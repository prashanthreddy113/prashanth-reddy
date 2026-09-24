using ManaBandi.Api.Auth;
using ManaBandi.Api.Data;
using ManaBandi.Api.Infrastructure;
using ManaBandi.Api.Models;
using ManaBandi.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace ManaBandi.Api.Controllers;

[ApiController]
[Route("api/live")]
[Authorize(Policy = Policies.Admin)]
public class LiveController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly AccountService _accounts;
    private readonly IClock _clock;
    private readonly DispatchOptions _dispatch;

    public LiveController(AppDbContext db, AccountService accounts, IClock clock, IOptions<DispatchOptions> dispatch)
    {
        _db = db;
        _accounts = accounts;
        _clock = clock;
        _dispatch = dispatch.Value;
    }

    /// <summary>Online captains with their last reported position.</summary>
    [HttpGet("captains")]
    public async Task<IActionResult> Captains([FromQuery] string? town, CancellationToken ct)
    {
        var scope = User.ScopeTown(town);
        var q = _db.Captains.AsNoTracking().Include(c => c.User).Include(c => c.Kyc).Include(c => c.Documents).Where(c => c.Online && c.LastLat != null);
        if (scope != null) q = q.Where(c => c.TownId == scope);
        var rows = await q.ToListAsync(ct);
        var stats = await _accounts.StatsAsync(rows.Select(c => c.Id), ct);
        var busy = (await _db.Rides.Where(r => r.CaptainId != null && RideStatus.Active.Contains(r.Status)).Select(r => r.CaptainId!).ToListAsync(ct)).ToHashSet();
        var stale = _clock.UtcNow.AddSeconds(-_dispatch.HeartbeatStaleSeconds);
        return Ok(rows.Select(c =>
        {
            var v = Views.ForAdmin(c, stats[c.Id]);
            v["onTrip"] = busy.Contains(c.Id);
            v["stale"] = c.LastSeenAt < stale;
            return v;
        }));
    }

    /// <summary>Open rides and parcels: searching / assigned / on_trip.</summary>
    [HttpGet("requests")]
    public async Task<IActionResult> Requests([FromQuery] string? town, CancellationToken ct)
    {
        var scope = User.ScopeTown(town);
        var q = _db.Rides.AsNoTracking().Include(r => r.Rider).Include(r => r.Events).Where(r => RideStatus.NonTerminal.Contains(r.Status));
        if (scope != null) q = q.Where(r => r.TownId == scope);
        var rows = await q.OrderByDescending(r => r.CreatedAt).Take(500).ToListAsync(ct);
        return Ok(rows.Select(Views.ForAdmin));
    }
}

public class CompanyBody
{
    public string? LegalName { get; set; }
    public string? Brand { get; set; }
    public string? Gstin { get; set; }
    public string? Address { get; set; }
    public string? SupportEmail { get; set; }
    public string? SupportPhone { get; set; }
    public string? WhatsappNumber { get; set; }
    public double? CommissionPct { get; set; }
    public int? FreeMonths { get; set; }
    public int? IncentiveTripsPerDay { get; set; }
    public int? IncentiveAmount { get; set; }
    public int? OfferWindowSec { get; set; }
    public int? DispatchRounds { get; set; }
    public double? DispatchRadiusKm { get; set; }
}

public record PublishTermsBody(string? Version, string? Te, string? En);
public class TemplateBody
{
    public string? Id { get; set; }
    public string? Channel { get; set; }
    public string? Key { get; set; }
    public List<string>? Langs { get; set; }
    public string? Status { get; set; }
    public string? Te { get; set; }
    public string? En { get; set; }
}
public record AddUserBody(string? Name, string? Email, string? Role, string? TownId, string? Password);

