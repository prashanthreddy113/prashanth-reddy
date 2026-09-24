using System.Net;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;

namespace ManaBandi.Api.Tests;

public class RideLifecycleTests
{
    internal static async Task<JsonElement> WaitForOffer(HttpClient captain, (double lat, double lng) at, TimeSpan? timeout = null) =>
        await Http.WaitFor<JsonElement>(async () =>
        {
            var hb = await captain.PostJson("/api/captain/location", new { points = new[] { Nkd.Point(at.lat, at.lng) } }).Ok();
            return hb.GetProperty("offer").ValueKind == JsonValueKind.Object ? hb.GetProperty("offer") : null;
        }, timeout ?? TimeSpan.FromSeconds(6), "an offer in the heartbeat");

    [Fact]
    public async Task Full_ride_lifecycle_rider_and_captain_with_dispatch()
    {
        await using var app = TestApp.Create();
        var rider = await app.Rider("9848000010", "Lakshmi");
        // joined a year ago → outside the 3 free months → default 10 %
        var (captain, captainId) = await app.VerifiedCaptain("9000000101", "bike", DateOnly.FromDateTime(DateTime.UtcNow.AddYears(-1)), "Srinivas");

        var online = await captain.PostJson("/api/captain/online", new { online = true, lat = 18.0345, lng = 77.7570 }).Ok();
        Assert.True(online.GetProperty("online").GetBoolean());
        Assert.Equal("verified", online.Str("status"));
        Assert.Equal(10, online.GetProperty("commission").GetProperty("currentPct").GetDouble());

        var quote = await rider.PostJson("/api/rider/quote", new { service = "bike", pickup = Nkd.Place(Nkd.BusStand), drop = Nkd.Place(Nkd.FarDrop) }).Ok();
        Assert.Equal(2, quote.GetProperty("etaPickupMin").GetInt32());

        var ride = await rider.PostJson("/api/rides", new
        {
            clientId = Guid.NewGuid().ToString(), service = "bike", payment = "cash",
            pickup = new { lat = Nkd.BusStand.lat, lng = Nkd.BusStand.lng }, drop = new { lat = Nkd.FarDrop.lat, lng = Nkd.FarDrop.lng, name = "Farm house" },
        }).Ok(HttpStatusCode.Created);
        var rideId = ride.Str("id");
        Assert.Equal("searching", ride.Str("status"));
        Assert.Equal("RTC Bus stand", ride.GetProperty("pickup").Str("name")); // named from landmarks
        Assert.Equal("nkd_l1", ride.GetProperty("pickup").Str("landmarkId"));
        Assert.Equal(quote.GetProperty("fare").GetInt32(), ride.GetProperty("fareQuoted").GetInt32());
        Assert.Equal(JsonValueKind.Null, ride.GetProperty("otp").ValueKind);
        Assert.StartsWith("https://track.test/t/", ride.Str("trackUrl"));
        Assert.Equal(12, ride.Str("trackUrl").Split('/').Last().Length);
        Assert.Equal(rideId, (await rider.GetAsync("/api/rides/active").Ok()).Str("id"));

        // captain receives the offer through the heartbeat
        var offer = await WaitForOffer(captain, (18.0345, 77.7570));
        Assert.Equal(rideId, offer.Str("rideId"));
        Assert.Equal(ride.GetProperty("fareQuoted").GetInt32(), offer.GetProperty("fare").GetInt32());
        Assert.InRange(offer.GetProperty("secondsLeft").GetInt32(), 1, 2);
        Assert.InRange(offer.GetProperty("distanceToPickupKm").GetDouble(), 0, 0.3);

        // illegal transition before accepting
        await captain.PostJson("/api/captain/trip/arrived").Problem(404, "not_found");

        var trip = await captain.PostJson($"/api/captain/offers/{offer.Str("id")}/accept").Ok();
        Assert.Equal("accepted", trip.Str("status"));
        Assert.Equal("Lakshmi", trip.GetProperty("rider").Str("name"));
        Assert.Equal("+919848000010", trip.GetProperty("rider").Str("phone"));
        Assert.Equal(10, trip.GetProperty("commission").GetProperty("pct").GetDouble());

        var seen = await rider.GetAsync($"/api/rides/{rideId}").Ok();
        Assert.Equal("accepted", seen.Str("status"));
        var cap = seen.GetProperty("captain");
        Assert.Equal("Srinivas", cap.Str("name"));
        Assert.Equal("+919000000101", cap.Str("phone"));
        Assert.Equal("TS 15 T 0101", cap.Str("vehicleNo"));
        Assert.Equal(JsonValueKind.Object, cap.GetProperty("location").ValueKind);
        var otp = seen.Str("otp");
        Assert.Matches("^[0-9]{4}$", otp);

        // start before arrival is illegal
        await captain.PostJson("/api/captain/trip/start", new { otp }).Problem(422, "invalid_state");

        // drive to pickup: the rider sees the captain move
        var before = cap.GetProperty("location").GetProperty("lat").GetDouble();
        await captain.PostJson("/api/captain/location", new { points = new[] { Nkd.Point(18.0341, 77.7566), Nkd.Point(18.0339, 77.7563) } }).Ok();
        var moved = (await rider.GetAsync($"/api/rides/{rideId}").Ok()).GetProperty("captain").GetProperty("location").GetProperty("lat").GetDouble();
        Assert.NotEqual(before, moved);
        Assert.Equal(18.0339, moved, 4);

        Assert.Equal("arrived", (await captain.PostJson("/api/captain/trip/arrived").Ok()).Str("status"));
        await captain.PostJson("/api/captain/trip/arrived").Problem(422, "invalid_state");
        var wrongOtp = otp == "0000" ? "1111" : "0000";
        await captain.PostJson("/api/captain/trip/start", new { otp = wrongOtp }).Problem(422, "wrong_ride_otp");
        Assert.Equal("started", (await captain.PostJson("/api/captain/trip/start", new { otp }).Ok()).Str("status"));
        await captain.PostJson("/api/captain/trip/deliver", new { deliveryOtp = "1234" }).Problem(422, "invalid_state"); // not a parcel
        await rider.PostJson($"/api/rides/{rideId}/cancel", new { reason = "late" }).Problem(422, "invalid_state");

        // drive to the drop along a road-ish path
        // 11 points pickup → drop weaving ~70 m either side of the straight line
        var path = Enumerable.Range(0, 11).Select(i =>
        {
            var f = i / 10.0;
            var side = i is 0 or 10 ? 0 : i % 2 == 0 ? 1 : -1;
            return Nkd.Point(Nkd.BusStand.lat + (Nkd.FarDrop.lat - Nkd.BusStand.lat) * f - side * 0.00037,
                             Nkd.BusStand.lng + (Nkd.FarDrop.lng - Nkd.BusStand.lng) * f + side * 0.00054);
        }).ToArray();
        await captain.PostJson("/api/captain/location", new { points = path }).Ok();

        var finished = await captain.PostJson("/api/captain/trip/finish", new { lat = Nkd.FarDrop.lat, lng = Nkd.FarDrop.lng }).Ok();
        Assert.Equal("finished", finished.Str("status"));
        var fareFinal = finished.GetProperty("fareFinal").GetInt32();
        // GPS trail (≈2.8 km weave) is longer than the straight line (2.5 km) and shorter than 2× → trail fare, below the 1.3× quote
        var gpsKm = finished.GetProperty("tripKm").GetDouble();
        Assert.InRange(gpsKm, 2.55, 5.0);
        var km1 = Math.Round(gpsKm, 1, MidpointRounding.AwayFromZero);
        var raw = Math.Max(20, 20 + km1 * 8) * (riderNight(ride) ? 1.2 : 1);
        Assert.Equal((int)Math.Floor(raw / 5 + 0.5) * 5, fareFinal);
        Assert.True(fareFinal <= ride.GetProperty("fareQuoted").GetInt32());
        var commission = finished.GetProperty("commission");
        Assert.Equal(10, commission.GetProperty("pct").GetDouble());
        Assert.Equal((int)Math.Floor(fareFinal * 0.1 + 0.5), commission.GetProperty("amount").GetInt32());
        Assert.Equal(fareFinal - commission.GetProperty("amount").GetInt32(), commission.GetProperty("captainGets").GetInt32());
        Assert.Equal(JsonValueKind.Null, finished.GetProperty("rider").GetProperty("phone").ValueKind); // phones only while active

        var riderView = await rider.GetAsync($"/api/rides/{rideId}").Ok();
        Assert.Equal("finished", riderView.Str("status"));
        Assert.Equal(fareFinal, riderView.GetProperty("fareFinal").GetInt32());
        Assert.Equal(JsonValueKind.Null, riderView.GetProperty("captain").GetProperty("location").ValueKind);
        Assert.Equal(JsonValueKind.Null, riderView.GetProperty("captain").GetProperty("phone").ValueKind);
        var events = riderView.GetProperty("events").EnumerateArray().Select(e => e.Str("type")).ToList();
        Assert.Equal(new[] { "requested", "accepted", "arrived", "started", "finished" }, events);

        // still the captain's trip until collected
        Assert.Equal(rideId, (await captain.GetAsync("/api/captain/trip").Ok()).Str("rideId"));
        await captain.PostJson("/api/captain/trip/collected", new { method = "cheque" }).Problem(422, "validation");
        var collected = await captain.PostJson("/api/captain/trip/collected", new { method = "cash" }).Ok();
        Assert.True(collected.GetProperty("ok").GetBoolean());
        Assert.Equal(1, collected.GetProperty("tripsToday").GetInt32());
        Assert.Equal(commission.GetProperty("captainGets").GetInt32(), collected.GetProperty("earningsToday").GetInt32());
        Assert.Equal(HttpStatusCode.NoContent, (await captain.GetAsync("/api/captain/trip")).StatusCode);
        await captain.PostJson("/api/captain/trip/collected", new { method = "cash" }).Problem(404, "not_found");

        var earnings = await captain.GetAsync("/api/captain/earnings").Ok();
        var today = earnings.GetProperty("today");
        Assert.Equal(fareFinal, today.GetProperty("gross").GetInt32());
        Assert.Equal(commission.GetProperty("amount").GetInt32(), today.GetProperty("commission").GetInt32());
        Assert.Equal(commission.GetProperty("captainGets").GetInt32(), today.GetProperty("net").GetInt32());
        Assert.Equal(1, today.GetProperty("trips").GetInt32());
        Assert.Equal(1, earnings.GetProperty("week").GetProperty("trips").GetInt32());
        // cash trip: captain holds the cash and owes the commission → payout is negative
        Assert.Equal(-commission.GetProperty("amount").GetInt32(), earnings.GetProperty("settlementDue").GetInt32());
        var t = earnings.GetProperty("trips")[0];
        Assert.Equal(rideId, t.Str("rideId"));
        Assert.Equal("Farm house", t.Str("dropName"));

        // rating updates the captain
        await rider.PostJson($"/api/rides/{rideId}/rate", new { stars = 6 }).Problem(422, "validation");
        await rider.PostJson($"/api/rides/{rideId}/rate", new { stars = 5, tip = 10 }).Ok();
        await rider.PostJson($"/api/rides/{rideId}/rate", new { stars = 4 }).Problem(422, "invalid_state");
        Assert.Equal(5.0, await app.WithDb(db => db.Captains.Where(c => c.Id == captainId).Select(c => c.Rating!.Value).SingleAsync()));

        var history = await rider.GetAsync("/api/rides?mine=1&limit=20").Ok();
        Assert.Equal(1, history.GetArrayLength());
        Assert.Equal(HttpStatusCode.NoContent, (await rider.GetAsync("/api/rides/active")).StatusCode);

        // location points were stored against the ride
        var points = await app.WithDb(db => db.LocationPoints.CountAsync(p => p.RideId == rideId));
        Assert.True(points >= 12, $"points stored: {points}");

        // another rider cannot see this ride
        var other = await app.Rider("9848000011");
        await other.GetAsync($"/api/rides/{rideId}").Problem(404, "not_found");
        await other.PostJson($"/api/rides/{rideId}/cancel", new { reason = "x" }).Problem(404, "not_found");
    }

