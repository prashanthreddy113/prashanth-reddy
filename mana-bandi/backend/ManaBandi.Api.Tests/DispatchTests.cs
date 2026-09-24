using System.Net;
using System.Text.Json;
using ManaBandi.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace ManaBandi.Api.Tests;

public class DispatchTests
{
    private static object RideBody(string service = "bike") => new
    {
        clientId = Guid.NewGuid().ToString(), service, payment = "cash",
        pickup = Nkd.Place(Nkd.BusStand), drop = Nkd.Place(Nkd.FarDrop),
    };

    [Fact]
    public async Task Two_parallel_accepts_give_one_200_and_one_409()
    {
        // dispatcher off: the test hands out two live offers for the same ride itself
        await using var app = TestApp.Create(new() { ["Dispatch:Enabled"] = "false" });
        var (a, aId) = await app.VerifiedCaptain("9000000301");
        var (b, bId) = await app.VerifiedCaptain("9000000302");
        await a.PostJson("/api/captain/online", new { online = true, lat = 18.034, lng = 77.756 }).Ok();
        await b.PostJson("/api/captain/online", new { online = true, lat = 18.035, lng = 77.757 }).Ok();

        for (var round = 0; round < 3; round++)
        {
            var rider = await app.Rider($"98480003{round:00}");
            var ride = await rider.PostJson("/api/rides", RideBody()).Ok(HttpStatusCode.Created);
            var rideId = ride.Str("id");
            var (oa, ob) = ($"o_race_a_{round}", $"o_race_b_{round}");
            await app.WithDb(async db =>
            {
                var now = DateTime.UtcNow;
                db.Offers.Add(new Offer { Id = oa, RideId = rideId, CaptainId = aId, CreatedAt = now, ExpiresAt = now.AddSeconds(30), Status = OfferStatus.Pending });
                db.Offers.Add(new Offer { Id = ob, RideId = rideId, CaptainId = bId, CreatedAt = now, ExpiresAt = now.AddSeconds(30), Status = OfferStatus.Pending });
                await db.SaveChangesAsync();
            });

            var results = await Task.WhenAll(a.PostAsync($"/api/captain/offers/{oa}/accept", null), b.PostAsync($"/api/captain/offers/{ob}/accept", null));
            var codes = results.Select(r => (int)r.StatusCode).OrderBy(x => x).ToArray();
            Assert.Equal(new[] { 200, 409 }, codes);
            var loser = results.Single(r => r.StatusCode == HttpStatusCode.Conflict);
            Assert.Equal("offer_taken", (await loser.Json()).Str("code"));

            var winner = results[0].StatusCode == HttpStatusCode.OK ? aId : bId;
            var stored = await app.WithDb(db => db.Rides.AsNoTracking().SingleAsync(r => r.Id == rideId));
            Assert.Equal("accepted", stored.Status);
            Assert.Equal(winner, stored.CaptainId);

            // free the winner for the next round
            var winClient = winner == aId ? a : b;
            await winClient.PostJson("/api/captain/trip/cancel", new { reason = "test" }).Ok();
            await rider.PostJson($"/api/rides/{rideId}/cancel", new { reason = "test" }).Ok();
        }
    }