[ApiController]
[Route("api/admin")]
[Authorize(Policy = Policies.Admin)]
public class AdminController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly AdminStatsService _stats;
    private readonly AuditService _audit;
    private readonly IPasswordHasher<User> _hasher;
    private readonly IClock _clock;

    public AdminController(AppDbContext db, AdminStatsService stats, AuditService audit, IPasswordHasher<User> hasher, IClock clock)
    {
        _db = db;
        _stats = stats;
        _audit = audit;
        _hasher = hasher;
        _clock = clock;
    }

    [HttpGet("dashboard")]
    public async Task<IActionResult> Dashboard([FromQuery] string? town, CancellationToken ct) => Ok(await _stats.DashboardAsync(User.ScopeTown(town), ct));

    [HttpGet("analytics")]
    public async Task<IActionResult> Analytics([FromQuery] string? town, [FromQuery] int? days, CancellationToken ct) =>
        Ok(await _stats.AnalyticsAsync(User.ScopeTown(town), days ?? 30, ct));

    // ---------------------------------------------------------------- SOS

    [HttpGet("sos")]
    public async Task<IActionResult> Sos([FromQuery] string? town, [FromQuery] bool? resolved, CancellationToken ct)
    {
        var scope = User.ScopeTown(town);
        var q = _db.SosEvents.AsNoTracking().AsQueryable();
        if (scope != null) q = q.Where(s => s.TownId == scope);
        if (resolved != null) q = q.Where(s => s.Resolved == resolved);
        return Ok(await q.OrderByDescending(s => s.At).Take(200)
            .Select(s => new { id = s.Id, at = s.At, rideId = s.RideId, townId = s.TownId, by = s.By, resolved = s.Resolved, lat = s.Lat, lng = s.Lng, resolvedAt = s.ResolvedAt, resolvedBy = s.ResolvedBy, contactNotified = s.ContactNotified })
            .ToListAsync(ct));
    }

    [HttpPost("sos/{id}/resolve")]
    public async Task<IActionResult> ResolveSos(string id, CancellationToken ct)
    {
        var s = await _db.SosEvents.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (s is null || !User.CanSeeTown(s.TownId)) throw ApiException.NotFound("SOS not found");
        s.Resolved = true;
        s.ResolvedAt = _clock.UtcNow;
        s.ResolvedBy = User.FindFirst("name")?.Value;
        _audit.Log("sos.resolve", s.RideId, $"SOS {s.Id} resolved", s.TownId);
        await _db.SaveChangesAsync(ct);
        return Ok(new { ok = true });
    }

    // ---------------------------------------------------------------- company

    private static object CompanyView(CompanySettings c) => new
    {
        legalName = c.LegalName, brand = c.Brand, gstin = c.Gstin, address = c.Address, supportEmail = c.SupportEmail,
        supportPhone = c.SupportPhone, whatsappNumber = c.WhatsappNumber, commissionPct = c.CommissionPct, freeMonths = c.FreeMonths,
        incentiveTripsPerDay = c.IncentiveTripsPerDay, incentiveAmount = c.IncentiveAmount, offerWindowSec = c.OfferWindowSec,
        dispatchRounds = c.DispatchRounds, dispatchRadiusKm = c.DispatchRadiusKm,
    };

    private async Task<CompanySettings> Company(CancellationToken ct)
    {
        var c = await _db.Company.FirstOrDefaultAsync(ct);
        if (c is null) { c = new CompanySettings(); _db.Company.Add(c); }
        return c;
    }

    [HttpGet("settings/company")]
    public async Task<IActionResult> GetCompany(CancellationToken ct) => Ok(CompanyView(await Company(ct)));

    [HttpPut("settings/company")]
    [Authorize(Policy = Policies.Owner)]
    public async Task<IActionResult> SaveCompany([FromBody] CompanyBody b, CancellationToken ct)
    {
        var c = await Company(ct);
        string S(string? v, string cur, int max) => v is null ? cur : (v.Trim().Length > max ? throw ApiException.Validation("Value too long") : v.Trim());
        c.LegalName = S(b.LegalName, c.LegalName, 200);
        c.Brand = S(b.Brand, c.Brand, 200);
        c.Gstin = S(b.Gstin, c.Gstin, 20);
        c.Address = S(b.Address, c.Address, 400);
        c.SupportEmail = S(b.SupportEmail, c.SupportEmail, 200);
        c.SupportPhone = S(b.SupportPhone, c.SupportPhone, 30);
        c.WhatsappNumber = S(b.WhatsappNumber, c.WhatsappNumber, 30);
        if (b.CommissionPct is { } p) c.CommissionPct = p is >= 0 and <= 50 ? p : throw ApiException.Validation("commissionPct must be 0–50");
        if (b.FreeMonths is { } fm) c.FreeMonths = fm is >= 0 and <= 36 ? fm : throw ApiException.Validation("freeMonths must be 0–36");
        if (b.IncentiveTripsPerDay is { } it) c.IncentiveTripsPerDay = it is >= 0 and <= 100 ? it : throw ApiException.Validation("incentiveTripsPerDay out of range");
        if (b.IncentiveAmount is { } ia) c.IncentiveAmount = ia is >= 0 and <= 10000 ? ia : throw ApiException.Validation("incentiveAmount out of range");
        if (b.OfferWindowSec is { } ow) c.OfferWindowSec = ow is >= 5 and <= 120 ? ow : throw ApiException.Validation("offerWindowSec out of range");
        if (b.DispatchRounds is { } dr) c.DispatchRounds = dr is >= 1 and <= 10 ? dr : throw ApiException.Validation("dispatchRounds out of range");
        if (b.DispatchRadiusKm is { } rk) c.DispatchRadiusKm = rk is > 0 and <= 50 ? rk : throw ApiException.Validation("dispatchRadiusKm out of range");
        _audit.Log("settings.company", "company", "Company details / commission updated");
        await _db.SaveChangesAsync(ct);
        return Ok(CompanyView(c));
    }

    // ---------------------------------------------------------------- terms

    private async Task<object> TermsView(CancellationToken ct)
    {
        var all = await _db.TermsVersions.AsNoTracking().OrderBy(t => t.PublishedAt).ThenBy(t => t.Id).ToListAsync(ct);
        var cur = all.LastOrDefault();
        return new
        {
            currentVersion = cur?.Version,
            publishedAt = cur?.PublishedAt.ToString("yyyy-MM-dd"),
            versions = all.Select(t => new { version = t.Version, publishedAt = t.PublishedAt.ToString("yyyy-MM-dd"), by = t.By }).ToList(),
            te = cur?.Te ?? "",
            en = cur?.En ?? "",
        };
    }

    [HttpGet("terms")]
    public async Task<IActionResult> Terms(CancellationToken ct) => Ok(await TermsView(ct));

    [HttpPost("terms")]
    [Authorize(Policy = Policies.Owner)]
    public async Task<IActionResult> PublishTerms([FromBody] PublishTermsBody b, CancellationToken ct)
    {
        var version = RideService.Trim(b.Version, 20) ?? throw ApiException.Validation("version is required");
        if (string.IsNullOrWhiteSpace(b.Te) || string.IsNullOrWhiteSpace(b.En)) throw ApiException.Validation("Telugu and English text are required");
        if (b.Te.Length > 100_000 || b.En.Length > 100_000) throw ApiException.Validation("Terms text too long");
        if (await _db.TermsVersions.AnyAsync(t => t.Version == version, ct)) throw ApiException.Validation($"Version {version} already exists");
        _db.TermsVersions.Add(new TermsVersion { Version = version, PublishedAt = Ist.Today(_clock), By = User.FindFirst("name")?.Value ?? "owner", Te = b.Te.Trim(), En = b.En.Trim() });
        _audit.Log("terms.publish", $"v{version}", "Telugu + English");
        await _db.SaveChangesAsync(ct);
        return Ok(await TermsView(ct));
    }

    // ---------------------------------------------------------------- templates

    private static object TemplateView(MessageTemplate t) => new { id = t.Id, channel = t.Channel, key = t.Key, langs = t.Langs, status = t.Status, te = t.Te, en = t.En };

    [HttpGet("templates")]
    public async Task<IActionResult> Templates(CancellationToken ct) =>
        Ok((await _db.MessageTemplates.AsNoTracking().OrderBy(t => t.Id).ToListAsync(ct)).Select(TemplateView));

    [HttpPut("templates/{id}")]
    [Authorize(Policy = Policies.Owner)]
    public Task<IActionResult> SaveTemplate(string id, [FromBody] TemplateBody b, CancellationToken ct)
    {
        b.Id = id;
        return UpsertTemplate(b, ct);
    }

    [HttpPost("templates")]
    [Authorize(Policy = Policies.Owner)]
    public Task<IActionResult> AddTemplate([FromBody] TemplateBody b, CancellationToken ct)
    {
        b.Id = null;
        return UpsertTemplate(b, ct);
    }

    private async Task<IActionResult> UpsertTemplate(TemplateBody b, CancellationToken ct)
    {
        var key = RideService.Trim(b.Key, 60) ?? throw ApiException.Validation("key is required");
        if (b.Channel is not ("sms" or "whatsapp")) throw ApiException.Validation("channel must be sms or whatsapp");
        MessageTemplate? t = null;
        if (b.Id != null) t = await _db.MessageTemplates.FirstOrDefaultAsync(x => x.Id == b.Id, ct) ?? throw ApiException.NotFound("Template not found");
        if (t is null)
        {
            var n = await _db.MessageTemplates.CountAsync(ct) + 1;
            var id = $"tpl_{n}";
            while (await _db.MessageTemplates.AnyAsync(x => x.Id == id, ct)) id = $"tpl_{++n}";
            t = new MessageTemplate { Id = id };
            _db.MessageTemplates.Add(t);
        }
        t.Key = key;
        t.Channel = b.Channel;
        t.Langs = (b.Langs ?? new() { "te", "en" }).Where(l => AuthController.Langs.Contains(l)).Distinct().ToList();
        t.Status = b.Status is "approved" or "pending_review" or "rejected" ? b.Status : "pending_review";
        t.Te = (b.Te ?? "").Length > 1000 ? throw ApiException.Validation("Text too long") : b.Te ?? "";
        t.En = (b.En ?? "").Length > 1000 ? throw ApiException.Validation("Text too long") : b.En ?? "";
        _audit.Log("template.save", t.Id, key);
        await _db.SaveChangesAsync(ct);
        return Ok((await _db.MessageTemplates.AsNoTracking().OrderBy(x => x.Id).ToListAsync(ct)).Select(TemplateView));
    }

    // ---------------------------------------------------------------- users

    private static object UserView(User u) => new { id = u.Id, name = u.Name, email = u.Email, role = u.Role, townId = u.TownId, lastLogin = u.LastLoginAt };

    [HttpGet("users")]
    [Authorize(Policy = Policies.Owner)]
    public async Task<IActionResult> Users(CancellationToken ct) =>
        Ok((await _db.Users.AsNoTracking().Where(u => (u.Role == Roles.Owner || u.Role == Roles.TownManager) && !u.Disabled).OrderBy(u => u.CreatedAt).ToListAsync(ct)).Select(UserView));

    /// <summary>Adds a portal user. Returns `tempPassword` once (there is no e-mail service in v1: share it privately).</summary>
    [HttpPost("users")]
    [Authorize(Policy = Policies.Owner)]
    public async Task<IActionResult> AddUser([FromBody] AddUserBody b, CancellationToken ct)
    {
        var name = RideService.Trim(b.Name, 100) ?? throw ApiException.Validation("name is required");
        var email = (b.Email ?? "").Trim().ToLowerInvariant();
        if (email.Length is < 5 or > 200 || !email.Contains('@') || email.Contains(' ')) throw ApiException.Validation("A valid email is required");
        var role = b.Role is Roles.Owner ? Roles.Owner : b.Role is Roles.TownManager or null ? Roles.TownManager : throw ApiException.Validation("role must be owner or town_manager");
        string? townId = null;
        if (role == Roles.TownManager)
        {
            townId = b.TownId;
            if (townId is null || !await _db.Towns.AnyAsync(t => t.Id == townId, ct)) throw ApiException.Validation("A town manager needs a town");
        }
        var existing = await _db.Users.FirstOrDefaultAsync(u => u.Email == email, ct);
        if (existing is { Disabled: false }) throw new ApiException(409, "validation", "A user with this email already exists");
        var password = string.IsNullOrWhiteSpace(b.Password) ? IdGen.Token(14) : b.Password;
        if (password.Length < 10) throw ApiException.Validation("Password must be at least 10 characters");
        var u = existing ?? new User { Id = IdGen.New("u"), CreatedAt = _clock.UtcNow };
        u.Name = name;
        u.Email = email;
        u.Role = role;
        u.TownId = townId;
        u.Disabled = false;
        u.PasswordHash = _hasher.HashPassword(u, password);
        if (existing is null) _db.Users.Add(u);
        _audit.Log("user.add", email, $"{role}{(townId != null ? " · " + townId : "")}", townId);
        await _db.SaveChangesAsync(ct);
        return Ok(new { id = u.Id, name = u.Name, email = u.Email, role = u.Role, townId = u.TownId, lastLogin = u.LastLoginAt, tempPassword = string.IsNullOrWhiteSpace(b.Password) ? password : null });
    }

    [HttpDelete("users/{id}")]
    [Authorize(Policy = Policies.Owner)]
    public async Task<IActionResult> RemoveUser(string id, CancellationToken ct)
    {
        var u = await _db.Users.FirstOrDefaultAsync(x => x.Id == id && (x.Role == Roles.Owner || x.Role == Roles.TownManager), ct) ?? throw ApiException.NotFound("User not found");
        if (u.Id == User.UserId()) throw ApiException.Validation("You cannot remove yourself");
        if (u.Role == Roles.Owner && await _db.Users.CountAsync(x => x.Role == Roles.Owner && !x.Disabled, ct) <= 1)
            throw ApiException.Validation("At least one owner must remain");
        u.Disabled = true; // tokens stop working on the next request (checked on every call)
        u.PasswordHash = null;
        _audit.Log("user.remove", u.Email ?? u.Id, "", u.TownId);
        await _db.SaveChangesAsync(ct);
        return Ok(new { ok = true });
    }

    // ---------------------------------------------------------------- audit

    [HttpGet("audit")]
    [Authorize(Policy = Policies.Owner)]
    public async Task<IActionResult> Audit([FromQuery] int? limit, CancellationToken ct) =>
        Ok(await _db.AuditLog.AsNoTracking().OrderByDescending(a => a.At).ThenByDescending(a => a.Id).Take(Math.Clamp(limit ?? 100, 1, 1000))
            .Select(a => new { id = "aud_" + a.Id, at = a.At, by = a.By, action = a.Action, target = a.Target, detail = a.Detail }).ToListAsync(ct));
}

