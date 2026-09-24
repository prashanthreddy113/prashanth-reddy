using ManaBandi.Api.Auth;
using ManaBandi.Api.Data;
using ManaBandi.Api.Infrastructure;
using ManaBandi.Api.Models;
using ManaBandi.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ManaBandi.Api.Controllers;

public class RuleBody { public double Pct { get; set; } public int FreeMonths { get; set; } public double? FreePct { get; set; } public string? EffectiveFrom { get; set; } }
public class CommissionSaveBody { public RuleBody? DefaultRule { get; set; } public Dictionary<string, double?>? ServiceOverrides { get; set; } }
public class TownOverrideBody
{
    public string? Id { get; set; }
    public string? TownId { get; set; }
    public string? Service { get; set; }
    public double Pct { get; set; }
    public int FreeMonths { get; set; }
    public double? FreePct { get; set; }
    public string? EffectiveFrom { get; set; }
    public string? Status { get; set; }
    public string? Note { get; set; }
}

/// <summary>Commission rules: owners edit, town managers read, captains resolve their own line.</summary>
[ApiController]
[Route("api/config/commission")]
[Authorize]
public class CommissionController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly CommissionService _svc;
    private readonly AuditService _audit;
    private readonly IClock _clock;

    public CommissionController(AppDbContext db, CommissionService svc, AuditService audit, IClock clock)
    {
        _db = db;
        _svc = svc;
        _audit = audit;
        _clock = clock;
    }

    /// <summary>
    /// No query → full config { defaultRule, serviceOverrides, townOverrides } (admins).
    /// ?town=&amp;service=&amp;captainId=&amp;fare=&amp;on= → resolved { pct, commission, captainGets, rule, reason } (admins; captains for themselves).
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> Get([FromQuery] string? town, [FromQuery] string? service, [FromQuery] string? captainId,
        [FromQuery] int? fare, [FromQuery] string? on, [FromQuery] string? joinedAt, CancellationToken ct)
    {
        var resolve = town != null || service != null || captainId != null || fare != null;
        var role = User.Role();
        if (!resolve)
        {
            if (!User.IsAdmin()) throw ApiException.Forbidden();
            return Ok(await _svc.GetConfigAsync(ct));
        }
        Captain? c = null;
        if (role == Roles.Captain)
        {
            var uid = User.UserId();
            c = await _db.Captains.AsNoTracking().FirstOrDefaultAsync(x => x.UserId == uid, ct) ?? throw ApiException.NotFound("Captain not found");
            if (captainId != null && captainId != c.Id) throw ApiException.Forbidden();
        }
        else if (User.IsAdmin())
        {
            if (captainId != null)
            {
                c = await _db.Captains.AsNoTracking().FirstOrDefaultAsync(x => x.Id == captainId, ct);
                if (c is null || !User.CanSeeTown(c.TownId)) throw ApiException.NotFound("Captain not found");
            }
        }
        else throw ApiException.Forbidden();

        var svc = service ?? c?.VehicleType ?? "bike";
        AreaService.ValidateService(svc);
        var fareV = fare ?? 100;
        if (fareV is < 0 or > 100000) throw ApiException.Validation("fare out of range");
        var date = KycRules.ParseDate(on) ?? Ist.Today(_clock);
        var cfg = await _svc.GetConfigAsync(ct);
        var res = CommissionResolver.Resolve(cfg, town ?? c?.TownId, svc, fareV, c?.JoinedAt ?? KycRules.ParseDate(joinedAt), date);
        return Ok(res);
    }

    private static string? Date(string? s)
    {
        if (string.IsNullOrWhiteSpace(s)) return null;
        return KycRules.ParseDate(s) is { } d ? d.ToString("yyyy-MM-dd") : throw ApiException.Validation("effectiveFrom must be yyyy-MM-dd");
    }

    private static void CheckRule(double pct, int freeMonths, double freePct)
    {
        if (pct is < 0 or > 50) throw ApiException.Validation("pct must be 0–50");
        if (freeMonths is < 0 or > 36) throw ApiException.Validation("freeMonths must be 0–36");
        if (freePct is < 0 or > 50) throw ApiException.Validation("freePct must be 0–50");
    }

    [HttpPut]
    [Authorize(Policy = Policies.Owner)]
    public async Task<IActionResult> Save([FromBody] CommissionSaveBody b, CancellationToken ct)
    {
        var who = _audit.ActorEmailOrName();
        var on = Ist.Today(_clock).ToString("yyyy-MM-dd");
        var now = _clock.UtcNow;
        var before = await _svc.GetConfigAsync(ct);
        if (b.DefaultRule is { } d)
        {
            var freePct = d.FreePct ?? 0;
            CheckRule(d.Pct, d.FreeMonths, freePct);
            var eff = Date(d.EffectiveFrom);
            var row = await _db.CommissionRules.FirstOrDefaultAsync(r => r.Scope == "default", ct);
            if (row is null) { row = new CommissionRule { Id = IdGen.New("co"), Scope = "default", CreatedAt = now, CreatedBy = who }; _db.CommissionRules.Add(row); }
            var o = before.DefaultRule;
            var changes = new List<string>();
            if (o.Pct != d.Pct) changes.Add($"default {o.Pct}% → {d.Pct}%");
            if (o.FreeMonths != d.FreeMonths) changes.Add($"free months {o.FreeMonths} → {d.FreeMonths}");
            if (o.FreePct != freePct) changes.Add($"free-period % {o.FreePct} → {freePct}");
            if (o.EffectiveFrom != eff) changes.Add($"effective from {o.EffectiveFrom} → {eff}");
            foreach (var ch in changes) _audit.Log("commission.default", "default", $"{who} changed {ch} on {on}");
            row.Pct = d.Pct;
            row.FreeMonths = d.FreeMonths;
            row.FreePct = freePct;
            row.EffectiveFrom = KycRules.ParseDate(eff);
            row.UpdatedAt = now;
        }
        if (b.ServiceOverrides != null)
        {
            foreach (var svc in AreaService.Services)
            {
                b.ServiceOverrides.TryGetValue(svc, out var pct);
                if (pct is < 0 or > 50) throw ApiException.Validation("service override must be 0–50");
                var a = before.ServiceOverrides.GetValueOrDefault(svc);
                if (a != pct) _audit.Log("commission.service", svc, $"{who} changed {svc} {(a is null ? "default" : a + "%")} → {(pct is null ? "default" : pct + "%")} on {on}");
                var rows = await _db.CommissionRules.Where(r => r.Scope == "service" && r.Service == svc).ToListAsync(ct);
                if (pct is null) _db.CommissionRules.RemoveRange(rows);
                else
                {
                    var row = rows.FirstOrDefault();
                    if (row is null) { row = new CommissionRule { Id = IdGen.New("co"), Scope = "service", Service = svc, CreatedAt = now, CreatedBy = who }; _db.CommissionRules.Add(row); }
                    row.Pct = pct.Value;
                    row.Status = "active";
                    row.UpdatedAt = now;
                    _db.CommissionRules.RemoveRange(rows.Skip(1));
                }
            }
        }
        await _db.SaveChangesAsync(ct);
        return Ok(await _svc.GetConfigAsync(ct));
    }

    private async Task Fill(CommissionRule row, TownOverrideBody b, CancellationToken ct)
    {
        if (b.TownId is null || !await _db.Towns.AnyAsync(t => t.Id == b.TownId, ct)) throw ApiException.Validation("Unknown town");
        var svc = b.Service ?? "all";
        if (svc != "all") AreaService.ValidateService(svc);
        var freePct = b.FreePct ?? 0;
        CheckRule(b.Pct, b.FreeMonths, freePct);
        row.TownId = b.TownId;
        row.Service = svc;
        row.Scope = svc == "all" ? "town" : "town_service";
        row.Pct = b.Pct;
        row.FreeMonths = b.FreeMonths;
        row.FreePct = freePct;
        row.EffectiveFrom = KycRules.ParseDate(Date(b.EffectiveFrom));
        row.Status = b.Status is "active" or "scheduled" or "disabled" ? b.Status : "active";
        row.Note = RideService.Trim(b.Note, 200);
        row.UpdatedAt = _clock.UtcNow;
    }

    private static TownOverrideDto Dto(CommissionRule r) =>
        new(r.Id, r.TownId!, r.Service ?? "all", r.Pct, r.FreeMonths, r.FreePct, CommissionService.D(r.EffectiveFrom), r.Status, r.Note);

    [HttpPost("towns")]
    [Authorize(Policy = Policies.Owner)]
    public async Task<IActionResult> AddTown([FromBody] TownOverrideBody b, CancellationToken ct)
    {
        var who = _audit.ActorEmailOrName();
        var row = new CommissionRule { Id = IdGen.New("co"), CreatedAt = _clock.UtcNow, CreatedBy = who, SortOrder = await _db.CommissionRules.CountAsync(ct) };
        await Fill(row, b, ct);
        _db.CommissionRules.Add(row);
        _audit.Log("commission.town", row.TownId!, $"{who} added {row.TownId}/{row.Service} {row.Pct}% (free {row.FreeMonths} m @ {row.FreePct}%) from {CommissionService.D(row.EffectiveFrom)} on {Ist.Today(_clock):yyyy-MM-dd}", row.TownId);
        await _db.SaveChangesAsync(ct);
        return Ok(Dto(row));
    }

    [HttpPut("towns/{id}")]
    [Authorize(Policy = Policies.Owner)]
    public async Task<IActionResult> UpdateTown(string id, [FromBody] TownOverrideBody b, CancellationToken ct)
    {
        var row = await _db.CommissionRules.FirstOrDefaultAsync(r => r.Id == id && (r.Scope == "town" || r.Scope == "town_service"), ct)
                  ?? throw ApiException.NotFound("Override not found");
        var who = _audit.ActorEmailOrName();
        var a = Dto(row);
        await Fill(row, b, ct);
        _audit.Log("commission.town", row.TownId!, $"{who} changed {a.TownId}/{a.Service} {a.Pct}% → {row.TownId}/{row.Service} {row.Pct}% ({row.Status}) on {Ist.Today(_clock):yyyy-MM-dd}", row.TownId);
        await _db.SaveChangesAsync(ct);
        return Ok(Dto(row));
    }

    [HttpDelete("towns/{id}")]
    [Authorize(Policy = Policies.Owner)]
    public async Task<IActionResult> DeleteTown(string id, CancellationToken ct)
    {
        var row = await _db.CommissionRules.FirstOrDefaultAsync(r => r.Id == id && (r.Scope == "town" || r.Scope == "town_service"), ct);
        if (row != null)
        {
            var who = _audit.ActorEmailOrName();
            _db.CommissionRules.Remove(row);
            _audit.Log("commission.town", row.TownId!, $"{who} deleted {row.TownId}/{row.Service} {row.Pct}% override on {Ist.Today(_clock):yyyy-MM-dd}", row.TownId);
            await _db.SaveChangesAsync(ct);
        }
        return Ok(new { ok = true });
    }
}
