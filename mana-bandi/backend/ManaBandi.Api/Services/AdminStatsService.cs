using System.Globalization;
using ManaBandi.Api.Data;
using ManaBandi.Api.Infrastructure;
using ManaBandi.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace ManaBandi.Api.Services;

/// <summary>Dashboard and analytics for the owner portal, computed from real rides (same shapes as owner-web mock).</summary>
public class AdminStatsService
{
    private readonly AppDbContext _db;
    private readonly IClock _clock;
    private readonly AccountService _accounts;

    public AdminStatsService(AppDbContext db, IClock clock, AccountService accounts)
    {
        _db = db;
        _clock = clock;
        _accounts = accounts;
    }

    private record Row(string Id, string RiderId, string? CaptainId, string TownId, string Service, string Status, DateTime CreatedAt,
        DateTime? ArrivedAt, int? FareFinal, int? Commission, int? Rating, string PickupName, string? PickupNameTe, string DropName, string? DropNameTe,
        int CodAmount, bool CodCollected)
    {
        public bool IsParcel => Service == "parcel";
        public DateOnly Day => Ist.DateOf(CreatedAt);
        public int Hour => Ist.ToIst(CreatedAt).Hour;
        public double? PickupMinutes => ArrivedAt is { } a && Status is RideStatus.Started or RideStatus.Finished ? Math.Round((a - CreatedAt).TotalMinutes, 1) : null;
    }

    private async Task<List<Row>> RowsAsync(string? townId, DateTime fromUtc, CancellationToken ct)
    {
        var q = _db.Rides.AsNoTracking().Where(r => r.CreatedAt >= fromUtc);
        if (townId != null) q = q.Where(r => r.TownId == townId);
        return await q.Select(r => new Row(r.Id, r.RiderId, r.CaptainId, r.TownId, r.Service, r.Status, r.CreatedAt, r.ArrivedAt, r.FareFinal,
            r.CommissionAmount, r.Rating, r.PickupName, r.PickupNameTe, r.DropName, r.DropNameTe, r.CodAmount, r.CodCollected)).ToListAsync(ct);
    }

    private class LmCount
    {
        public LmCount(string name, string? nameTe) { Name = name; NameTe = nameTe; }
        public string Name { get; }
        public string? NameTe { get; }
        public int Pickups { get; set; }
        public int Drops { get; set; }
    }

    private static double Median(IEnumerable<double> xs)
    {
        var s = xs.OrderBy(x => x).ToList();
        if (s.Count == 0) return 0;
        var m = s.Count / 2;
        return s.Count % 2 == 1 ? s[m] : (s[m - 1] + s[m]) / 2;
    }

    private static string Label(DateOnly d) => d.ToString("dd MMM", CultureInfo.InvariantCulture);

    private async Task<List<Dictionary<string, object?>>> AdminRidesAsync(IEnumerable<string> ids, CancellationToken ct)
    {
        var list = ids.ToList();
        if (list.Count == 0) return new();
        var rides = await _db.Rides.AsNoTracking().Include(r => r.Rider).Include(r => r.Events).Where(r => list.Contains(r.Id))
            .OrderByDescending(r => r.CreatedAt).ToListAsync(ct);
        return rides.Select(Views.ForAdmin).ToList();
    }

    private async Task<List<Dictionary<string, object?>>> AdminCaptainsAsync(IQueryable<Captain> q, CancellationToken ct)
    {
        var caps = await q.AsNoTracking().Include(c => c.User).Include(c => c.Kyc).Include(c => c.Documents).Take(200).ToListAsync(ct);
        var stats = await _accounts.StatsAsync(caps.Select(c => c.Id), ct);
        return caps.Select(c => Views.ForAdmin(c, stats[c.Id])).ToList();
    }

