using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Yukktha.Api.Data;
using Yukktha.Api.Data.Entities;
using Yukktha.Api.Dtos;
using Yukktha.Api.Services;
using Yukktha.Api.Tenancy;

namespace Yukktha.Api.Controllers;

[Route("api/admin/store")]
public class StoreController(AppDbContext db, TenantContext tenant, SubscriptionService subs, IConfiguration cfg) : TenantControllerBase(tenant)
{
    [HttpGet]
    public async Task<IActionResult> Get()
    {
        var s = await db.Stores.AsNoTracking().FirstAsync(x => x.Id == StoreId);
        return Ok(new
        {
            s.Id, s.Slug, s.Name, s.OwnerPhone, s.WhatsAppNumber, s.LogoUrl, s.ThemeColor, s.City, s.Address, s.Gstin, s.DefaultLanguage,
            s.CodEnabled, s.OnlinePaymentEnabled, s.LocalDeliveryEnabled, s.LocalDeliveryCharge, s.CourierEnabled, s.CourierCharge,
            s.GoogleReviewUrl, s.GoogleReviewPromptEnabled, s.InstagramHandle, s.Plan, s.Status, s.TrialEndsAt, s.CurrentPeriodEndsAt,
            s.ReferralCode, s.OnboardingCompleted, s.CustomDomain,
            storefrontUrl = $"https://{s.Slug}.{cfg["Platform:RootDomain"]}",
            storefrontOpen = subs.IsStorefrontOpen(s),
            features = new { onlinePayments = subs.HasFeature(s, "online_payments"), delivery = subs.HasFeature(s, "delivery"), broadcast = subs.HasFeature(s, "broadcast") }
        });
    }

    [HttpPut, Authorize(Policy = "StoreOwner")]
    public async Task<IActionResult> Update(StoreSettingsUpdate r)
    {
        var s = await db.Stores.FirstAsync(x => x.Id == StoreId);
        s.Name = r.Name; s.WhatsAppNumber = r.WhatsAppNumber; s.Address = r.Address; s.Gstin = r.Gstin; s.LogoUrl = r.LogoUrl; s.ThemeColor = r.ThemeColor;
        s.DefaultLanguage = r.DefaultLanguage; s.CodEnabled = r.CodEnabled; s.InstagramHandle = r.InstagramHandle;
        s.LocalDeliveryEnabled = r.LocalDeliveryEnabled && subs.HasFeature(s, "delivery"); s.LocalDeliveryCharge = r.LocalDeliveryCharge;
        s.CourierEnabled = r.CourierEnabled && subs.HasFeature(s, "delivery"); s.CourierCharge = r.CourierCharge;
        s.GoogleReviewPromptEnabled = r.GoogleReviewPromptEnabled;
        if (r.GoogleReviewUrl is not null) s.GoogleReviewUrl = r.GoogleReviewUrl; // owner may set; super-admin may pre-set (PL-6)
        await db.SaveChangesAsync();
        return Ok();
    }

    /// <summary>AD-3: called when the guided first-run finishes.</summary>
    [HttpPost("onboarding/complete")]
    public async Task<IActionResult> CompleteOnboarding()
    {
        var s = await db.Stores.FirstAsync(x => x.Id == StoreId);
        s.OnboardingCompleted = true;
        await db.SaveChangesAsync();
        return Ok();
    }

    [HttpGet("plans")]
    public IActionResult Plans() => Ok(SubscriptionService.Plans.Select(p => new { tier = p.Key, p.Value.Name, monthlyInr = p.Value.MonthlyInr }));

    [HttpGet("/api/admin/users"), Authorize(Policy = "StoreOwner")]
    public async Task<IActionResult> Users() => Ok(await db.Users.Select(u => new { u.Id, u.Name, u.Phone, u.Role, u.LastLoginAt }).ToListAsync());

    /// <summary>PL-4: owner adds staff by phone; staff log in with OTP.</summary>
    [HttpPost("/api/admin/users"), Authorize(Policy = "StoreOwner")]
    public async Task<IActionResult> AddStaff([FromBody] AddStaffRequest r)
    {
        var phone = Auth.PhoneUtil.Normalize(r.Phone);
        if (await db.Users.AnyAsync(u => u.Phone == phone)) return Conflict(new { error = "Already a user of this store" });
        db.Users.Add(new User { Phone = phone, Name = r.Name, Role = UserRole.Staff });
        await db.SaveChangesAsync();
        return Ok();
    }
    public record AddStaffRequest(string Name, string Phone);
}
