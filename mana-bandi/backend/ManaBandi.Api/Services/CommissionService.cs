using ManaBandi.Api.Data;
using ManaBandi.Api.Infrastructure;
using ManaBandi.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace ManaBandi.Api.Services;

public record RuleDto(double Pct, int FreeMonths, double FreePct, string? EffectiveFrom);

public record TownOverrideDto(string Id, string TownId, string Service, double Pct, int FreeMonths, double FreePct, string? EffectiveFrom, string Status, string? Note);

public record CommissionConfig(RuleDto DefaultRule, Dictionary<string, double?> ServiceOverrides, List<TownOverrideDto> TownOverrides);

public record CommissionResult(double Pct, int Commission, int CaptainGets, string Rule, string Reason);

public static class CommissionResolver
{
    /// <summary>
    /// Port of owner-web resolveCommission(). Order: town+service → town "all" → service override → default.
    /// A rule whose effectiveFrom is in the future is skipped; captains inside joinedAt + freeMonths pay freePct.
    /// </summary>
    public static CommissionResult Resolve(CommissionConfig cfg, string? townId, string service, int fare, DateOnly? joinedAt, DateOnly on)
    {
        var date = on.ToString("yyyy-MM-dd");
        bool Active(TownOverrideDto o) => o.Status != "disabled" && (string.IsNullOrEmpty(o.EffectiveFrom) || string.CompareOrdinal(o.EffectiveFrom, date) <= 0);
        var ts = cfg.TownOverrides.FirstOrDefault(o => o.TownId == townId && o.Service == service && Active(o));
        var ta = cfg.TownOverrides.FirstOrDefault(o => o.TownId == townId && o.Service == "all" && Active(o));
        RuleDto rule;
        string ruleName;
        var isDefault = false;
        if (ts != null) { rule = new RuleDto(ts.Pct, ts.FreeMonths, ts.FreePct, ts.EffectiveFrom); ruleName = $"Town override · {townId} / {service}"; }
        else if (ta != null) { rule = new RuleDto(ta.Pct, ta.FreeMonths, ta.FreePct, ta.EffectiveFrom); ruleName = $"Town override · {townId} / all services"; }
        else if (cfg.ServiceOverrides.TryGetValue(service, out var sp) && sp != null) { rule = cfg.DefaultRule with { Pct = sp.Value }; ruleName = $"Service override · {service}"; }
        else { rule = cfg.DefaultRule; ruleName = "Default rule"; isDefault = true; }

        if (isDefault && !string.IsNullOrEmpty(rule.EffectiveFrom) && string.CompareOrdinal(rule.EffectiveFrom, date) > 0)
            return new CommissionResult(0, 0, fare, ruleName, $"Default rule is effective only from {rule.EffectiveFrom}");

        var pct = rule.Pct;
        var reason = $"{ruleName}: {Num(pct)}%";
        if (joinedAt is { } j && rule.FreeMonths > 0)
        {
            var freeTill = j.AddMonths(rule.FreeMonths);
            var freeTillS = freeTill.ToString("yyyy-MM-dd");
            if (on < freeTill)
            {
                pct = rule.FreePct;
                reason = $"{ruleName}: captain joined {j:yyyy-MM-dd}, inside {rule.FreeMonths} free month(s) (till {freeTillS}) → {Num(pct)}%";
            }
            else reason += $" (free period ended {freeTillS})";
        }
        var commission = Money.Round(fare * pct / 100.0);
        return new CommissionResult(pct, commission, fare - commission, ruleName, reason);
    }

    private static string Num(double d) => d.ToString("0.##", System.Globalization.CultureInfo.InvariantCulture);
}

public class CommissionService
{
    private readonly AppDbContext _db;
    private readonly IClock _clock;

    public CommissionService(AppDbContext db, IClock clock)
    {
        _db = db;
        _clock = clock;
    }

    public static string? D(DateOnly? d) => d?.ToString("yyyy-MM-dd");

    public async Task<CommissionConfig> GetConfigAsync(CancellationToken ct = default)
    {
        var rules = await _db.CommissionRules.AsNoTracking().OrderBy(r => r.SortOrder).ThenBy(r => r.CreatedAt).ToListAsync(ct);
        var def = rules.FirstOrDefault(r => r.Scope == "default");
        var defaultRule = def is null ? new RuleDto(10, 3, 0, null) : new RuleDto(def.Pct, def.FreeMonths, def.FreePct, D(def.EffectiveFrom));
        var svc = new Dictionary<string, double?> { ["bike"] = null, ["auto"] = null, ["parcel"] = null };
        foreach (var r in rules.Where(r => r.Scope == "service" && r.Service != null && r.Status != "disabled")) svc[r.Service!] = r.Pct;
        var towns = rules.Where(r => r.Scope is "town" or "town_service")
            .Select(r => new TownOverrideDto(r.Id, r.TownId!, r.Service ?? "all", r.Pct, r.FreeMonths, r.FreePct, D(r.EffectiveFrom), r.Status, r.Note))
            .ToList();
        return new CommissionConfig(defaultRule, svc, towns);
    }

    public async Task<CommissionResult> ResolveAsync(string? townId, string service, int fare, DateOnly? joinedAt, CancellationToken ct = default)
    {
        var cfg = await GetConfigAsync(ct);
        return CommissionResolver.Resolve(cfg, townId, service, fare, joinedAt, Ist.Today(_clock));
    }

    /// <summary>The captain app's commission block: base pct of the matching rule, free months, and what applies today.</summary>
    public async Task<object> CaptainCommissionAsync(Captain c, CancellationToken ct = default)
    {
        var cfg = await GetConfigAsync(ct);
        var today = Ist.Today(_clock);
        var noJoin = CommissionResolver.Resolve(cfg, c.TownId, c.VehicleType, 1000, null, today);
        var now = CommissionResolver.Resolve(cfg, c.TownId, c.VehicleType, 1000, c.JoinedAt, today);
        var rule = RuleFor(cfg, c.TownId, c.VehicleType, today);
        return new { pct = noJoin.Pct, freeMonths = rule.FreeMonths, freePct = rule.FreePct, currentPct = now.Pct, rule = now.Rule, reason = now.Reason };
    }

    private static RuleDto RuleFor(CommissionConfig cfg, string? townId, string service, DateOnly on)
    {
        var date = on.ToString("yyyy-MM-dd");
        bool Active(TownOverrideDto o) => o.Status != "disabled" && (string.IsNullOrEmpty(o.EffectiveFrom) || string.CompareOrdinal(o.EffectiveFrom, date) <= 0);
        var o = cfg.TownOverrides.FirstOrDefault(x => x.TownId == townId && x.Service == service && Active(x))
                ?? cfg.TownOverrides.FirstOrDefault(x => x.TownId == townId && x.Service == "all" && Active(x));
        if (o != null) return new RuleDto(o.Pct, o.FreeMonths, o.FreePct, o.EffectiveFrom);
        return cfg.ServiceOverrides.TryGetValue(service, out var sp) && sp != null ? cfg.DefaultRule with { Pct = sp.Value } : cfg.DefaultRule;
    }
}