    [Fact]
    public async Task Offer_expiry_moves_to_next_captain_and_rejections_too()
    {
        await using var app = TestApp.Create(new() { ["Dispatch:MaxSearchSeconds"] = "20" });
        var (near, nearId) = await app.VerifiedCaptain("9000000401");
        var (far, farId) = await app.VerifiedCaptain("9000000402");
        var (farther, _) = await app.VerifiedCaptain("9000000403");
        var (autoCaptain, _) = await app.VerifiedCaptain("9000000404", "auto");
        await near.PostJson("/api/captain/online", new { online = true, lat = 18.0340, lng = 77.7563 }).Ok();     // ~30 m
        await far.PostJson("/api/captain/online", new { online = true, lat = 18.0400, lng = 77.7600 }).Ok();      // ~0.8 km
        await farther.PostJson("/api/captain/online", new { online = true, lat = 18.0600, lng = 77.7562 }).Ok();  // ~2.9 km
        await autoCaptain.PostJson("/api/captain/online", new { online = true, lat = 18.0338, lng = 77.7562 }).Ok(); // wrong vehicle

        var rider = await app.Rider("9848000400");
        var ride = await rider.PostJson("/api/rides", RideBody()).Ok(HttpStatusCode.Created);

        // nearest bike captain first; the auto captain never gets a bike ride
        var first = await RideLifecycleTests.WaitForOffer(near, (18.0340, 77.7563));
        Assert.Equal(ride.Str("id"), first.Str("rideId"));
        var autoHb = await autoCaptain.PostJson("/api/captain/location", new { points = new[] { Nkd.Point(18.0338, 77.7562) } }).Ok();
        Assert.Equal(JsonValueKind.Null, autoHb.GetProperty("offer").ValueKind);

        // nearest ignores it → after 2 s the next nearest gets the same ride
        var second = await RideLifecycleTests.WaitForOffer(far, (18.0400, 77.7600));
        Assert.Equal(ride.Str("id"), second.Str("rideId"));
        await near.PostJson($"/api/captain/offers/{first.Str("id")}/accept").Problem(409, "offer_expired");

        // the second captain rejects → third captain is offered
        await far.PostJson($"/api/captain/offers/{second.Str("id")}/reject").Ok();
        var third = await RideLifecycleTests.WaitForOffer(farther, (18.0600, 77.7562));
        Assert.Equal(ride.Str("id"), third.Str("rideId"));
        await farther.PostJson($"/api/captain/offers/{third.Str("id")}/accept").Ok();
        await near.PostJson($"/api/captain/offers/{first.Str("id")}/accept").Problem(409, "offer_taken");

        var offers = await app.WithDb(db => db.Offers.Where(o => o.RideId == ride.Str("id")).OrderBy(o => o.CreatedAt).Select(o => new { o.CaptainId, o.Status }).ToListAsync());
        Assert.Equal(3, offers.Count);
        Assert.Equal(nearId, offers[0].CaptainId);
        Assert.Equal("expired", offers[0].Status);
        Assert.Equal(farId, offers[1].CaptainId);
        Assert.Equal("rejected", offers[1].Status);
        Assert.Equal("accepted", offers[2].Status);

        // captain cancels after accepting → ride goes back to searching and is re-offered to someone new (the auto can't take it; near/far already tried)
        await farther.PostJson("/api/captain/trip/cancel", new { reason = "puncture" }).Ok();
        var again = await rider.GetAsync($"/api/rides/{ride.Str("id")}").Ok();
        Assert.Equal("searching", again.Str("status"));
        Assert.Equal(JsonValueKind.Null, again.GetProperty("captain").ValueKind);
        var (fresh, _) = await app.VerifiedCaptain("9000000405");
        await fresh.PostJson("/api/captain/online", new { online = true, lat = 18.0345, lng = 77.7565 }).Ok();
        var redispatched = await RideLifecycleTests.WaitForOffer(fresh, (18.0345, 77.7565));
        Assert.Equal(ride.Str("id"), redispatched.Str("rideId"));
    }

    [Fact]
    public async Task No_captain_after_max_search_time()
    {
        await using var app = TestApp.Create(new() { ["Dispatch:MaxSearchSeconds"] = "2" });
        var rider = await app.Rider("9848000500");
        var ride = await rider.PostJson("/api/rides", RideBody("auto")).Ok(HttpStatusCode.Created);
        var status = await Http.WaitFor<JsonElement>(async () =>
        {
            var r = await rider.GetAsync($"/api/rides/{ride.Str("id")}").Ok();
            return r.Str("status") == "no_captain" ? r : null;
        }, TimeSpan.FromSeconds(8), "no_captain");
        Assert.Contains(status.GetProperty("events").EnumerateArray(), e => e.Str("type") == "no_captain");
        Assert.Equal(HttpStatusCode.NoContent, (await rider.GetAsync("/api/rides/active")).StatusCode);

        var owner = await app.Owner();
        var dash = await owner.GetAsync("/api/admin/dashboard").Ok();
        var unfulfilled = dash.GetProperty("attention").GetProperty("unfulfilled");
        Assert.Equal(1, unfulfilled.GetArrayLength());
        Assert.Equal("unfulfilled", unfulfilled[0].Str("status"));
        await rider.PostJson($"/api/rides/{ride.Str("id")}/cancel", new { reason = "x" }).Problem(422, "invalid_state");
    }
}
