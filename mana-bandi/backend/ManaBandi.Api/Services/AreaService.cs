using System.Globalization;
using ManaBandi.Api.Data;
using ManaBandi.Api.Infrastructure;
using ManaBandi.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace ManaBandi.Api.Services;

public class PlaceDto
{
    public double Lat { get; set; }
    public double Lng { get; set; }
    public string? Name { get; set; }
    public string? NameTe { get; set; }
    public string? LandmarkId { get; set; }
}

public record QuoteResult(Town Town, double DistanceKm, int Fare, bool Night);

/// <summary>Service-area checks, fare quotes and landmark naming.</summary>
public class AreaService
{
    public static readonly string[] Services = { "bike", "auto", "parcel" };
    public static readonly Dictionary<string, int> ParcelSizeBase = new() { ["s"] = 30, ["m"] = 50, ["l"] = 80 };
    public const double RoadFactor = 1.3;

    private readonly AppDbContext _db;
    private readonly IClock _clock;

    public AreaService(AppDbContext db, IClock clock)
    {
        _db = db;
        _clock = clock;
    }

    public Task<List<Town>> EnabledTownsAsync(CancellationToken ct = default) =>
        _db.Towns.AsNoTracking().Include(t => t.Landmarks).Where(t => t.Enabled).ToListAsync(ct);

    public static double DistanceFromCenter(Town t, double lat, double lng) => Geo.HaversineKm(t.CenterLat, t.CenterLng, lat, lng);

    /// <summary>The enabled town serving this pickup point, or throws 422 outside_area / no_town.</summary>
    public async Task<Town> TownForPickupAsync(double lat, double lng, CancellationToken ct = default)
    {
        var towns = await EnabledTownsAsync(ct);
        if (towns.Count == 0) throw new ApiException(422, "no_town", "No town is open for service yet");
        var t = towns
            .Select(t => (t, d: DistanceFromCenter(t, lat, lng)))
            .Where(x => x.d <= (x.t.EnforceRadius ? x.t.RadiusKm : x.t.ExtendedRadiusKm))
            .OrderBy(x => x.d)
            .Select(x => x.t)
            .FirstOrDefault();
        return t ?? throw new ApiException(422, "outside_area", "Pickup is outside the service area");
    }

    public static void CheckDrop(Town t, string service, double lat, double lng)
    {
        var limit = service == "parcel" ? t.ExtendedRadiusKm : t.RadiusKm * 1.5;
        if (!t.EnforceRadius) limit = Math.Max(limit, t.ExtendedRadiusKm * 2);
        if (DistanceFromCenter(t, lat, lng) > limit)
            throw new ApiException(422, "outside_area", service == "parcel" ? "Drop is beyond the parcel delivery area" : "Drop is outside the service area");
    }

    public static bool IsNight(Town t, DateTime utc)
    {
        static int Min(string hhmm, int fallback)
        {
            return TimeOnly.TryParseExact(hhmm, "HH:mm", CultureInfo.InvariantCulture, DateTimeStyles.None, out var x) ? x.Hour * 60 + x.Minute : fallback;
        }
        var ist = Ist.ToIst(utc);
        var m = ist.Hour * 60 + ist.Minute;
        var s = Min(t.NightStart, 22 * 60);
        var e = Min(t.NightEnd, 5 * 60);
        if (s == e) return false;
        return s < e ? m >= s && m < e : m >= s || m < e;
    }

    /// <summary>Fare = base + km × perKm (parcel: size price + perKm beyond 5 km), ≥ min, + night %, rounded to ₹5.</summary>
    public static int FareFor(Town t, string service, double km, string? parcelSize, bool night)
    {
        if (!t.Fares.TryGetValue(service, out var f)) throw ApiException.Validation($"No fare configured for {service} in {t.NameEn}");
        double fare = service == "parcel"
            ? ParcelSizeBase[parcelSize ?? "s"] + Math.Max(0, km - 5) * f.PerKm
            : f.Base + km * f.PerKm;
        fare = Math.Max(f.Min, fare);
        if (night) fare *= 1 + f.NightPct / 100.0;
        return Money.Round(fare / 5) * 5;
    }

