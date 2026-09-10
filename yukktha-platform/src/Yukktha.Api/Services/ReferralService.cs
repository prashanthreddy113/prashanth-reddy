using Microsoft.EntityFrameworkCore;
using Yukktha.Api.Data;
using Yukktha.Api.Data.Entities;

namespace Yukktha.Api.Services;

/// <summary>
/// BL-4 referral programme. A referral code belongs to a Referrer (every store has one of type Retailer; BrightLoop creates
/// Wholesaler and Agent referrers). A referred store gets extra trial days at signup. When it makes its first payment the
/// referrer earns a free month (refunded on their next charge) or, without a store of their own, a cash payout to settle.
/// </summary>
public class ReferralService(AppDbContext db, IConfiguration cfg, RazorpayService rzp, ILogger<ReferralService> log)
{
    public int ReferredBonusDays => cfg.GetValue<int>("Referral:ReferredBonusDays", 30);
    public decimal PayoutInr => cfg.GetValue<decimal>("Referral:PayoutInr", 500);

    public string AdminUrl => string.IsNullOrWhiteSpace(cfg["Platform:AdminUrl"]) ? $"https://app.{cfg["Platform:RootDomain"]}" : cfg["Platform:AdminUrl"]!.TrimEnd('/');
    public string JoinLink(string code) => $"{AdminUrl}/join?ref={code}";

    public Task<Referrer?> FindByCodeAsync(string code)
    {
        var c = code.Trim().ToUpperInvariant();
        return db.Referrers.FirstOrDefaultAsync(r => r.Code == c && r.Active);
    }

    /// <summary>Every new store gets its own Retailer referrer row carrying the store's code.</summary>
    public Referrer CreateForStore(Store store)
    {
        var r = new Referrer { Code = store.ReferralCode!, Name = store.Name, Type = ReferrerType.Retailer, Phone = store.OwnerPhone, City = store.City, StoreId = store.Id };
        db.Referrers.Add(r);
        return r;
    }

    public async Task<string> UniqueCodeAsync(string basis)
    {
        var letters = new string(basis.ToUpperInvariant().Where(char.IsLetterOrDigit).ToArray());
        if (letters.Length < 3) letters = "REF";
        letters = letters[..Math.Min(6, letters.Length)];
        for (var i = 0; i < 20; i++)
        {
            var code = letters + Random.Shared.Next(100, 999);
            if (!await db.Referrers.AnyAsync(r => r.Code == code) && !await db.Stores.IgnoreQueryFilters().AnyAsync(s => s.ReferralCode == code)) return code;
        }
        return letters + Guid.NewGuid().ToString("N")[..4].ToUpperInvariant();
    }

    /// <summary>At signup: link the store to its referrer and extend its trial. Records the extension in the ledger.</summary>
    public void ApplySignup(Store store, Referrer referrer)
    {
        if (referrer.StoreId == store.Id) return;                     // cannot refer yourself
        store.ReferrerId = referrer.Id;
        store.ReferredByStoreId = referrer.StoreId;
        store.TrialEndsAt = store.TrialEndsAt.AddDays(ReferredBonusDays);
        db.ReferralCredits.Add(new ReferralCredit
        {
            ReferrerId = referrer.Id, ReferredStoreId = store.Id, Type = ReferralCreditType.ReferredTrialExtension,
            Status = ReferralCreditStatus.Applied, SettledAt = DateTime.UtcNow, Note = $"+{ReferredBonusDays} trial days for {store.Name}"
        });
    }

    /// <summary>The referred store paid for the first time: the referrer earns a free month or a payout. Idempotent.</summary>
    public async Task OnFirstPaymentAsync(Store store)
    {
        if (store.FirstPaidAt is not null) return;
        store.FirstPaidAt = DateTime.UtcNow;
        if (store.ReferrerId is not { } rid) return;
        var referrer = await db.Referrers.FirstOrDefaultAsync(r => r.Id == rid);
        if (referrer is null) return;

        if (referrer.StoreId is { } ownStoreId && await db.Stores.IgnoreQueryFilters().FirstOrDefaultAsync(s => s.Id == ownStoreId) is { } own)
        {
            own.CreditMonths += 1;
            var monthly = SubscriptionService.Plans.TryGetValue(own.Plan, out var p) ? p.MonthlyInr : SubscriptionService.Plans[PlanTier.Starter].MonthlyInr;
            db.ReferralCredits.Add(new ReferralCredit
            {
                ReferrerId = referrer.Id, ReferredStoreId = store.Id, Type = ReferralCreditType.ReferrerFreeMonth, AmountInr = monthly,
                Note = $"Free month for {own.Name}: {store.Name} made its first payment"
            });
            log.LogInformation("Referral: {Referrer} earned a free month from {Store}", referrer.Code, store.Slug);
        }
        else
        {
            db.ReferralCredits.Add(new ReferralCredit
            {
                ReferrerId = referrer.Id, ReferredStoreId = store.Id, Type = ReferralCreditType.ReferrerPayout, AmountInr = PayoutInr,
                Note = $"Payout to {referrer.Name} ({referrer.Type}): {store.Name} made its first payment"
            });
            log.LogInformation("Referral: payout of {Amount} owed to {Referrer} for {Store}", PayoutInr, referrer.Code, store.Slug);
        }
    }

    /// <summary>A store was charged. If it holds free months, refund this charge and consume one.</summary>
    public async Task OnChargedAsync(Store store, string? paymentId, decimal amountInr)
    {
        if (store.CreditMonths <= 0) return;
        string? refundId = null;
        if (rzp.Configured && !string.IsNullOrEmpty(paymentId))
        {
            try { refundId = await rzp.RefundAsync(paymentId, (long)(amountInr * 100)); }
            catch (InvalidOperationException ex) { log.LogError(ex, "Referral refund failed for {Store}; credit kept", store.Slug); return; }
        }
        store.CreditMonths -= 1;
        var referrer = await db.Referrers.FirstOrDefaultAsync(r => r.StoreId == store.Id);
        var credit = referrer is null ? null : await db.ReferralCredits
            .Where(c => c.ReferrerId == referrer.Id && c.Type == ReferralCreditType.ReferrerFreeMonth && c.Status == ReferralCreditStatus.Pending)
            .OrderBy(c => c.CreatedAt).FirstOrDefaultAsync();
        if (credit is not null) { credit.Status = ReferralCreditStatus.Applied; credit.SettledAt = DateTime.UtcNow; credit.RazorpayRefundId = refundId; credit.AmountInr = amountInr; }
        log.LogInformation("Referral: free month applied to {Store} (refund {Refund})", store.Slug, refundId ?? "dev");
    }
}