    private static bool riderNight(JsonElement ride) => ride.GetProperty("night").GetBoolean();

    [Fact]
    public async Task Parcel_lifecycle_with_delivery_otp()
    {
        await using var app = TestApp.Create();
        var sender = await app.Rider("9848000020", "Sri Lakshmi Kirana");
        var (captain, _) = await app.VerifiedCaptain("9000000201", "bike");
        await captain.PostJson("/api/captain/online", new { online = true, lat = 18.0335, lng = 77.7560 }).Ok();

        var created = await sender.PostJson("/api/rides", new
        {
            clientId = Guid.NewGuid().ToString(), service = "parcel", payment = "cash",
            pickup = Nkd.Place(Nkd.BusStand), drop = Nkd.Place(Nkd.FarDrop, "Colony"),
            parcel = new { receiverName = "Padma", receiverPhone = "7093012345", size = "m", payer = "receiver", codAmount = 500 },
        }).Ok(HttpStatusCode.Created);
        var p = created.GetProperty("parcel");
        Assert.Equal("m", p.Str("size"));
        Assert.Equal("+917093012345", p.Str("receiverPhone"));
        var deliveryOtp = p.Str("deliveryOtp");
        Assert.Matches("^[0-9]{4}$", deliveryOtp);

        var offer = await WaitForOffer(captain, (18.0335, 77.7560));
        Assert.Equal("parcel", offer.Str("service"));
        var trip = await captain.PostJson($"/api/captain/offers/{offer.Str("id")}/accept").Ok();
        Assert.Equal("Padma", trip.GetProperty("parcel").Str("receiverName"));
        Assert.Equal(500, trip.GetProperty("parcel").GetProperty("codAmount").GetInt32());

        var pickupOtp = (await sender.GetAsync($"/api/rides/{created.Str("id")}").Ok()).Str("otp");
        await captain.PostJson("/api/captain/trip/arrived").Ok();
        await captain.PostJson("/api/captain/trip/start", new { otp = pickupOtp }).Ok();
        await captain.PostJson("/api/captain/trip/finish", new { lat = Nkd.FarDrop.lat, lng = Nkd.FarDrop.lng }).Problem(422, "invalid_state");
        var wrong = deliveryOtp == "0000" ? "1111" : "0000";
        await captain.PostJson("/api/captain/trip/deliver", new { deliveryOtp = wrong }).Problem(422, "wrong_ride_otp");
        var delivered = await captain.PostJson("/api/captain/trip/deliver", new { deliveryOtp }).Ok();
        Assert.True(delivered.GetProperty("parcel").GetProperty("delivered").GetBoolean());
        await captain.PostJson("/api/captain/trip/deliver", new { deliveryOtp }).Problem(422, "invalid_state");
        var fin = await captain.PostJson("/api/captain/trip/finish", new { lat = Nkd.FarDrop.lat, lng = Nkd.FarDrop.lng }).Ok();
        Assert.Equal("finished", fin.Str("status"));
        Assert.Equal(0, fin.GetProperty("commission").GetProperty("pct").GetDouble()); // joined today → free months
        await captain.PostJson("/api/captain/trip/collected", new { method = "upi" }).Ok();

        var owner = await app.Owner();
        var parcels = await owner.GetAsync("/api/parcels?town=all").Ok();
        Assert.Equal(1, parcels.GetArrayLength());
        var row = parcels[0];
        Assert.Equal("parcel", row.Str("kind"));
        Assert.Equal("finished", row.Str("status"));
        Assert.True(row.GetProperty("codCollected").GetBoolean());
        Assert.True(row.GetProperty("deliveryOtpVerified").GetBoolean());
        Assert.Equal("Padma", row.GetProperty("receiver").Str("name"));
        Assert.Equal("upi", row.Str("payment"));
        Assert.Equal(0, (await owner.GetAsync("/api/rides").Ok()).GetArrayLength()); // rides list excludes parcels
        var events = row.GetProperty("events").EnumerateArray().Select(e => e.Str("type")).ToList();
        Assert.Contains("delivered", events);
    }
}
