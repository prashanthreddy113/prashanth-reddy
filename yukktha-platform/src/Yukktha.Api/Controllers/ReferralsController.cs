using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Yukktha.Api.Data;
using Yukktha.Api.Data.Entities;
using Yukktha.Api.Services;

namespace Yukktha.Api.Controllers;

/// <summary>PL-3 + BL-4: BrightLoop's view of the referral programme: referrers, the report, and the credit ledger.</summary>
[ApiController, Route("api/superadmin/referrals"), Authorize(Policy = "SuperAdmin")]
public class ReferralsController(AppDbContext db, ReferralService referrals) : ControllerBase
{
    public record ReferrerCreate(string Name, ReferrerType Type, string? Phone, string? City, string? Notes, string? Code);
    public record ReferrerUpdate(string? Name, string? Phone, string? City, string? Notes, bool? Active);
    public record CreditUpdate(ReferralCreditStatus Status, string? Note);

    /// <summary>The report: one row per referrer with signups, funnel, revenue and credits, plus totals by referrer type.</summary>
    [HttpGet("report")]
    public async Task<IActionResult> Report([FromQuery] ReferrerType? type, [FromQuery] bool includeEmpty = false)
    {
        var rows = await BuildRowsAsync(type, includeEmpty);
        var totals = rows.GroupBy(r => r.Type).Select(g => new
        {
            type = g.Key, referrers = g.Count(), signups = g.Sum(r => r.Signups), trial = g.Sum(r => r.Trial), paying = g.Sum(r => r.Paying),
            pastDue = g.Sum(r => r.PastDue), churned = g.Sum(r => r.Churned), mrrInr = g.Sum(r => r.MrrInr),
            creditPendingInr = g.Sum(r => r.CreditPendingInr), creditSettledInr = g.Sum(r => r.CreditSettledInr)
        }).OrderBy(t => t.type).ToList();
        return Ok(new { totals, rows, joinLinkBase = referrals.JoinLink("CODE") });
    }

    [HttpGet("report.csv")]
    public async Task<IActionResult> ReportCsv([FromQuery] ReferrerType? type)
    {
        var rows = await BuildRowsAsync(type, true);
        var sb = new StringBuilder("Code,Name,Type,Phone,City,Signups,Trial,Paying,PastDue,Churned,MRR INR,Credit pending INR,Credit settled INR,Last signup\n");
        foreach (var r in rows)
            sb.AppendLine(string.Join(',', new[] { r.Code, Csv(r.Name), r.Type.ToString(), r.Phone ?? "", Csv(r.City ?? ""), r.Signups.ToString(), r.Trial.ToString(), r.Paying.ToString(),
                r.PastDue.ToString(), r.Churned.ToString(), r.MrrInr.ToString("0"), r.CreditPendingInr.ToString("0"), r.CreditSettledInr.ToString("0"), r.LastSignupAt?.ToString("yyyy-MM-dd") ?? "" }));
        return File(Encoding.UTF8.GetBytes(sb.ToString()), "text/csv", $"referrals-{DateTime.UtcNow:yyyyMMdd}.csv");
    }

    [HttpGet("referrers")]
    public async Task<IActionResult> Referrers([FromQuery] ReferrerType? type)
        => Ok(await BuildRowsAsync(type, true));

    [HttpPost("referrers")]
    public async Task<IActionResult> Create(ReferrerCreate r)
    {
        if (string.IsNullOrWhiteSpace(r.Name)) return BadRequest(new { error = "Name is required" });
        var code = string.IsNullOrWhiteSpace(r.Code) ? await referrals.UniqueCodeAsync(r.Name) : r.Code.Trim().ToUpperInvariant();
        if (await db.Referrers.AnyAsync(x => x.Code == code)) return Conflict(new { error = "Code already in use" });
        var referrer = new Referrer { Name = r.Name.Trim(), Type = r.Type, Code = code, City = r.City, Notes = r.Notes,
            Phone = string.IsNullOrWhiteSpace(r.Phone) ? null : Auth.PhoneUtil.Normalize(r.Phone) };
        db.Referrers.Add(referrer);
        await db.SaveChangesAsync();
        return Ok(new { referrer.Id, referrer.Code, referrer.Name, type = referrer.Type, joinLink = referrals.JoinLink(referrer.Code) });
    }

    [HttpPatch("referrers/{id:guid}")]
    public async Task<IActionResult> Update(Guid id, ReferrerUpdate r)
    {
        var x = await db.Referrers.FirstOrDefaultAsync(z => z.Id == id);
        if (x is null) return NotFound();
        if (r.Name is not null) x.Name = r.Name.Trim();
        if (r.Phone is not null) x.Phone = string.IsNullOrWhiteSpace(r.Phone) ? null : Auth.PhoneUtil.Normalize(r.Phone);
        if (r.City is not null) x.City = r.City;
        if (r.Notes is not null) x.Notes = r.Notes;
        if (r.Active is { } a) x.Active = a;
        await db.SaveChangesAsync();
        return Ok();
    }

    /// <summary>Stores a referrer brought in, with where each one is in the funnel.</summary>
    [HttpGet("referrers/{id:guid}/stores")]
    public async Task<IActionResult> ReferredStores(Guid id)
    {
        var stores = await db.Stores.IgnoreQueryFilters().AsNoTracking().Where(s => s.ReferrerId == id).OrderByDescending(s => s.CreatedAt).ToListAsync();
        return Ok(stores.Select(s => new { s.Id, s.Slug, s.Name, s.City, s.OwnerPhone, s.Plan, s.Status, s.TrialEndsAt, s.FirstPaidAt, s.CreatedAt, s.OnboardingCompleted }));
    }

