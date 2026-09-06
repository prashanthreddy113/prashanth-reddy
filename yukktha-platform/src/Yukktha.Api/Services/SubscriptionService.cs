using Yukktha.Api.Data.Entities;

namespace Yukktha.Api.Services;

/// <summary>BL-1..BL-3: plan rules, trial, grace period, and whether the storefront is open.</summary>
public class SubscriptionService(IConfiguration cfg)
{
    public static readonly Dictionary<PlanTier, (decimal MonthlyInr, string Name)> Plans = new()
    {
        [PlanTier.Starter] = (999, "Starter"),
        [PlanTier.Growth] = (2499, "Growth"),
        [PlanTier.MultiBranch] = (7500, "Multi-branch"),
    };

    public int TrialDays => cfg.GetValue<int>("Platform:TrialDays", 14);
    public int GraceDays => cfg.GetValue<int>("Platform:GraceDays", 7);

    /// <summary>BL-2: the trial only opens the storefront once a payment method is authorised (can be relaxed for demos).</summary>
    public bool TrialRequiresPaymentMethod => cfg.GetValue<bool>("Platform:TrialRequiresPaymentMethod", true);

    public bool IsStorefrontOpen(Store s) => ClosedReason(s) is null;

    /// <summary>Null when the storefront is open; otherwise a stable code the admin app can explain to the owner.</summary>
    public string? ClosedReason(Store s) => s.Status switch
    {
        StoreStatus.Trial when TrialRequiresPaymentMethod && !s.PaymentMethodAttached => "trial_needs_payment_method",
        StoreStatus.Trial => s.TrialEndsAt > DateTime.UtcNow ? null : "trial_expired",
        StoreStatus.Active => null,
        StoreStatus.PastDue => (s.CurrentPeriodEndsAt ?? DateTime.MinValue).AddDays(GraceDays) > DateTime.UtcNow ? null : "past_due",
        StoreStatus.Suspended => "suspended",
        _ => "closed"
    };

    public static readonly Dictionary<PlanTier, string[]> PlanFeatures = new()
    {
        [PlanTier.Starter] = ["catalogue", "whatsapp_links", "storefront", "cod"],
        [PlanTier.Growth] = ["catalogue", "whatsapp_links", "storefront", "cod", "online_payments", "delivery", "broadcast", "analytics"],
        [PlanTier.MultiBranch] = ["catalogue", "whatsapp_links", "storefront", "cod", "online_payments", "delivery", "broadcast", "analytics", "multi_branch"],
    };

    public bool HasFeature(Store s, string feature) => feature switch
    {
        "online_payments" or "delivery" or "broadcast" or "analytics" => s.Plan >= PlanTier.Growth,
        "multi_branch" => s.Plan >= PlanTier.MultiBranch,
        _ => true
    };

    /// <summary>Called from the Razorpay webhook. Idempotent on repeated events.</summary>
    public void ApplyWebhook(Store s, string eventName, DateTime? periodEnd)
    {
        switch (eventName)
        {
            case "subscription.authenticated":          // mandate authorised; first charge comes at start_at
                s.PaymentMethodAttached = true; break;
            case "subscription.activated":
            case "subscription.charged":
                s.Status = StoreStatus.Active; s.PaymentMethodAttached = true; s.CurrentPeriodEndsAt = periodEnd; break;
            case "subscription.pending":
            case "subscription.halted":
                // BL-3: the 7-day grace runs from the end of the paid period, or from now if no period was ever charged.
                s.Status = StoreStatus.PastDue; s.CurrentPeriodEndsAt ??= periodEnd ?? DateTime.UtcNow; break;
            case "subscription.cancelled":
            case "subscription.completed":
                s.Status = StoreStatus.Suspended; break;
        }
    }
}