    public static double QuoteKm(double pLat, double pLng, double dLat, double dLng) =>
        Geo.Round1(Math.Max(0.8, Geo.HaversineKm(pLat, pLng, dLat, dLng) * RoadFactor));

    public async Task<QuoteResult> QuoteAsync(string service, PlaceDto pickup, PlaceDto drop, string? parcelSize, CancellationToken ct = default)
    {
        ValidateService(service);
        ValidatePlace(pickup, "pickup");
        ValidatePlace(drop, "drop");
        if (service == "parcel")
        {
            parcelSize ??= "s";
            if (!ParcelSizeBase.ContainsKey(parcelSize)) throw ApiException.Validation("parcelSize must be s, m or l");
        }
        var town = await TownForPickupAsync(pickup.Lat, pickup.Lng, ct);
        CheckDrop(town, service, drop.Lat, drop.Lng);
        var km = QuoteKm(pickup.Lat, pickup.Lng, drop.Lat, drop.Lng);
        var night = IsNight(town, _clock.UtcNow);
        return new QuoteResult(town, km, FareFor(town, service, km, parcelSize, night), night);
    }

    public static void ValidateService(string? service)
    {
        if (service is null || !Services.Contains(service)) throw ApiException.Validation("service must be bike, auto or parcel");
    }

    public static void ValidatePlace(PlaceDto? p, string field)
    {
        if (p is null) throw ApiException.Validation($"{field} is required");
        if (!Geo.ValidLatLng(p.Lat, p.Lng)) throw ApiException.Validation($"{field} has invalid coordinates");
        if (p.Name?.Length > 120 || p.NameTe?.Length > 120 || p.LandmarkId?.Length > 40) throw ApiException.Validation($"{field} name is too long");
    }

    /// <summary>Names a coordinate after the nearest landmark within 300 m, else "GPS pin".</summary>
    public static PlaceDto NamePlace(Town? t, double lat, double lng)
    {
        var lm = t?.Landmarks.Select(l => (l, d: Geo.HaversineKm(l.Lat, l.Lng, lat, lng))).Where(x => x.d <= 0.3).OrderBy(x => x.d).Select(x => x.l).FirstOrDefault();
        return lm is null
            ? new PlaceDto { Lat = lat, Lng = lng, Name = "GPS pin", NameTe = "GPS పిన్" }
            : new PlaceDto { Lat = lat, Lng = lng, Name = lm.NameEn, NameTe = lm.NameTe, LandmarkId = lm.Id };
    }

    // ---------------------------------------------------------------- views

    public static object PublicTown(Town t) => new
    {
        id = t.Id,
        nameEn = t.NameEn,
        nameTe = t.NameTe,
        center = new { lat = t.CenterLat, lng = t.CenterLng },
        radiusKm = t.RadiusKm,
        extendedRadiusKm = t.ExtendedRadiusKm,
        supportPhone = t.SupportPhone,
        landmarks = t.Landmarks.OrderBy(l => l.SortOrder).Select(LandmarkView).ToList(),
    };

    public static object LandmarkView(Landmark l) => new { id = l.Id, kind = l.Kind, nameTe = l.NameTe, nameEn = l.NameEn, lat = l.Lat, lng = l.Lng };

    public static object FareView(Fare f) => new { @base = f.Base, perKm = f.PerKm, min = f.Min, nightPct = f.NightPct };

    public static object AdminTown(Town t) => new
    {
        id = t.Id,
        nameEn = t.NameEn,
        nameTe = t.NameTe,
        district = t.District,
        state = t.State,
        enabled = t.Enabled,
        center = new { lat = t.CenterLat, lng = t.CenterLng },
        radiusKm = t.RadiusKm,
        extendedRadiusKm = t.ExtendedRadiusKm,
        enforceRadius = t.EnforceRadius,
        nightStart = t.NightStart,
        nightEnd = t.NightEnd,
        supportPhone = t.SupportPhone,
        missedCallNo = t.MissedCallNo,
        launchedAt = t.LaunchedAt?.ToString("yyyy-MM-dd"),
        fares = t.Fares.ToDictionary(kv => kv.Key, kv => FareView(kv.Value)),
        landmarks = t.Landmarks.OrderBy(l => l.SortOrder).Select(LandmarkView).ToList(),
    };
}
