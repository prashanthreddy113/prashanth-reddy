using ManaBandi.Api.Data;
using ManaBandi.Api.Infrastructure;
using ManaBandi.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace ManaBandi.Api.Services;

public class SettlementLine
{
    public string Service { get; set; } = "";
    public int Amount { get; set; }
    public double Pct { get; set; }
    public int Commission { get; set; }
    public string Rule { get; set; } = "";
}

public class SettlementCalc
{
    public string Id { get; set; } = "";
    public string CaptainId { get; set; } = "";
    public DateOnly Start { get; set; }
    public DateOnly End { get; set; }
    public int CashCollected { get; set; }
    public int UpiEarned { get; set; }
    public Dictionary<string, int> ByService { get; set; } = new();
    public int CodHeld { get; set; }
    public int Incentive { get; set; }
    public List<SettlementLine> Lines { get; set; } = new();
    public int Commission { get; set; }
    public int Payout { get; set; }
    public int Trips { get; set; }
    public string Status { get; set; } = "due";
    public DateTime? PaidAt { get; set; }
    public string? Utr { get; set; }
}

/// <summary>Weekly (Mon–Sun IST) settlements computed from finished rides with the commission frozen on each ride.</summary>
public class SettlementService
{
    private readonly AppDbContext _db;
    private readonly IClock _clock;

    public SettlementService(AppDbContext db, IClock clock)
    {
        _db = db;
        _clock = clock;
    }

    public static string IdFor(string captainId, DateOnly weekStart) => $"stl_{captainId}_{weekStart:yyyyMMdd}";

    public DateOnly ResolvePeriod(string? period)
    {
        var today = Ist.Today(_clock);
        if (string.IsNullOrWhiteSpace(period) || period == "current") return Ist.WeekStart(today);
        if (period == "previous") return Ist.WeekStart(today).AddDays(-7);
        var d = KycRules.ParseDate(period) ?? throw ApiException.Validation("period must be current, previous or a date (yyyy-MM-dd)");
        return Ist.WeekStart(d);
    }

    public async Task<List<SettlementCalc>> ComputeAsync(DateOnly weekStart, IReadOnlyCollection<string>? captainIds, CancellationToken ct = default)
    {
        var from = Ist.StartUtc(weekStart);
        var to = Ist.StartUtc(weekStart.AddDays(7));
        var q = _db.Rides.AsNoTracking().Where(r => r.Status == RideStatus.Finished && r.CaptainId != null && r.FinishedAt >= from && r.FinishedAt < to);
        if (captainIds != null) q = q.Where(r => captainIds.Contains(r.CaptainId!));
        var rides = await q.Select(r => new
        {
            r.CaptainId, r.Service, fare = r.FareFinal ?? 0, com = r.CommissionAmount ?? 0, r.CommissionRule,
            method = r.PaidMethod ?? r.Payment, r.CodAmount, r.CodCollected, r.FinishedAt,
        }).ToListAsync(ct);
        var company = await _db.Company.AsNoTracking().FirstOrDefaultAsync(ct) ?? new CompanySettings();
        var stored = await _db.Settlements.AsNoTracking().Where(s => s.PeriodStart == weekStart && (captainIds == null || captainIds.Contains(s.CaptainId))).ToListAsync(ct);

        var result = new List<SettlementCalc>();
        foreach (var g in rides.GroupBy(r => r.CaptainId!))
        {
            var s = new SettlementCalc { Id = IdFor(g.Key, weekStart), CaptainId = g.Key, Start = weekStart, End = weekStart.AddDays(6), Trips = g.Count() };
            s.CashCollected = g.Where(r => r.method == "cash").Sum(r => r.fare);
            s.UpiEarned = g.Where(r => r.method != "cash").Sum(r => r.fare);
            s.ByService = g.GroupBy(r => r.Service).ToDictionary(x => x.Key, x => x.Sum(r => r.fare));
            s.CodHeld = g.Where(r => r.CodCollected).Sum(r => r.CodAmount);
            if (company.IncentiveTripsPerDay > 0 && company.IncentiveAmount > 0)
                s.Incentive = g.GroupBy(r => Ist.DateOf(r.FinishedAt!.Value)).Count(d => d.Count() >= company.IncentiveTripsPerDay) * company.IncentiveAmount;
            s.Lines = g.GroupBy(r => r.Service).Where(x => x.Sum(r => r.fare) > 0).Select(x =>
            {
                var amt = x.Sum(r => r.fare);
                var com = x.Sum(r => r.com);
                var rule = x.OrderByDescending(r => r.FinishedAt).First().CommissionRule ?? "";
                var colon = rule.IndexOf(':');
                return new SettlementLine { Service = x.Key, Amount = amt, Commission = com, Pct = amt > 0 ? Math.Round(com * 100.0 / amt, 1) : 0, Rule = colon > 0 ? rule[..colon] : rule };
            }).ToList();
            s.Commission = s.Lines.Sum(l => l.Commission);
            s.Payout = s.UpiEarned + s.Incentive - s.Commission - s.CodHeld;
            result.Add(s);
        }
        foreach (var st in stored)
        {
            var s = result.FirstOrDefault(x => x.CaptainId == st.CaptainId);
            if (s is null) continue;
            s.Status = st.Status;
            s.PaidAt = st.PaidAt;
            s.Utr = st.Utr;
            if (st.Status == "paid")
            {
                // show what was actually paid
                s.CashCollected = st.CashCollected;
                s.UpiEarned = st.UpiEarned;
                s.Commission = st.Commission;
                s.CodHeld = st.CodHeld;
                s.Incentive = st.Incentive;
                s.Payout = st.Payout;
            }
        }
        return result;
    }