    [HttpGet("credits")]
    public async Task<IActionResult> Credits([FromQuery] ReferralCreditStatus? status, [FromQuery] ReferralCreditType? type)
    {
        var q = db.ReferralCredits.AsNoTracking().AsQueryable();
        if (status is { } st) q = q.Where(c => c.Status == st);
        if (type is { } t) q = q.Where(c => c.Type == t);
        var list = await q.OrderByDescending(c => c.CreatedAt).Take(500).ToListAsync();
        var refIds = list.Select(c => c.ReferrerId).Distinct().ToList();
        var storeIds = list.Select(c => c.ReferredStoreId).Distinct().ToList();
        var refs = await db.Referrers.Where(r => refIds.Contains(r.Id)).ToDictionaryAsync(r => r.Id);
        var stores = await db.Stores.IgnoreQueryFilters().Where(s => storeIds.Contains(s.Id)).ToDictionaryAsync(s => s.Id);
        return Ok(list.Select(c => new
        {
            c.Id, c.Type, c.Status, c.AmountInr, c.Note, c.CreatedAt, c.SettledAt, c.RazorpayRefundId,
            referrer = refs.TryGetValue(c.ReferrerId, out var r) ? new { r.Id, r.Code, r.Name, r.Type, r.Phone } : null,
            store = stores.TryGetValue(c.ReferredStoreId, out var s) ? new { s.Id, s.Slug, s.Name } : null
        }));
    }

    /// <summary>Mark a payout as paid (or cancel a credit). Free months settle themselves through the billing webhook.</summary>
    [HttpPatch("credits/{id:guid}")]
    public async Task<IActionResult> SettleCredit(Guid id, CreditUpdate r)
    {
        var c = await db.ReferralCredits.FirstOrDefaultAsync(x => x.Id == id);
        if (c is null) return NotFound();
        if (r.Status is not (ReferralCreditStatus.Paid or ReferralCreditStatus.Cancelled)) return BadRequest(new { error = "Only Paid or Cancelled can be set by hand" });
        c.Status = r.Status; c.SettledAt = DateTime.UtcNow;
        if (r.Note is not null) c.Note = r.Note;
        await db.SaveChangesAsync();
        return Ok();
    }

    public record Row(Guid Id, string Code, string Name, ReferrerType Type, string? Phone, string? City, bool Active, bool HasStore, string JoinLink,
        int Signups, int Trial, int Paying, int PastDue, int Churned, decimal MrrInr, decimal CreditPendingInr, decimal CreditSettledInr, DateTime? LastSignupAt, DateTime CreatedAt);

    private async Task<List<Row>> BuildRowsAsync(ReferrerType? type, bool includeEmpty)
    {
        var refsQ = db.Referrers.AsNoTracking().AsQueryable();
        if (type is { } t) refsQ = refsQ.Where(r => r.Type == t);
        var refs = await refsQ.OrderByDescending(r => r.CreatedAt).ToListAsync();
        var stores = await db.Stores.IgnoreQueryFilters().AsNoTracking().Where(s => s.ReferrerId != null)
            .Select(s => new { s.ReferrerId, s.Status, s.Plan, s.CreatedAt, s.FirstPaidAt }).ToListAsync();
        var credits = await db.ReferralCredits.AsNoTracking().Where(c => c.Type != ReferralCreditType.ReferredTrialExtension)
            .Select(c => new { c.ReferrerId, c.Status, c.AmountInr }).ToListAsync();
        var byRef = stores.GroupBy(s => s.ReferrerId!.Value).ToDictionary(g => g.Key, g => g.ToList());
        var creditsByRef = credits.GroupBy(c => c.ReferrerId).ToDictionary(g => g.Key, g => g.ToList());
        // paying = has made a first payment (subscribed, even if still inside the trial window) or is Active
        decimal price(PlanTier p) => SubscriptionService.Plans.TryGetValue(p, out var v) ? v.MonthlyInr : 0;

        var rows = refs.Select(r =>
        {
            var ss = byRef.GetValueOrDefault(r.Id) ?? [];
            var cs = creditsByRef.GetValueOrDefault(r.Id) ?? [];
            return new Row(r.Id, r.Code, r.Name, r.Type, r.Phone, r.City, r.Active, r.StoreId != null, referrals.JoinLink(r.Code),
                ss.Count, ss.Count(s => s.Status == StoreStatus.Trial && s.FirstPaidAt == null), ss.Count(s => s.FirstPaidAt != null || s.Status == StoreStatus.Active), ss.Count(s => s.Status == StoreStatus.PastDue),
                ss.Count(s => s.Status is StoreStatus.Suspended or StoreStatus.Closed), ss.Where(s => s.FirstPaidAt != null || s.Status == StoreStatus.Active).Sum(s => price(s.Plan)),
                cs.Where(c => c.Status == ReferralCreditStatus.Pending).Sum(c => c.AmountInr), cs.Where(c => c.Status is ReferralCreditStatus.Applied or ReferralCreditStatus.Paid).Sum(c => c.AmountInr),
                ss.Count == 0 ? null : ss.Max(s => s.CreatedAt), r.CreatedAt);
        });
        if (!includeEmpty) rows = rows.Where(r => r.Signups > 0 || r.Type != ReferrerType.Retailer);
        return rows.OrderByDescending(r => r.Signups).ThenByDescending(r => r.CreatedAt).ToList();
    }

    private static string Csv(string s) => s.Contains(',') || s.Contains('"') ? "\"" + s.Replace("\"", "\"\"") + "\"" : s;
}
