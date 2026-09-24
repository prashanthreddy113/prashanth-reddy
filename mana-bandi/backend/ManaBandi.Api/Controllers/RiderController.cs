using ManaBandi.Api.Auth;
using ManaBandi.Api.Data;
using ManaBandi.Api.Infrastructure;
using ManaBandi.Api.Models;
using ManaBandi.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace ManaBandi.Api.Controllers;

public class QuoteBody
{
    public string? Service { get; set; }
    public PlaceDto? Pickup { get; set; }
    public PlaceDto? Drop { get; set; }
    public string? ParcelSize { get; set; }
}

public record CancelBody(string? Reason);
public record RateBody(int Stars, int? Tip);
public record SosBody(double? Lat, double? Lng);

[ApiController]
[Route("api/rider")]
[Authorize(Policy = Policies.Rider)]
public class RiderController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly AreaService _area;
    private readonly DispatchOptions _dispatch;
    private readonly IClock _clock;

    public RiderController(AppDbContext db, AreaService area, IOptions<DispatchOptions> dispatch, IClock clock)
    {
        _db = db;
        _area = area;
        _dispatch = dispatch.Value;
        _clock = clock;
    }

    [HttpGet("towns/nearest")]
    public async Task<IActionResult> Nearest([FromQuery] double lat, [FromQuery] double lng, CancellationToken ct)
    {
        if (!Geo.ValidLatLng(lat, lng)) throw ApiException.Validation("lat/lng are required");
        var towns = await _area.EnabledTownsAsync(ct);
        var best = towns.Select(t => (t, d: AreaService.DistanceFromCenter(t, lat, lng))).OrderBy(x => x.d).FirstOrDefault();
        if (best.t is null || best.d > Math.Max(50, best.t.ExtendedRadiusKm * 2))
            return Ok(new { town = (object?)null, inside = false, distanceKm = best.t is null ? (double?)null : Geo.Round1(best.d), place = AreaService.NamePlace(null, lat, lng) });
        var inside = best.d <= (best.t.EnforceRadius ? best.t.RadiusKm : best.t.ExtendedRadiusKm);
        return Ok(new { town = AreaService.PublicTown(best.t), inside, distanceKm = Geo.Round1(best.d), place = AreaService.NamePlace(best.t, lat, lng) });
    }

    [HttpPost("quote")]
    public async Task<IActionResult> Quote([FromBody] QuoteBody body, CancellationToken ct)
    {
        var q = await _area.QuoteAsync(body.Service ?? "", body.Pickup!, body.Drop!, body.ParcelSize, ct);
        // ETA: nearest fresh, free captain of the right vehicle
        var vehicle = body.Service == "parcel" ? (body.ParcelSize == "l" ? "auto" : "bike") : body.Service;
        var fresh = _clock.UtcNow.AddSeconds(-_dispatch.HeartbeatStaleSeconds);
        var caps = await _db.Captains.AsNoTracking()
            .Where(c => c.Status == CaptainStatus.Verified && c.Online && c.VehicleType == vehicle && c.LastSeenAt >= fresh && c.LastLat != null)
            .Select(c => new { Lat = c.LastLat!.Value, Lng = c.LastLng!.Value }).ToListAsync(ct);
        int? eta = null;
        if (caps.Count > 0)
        {
            var km = caps.Min(c => Geo.HaversineKm(c.Lat, c.Lng, body.Pickup!.Lat, body.Pickup.Lng)) * AreaService.RoadFactor;
            eta = Math.Max(2, (int)Math.Ceiling(km / _dispatch.AvgSpeedKmh * 60));
        }
        return Ok(new { townId = q.Town.Id, distanceKm = q.DistanceKm, fare = q.Fare, night = q.Night, etaPickupMin = eta });
    }
}