public record PayBody(string? Utr);

[ApiController]
[Route("api/settlements")]
[Authorize(Policy = Policies.Admin)]
public class SettlementsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly SettlementService _svc;
    private readonly AccountService _accounts;
    private readonly AuditService _audit;

    public SettlementsController(AppDbContext db, SettlementService svc, AccountService accounts, AuditService audit)
    {
        _db = db;
        _svc = svc;
        _accounts = accounts;
        _audit = audit;
    }

    /// <summary>GET /api/settlements?town=&amp;period=current|previous|yyyy-MM-dd (week Mon–Sun IST).</summary>
    [HttpGet]
    public async Task<IActionResult> List([FromQuery] string? town, [FromQuery] string? period, CancellationToken ct)
    {
        var scope = User.ScopeTown(town);
        var week = _svc.ResolvePeriod(period);
        List<string>? ids = null;
        if (scope != null) ids = await _db.Captains.Where(c => c.TownId == scope).Select(c => c.Id).ToListAsync(ct);
        var rows = await _svc.ComputeAsync(week, ids, ct);
        var capIds = rows.Select(r => r.CaptainId).ToList();
        var caps = await _db.Captains.AsNoTracking().Include(c => c.User).Include(c => c.Kyc).Include(c => c.Documents).Where(c => capIds.Contains(c.Id)).ToListAsync(ct);
        var stats = await _accounts.StatsAsync(capIds, ct);
        return Ok(rows.Select(r =>
        {
            var c = caps.FirstOrDefault(x => x.Id == r.CaptainId);
            return SettlementService.View(r, c is null ? null : Views.ForAdmin(c, stats[c.Id]));
        }).OrderBy(x => ((string?)((Dictionary<string, object?>?)x["captain"])?["name"]) ?? ""));
    }

    [HttpPost("{id}/pay")]
    public async Task<IActionResult> Pay(string id, [FromBody] PayBody? body, CancellationToken ct)
    {
        if (!SettlementService.TryParseId(id, out var captainId, out _)) throw ApiException.NotFound("Settlement not found");
        var c = await _db.Captains.AsNoTracking().FirstOrDefaultAsync(x => x.Id == captainId, ct);
        if (c is null || !User.CanSeeTown(c.TownId)) throw ApiException.NotFound("Settlement not found");
        var s = await _svc.PayAsync(id, body?.Utr, User.FindFirst("name")?.Value ?? "", ct);
        _audit.Log("settlement.paid", captainId, $"{s.Utr} · ₹{s.Payout}", c.TownId);
        await _db.SaveChangesAsync(ct);
        return Ok(SettlementService.View(s, null));
    }
}
