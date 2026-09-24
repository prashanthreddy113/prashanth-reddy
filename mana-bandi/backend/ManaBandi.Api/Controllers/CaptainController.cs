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

public record VehicleBody(string? VehicleType, string? VehicleNo, string? VehicleModel, string? TownId);
public record OnlineBody(bool Online, double? Lat, double? Lng);
public class LocationBody { public List<LocationPointInput>? Points { get; set; } }
public record StartBody(string? Otp);
public record DeliverBody(string? DeliveryOtp);
public record FinishBody(double? Lat, double? Lng);
public record CollectedBody(string? Method);

[ApiController]
[Route("api/captain")]
[Authorize(Policy = Policies.Captain)]
public partial class CaptainController : ControllerBase
{
    public static readonly string[] DocKinds = { "aadhaar", "dl", "rc", "selfie", "bank", "owner_consent", "police" };

    private readonly AppDbContext _db;
    private readonly AccountService _accounts;
    private readonly TripService _trips;
    private readonly FileStorage _files;
    private readonly IClock _clock;

    public CaptainController(AppDbContext db, AccountService accounts, TripService trips, FileStorage files, IClock clock)
    {
        _db = db;
        _accounts = accounts;
        _trips = trips;
        _files = files;
        _clock = clock;
    }

    private Task<Captain> Me(CancellationToken ct) => _accounts.RequireCaptainAsync(User.UserId(), ct);

    [GeneratedRegex("^[A-Z]{2}[ -]?[0-9]{1,2}[ -]?[A-Z]{0,3}[ -]?[0-9]{1,4}$")]
    private static partial Regex VehicleNoRx();

    public static string CleanVehicleNo(string? raw)
    {
        var v = Regex.Replace((raw ?? "").Trim().ToUpperInvariant(), @"\s+", " ");
        if (v.Length is < 6 or > 20 || !VehicleNoRx().IsMatch(v)) throw ApiException.Validation("Vehicle number looks wrong (example: TS 15 AB 1234)");
        return v;
    }

    [HttpGet("me")]
    public async Task<IActionResult> GetMe(CancellationToken ct) => Ok(await _accounts.CaptainMeAsync(await Me(ct), ct));

    [HttpPut("vehicle")]
    public async Task<IActionResult> Vehicle([FromBody] VehicleBody body, CancellationToken ct)
    {
        var c = await Me(ct);
        if (body.VehicleType is not ("bike" or "auto")) throw ApiException.Validation("vehicleType must be bike or auto");
        var no = CleanVehicleNo(body.VehicleNo);
        if (c.Status == CaptainStatus.Verified && (c.VehicleNo != no || c.VehicleType != body.VehicleType))
            throw ApiException.InvalidState("Vehicle changes after approval are done at the town office");
        c.VehicleType = body.VehicleType;
        c.VehicleNo = no;
        c.VehicleModel = RideService.Trim(body.VehicleModel, 60) ?? c.VehicleModel;
        if (body.TownId != null)
        {
            if (!await _db.Towns.AnyAsync(t => t.Id == body.TownId && t.Enabled, ct)) throw ApiException.Validation("Unknown town");
            c.TownId = body.TownId;
        }
        await _db.SaveChangesAsync(ct);
        return Ok(await _accounts.CaptainMeAsync(c, ct));
    }

    [HttpPost("documents/{kind}")]
    [RequestSizeLimit(9 * 1024 * 1024)]
    public async Task<IActionResult> Document(string kind, IFormFile? photo, [FromForm] string? upi, [FromForm] string? ifsc,
        [FromForm] string? accountLast4, [FromForm] string? number, [FromForm] string? ownerPhone, CancellationToken ct)
    {
        if (!DocKinds.Contains(kind)) throw ApiException.Validation("Unknown document kind");
        var c = await Me(ct);
        if (c.Status == CaptainStatus.Blocked) throw ApiException.Forbidden("Your account is blocked");
        c.Kyc ??= new CaptainKyc { CaptainId = c.Id };
        if (kind == "bank")
        {
            c.Kyc.BankUpi = KycRules.CleanUpi(upi) ?? c.Kyc.BankUpi;
            c.Kyc.BankIfsc = KycRules.CleanIfsc(ifsc) ?? c.Kyc.BankIfsc;
            c.Kyc.BankAccountLast4 = KycRules.CleanLast4(accountLast4) ?? c.Kyc.BankAccountLast4;
        }
        if (kind == "aadhaar" && number != null) c.Kyc.AadhaarLast4 = KycRules.AadhaarLast4(number); // never the full number
        if (kind == "owner_consent" && ownerPhone != null) c.Kyc.OwnerPhone = Phone.Normalize(ownerPhone) ?? throw ApiException.Validation("ownerPhone must be a valid mobile number");
        if (photo != null || kind != "bank")
        {
            var f = await _files.SaveAsync(photo, "kyc_" + kind, User.UserId(), captainId: c.Id, ct: ct);
            c.Documents.Add(new CaptainDocument { CaptainId = c.Id, Kind = kind, FileId = f.Id, UploadedAt = _clock.UtcNow, UploadedBy = User.UserId() });
            if (kind == "owner_consent") c.Kyc.ConsentLetter = true;
        }
        await _db.SaveChangesAsync(ct);
        return Ok(await _accounts.CaptainMeAsync(c, ct));
    }

