using System.Net;
using System.Text.Json;
using ManaBandi.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace ManaBandi.Api.Tests;

public class PublicTrackTests
{
    [Fact]
    public async Task Track_page_and_json_without_phone_numbers_and_expiry()
    {
        await using var app = TestApp.Create();
        var rider = await app.Rider("9848000600", "Swathi");
        var (captain, _) = await app.VerifiedCaptain("9000000601", name: "Mahesh");
        await captain.PostJson("/api/captain/online", new { online = true, lat = 18.034, lng = 77.757 }).Ok();
        var ride = await rider.PostJson("/api/rides", new
        {
            clientId = Guid.NewGuid().ToString(), service = "bike", payment = "upi", pickup = Nkd.Place(Nkd.BusStand), drop = Nkd.Place(Nkd.Hospital),
        }).Ok(HttpStatusCode.Created);
        var token = ride.Str("trackUrl").Split('/').Last();
        Assert.Matches("^[A-Za-z0-9]{12}$", token);

        var anon = app.Anonymous();
        var page = await anon.GetAsync($"/t/{token}");
        Assert.Equal(HttpStatusCode.OK, page.StatusCode);
        Assert.Equal("text/html", page.Content.Headers.ContentType?.MediaType);
        var html = await page.Content.ReadAsStringAsync();
        Assert.Contains("మన బండి", html);
        Assert.Contains("cdnjs.cloudflare.com/ajax/libs/leaflet", html);
        Assert.Contains("/api/public/track/", html);
        Assert.Contains("5000", html);

        var searching = await anon.GetAsync($"/api/public/track/{token}").Ok();
        Assert.Equal("searching", searching.Str("status"));
        Assert.Equal(JsonValueKind.Null, searching.GetProperty("captain").ValueKind);

        var offer = await RideLifecycleTests.WaitForOffer(captain, (18.034, 77.757));
        await captain.PostJson($"/api/captain/offers/{offer.Str("id")}/accept").Ok();
        var raw = await (await anon.GetAsync($"/api/public/track/{token}")).Content.ReadAsStringAsync();
        var live = JsonDocument.Parse(raw).RootElement;
        Assert.Equal("accepted", live.Str("status"));
        Assert.Equal("Mahesh", live.GetProperty("captain").Str("name"));
        Assert.Equal(JsonValueKind.Object, live.GetProperty("captain").GetProperty("location").ValueKind);
        Assert.DoesNotContain("+91", raw);
        Assert.DoesNotContain("9000000601", raw);
        Assert.DoesNotContain("9848000600", raw);
        Assert.False(live.TryGetProperty("otp", out _));

        await anon.GetAsync("/api/public/track/AAAAAAAAAAAA").Problem(404, "not_found");
        await anon.GetAsync("/api/public/track/short").Problem(404, "not_found");

        // expires 2 h after the ride ends
        await app.WithDb(async db =>
        {
            var r = await db.Rides.SingleAsync(x => x.TrackToken == token);
            r.Status = RideStatus.Cancelled;
            r.EndedAt = DateTime.UtcNow.AddHours(-2).AddMinutes(-1);
            await db.SaveChangesAsync();
        });
        await anon.GetAsync($"/api/public/track/{token}").Problem(404, "not_found");
    }
}
