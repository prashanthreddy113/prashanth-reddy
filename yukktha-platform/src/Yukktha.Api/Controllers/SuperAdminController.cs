using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Yukktha.Api.Auth;
using Yukktha.Api.Data;
using Yukktha.Api.Data.Entities;
using Yukktha.Api.Dtos;
using Yukktha.Api.Tenancy;

namespace Yukktha.Api.Controllers;

/// <summary>PL-3: BrightLoop console. All queries use IgnoreQueryFilters deliberately.</summary>
[ApiController, Route("api/superadmin"), Authorize(Policy = "SuperAdmin")]
public class SuperAdminController(AppDbContext db, TenantContext tenant, JwtTokenService jwt) : ControllerBase
{
    [HttpGet("stores")]
    public async Task<IActionResult> Stores([FromQuery] string? q)
    {
        var stores = db.Stores.IgnoreQueryFilters().AsNoTracking();
        if (!string.IsNullOrWhiteSpace(q)) stores = stores.Where(s => s.Name.Contains(q) || s.Slug.Contains(q) || s.OwnerPhone.Contains(q));
        var list = await stores.OrderByDescending(s => s.CreatedAt).Take(500).ToListAsync();
        var ids = list.Select(s => s.Id).ToList();
        var orderCounts = await db.Orders.IgnoreQueryFilters().Where(o => ids.Contains(o.StoreId)).GroupBy(o => o.StoreId).Select(g => new { g.Key, n = g.Count() }).ToDictionaryAsync(x => x.Key, x => x.n);
        var productCounts = await db.Products.IgnoreQueryFilters().Where(p => ids.Contains(p.StoreId)).GroupBy(p => p.StoreId).Select(g => new { g.Key, n = g.Count() }).ToDictionaryAsync(x => x.Key, x => x.n);
        var lastLogins = await db.Users.IgnoreQueryFilters().Where(u => ids.Contains(u.StoreId)).GroupBy(u => u.StoreId).Select(g => new { g.Key, t = g.Max(u => u.LastLoginAt) }).ToDictionaryAsync(x => x.Key, x => x.t);
        return Ok(list.Select(s => new
        {
            s.Id, s.Slug, s.Name, s.OwnerPhone, s.City, s.Plan, s.Status, s.TrialEndsAt, s.CurrentPeriodEndsAt, s.CreatedAt, s.OnboardingCompleted, s.ReferralCode, s.ReferredByStoreId,
            orders = orderCounts.GetValueOrDefault(s.Id), products = productCounts.GetValueOrDefault(s.Id), lastLogin = lastLogins.GetValueOrDefault(s.Id)
        }));
    }

    /// <summary>PL-6 + suspend/reactivate + plan override.</summary>
    [HttpPatch("stores/{id:guid}")]
    public async Task<IActionResult> Configure(Guid id, SuperAdminStoreConfig r)
    {
        var s = await db.Stores.IgnoreQueryFilters().FirstOrDefaultAsync(x => x.Id == id);
        if (s is null) return NotFound();
        if (r.GoogleReviewUrl is not null) s.GoogleReviewUrl = r.GoogleReviewUrl;
        if (r.GoogleReviewPromptEnabled is { } g) s.GoogleReviewPromptEnabled = g;
        if (r.Plan is { } p) s.Plan = p;
        if (r.Status is { } st) s.Status = st;
        if (r.CustomDomain is not null) s.CustomDomain = string.IsNullOrWhiteSpace(r.CustomDomain) ? null : r.CustomDomain.ToLowerInvariant();
        await db.SaveChangesAsync();
        return Ok();
    }

    /// <summary>Impersonate a store's owner for support. Every use is logged.</summary>
    [HttpPost("stores/{id:guid}/impersonate")]
    public async Task<IActionResult> Impersonate(Guid id, [FromServices] ILogger<SuperAdminController> log)
    {
        var s = await db.Stores.IgnoreQueryFilters().FirstOrDefaultAsync(x => x.Id == id);
        if (s is null) return NotFound();
        var owner = await db.Users.IgnoreQueryFilters().FirstAsync(u => u.StoreId == id && u.Role == UserRole.Owner);
        log.LogWarning("SUPERADMIN {Admin} impersonating store {Slug}", User.Identity?.Name, s.Slug);
        return Ok(new AuthResponse(jwt.Issue(owner, s), s.Id, s.Slug, s.Name, "Owner", s.OnboardingCompleted));
    }

    [HttpGet("metrics")]
    public async Task<IActionResult> Metrics()
    {
        var stores = db.Stores.IgnoreQueryFilters();
        var monthStart = new DateTime(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 1);
        return Ok(new
        {
            total = await stores.CountAsync(),
            trial = await stores.CountAsync(s => s.Status == StoreStatus.Trial),
            active = await stores.CountAsync(s => s.Status == StoreStatus.Active),
            pastDue = await stores.CountAsync(s => s.Status == StoreStatus.PastDue),
            newThisMonth = await stores.CountAsync(s => s.CreatedAt >= monthStart),
            mrrInr = await stores.Where(s => s.Status == StoreStatus.Active).SumAsync(s => s.Plan == PlanTier.Starter ? 999 : s.Plan == PlanTier.Growth ? 2499 : 7500),
            ordersThisMonth = await db.Orders.IgnoreQueryFilters().CountAsync(o => o.CreatedAt >= monthStart)
        });
    }
}
