using System.Globalization;
using System.Text.RegularExpressions;
using ManaBandi.Api.Auth;
using ManaBandi.Api.Data;
using ManaBandi.Api.Infrastructure;
using ManaBandi.Api.Models;
using ManaBandi.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ManaBandi.Api.Controllers;

public class LatLng { public double Lat { get; set; } public double Lng { get; set; } }
public class FareBody { public int Base { get; set; } public double PerKm { get; set; } public int Min { get; set; } public int NightPct { get; set; } }
public class LandmarkBody { public string? Id { get; set; } public string? Kind { get; set; } public string? NameTe { get; set; } public string? NameEn { get; set; } public double Lat { get; set; } public double Lng { get; set; } }

public class TownBody
{
    public string? Id { get; set; }
    public string? NameEn { get; set; }
    public string? NameTe { get; set; }
    public string? District { get; set; }
    public string? State { get; set; }
    public bool? Enabled { get; set; }
    public LatLng? Center { get; set; }
    public double? RadiusKm { get; set; }
    public double? ExtendedRadiusKm { get; set; }
    public bool? EnforceRadius { get; set; }
    public string? NightStart { get; set; }
    public string? NightEnd { get; set; }
    public string? SupportPhone { get; set; }
    public string? MissedCallNo { get; set; }
    public string? LaunchedAt { get; set; }
    public Dictionary<string, FareBody>? Fares { get; set; }
    public List<LandmarkBody>? Landmarks { get; set; }
}

[ApiController]
[Route("api/towns")]
[Authorize(Policy = Policies.Admin)]
public partial class TownsController : ControllerBase
{
    private static readonly string[] LandmarkKinds = { "bus", "hospital", "market", "temple", "school", "office", "colony", "other" };
    private readonly AppDbContext _db;
    private readonly AuditService _audit;
    private readonly IClock _clock;

    public TownsController(AppDbContext db, AuditService audit, IClock clock)
    {
        _db = db;
        _audit = audit;
        _clock = clock;
    }