    public async Task<object> DashboardAsync(string? townId, CancellationToken ct = default)
    {
        var today = Ist.Today(_clock);
        var from = today.AddDays(-13);
        var all = await RowsAsync(townId, Ist.StartUtc(from), ct);
        var todayRows = all.Where(x => x.Day == today).ToList();
        var finished = todayRows.Where(x => x.Status == RideStatus.Finished).ToList();
        var requested = todayRows.Where(x => x.Status != RideStatus.Searching).ToList();
        var accepted = requested.Count(x => x.CaptainId != null);
        var capsQ = _db.Captains.AsNoTracking().AsQueryable();
        if (townId != null) capsQ = capsQ.Where(c => c.TownId == townId);
        var online = await capsQ.CountAsync(c => c.Online, ct);
        var verified = await capsQ.CountAsync(c => c.Status == CaptainStatus.Verified, ct);
        var ratings = finished.Where(x => x.Rating != null).Select(x => (double)x.Rating!).ToList();

        var kpis = new
        {
            ridesToday = todayRows.Count(x => !x.IsParcel),
            parcelsToday = todayRows.Count(x => x.IsParcel),
            grossToday = finished.Sum(x => x.FareFinal ?? 0),
            revenueToday = finished.Sum(x => x.Commission ?? 0),
            captainsOnline = online,
            captainsTotal = verified,
            fulfilment = requested.Count > 0 ? accepted * 100.0 / requested.Count : 0,
            medianPickup = Median(todayRows.Where(x => x.PickupMinutes != null).Select(x => x.PickupMinutes!.Value)),
            cancellations = requested.Count > 0 ? todayRows.Count(x => x.Status == RideStatus.Cancelled) * 100.0 / requested.Count : 0,
            avgRating = ratings.Count > 0 ? ratings.Average() : 0,
        };
        var series14d = Enumerable.Range(0, 14).Select(i =>
        {
            var d = from.AddDays(i);
            var rows = all.Where(x => x.Day == d).ToList();
            return new { day = d.ToString("yyyy-MM-dd"), label = Label(d), rides = rows.Count(x => !x.IsParcel), parcels = rows.Count(x => x.IsParcel) };
        }).ToList();
        var byHourToday = Enumerable.Range(0, 24).Select(h => new
        {
            hour = h,
            label = $"{h}:00",
            rides = todayRows.Count(x => x.Hour == h && !x.IsParcel),
            parcels = todayRows.Count(x => x.Hour == h && x.IsParcel),
        }).ToList();

        var sosQ = _db.SosEvents.AsNoTracking().Where(s => !s.Resolved);
        if (townId != null) sosQ = sosQ.Where(s => s.TownId == townId);
        var sos = await sosQ.OrderByDescending(s => s.At).Take(50)
            .Select(s => new { id = s.Id, at = s.At, rideId = s.RideId, townId = s.TownId, by = s.By, resolved = s.Resolved, lat = s.Lat, lng = s.Lng }).ToListAsync(ct);
        var longAgo = _clock.UtcNow.AddSeconds(-90);
        var attention = new
        {
            pendingCaptains = await AdminCaptainsAsync(capsQ.Where(c => c.Status == CaptainStatus.Pending).OrderBy(c => c.CreatedAt), ct),
            sos,
            unfulfilled = await AdminRidesAsync(todayRows.Where(x => x.Status == RideStatus.NoCaptain).Select(x => x.Id), ct),
            lowRated = await AdminCaptainsAsync(capsQ.Where(c => c.Status == CaptainStatus.Verified && c.Rating != null && c.Rating < 4.2), ct),
            searchingLong = await AdminRidesAsync(todayRows.Where(x => x.Status == RideStatus.Searching && x.CreatedAt < longAgo).Select(x => x.Id), ct),
        };
        return new { kpis, series14d, byHourToday, attention };
    }

