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

    public bool IsStorefrontOpen(Store s) => s.Status switch
    {
        StoreStatus.Trial => s.TrialEndsAt > DateTime.UtcNow,
        StoreStatus.Active => true,
        StoreStatus.PastDue => (s.CurrentPeriodEndsAt ?? DateTime.MinValue).AddDays(GraceDays) > DateTime.UtcNow,
        _ => false
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
            case "subscription.activated":
            case "subscription.charged":
                s.Status = StoreStatus.Active; s.CurrentPeriodEndsAt = periodEnd; break;
            case "subscription.pending":
            case "subscription.halted":
                s.Status = StoreStatus.PastDue; break;
            case "subscription.cancelled":
            case "subscription.completed":
                s.Status = StoreStatus.Suspended; break;
        }
    }
}
