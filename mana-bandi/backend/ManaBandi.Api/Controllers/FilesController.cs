using ManaBandi.Api.Auth;
using ManaBandi.Api.Data;
using ManaBandi.Api.Infrastructure;
using ManaBandi.Api.Models;
using ManaBandi.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ManaBandi.Api.Controllers;

/// <summary>
/// Uploaded images. KYC documents: owners and the captain's town manager only.
/// Parcel/trip photos: admins, plus the rider and the captain of that ride.
/// </summary>
[ApiController]
[Authorize]
public class FilesController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly FileStorage _files;

    public FilesController(AppDbContext db, FileStorage files)
    {
        _db = db;
        _files = files;
    }

    [HttpGet("api/files/{id}")]
    public async Task<IActionResult> Get(string id, CancellationToken ct)
    {
        var f = await _db.Files.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct) ?? throw ApiException.NotFound("File not found");
        var allowed = false;
        if (User.IsAdmin())
        {
            string? town = null;
            if (f.CaptainId != null) town = await _db.Captains.Where(c => c.Id == f.CaptainId).Select(c => c.TownId).FirstOrDefaultAsync(ct);
            else if (f.RideId != null) town = await _db.Rides.Where(r => r.Id == f.RideId).Select(r => r.TownId).FirstOrDefaultAsync(ct);
            allowed = User.ManagerTown() is null || User.CanSeeTown(town);
        }
        else if (f.RideId != null && f.CaptainId is null)
        {
            var uid = User.UserId();
            allowed = await _db.Rides.AnyAsync(r => r.Id == f.RideId && (r.RiderId == uid || r.Captain!.UserId == uid), ct);
        }
        if (!allowed) throw ApiException.NotFound("File not found");
        var path = _files.FullPath(f);
        if (!System.IO.File.Exists(path)) throw ApiException.NotFound("File missing on disk");
        Response.Headers.CacheControl = "private, max-age=300";
        Response.Headers["X-Content-Type-Options"] = "nosniff";
        return PhysicalFile(path, f.ContentType);
    }
}

[ApiController]
[AllowAnonymous]
public class PublicTrackController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IClock _clock;
    private readonly PublicOptions _pub;

    public PublicTrackController(AppDbContext db, IClock clock, Microsoft.Extensions.Options.IOptions<PublicOptions> pub)
    {
        _db = db;
        _clock = clock;
        _pub = pub.Value;
    }

    private async Task<Ride?> Find(string token, CancellationToken ct)
    {
        if (string.IsNullOrEmpty(token) || token.Length != 12 || !token.All(char.IsLetterOrDigit)) return null;
        var r = await _db.Rides.AsNoTracking().Include(x => x.Captain).ThenInclude(c => c!.User).FirstOrDefaultAsync(x => x.TrackToken == token, ct);
        if (r is null) return null;
        if (r.EndedAt is { } end && _clock.UtcNow > end.AddHours(_pub.TrackExpiryHours)) return null;
        return r;
    }

    /// <summary>JSON for the share page. No phone numbers.</summary>
    [HttpGet("api/public/track/{token}")]
    public async Task<IActionResult> Json(string token, CancellationToken ct)
    {
        var r = await Find(token, ct) ?? throw ApiException.NotFound("This tracking link has expired");
        Response.Headers.CacheControl = "no-store";
        var c = r.Captain;
        return Ok(new
        {
            status = r.Status,
            service = r.Service,
            captain = c is null ? null : new
            {
                name = c.User?.Name ?? "",
                vehicleNo = c.VehicleNo,
                location = Views.IsActive(r) ? Views.CaptainLocation(c) : null,
            },
            pickup = new { lat = r.PickupLat, lng = r.PickupLng, name = r.PickupName, nameTe = r.PickupNameTe },
            drop = new { lat = r.DropLat, lng = r.DropLng, name = r.DropName, nameTe = r.DropNameTe },
            updatedAt = c?.LastPointAt is { } lp && lp > r.UpdatedAt && Views.IsActive(r) ? lp : r.UpdatedAt,
        });
    }

    [HttpGet("t/{token}")]
    public ContentResult Page(string token)
    {
        Response.Headers.CacheControl = "no-store";
        Response.Headers["Content-Security-Policy"] =
            "default-src 'none'; script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; " +
            "img-src 'self' data: https://*.tile.openstreetmap.org https://cdnjs.cloudflare.com; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'";
        Response.Headers["Referrer-Policy"] = "no-referrer";
        Response.Headers["X-Robots-Tag"] = "noindex";
        return Content(TrackPage.Html, "text/html; charset=utf-8");
    }
}