    public async Task<object> AnalyticsAsync(string? townId, int days, CancellationToken ct = default)
    {
        days = Math.Clamp(days, 1, 366);
        var today = Ist.Today(_clock);
        var from = today.AddDays(-(days - 1));
        var window = await RowsAsync(townId, Ist.StartUtc(from), ct);

        var perDay = Enumerable.Range(0, days).Select(i =>
        {
            var d = from.AddDays(i);
            var rows = window.Where(x => x.Day == d).ToList();
            var req = rows.Where(x => x.Status != RideStatus.Searching).ToList();
            return new
            {
                day = d.ToString("yyyy-MM-dd"),
                label = Label(d),
                rides = rows.Count(x => !x.IsParcel),
                parcels = rows.Count(x => x.IsParcel),
                revenue = rows.Where(x => x.Status == RideStatus.Finished).Sum(x => x.FareFinal ?? 0),
                fulfilment = req.Count > 0 ? (int?)Math.Round(req.Count(x => x.CaptainId != null) * 100.0 / req.Count, MidpointRounding.AwayFromZero) : null,
                medianPickup = Math.Round(Median(rows.Where(x => x.PickupMinutes != null).Select(x => x.PickupMinutes!.Value)), 1),
            };
        }).ToList();

        var fin = window.Where(x => x.Status == RideStatus.Finished).ToList();
        var byService = AreaService.Services.Select(s => new { service = s, count = window.Count(x => x.Service == s), revenue = fin.Where(x => x.Service == s).Sum(x => x.FareFinal ?? 0) }).ToList();
        var towns = await _db.Towns.AsNoTracking().OrderBy(t => t.CreatedAt).Select(t => new { t.Id, t.NameEn }).ToListAsync(ct);
        if (townId != null) towns = towns.Where(t => t.Id == townId).ToList();
        var byTown = towns.Select(t => new
        {
            townId = t.Id, town = t.NameEn,
            rides = window.Count(x => x.TownId == t.Id && !x.IsParcel),
            parcels = window.Count(x => x.TownId == t.Id && x.IsParcel),
            revenue = fin.Where(x => x.TownId == t.Id).Sum(x => x.FareFinal ?? 0),
        }).ToList();
        var heatmap = Enumerable.Range(0, 7).Select(dow => Enumerable.Range(0, 24).Select(h =>
            window.Count(x => (int)Ist.ToIst(x.CreatedAt).DayOfWeek == dow && x.Hour == h)).ToList()).ToList();

        var capIds = fin.Where(x => x.CaptainId != null).Select(x => x.CaptainId!).Distinct().ToList();
        var caps = await _db.Captains.AsNoTracking().Where(c => capIds.Contains(c.Id))
            .Select(c => new { c.Id, c.User!.Name, c.TownId, c.VehicleType }).ToDictionaryAsync(c => c.Id, ct);
        var leaderboard = fin.Where(x => x.CaptainId != null).GroupBy(x => x.CaptainId!).Select(g =>
        {
            caps.TryGetValue(g.Key, out var c);
            var rs = g.Where(x => x.Rating != null).Select(x => (double)x.Rating!).ToList();
            return new { captainId = g.Key, name = c?.Name, townId = c?.TownId, vehicleType = c?.VehicleType, trips = g.Count(), revenue = g.Sum(x => x.FareFinal ?? 0), rating = rs.Count > 0 ? (double?)Math.Round(rs.Average(), 2) : null };
        }).OrderByDescending(x => x.trips).Take(12).ToList();

        var lm = new Dictionary<string, LmCount>();
        foreach (var x in window)
        {
            if (x.PickupName != "GPS pin") { if (!lm.TryGetValue(x.PickupName, out var e)) lm[x.PickupName] = e = new LmCount(x.PickupName, x.PickupNameTe); e.Pickups++; }
            if (x.DropName != "GPS pin") { if (!lm.TryGetValue(x.DropName, out var e)) lm[x.DropName] = e = new LmCount(x.DropName, x.DropNameTe); e.Drops++; }
        }
        var topLandmarks = lm.Values.OrderByDescending(v => v.Pickups + v.Drops).Take(10)
            .Select(v => new { name = v.Name, nameTe = v.NameTe, pickups = v.Pickups, drops = v.Drops }).ToList();

        var riderIds = window.Select(x => x.RiderId).Distinct().ToList();
        var fsQ = _db.Rides.AsNoTracking().Where(r => riderIds.Contains(r.RiderId));
        if (townId != null) fsQ = fsQ.Where(r => r.TownId == townId);
        var firstSeen = (await fsQ.GroupBy(r => r.RiderId).Select(g => new { id = g.Key, first = g.Min(r => r.CreatedAt) }).ToListAsync(ct))
            .ToDictionary(x => x.id, x => Ist.DateOf(x.first));
        var retention = window.GroupBy(x => x.Day.AddDays(-(int)x.Day.DayOfWeek)).OrderBy(g => g.Key).Select(g => new
        {
            week = g.Key.ToString("yyyy-MM-dd"),
            label = $"w/c {Label(g.Key)}",
            newRiders = g.Select(x => x.RiderId).Distinct().Count(id => firstSeen.GetValueOrDefault(id, g.Key) >= g.Key),
            repeatRiders = g.Select(x => x.RiderId).Distinct().Count(id => firstSeen.GetValueOrDefault(id, g.Key) < g.Key),
        }).ToList();

        var cod = window.Where(x => x.IsParcel && x.CodAmount > 0).ToList();
        var codSummary = new
        {
            collected = cod.Where(x => x.CodCollected).Sum(x => x.CodAmount),
            pending = cod.Where(x => !x.CodCollected && x.Status != RideStatus.Cancelled && x.Status != RideStatus.NoCaptain).Sum(x => x.CodAmount),
            parcels = cod.Count,
        };
        return new { perDay, byService, byTown, heatmap, leaderboard, topLandmarks, retention, codSummary };
    }
}
