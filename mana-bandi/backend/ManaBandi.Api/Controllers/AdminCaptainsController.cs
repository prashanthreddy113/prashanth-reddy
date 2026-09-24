using System.Text.Json;
using ManaBandi.Api.Auth;
using ManaBandi.Api.Data;
using ManaBandi.Api.Infrastructure;
using ManaBandi.Api.Models;
using ManaBandi.Api.Services;
using ManaBandi.Api.Sms;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ManaBandi.Api.Controllers;

public class CreateCaptainBody
{
    public string? Name { get; set; }
    public string? NameTe { get; set; }
    public string? Phone { get; set; }
    public string? VehicleType { get; set; }
    public string? VehicleModel { get; set; }
    public string? VehicleNo { get; set; }
    public string? TownId { get; set; }
    public int? VerificationScore { get; set; }
    public string? Lang { get; set; }
    public CaptainDocs? Docs { get; set; }
}

public record ReasonBody(string? Reason);
public record ReuploadBody(List<string>? Documents, string? Note);
public record PoliceBody(string? Status);

[ApiController]
[Route("api/captains")]
[Authorize(Policy = Policies.Admin)]
public class AdminCaptainsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly AccountService _accounts;
    private readonly IKycProvider _kyc;
    private readonly FileStorage _files;
    private readonly AuditService _audit;
    private readonly ISmsSender _sms;
    private readonly IClock _clock;
    private readonly ILogger<AdminCaptainsController> _log;

    public AdminCaptainsController(AppDbContext db, AccountService accounts, IKycProvider kyc, FileStorage files, AuditService audit, ISmsSender sms, IClock clock, ILogger<AdminCaptainsController> log)
    {
        _db = db;
        _accounts = accounts;
        _kyc = kyc;
        _files = files;
        _audit = audit;
        _sms = sms;
        _clock = clock;
        _log = log;
    }

    private IQueryable<Captain> Full() => _db.Captains.Include(c => c.User).Include(c => c.Kyc).Include(c => c.Documents);

    private async Task<Captain> Load(string id, CancellationToken ct)
    {
        var c = await Full().FirstOrDefaultAsync(c => c.Id == id, ct);
        if (c is null || !User.CanSeeTown(c.TownId)) throw ApiException.NotFound("Captain not found");
        return c;
    }

    private async Task<bool> DlUsedByOther(string? dlNumber, string? captainId, CancellationToken ct) =>
        !string.IsNullOrWhiteSpace(dlNumber) &&
        await _db.CaptainKyc.AnyAsync(k => k.DlNumber == dlNumber.Trim().ToUpper() && k.CaptainId != captainId, ct);

    private async Task<List<Check>> ChecksFor(Captain c, CancellationToken ct) =>
        KycRules.BuildChecks(KycRules.ToDocs(c, c.Documents), new KycContext(c.Id, c.VehicleType, Ist.Today(_clock), await DlUsedByOther(c.Kyc?.DlNumber, c.Id, ct)));

    private async Task<Dictionary<string, object?>> View(Captain c, CancellationToken ct)
    {
        var stats = await _accounts.StatsAsync(new[] { c.Id }, ct);
        return Views.ForAdmin(c, stats[c.Id], await ChecksFor(c, ct));
    }

    [HttpGet]
    public async Task<IActionResult> List([FromQuery] string? town, [FromQuery] string? vehicle, [FromQuery] string? vehicleType, [FromQuery] string? status, [FromQuery] string? q, CancellationToken ct)
    {
        var scope = User.ScopeTown(town);
        var query = Full().AsNoTracking();
        if (scope != null) query = query.Where(c => c.TownId == scope);
        vehicle ??= vehicleType;
        if (!string.IsNullOrEmpty(vehicle)) query = query.Where(c => c.VehicleType == vehicle);
        if (status == "online") query = query.Where(c => c.Online);
        else if (!string.IsNullOrEmpty(status)) query = query.Where(c => c.Status == status);
        if (!string.IsNullOrWhiteSpace(q))
        {
            var s = q.Trim().ToLower();
            query = query.Where(c => c.User!.Name.ToLower().Contains(s) || (c.User.Phone != null && c.User.Phone.Contains(s)) || c.VehicleNo.ToLower().Contains(s));
        }
        var rows = await query.OrderByDescending(c => c.CreatedAt).Take(1000).ToListAsync(ct);
        var stats = await _accounts.StatsAsync(rows.Select(c => c.Id), ct);
        return Ok(rows.Select(c => Views.ForAdmin(c, stats[c.Id])));
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> Get(string id, CancellationToken ct) => Ok(await View(await Load(id, ct), ct));

    /// <summary>Office onboarding: creates the captain user + profile (pending) with typed document fields.</summary>
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateCaptainBody body, CancellationToken ct)
    {
        var name = RideService.Trim(body.Name, 100) ?? throw ApiException.Validation("name is required");
        var phone = Phone.Normalize(body.Phone) ?? throw ApiException.Validation("phone must be a valid mobile number");
        if (body.VehicleType is not ("bike" or "auto")) throw ApiException.Validation("vehicleType must be bike or auto");
        var vehicleNo = CaptainController.CleanVehicleNo(body.VehicleNo);
        var townId = User.ManagerTown() ?? body.TownId;
        if (townId is null || !await _db.Towns.AnyAsync(t => t.Id == townId, ct)) throw ApiException.Validation("Unknown town");

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Phone == phone && u.Role == Roles.Captain, ct);
        if (user != null && await _db.Captains.AnyAsync(c => c.UserId == user.Id && c.VehicleNo != "", ct))
            throw new ApiException(409, "validation", "A captain with this phone number already exists");
        var now = _clock.UtcNow;
        if (user is null)
        {
            user = new User { Id = IdGen.New("u"), Phone = phone, Role = Roles.Captain, Name = name, Lang = body.Lang ?? "te", CreatedAt = now };
            _db.Users.Add(user);
        }
        else user.Name = name;
        var c = await _db.Captains.Include(x => x.Kyc).Include(x => x.Documents).FirstOrDefaultAsync(x => x.UserId == user.Id, ct);
        if (c is null)
        {
            c = new Captain { Id = IdGen.New("c"), UserId = user.Id, JoinedAt = Ist.Today(_clock), CreatedAt = now, Status = CaptainStatus.Pending };
            _db.Captains.Add(c);
        }
        c.User = user;
        c.Kyc ??= new CaptainKyc { CaptainId = c.Id };
        c.NameTe = RideService.Trim(body.NameTe, 100) ?? "";
        c.VehicleType = body.VehicleType;
        c.VehicleModel = RideService.Trim(body.VehicleModel, 60) ?? "";
        c.VehicleNo = vehicleNo;
        c.TownId = townId;
        if (body.Docs != null)
        {
            KycRules.Apply(c.Kyc, body.Docs);
            if (body.Docs.Police?.Status is { } ps) c.PoliceStatus = ValidPolice(ps);
        }
        await RunKycAsync(c, ct);
        _audit.Log("captain.create", c.Id, $"{name} · {vehicleNo}", townId);
        await _db.SaveChangesAsync(ct);
        return StatusCode(201, await View(c, ct));
    }

    /// <summary>Checks for the "Add captain" form before the captain exists. Body = docs object.</summary>
    [HttpPost("verify")]
    public async Task<IActionResult> VerifyDraft([FromBody] CaptainDocs docs, [FromQuery] string? vehicleType, CancellationToken ct)
    {
        var res = await _kyc.VerifyAsync(docs, new KycContext(null, vehicleType is "bike" or "auto" ? vehicleType : null, Ist.Today(_clock), await DlUsedByOther(docs.Dl?.Number, null, ct)), ct);
        return Ok(new { checks = res.Checks, docs = res.Docs });
    }

    /// <summary>Runs the KYC provider on the stored fields and persists what it derives (scores, owner match, checks).</summary>
    private async Task<KycResult> RunKycAsync(Captain c, CancellationToken ct)
    {
        c.Kyc ??= new CaptainKyc { CaptainId = c.Id };
        var res = await _kyc.VerifyAsync(KycRules.ToDocs(c, c.Documents, forView: false), new KycContext(c.Id, c.VehicleType, Ist.Today(_clock), await DlUsedByOther(c.Kyc.DlNumber, c.Id, ct)), ct);
        c.Kyc.Provider = _kyc.Name;
        c.Kyc.AadhaarVerifiedVia = res.Docs.Aadhaar?.VerifiedVia;
        c.Kyc.NameMatchScore = res.Docs.Dl?.NameMatchScore;
        c.Kyc.RcOwnerIsCaptain = res.Docs.Rc?.OwnerIsCaptain;
        c.Kyc.FaceMatchScore = res.Docs.Selfie?.FaceMatchScore;
        c.Kyc.Liveness = res.Docs.Selfie?.Liveness;
        c.Kyc.ChecksJson = JsonSerializer.Serialize(res.Checks);
        c.Kyc.CheckedAt = _clock.UtcNow;
        c.VerificationScore = KycRules.Score(res.Checks);
        return res;
    }

    /// <summary>Re-runs the KYC provider on the stored docs and persists the result.</summary>
    [HttpPost("{id}/verify")]
    public async Task<IActionResult> Verify(string id, CancellationToken ct)
    {
        var c = await Load(id, ct);
        var res = await RunKycAsync(c, ct);
        _audit.Log("captain.verify", c.Id, $"{_kyc.Name} checks · score {c.VerificationScore}", c.TownId);
        await _db.SaveChangesAsync(ct);
        return Ok(new { checks = res.Checks, docs = res.Docs, captain = await View(c, ct) });
    }

    /// <summary>Office corrections of extracted document fields (same docs shape).</summary>
    [HttpPut("{id}/docs")]
    public async Task<IActionResult> UpdateDocs(string id, [FromBody] CaptainDocs docs, CancellationToken ct)
    {
        var c = await Load(id, ct);
        c.Kyc ??= new CaptainKyc { CaptainId = c.Id };
        KycRules.Apply(c.Kyc, docs);
        if (docs.Police?.Status is { } ps) c.PoliceStatus = ValidPolice(ps);
        // derived values are recomputed from the new fields unless the caller supplied them
        if (docs.Dl?.NameMatchScore is null && (docs.Dl?.Name != null || docs.Aadhaar?.Name != null)) c.Kyc.NameMatchScore = null;
        if (docs.Rc?.OwnerIsCaptain is null && docs.Rc?.OwnerName != null) c.Kyc.RcOwnerIsCaptain = null;
        if (docs.Aadhaar?.Number != null && docs.Aadhaar.VerifiedVia is null) c.Kyc.AadhaarVerifiedVia = null;
        await RunKycAsync(c, ct);
        _audit.Log("captain.docs", c.Id, "Document fields updated", c.TownId);
        await _db.SaveChangesAsync(ct);
        return Ok(await View(c, ct));
    }

    [HttpPost("{id}/approve")]
    public async Task<IActionResult> Approve(string id, CancellationToken ct)
    {
        var c = await Load(id, ct);
        if (c.Status == CaptainStatus.Blocked) throw ApiException.InvalidState("Unblock the captain instead");
        var fails = (await ChecksFor(c, ct)).Where(x => x.State == "fail").Select(x => x.Label).ToList();
        if (fails.Count > 0) throw ApiException.Validation($"Fix failed checks first: {string.Join(", ", fails)}");
        if (string.IsNullOrWhiteSpace(c.VehicleNo) || c.TownId is null) throw ApiException.Validation("Vehicle number and town are required");
        c.Status = CaptainStatus.Verified;
        c.RejectReason = null;
        c.ApprovedAt ??= _clock.UtcNow;
        if (c.Kyc != null) { c.Kyc.DecidedBy = User.UserId(); c.Kyc.DecidedAt = _clock.UtcNow; }
        _audit.Log("captain.approve", c.Id, $"Approved (score {c.VerificationScore})", c.TownId);
        await _db.SaveChangesAsync(ct);
        return Ok(await View(c, ct));
    }

    [HttpPost("{id}/reject")]
    public async Task<IActionResult> Reject(string id, [FromBody] ReasonBody body, CancellationToken ct)
    {
        var reason = RideService.Trim(body.Reason, 300) ?? throw ApiException.Validation("reason is required");
        var c = await Load(id, ct);
        c.Status = CaptainStatus.Rejected;
        c.RejectReason = reason;
        c.Online = false;
        _audit.Log("captain.reject", c.Id, reason, c.TownId);
        await _db.SaveChangesAsync(ct);
        return Ok(await View(c, ct));
    }

    [HttpPost("{id}/block")]
    public async Task<IActionResult> Block(string id, [FromBody] ReasonBody body, CancellationToken ct)
    {
        var reason = RideService.Trim(body.Reason, 300) ?? throw ApiException.Validation("reason is required");
        var c = await Load(id, ct);
        c.Status = CaptainStatus.Blocked;
        c.BlockReason = reason;
        c.Online = false;
        _audit.Log("captain.block", c.Id, reason, c.TownId);
        await _db.SaveChangesAsync(ct);
        await _db.Offers.Where(o => o.CaptainId == c.Id && o.Status == OfferStatus.Pending)
            .ExecuteUpdateAsync(s => s.SetProperty(o => o.Status, OfferStatus.Cancelled), ct);
        return Ok(await View(c, ct));
    }

    [HttpPost("{id}/unblock")]
    public async Task<IActionResult> Unblock(string id, CancellationToken ct)
    {
        var c = await Load(id, ct);
        if (c.Status != CaptainStatus.Blocked) throw ApiException.InvalidState("Captain is not blocked");
        c.Status = CaptainStatus.Verified;
        c.BlockReason = null;
        _audit.Log("captain.unblock", c.Id, "Unblocked", c.TownId);
        await _db.SaveChangesAsync(ct);
        return Ok(await View(c, ct));
    }

    [HttpPost("{id}/request-reupload")]
    public async Task<IActionResult> RequestReupload(string id, [FromBody] ReuploadBody body, CancellationToken ct)
    {
        var docs = (body.Documents ?? new()).Where(d => CaptainController.DocKinds.Contains(d)).Distinct().ToList();
        if (docs.Count == 0) throw ApiException.Validation("Choose at least one document");
        var c = await Load(id, ct);
        foreach (var d in c.Documents.Where(d => docs.Contains(d.Kind))) d.Status = "reupload_requested";
        var note = RideService.Trim(body.Note, 300);
        _audit.Log("captain.reupload", c.Id, $"{string.Join(", ", docs)} — {note ?? "no note"}", c.TownId);
        await _db.SaveChangesAsync(ct);
        if (c.User?.Phone is { } phone)
        {
            try
            {
                await _sms.SendMessageAsync(phone, "captain_reupload", new Dictionary<string, string> { ["docs"] = string.Join(", ", docs), ["note"] = note ?? "" },
                    $"Mana Bandi: please upload again: {string.Join(", ", docs)}. {note}", ct);
            }
            catch (Exception ex) { _log.LogError(ex, "Re-upload SMS failed for {CaptainId}", c.Id); }
        }
        return Ok(new { ok = true });
    }

    /// <summary>Multipart `photo` (letter image) or an empty body (paper letter seen at the office).</summary>
    [HttpPost("{id}/documents/consent-letter")]
    [RequestSizeLimit(9 * 1024 * 1024)]
    public async Task<IActionResult> ConsentLetter(string id, CancellationToken ct)
    {
        var c = await Load(id, ct);
        c.Kyc ??= new CaptainKyc { CaptainId = c.Id };
        IFormFile? photo = null;
        if (Request.HasFormContentType) photo = (await Request.ReadFormAsync(ct)).Files.GetFile("photo");
        if (photo != null)
        {
            var f = await _files.SaveAsync(photo, "kyc_owner_consent", User.UserId(), captainId: c.Id, ct: ct);
            c.Documents.Add(new CaptainDocument { CaptainId = c.Id, Kind = "owner_consent", FileId = f.Id, UploadedAt = _clock.UtcNow, UploadedBy = User.UserId() });
        }
        c.Kyc.ConsentLetter = true;
        _audit.Log("captain.consent", c.Id, photo != null ? "Owner consent letter uploaded" : "Owner consent letter seen at office", c.TownId);
        await _db.SaveChangesAsync(ct);
        return Ok(await View(c, ct));
    }

    /// <summary>Office uploads a document photo on the captain's behalf (multipart `photo`).</summary>
    [HttpPost("{id}/documents/{kind}")]
    [RequestSizeLimit(9 * 1024 * 1024)]
    public async Task<IActionResult> UploadDocument(string id, string kind, IFormFile? photo, CancellationToken ct)
    {
        if (!CaptainController.DocKinds.Contains(kind)) throw ApiException.Validation("Unknown document kind");
        var c = await Load(id, ct);
        var f = await _files.SaveAsync(photo, "kyc_" + kind, User.UserId(), captainId: c.Id, ct: ct);
        c.Documents.Add(new CaptainDocument { CaptainId = c.Id, Kind = kind, FileId = f.Id, UploadedAt = _clock.UtcNow, UploadedBy = User.UserId() });
        _audit.Log("captain.document", c.Id, $"{kind} uploaded by office", c.TownId);
        await _db.SaveChangesAsync(ct);
        return Ok(await View(c, ct));
    }

    private static string ValidPolice(string s) =>
        s is "not_started" or "requested" or "done" or "adverse" ? s : throw ApiException.Validation("status must be not_started, requested, done or adverse");

    [HttpPatch("{id}/police-verification")]
    [HttpPost("{id}/police-verification")]
    public async Task<IActionResult> Police(string id, [FromBody] PoliceBody body, CancellationToken ct)
    {
        var status = ValidPolice(body.Status ?? "");
        var c = await Load(id, ct);
        var before = c.PoliceStatus;
        c.PoliceStatus = status;
        _audit.Log("captain.police", c.Id, $"Police verification {before} → {status}", c.TownId);
        await _db.SaveChangesAsync(ct);
        return Ok(await View(c, ct));
    }
}