[ApiController]
[Authorize]
public class RidesController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly RideService _rides;
    private readonly FileStorage _files;
    private readonly AccountService _accounts;

    public RidesController(AppDbContext db, RideService rides, FileStorage files, AccountService accounts)
    {
        _db = db;
        _rides = rides;
        _files = files;
        _accounts = accounts;
    }

    [HttpPost("api/rides")]
    [Authorize(Policy = Policies.Rider)]
    public async Task<IActionResult> Create([FromBody] CreateRideRequest body, CancellationToken ct)
    {
        var (ride, created) = await _rides.CreateAsync(User.UserId(), body, ct);
        var view = _rides.View(ride);
        return created ? StatusCode(201, view) : Ok(view);
    }

    [HttpGet("api/rides/active")]
    [Authorize(Policy = Policies.Rider)]
    public async Task<IActionResult> Active(CancellationToken ct)
    {
        var uid = User.UserId();
        var r = await _rides.WithDetails().AsNoTracking()
            .Where(x => x.RiderId == uid && RideStatus.NonTerminal.Contains(x.Status))
            .OrderByDescending(x => x.CreatedAt).FirstOrDefaultAsync(ct);
        return r is null ? NoContent() : Ok(_rides.View(r));
    }

    /// <summary>Riders: own ride (contract Ride). Admins: any ride in scope (portal shape).</summary>
    [HttpGet("api/rides/{id}")]
    public async Task<IActionResult> Get(string id, CancellationToken ct)
    {
        if (User.Role() == Roles.Rider)
            return Ok(_rides.View(await _rides.LoadForRiderAsync(id, User.UserId(), ct)));
        if (!User.IsAdmin()) throw ApiException.Forbidden();
        var r = await _rides.WithDetails().AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct);
        if (r is null || !User.CanSeeTown(r.TownId)) throw ApiException.NotFound("Ride not found");
        return Ok(Views.ForAdmin(r));
    }

    [HttpGet("api/parcels/{id}")]
    [Authorize(Policy = Policies.Admin)]
    public Task<IActionResult> GetParcel(string id, CancellationToken ct) => Get(id, ct);

    /// <summary>Riders: history (?mine=1&amp;limit=20). Admins: GET /api/rides?from=&amp;to=&amp;status=&amp;town=&amp;service=&amp;q=</summary>
    [HttpGet("api/rides")]
    public async Task<IActionResult> List([FromQuery] int? limit, [FromQuery] string? town, [FromQuery] string? from, [FromQuery] string? to,
        [FromQuery] string? status, [FromQuery] string? service, [FromQuery] string? q, CancellationToken ct)
    {
        if (User.Role() == Roles.Rider)
        {
            var uid = User.UserId();
            var rows = await _rides.WithDetails().AsNoTracking().Where(x => x.RiderId == uid)
                .OrderByDescending(x => x.CreatedAt).Take(Math.Clamp(limit ?? 20, 1, 100)).ToListAsync(ct);
            return Ok(rows.Select(_rides.View));
        }
        if (!User.IsAdmin()) throw ApiException.Forbidden();
        return Ok(await AdminList(false, town, from, to, status, service, q, limit, ct));
    }

    [HttpGet("api/parcels")]
    [Authorize(Policy = Policies.Admin)]
    public async Task<IActionResult> Parcels([FromQuery] int? limit, [FromQuery] string? town, [FromQuery] string? from, [FromQuery] string? to,
        [FromQuery] string? status, [FromQuery] string? service, [FromQuery] string? q, CancellationToken ct) =>
        Ok(await AdminList(true, town, from, to, status, service, q, limit, ct));

    private async Task<List<Dictionary<string, object?>>> AdminList(bool parcels, string? town, string? from, string? to, string? status, string? service, string? q, int? limit, CancellationToken ct)
    {
        var scope = User.ScopeTown(town);
        var query = _db.Rides.AsNoTracking().Include(r => r.Rider).Include(r => r.Events)
            .Where(r => parcels ? r.Service == "parcel" : r.Service != "parcel");
        if (scope != null) query = query.Where(r => r.TownId == scope);
        if (KycRules.ParseDate(from) is { } f) { var fu = Ist.StartUtc(f); query = query.Where(r => r.CreatedAt >= fu); }
        if (KycRules.ParseDate(to) is { } t) { var tu = Ist.StartUtc(t.AddDays(1)); query = query.Where(r => r.CreatedAt < tu); }
        if (!string.IsNullOrEmpty(service)) query = query.Where(r => r.Service == service);
        if (!string.IsNullOrEmpty(status))
        {
            string[] raw = status switch
            {
                "assigned" => new[] { RideStatus.Accepted, RideStatus.Arrived },
                "on_trip" => new[] { RideStatus.Started },
                "unfulfilled" => new[] { RideStatus.NoCaptain },
                _ => new[] { status },
            };
            query = query.Where(r => raw.Contains(r.Status));
        }
        if (!string.IsNullOrWhiteSpace(q))
        {
            var s = q.Trim().ToLower();
            query = query.Where(r => r.Id.ToLower().Contains(s) || r.Rider!.Name.ToLower().Contains(s) || r.PickupName.ToLower().Contains(s) || r.DropName.ToLower().Contains(s));
        }
        var rows = await query.OrderByDescending(r => r.CreatedAt).Take(Math.Clamp(limit ?? 2000, 1, 5000)).ToListAsync(ct);
        return rows.Select(Views.ForAdmin).ToList();
    }

    [HttpPost("api/rides/{id}/cancel")]
    [Authorize(Policy = Policies.Rider)]
    public async Task<IActionResult> Cancel(string id, [FromBody] CancelBody? body, CancellationToken ct) =>
        Ok(_rides.View(await _rides.CancelByRiderAsync(User.UserId(), id, body?.Reason, ct)));

    [HttpPost("api/rides/{id}/rate")]
    [Authorize(Policy = Policies.Rider)]
    public async Task<IActionResult> Rate(string id, [FromBody] RateBody body, CancellationToken ct)
    {
        await _rides.RateAsync(User.UserId(), id, body.Stars, body.Tip ?? 0, ct);
        return Ok(new { ok = true });
    }

    [HttpPost("api/rides/{id}/parcel-photo")]
    [Authorize(Policy = Policies.Rider)]
    [RequestSizeLimit(9 * 1024 * 1024)]
    public async Task<IActionResult> ParcelPhoto(string id, IFormFile? photo, CancellationToken ct)
    {
        var r = await _rides.LoadForRiderAsync(id, User.UserId(), ct);
        if (!r.IsParcel) throw ApiException.InvalidState("Only parcels have a parcel photo");
        if (RideStatus.IsTerminal(r.Status)) throw ApiException.InvalidState("This booking is closed");
        var f = await _files.SaveAsync(photo, "parcel_photo", User.UserId(), rideId: r.Id, ct: ct);
        r.ParcelPhotoFileId = f.Id;
        await _db.SaveChangesAsync(ct);
        return Ok(new { photoUrl = FileStorage.Url(f.Id) });
    }

    [HttpPost("api/rides/{id}/sos")]
    public async Task<IActionResult> Sos(string id, [FromBody] SosBody? body, CancellationToken ct)
    {
        var role = User.Role();
        if (role is not (Roles.Rider or Roles.Captain)) throw ApiException.Forbidden();
        await _rides.SosAsync(User.UserId(), role, id, body?.Lat, body?.Lng, ct);
        return Ok(new { ok = true });
    }
}