    [HttpGet]
    public async Task<IActionResult> List(CancellationToken ct)
    {
        var towns = await _db.Towns.AsNoTracking().Include(t => t.Landmarks).OrderBy(t => t.CreatedAt).ToListAsync(ct);
        return Ok(towns.Select(AreaService.AdminTown));
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> Get(string id, CancellationToken ct)
    {
        var t = await _db.Towns.AsNoTracking().Include(x => x.Landmarks).FirstOrDefaultAsync(x => x.Id == id, ct) ?? throw ApiException.NotFound("Town not found");
        return Ok(AreaService.AdminTown(t));
    }

    [GeneratedRegex("^([01][0-9]|2[0-3]):[0-5][0-9]$")]
    private static partial Regex HhMm();

    /// <summary>Owner: everything. Town manager: own town only.</summary>
    [HttpPut("{id}")]
    public async Task<IActionResult> Save(string id, [FromBody] TownBody b, CancellationToken ct)
    {
        if (!User.CanSeeTown(id)) throw ApiException.Forbidden("You can only edit your own town");
        var t = await _db.Towns.Include(x => x.Landmarks).FirstOrDefaultAsync(x => x.Id == id, ct) ?? throw ApiException.NotFound("Town not found");
        var changes = new List<string>();
        if (b.NameEn != null) t.NameEn = RideService.Trim(b.NameEn, 100) ?? throw ApiException.Validation("nameEn is required");
        if (b.NameTe != null) t.NameTe = RideService.Trim(b.NameTe, 100) ?? t.NameEn;
        if (b.District != null) t.District = RideService.Trim(b.District, 100) ?? "";
        if (b.State != null) t.State = RideService.Trim(b.State, 100) ?? "";
        var isOwner = User.IsOwner();
        if (b.Enabled is { } en && en != t.Enabled)
        {
            if (!isOwner) throw ApiException.Forbidden("Only the owner can open or close a town");
            changes.Add(en ? "enabled" : "disabled");
            t.Enabled = en;
        }
        if (b.Center != null)
        {
            if (!Geo.ValidLatLng(b.Center.Lat, b.Center.Lng)) throw ApiException.Validation("Invalid centre");
            t.CenterLat = b.Center.Lat;
            t.CenterLng = b.Center.Lng;
        }
        if (b.RadiusKm is { } r)
        {
            if (r is <= 0 or > 100) throw ApiException.Validation("radiusKm must be 0–100");
            if (Math.Abs(r - t.RadiusKm) > 0.001) changes.Add($"Service radius {t.RadiusKm} → {r} km");
            t.RadiusKm = r;
        }
        if (b.ExtendedRadiusKm is { } er)
        {
            if (er is <= 0 or > 200) throw ApiException.Validation("extendedRadiusKm must be 0–200");
            t.ExtendedRadiusKm = er;
        }
        if (t.ExtendedRadiusKm < t.RadiusKm) throw ApiException.Validation("extendedRadiusKm must be ≥ radiusKm");
        if (b.EnforceRadius is { } enf) t.EnforceRadius = enf;
        if (b.NightStart != null) t.NightStart = HhMm().IsMatch(b.NightStart) ? b.NightStart : throw ApiException.Validation("nightStart must be HH:mm");
        if (b.NightEnd != null) t.NightEnd = HhMm().IsMatch(b.NightEnd) ? b.NightEnd : throw ApiException.Validation("nightEnd must be HH:mm");
        if (b.SupportPhone != null) t.SupportPhone = RideService.Trim(b.SupportPhone, 30) ?? "";
        if (b.MissedCallNo != null) t.MissedCallNo = RideService.Trim(b.MissedCallNo, 30) ?? "";
        if (b.LaunchedAt != null) t.LaunchedAt = KycRules.ParseDate(b.LaunchedAt);
        if (b.Fares != null)
        {
            var fares = new Dictionary<string, Fare>();
            foreach (var (svc, f) in b.Fares)
            {
                if (!AreaService.Services.Contains(svc)) throw ApiException.Validation($"Unknown service {svc}");
                if (f.Base is < 0 or > 5000 || f.PerKm is < 0 or > 500 || f.Min is < 0 or > 5000 || f.NightPct is < 0 or > 200)
                    throw ApiException.Validation($"Fare for {svc} is out of range");
                fares[svc] = new Fare { Base = f.Base, PerKm = f.PerKm, Min = f.Min, NightPct = f.NightPct };
            }
            foreach (var svc in AreaService.Services) if (!fares.ContainsKey(svc)) throw ApiException.Validation($"Fare for {svc} is required");
            if (!FaresEqual(fares, t.Fares))
            {
                if (!isOwner) throw ApiException.Forbidden("Only the owner can change fares");
                changes.Add("fares updated");
            }
            t.Fares = fares;
        }
        if (b.Landmarks != null)
        {
            if (b.Landmarks.Count > 500) throw ApiException.Validation("Too many landmarks");
            var keep = new List<Landmark>();
            var i = 0;
            foreach (var l in b.Landmarks)
            {
                if (!Geo.ValidLatLng(l.Lat, l.Lng)) throw ApiException.Validation("Landmark has invalid coordinates");
                var nameEn = RideService.Trim(l.NameEn, 120) ?? throw ApiException.Validation("Landmark nameEn is required");
                var kind = l.Kind != null && LandmarkKinds.Contains(l.Kind) ? l.Kind : "other";
                var existing = l.Id is null ? null : t.Landmarks.FirstOrDefault(x => x.Id == l.Id);
                var lm = existing ?? new Landmark { Id = $"{t.Id}_l{IdGen.Token(6).ToLowerInvariant()}", TownId = t.Id };
                lm.Kind = kind;
                lm.NameEn = nameEn;
                lm.NameTe = RideService.Trim(l.NameTe, 120) ?? nameEn;
                lm.Lat = l.Lat;
                lm.Lng = l.Lng;
                lm.SortOrder = i++;
                keep.Add(lm);
            }
            var removed = t.Landmarks.Where(x => !keep.Contains(x)).ToList();
            foreach (var x in removed) _db.Landmarks.Remove(x);
            foreach (var x in keep.Where(x => !t.Landmarks.Contains(x))) t.Landmarks.Add(x);
            var added = keep.Count(x => _db.Entry(x).State == EntityState.Added);
            if (added > 0 || removed.Count > 0) changes.Add($"landmarks +{added} −{removed.Count}");
        }
        var radiusChange = changes.FirstOrDefault(c => c.StartsWith("Service radius"));
        _audit.Log(radiusChange != null ? "town.radius" : "town.save", t.Id, changes.Count > 0 ? string.Join("; ", changes) : "Service area updated", t.Id);
        await _db.SaveChangesAsync(ct);
        return Ok(AreaService.AdminTown(t));
    }

    private static bool FaresEqual(Dictionary<string, Fare> a, Dictionary<string, Fare> b) =>
        a.Count == b.Count && a.All(kv => b.TryGetValue(kv.Key, out var o) && o.Base == kv.Value.Base && Math.Abs(o.PerKm - kv.Value.PerKm) < 1e-9 && o.Min == kv.Value.Min && o.NightPct == kv.Value.NightPct);

    [HttpPost]
    [Authorize(Policy = Policies.Owner)]
    public async Task<IActionResult> Create([FromBody] TownBody b, CancellationToken ct)
    {
        var nameEn = RideService.Trim(b.NameEn, 100) ?? throw ApiException.Validation("nameEn is required");
        if (b.Center is null || !Geo.ValidLatLng(b.Center.Lat, b.Center.Lng)) throw ApiException.Validation("center is required");
        var baseId = new string(nameEn.ToLowerInvariant().Where(ch => ch is >= 'a' and <= 'z').Take(6).ToArray());
        if (baseId.Length == 0) baseId = "town";
        var n = await _db.Towns.CountAsync(ct);
        var id = baseId + n;
        while (await _db.Towns.AnyAsync(t => t.Id == id, ct)) id = baseId + (++n);
        var template = await _db.Towns.AsNoTracking().OrderBy(t => t.CreatedAt).FirstOrDefaultAsync(ct);
        var t = new Town
        {
            Id = id, NameEn = nameEn, NameTe = RideService.Trim(b.NameTe, 100) ?? nameEn,
            District = RideService.Trim(b.District, 100) ?? "Sangareddy", State = RideService.Trim(b.State, 100) ?? "Telangana",
            Enabled = false, CenterLat = b.Center.Lat, CenterLng = b.Center.Lng, RadiusKm = 8, ExtendedRadiusKm = 20, EnforceRadius = true,
            NightStart = "22:00", NightEnd = "05:00", SupportPhone = "", MissedCallNo = "",
            Fares = template?.Fares.ToDictionary(kv => kv.Key, kv => new Fare { Base = kv.Value.Base, PerKm = kv.Value.PerKm, Min = kv.Value.Min, NightPct = kv.Value.NightPct })
                    ?? SeedData.DefaultFares(),
            CreatedAt = _clock.UtcNow,
        };
        _db.Towns.Add(t);
        _audit.Log("town.create", id, nameEn, id);
        await _db.SaveChangesAsync(ct);
        return StatusCode(201, AreaService.AdminTown(t));
    }
}