    [HttpPost("online")]
    public async Task<IActionResult> Online([FromBody] OnlineBody body, CancellationToken ct)
    {
        var c = await Me(ct);
        await _trips.SetOnlineAsync(c, body.Online, body.Lat, body.Lng, ct);
        return Ok(await _accounts.CaptainMeAsync(c, ct));
    }

    /// <summary>The heartbeat: stores 1–20 points, updates the last position, returns any pending offer and the current trip.</summary>
    [HttpPost("location")]
    public async Task<IActionResult> Location([FromBody] LocationBody body, CancellationToken ct)
    {
        var uid = User.UserId();
        // light, untracked load: this endpoint is hit every 5–10 s by every online captain
        var c = await _db.Captains.AsNoTracking().FirstOrDefaultAsync(x => x.UserId == uid, ct) ?? throw ApiException.NotFound("Captain profile not found");
        return Ok(await _trips.HeartbeatAsync(c, body.Points, ct));
    }

    [HttpPost("offers/{id}/accept")]
    public async Task<IActionResult> Accept(string id, CancellationToken ct)
    {
        var c = await Me(ct);
        var r = await _trips.AcceptAsync(c, id, ct);
        return Ok(await _trips.TripViewAsync(r, c, ct));
    }

    [HttpPost("offers/{id}/reject")]
    public async Task<IActionResult> Reject(string id, CancellationToken ct)
    {
        await _trips.RejectAsync(await Me(ct), id, ct);
        return Ok(new { ok = true });
    }

    [HttpGet("trip")]
    public async Task<IActionResult> Trip(CancellationToken ct)
    {
        var c = await Me(ct);
        var r = await _trips.CurrentTripAsync(c.Id, ct);
        return r is null ? NoContent() : Ok(await _trips.TripViewAsync(r, c, ct));
    }

    [HttpPost("trip/arrived")]
    public async Task<IActionResult> Arrived(CancellationToken ct)
    {
        var c = await Me(ct);
        return Ok(await _trips.TripViewAsync(await _trips.ArrivedAsync(c, ct), c, ct));
    }

    [HttpPost("trip/start")]
    public async Task<IActionResult> Start([FromBody] StartBody body, CancellationToken ct)
    {
        var c = await Me(ct);
        return Ok(await _trips.TripViewAsync(await _trips.StartAsync(c, body.Otp, ct), c, ct));
    }

    [HttpPost("trip/deliver")]
    public async Task<IActionResult> Deliver([FromBody] DeliverBody body, CancellationToken ct)
    {
        var c = await Me(ct);
        return Ok(await _trips.TripViewAsync(await _trips.DeliverAsync(c, body.DeliveryOtp, ct), c, ct));
    }

    [HttpPost("trip/finish")]
    public async Task<IActionResult> Finish([FromBody] FinishBody? body, CancellationToken ct)
    {
        var c = await Me(ct);
        return Ok(await _trips.TripViewAsync(await _trips.FinishAsync(c, body?.Lat, body?.Lng, ct), c, ct));
    }

    [HttpPost("trip/photo")]
    [RequestSizeLimit(9 * 1024 * 1024)]
    public async Task<IActionResult> Photo(IFormFile? photo, [FromForm] string? stage, CancellationToken ct)
    {
        if (stage is not ("pickup" or "delivery")) throw ApiException.Validation("stage must be pickup or delivery");
        var c = await Me(ct);
        var r = await _trips.CurrentTripAsync(c.Id, ct) ?? throw ApiException.NotFound("You have no active trip");
        var f = await _files.SaveAsync(photo, "trip_" + stage, User.UserId(), rideId: r.Id, ct: ct);
        if (stage == "pickup") r.PickupPhotoFileId = f.Id; else r.DeliveryPhotoFileId = f.Id;
        await _db.SaveChangesAsync(ct);
        return Ok(new { photoUrl = FileStorage.Url(f.Id) });
    }

    [HttpPost("trip/collected")]
    public async Task<IActionResult> Collected([FromBody] CollectedBody body, CancellationToken ct) =>
        Ok(await _trips.CollectedAsync(await Me(ct), body.Method, ct));

    [HttpPost("trip/cancel")]
    public async Task<IActionResult> CancelTrip([FromBody] CancelBody? body, CancellationToken ct)
    {
        await _trips.CancelByCaptainAsync(await Me(ct), body?.Reason, ct);
        return Ok(new { ok = true });
    }

    [HttpGet("earnings")]
    public async Task<IActionResult> Earnings(CancellationToken ct) => Ok(await _trips.EarningsAsync(await Me(ct), ct));
}