    public async Task<SettlementCalc?> ForCaptainAsync(Captain c, DateOnly weekStart, CancellationToken ct = default) =>
        (await ComputeAsync(weekStart, new[] { c.Id }, ct)).FirstOrDefault();

    public static bool TryParseId(string id, out string captainId, out DateOnly weekStart)
    {
        captainId = "";
        weekStart = default;
        if (!id.StartsWith("stl_") || id.Length < 14) return false;
        var datePart = id[^8..];
        if (!DateOnly.TryParseExact(datePart, "yyyyMMdd", out weekStart)) return false;
        captainId = id[4..^9];
        return captainId.Length > 0 && id[^9] == '_';
    }

    public async Task<SettlementCalc> PayAsync(string id, string? utr, string paidBy, CancellationToken ct = default)
    {
        if (!TryParseId(id, out var captainId, out var weekStart)) throw ApiException.NotFound("Settlement not found");
        var calc = (await ComputeAsync(weekStart, new[] { captainId }, ct)).FirstOrDefault() ?? throw ApiException.NotFound("Settlement not found");
        if (calc.Status == "paid") throw ApiException.InvalidState("Already paid");
        utr = RideService.Trim(utr, 60) ?? $"UTR{IdGen.Digits(9)}";
        var now = _clock.UtcNow;
        var row = await _db.Settlements.FirstOrDefaultAsync(s => s.Id == id, ct);
        if (row is null)
        {
            row = new Settlement { Id = id, CaptainId = captainId, PeriodStart = weekStart, PeriodEnd = weekStart.AddDays(6) };
            _db.Settlements.Add(row);
        }
        row.CashCollected = calc.CashCollected;
        row.UpiEarned = calc.UpiEarned;
        row.Commission = calc.Commission;
        row.CodHeld = calc.CodHeld;
        row.Incentive = calc.Incentive;
        row.Payout = calc.Payout;
        row.Status = "paid";
        row.PaidAt = now;
        row.Utr = utr;
        row.PaidBy = paidBy;
        calc.Status = "paid";
        calc.PaidAt = now;
        calc.Utr = utr;
        return calc;
    }

    public static Dictionary<string, object?> View(SettlementCalc s, object? captain)
    {
        var gross = s.CashCollected + s.UpiEarned;
        return new Dictionary<string, object?>
        {
            ["id"] = s.Id,
            ["captainId"] = s.CaptainId,
            ["period"] = $"{s.Start:yyyy-MM-dd} → {s.End:yyyy-MM-dd}",
            ["periodStart"] = s.Start.ToString("yyyy-MM-dd"),
            ["periodEnd"] = s.End.ToString("yyyy-MM-dd"),
            ["cashCollected"] = s.CashCollected,
            ["upiEarned"] = s.UpiEarned,
            ["byService"] = s.ByService,
            ["codHeld"] = s.CodHeld,
            ["incentive"] = s.Incentive,
            ["trips"] = s.Trips,
            ["status"] = s.Status,
            ["paidAt"] = s.PaidAt,
            ["utr"] = s.Utr,
            ["captain"] = captain,
            ["lines"] = s.Lines.Select(l => new { service = l.Service, amount = l.Amount, pct = l.Pct, commission = l.Commission, rule = l.Rule }).ToList(),
            ["commissionPct"] = gross > 0 ? Math.Round(s.Commission * 100.0 / gross, 1) : 0,
            ["commission"] = s.Commission,
            ["payout"] = s.Payout,
        };
    }
}
