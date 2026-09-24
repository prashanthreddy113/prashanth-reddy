using System.Net;

namespace ManaBandi.Api.Tests;

public class QuoteTests
{
    private static int Expected(double km, int @base, double perKm, int min, bool night, int nightPct = 20)
    {
        var fare = Math.Max(min, @base + km * perKm);
        if (night) fare *= 1 + nightPct / 100.0;
        return (int)Math.Floor(fare / 5 + 0.5) * 5;
    }

    [Fact]
    public async Task Quote_inside_area_and_outside_area_rejection()
    {
        await using var app = TestApp.Create();
        var rider = await app.Rider("9848000002");

        var q = await rider.PostJson("/api/rider/quote", new { service = "bike", pickup = Nkd.Place(Nkd.BusStand), drop = Nkd.Place(Nkd.FarDrop) }).Ok();
        Assert.Equal("nkd", q.Str("townId"));
        var km = q.GetProperty("distanceKm").GetDouble();
        Assert.InRange(km, 3.0, 4.0); // ~2.6 km straight × 1.3
        var night = q.GetProperty("night").GetBoolean();
        Assert.Equal(Expected(km, 20, 8, 20, night), q.GetProperty("fare").GetInt32());
        Assert.Equal(JsonValueKindNull(), q.GetProperty("etaPickupMin").ValueKind); // nobody online

        var auto = await rider.PostJson("/api/rider/quote", new { service = "auto", pickup = Nkd.Place(Nkd.BusStand), drop = Nkd.Place(Nkd.FarDrop) }).Ok();
        Assert.Equal(Expected(km, 30, 12, 30, night), auto.GetProperty("fare").GetInt32());

        // parcel: size price + perKm beyond 5 km; short trip → size price (night % on top)
        var parcel = await rider.PostJson("/api/rider/quote", new { service = "parcel", parcelSize = "m", pickup = Nkd.Place(Nkd.BusStand), drop = Nkd.Place(Nkd.Hospital) }).Ok();
        Assert.Equal(Expected(0, 50, 0, 30, parcel.GetProperty("night").GetBoolean()), parcel.GetProperty("fare").GetInt32());

        await rider.PostJson("/api/rider/quote", new { service = "bike", pickup = Nkd.Place(Nkd.Hyderabad), drop = Nkd.Place(Nkd.BusStand) }).Problem(422, "outside_area");
        // ride drops may go to radius × 1.5 (18 km); 30 km away is rejected, but a parcel may go to 25 km
        var drop22km = (18.2310, 77.7550);
        await rider.PostJson("/api/rider/quote", new { service = "bike", pickup = Nkd.Place(Nkd.BusStand), drop = Nkd.Place(drop22km) }).Problem(422, "outside_area");
        await rider.PostJson("/api/rider/quote", new { service = "parcel", parcelSize = "s", pickup = Nkd.Place(Nkd.BusStand), drop = Nkd.Place(drop22km) }).Ok();
        await rider.PostJson("/api/rider/quote", new { service = "boat", pickup = Nkd.Place(Nkd.BusStand), drop = Nkd.Place(Nkd.FarDrop) }).Problem(422, "validation");

        // booking outside the area is refused too
        await rider.PostJson("/api/rides", new { clientId = Guid.NewGuid().ToString(), service = "bike", pickup = Nkd.Place(Nkd.Hyderabad), drop = Nkd.Place(Nkd.BusStand), payment = "cash" })
            .Problem(422, "outside_area");

        var nearest = await rider.GetAsync($"/api/rider/towns/nearest?lat={Nkd.BusStand.lat}&lng={Nkd.BusStand.lng}").Ok();
        Assert.True(nearest.GetProperty("inside").GetBoolean());
        Assert.Equal("nkd", nearest.GetProperty("town").Str("id"));
        Assert.Equal(7, nearest.GetProperty("town").GetProperty("landmarks").GetArrayLength());
        Assert.Equal("nkd_l1", nearest.GetProperty("place").Str("landmarkId"));
    }

    private static System.Text.Json.JsonValueKind JsonValueKindNull() => System.Text.Json.JsonValueKind.Null;
}
