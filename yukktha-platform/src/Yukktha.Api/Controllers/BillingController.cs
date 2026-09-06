using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Yukktha.Api.Data;
using Yukktha.Api.Data.Entities;
using Yukktha.Api.Services;
using Yukktha.Api.Tenancy;

namespace Yukktha.Api.Controllers;

/// <summary>
/// BL-1/BL-2/BL-3: the owner picks a plan, authorises UPI autopay or a card through Razorpay Checkout,
/// and the store opens. Razorpay webhooks (WebhooksController) keep the status current afterwards.
/// </summary>
[Route("api/admin/billing"), Authorize(Policy = "StoreOwner")]
public class BillingController(AppDbContext db, TenantContext tenant, SubscriptionService subs, RazorpayService rzp, ILogger<BillingController> log) : TenantControllerBase(tenant)
{
    public record SubscribeRequest(PlanTier Plan);
    public record VerifyRequest(string RazorpayPaymentId, string RazorpaySubscriptionId, string RazorpaySignature);

    [HttpGet]
    public async Task<IActionResult> Get()
    {
        var s = await db.Stores.AsNoTracking().FirstAsync(x => x.Id == StoreId);
        return Ok(Summary(s));
    }

    /// <summary>Step 1: choose a plan. Returns what the admin app needs to open Razorpay Checkout for the mandate.</summary>
    [HttpPost("subscribe")]
    public async Task<IActionResult> Subscribe(SubscribeRequest req)
    {
        if (!SubscriptionService.Plans.ContainsKey(req.Plan)) return BadRequest(new { error = "Unknown plan" });
        var s = await db.Stores.FirstAsync(x => x.Id == StoreId);
        if (s.Status == StoreStatus.Closed)
            return BadRequest(new { error = "This store is closed. Contact support to reopen it." });

        s.Plan = req.Plan;

        if (!rzp.Configured)
        {
            // Local development: no gateway. Behave as if the mandate was authorised so the rest of the product can be tested.
            s.RazorpaySubscriptionId = "sub_dev_" + Guid.NewGuid().ToString("N")[..12];
            s.PaymentMethodAttached = true;
            s.SubscriptionStartedAt = DateTime.UtcNow;
            if (s.Status is StoreStatus.Suspended or StoreStatus.PastDue || (s.Status == StoreStatus.Trial && s.TrialEndsAt <= DateTime.UtcNow)) s.Status = StoreStatus.Active;
            await db.SaveChangesAsync();
            log.LogWarning("Razorpay not configured; dev subscription {Id} for {Slug}", s.RazorpaySubscriptionId, s.Slug);
            return Ok(new { devMode = true, billing = Summary(s) });
        }

        var planId = rzp.PlanIdFor(req.Plan);
        if (string.IsNullOrWhiteSpace(planId)) return StatusCode(503, new { error = $"Plan {req.Plan} is not configured in Razorpay yet." });

        // First charge at the end of the trial; immediately when the trial is over or the store is past due.
        DateTime? startAt = s.Status == StoreStatus.Trial && s.TrialEndsAt > DateTime.UtcNow ? s.TrialEndsAt : null;
        try
        {
            var sub = await rzp.CreateSubscriptionAsync(planId, startAt, s.Id, s.Slug);
            s.RazorpaySubscriptionId = sub.Id;
            s.PaymentMethodAttached = false;      // set by /verify or the subscription.authenticated webhook
            await db.SaveChangesAsync();
            return Ok(new { devMode = false, subscriptionId = sub.Id, keyId = rzp.KeyId, shortUrl = sub.ShortUrl, billing = Summary(s) });
        }
        catch (InvalidOperationException ex) { return StatusCode(502, new { error = ex.Message }); }
    }

    /// <summary>Step 2: Razorpay Checkout succeeded on the phone. Verify its signature before trusting it.</summary>
    [HttpPost("verify")]
    public async Task<IActionResult> Verify(VerifyRequest req)
    {
        var s = await db.Stores.FirstAsync(x => x.Id == StoreId);
        if (s.RazorpaySubscriptionId != req.RazorpaySubscriptionId) return BadRequest(new { error = "Subscription does not match this store" });
        if (!rzp.VerifyCheckoutSignature(req.RazorpayPaymentId, req.RazorpaySubscriptionId, req.RazorpaySignature))
            return BadRequest(new { error = "Payment could not be verified" });

        s.PaymentMethodAttached = true;
        s.SubscriptionStartedAt ??= DateTime.UtcNow;
        if (s.Status is StoreStatus.PastDue or StoreStatus.Suspended || (s.Status == StoreStatus.Trial && s.TrialEndsAt <= DateTime.UtcNow)) s.Status = StoreStatus.Active;
        await db.SaveChangesAsync();
        return Ok(Summary(s));
    }

    /// <summary>Cancels at the end of the paid period. The webhook moves the store to Suspended when Razorpay completes it.</summary>
    [HttpPost("cancel")]
    public async Task<IActionResult> Cancel()
    {
        var s = await db.Stores.FirstAsync(x => x.Id == StoreId);
        if (string.IsNullOrEmpty(s.RazorpaySubscriptionId)) return BadRequest(new { error = "No active subscription" });
        if (rzp.Configured && !s.RazorpaySubscriptionId.StartsWith("sub_dev_"))
        {
            try { await rzp.CancelAtCycleEndAsync(s.RazorpaySubscriptionId); }
            catch (InvalidOperationException ex) { return StatusCode(502, new { error = ex.Message }); }
        }
        else { s.Status = StoreStatus.Suspended; s.PaymentMethodAttached = false; await db.SaveChangesAsync(); }
        return Ok(Summary(s));
    }

    private object Summary(Store s) => new
    {
        s.Plan, s.Status, s.TrialEndsAt, s.CurrentPeriodEndsAt, s.PaymentMethodAttached, s.SubscriptionStartedAt,
        hasSubscription = !string.IsNullOrEmpty(s.RazorpaySubscriptionId),
        storefrontOpen = subs.IsStorefrontOpen(s), closedReason = subs.ClosedReason(s),
        trialRequiresPaymentMethod = subs.TrialRequiresPaymentMethod, graceDays = subs.GraceDays,
        razorpayConfigured = rzp.Configured, keyId = rzp.Configured ? rzp.KeyId : null,
        plans = SubscriptionService.Plans.Select(p => new { tier = p.Key, p.Value.Name, monthlyInr = p.Value.MonthlyInr, features = SubscriptionService.PlanFeatures[p.Key] })
    };
}
