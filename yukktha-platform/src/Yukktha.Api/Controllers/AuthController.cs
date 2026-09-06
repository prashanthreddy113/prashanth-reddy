using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Yukktha.Api.Auth;
using Yukktha.Api.Data;
using Yukktha.Api.Data.Entities;
using Yukktha.Api.Dtos;
using Yukktha.Api.Services;
using Yukktha.Api.Tenancy;

namespace Yukktha.Api.Controllers;

[ApiController, Route("api/auth")]
public class AuthController(AppDbContext db, OtpService otp, JwtTokenService jwt, SubscriptionService subs, TenantContext tenant) : ControllerBase
{
    /// <summary>PL-2 step 1: request OTP. Same endpoint for signup and login.</summary>
    [HttpPost("otp")]
    public async Task<IActionResult> SendOtp(SendOtpRequest req)
    {
        try
        {
            var devCode = await otp.SendAsync(req.Phone);
            return Ok(new { sent = true, devCode });
        }
        catch (Exception ex) { return BadRequest(new { error = ex.Message }); }
    }

    /// <summary>PL-2 step 2 (new store): verify OTP and create the store + owner in one call.</summary>
    [HttpPost("signup")]
    public async Task<IActionResult> Signup(SignupRequest req)
    {
        if (!await otp.VerifyAsync(req.Phone, req.Code)) return Unauthorized(new { error = "Invalid or expired code" });
        var phone = PhoneUtil.Normalize(req.Phone);

        var slug = await UniqueSlugAsync(req.StoreName);
        var store = new Store
        {
            Slug = slug, Name = req.StoreName.Trim(), OwnerPhone = phone, WhatsAppNumber = phone,
            DefaultLanguage = req.Language, TrialEndsAt = DateTime.UtcNow.AddDays(subs.TrialDays),
            ReferralCode = slug.ToUpperInvariant()[..Math.Min(6, slug.Length)] + Random.Shared.Next(100, 999)
        };
        if (!string.IsNullOrWhiteSpace(req.ReferralCode))
            store.ReferredByStoreId = (await db.Stores.IgnoreQueryFilters().FirstOrDefaultAsync(s => s.ReferralCode == req.ReferralCode))?.Id;

        var owner = new User { StoreId = store.Id, Phone = phone, Name = "Owner", Role = UserRole.Owner, Language = req.Language, LastLoginAt = DateTime.UtcNow };
        db.Stores.Add(store); db.Users.Add(owner);

        // Every store starts with three sensible categories so the first product takes seconds.
        db.Categories.AddRange(
            new Category { StoreId = store.Id, NameEn = "Sarees", NameTe = "చీరలు", SortOrder = 1 },
            new Category { StoreId = store.Id, NameEn = "Blouses", NameTe = "బ్లౌజులు", SortOrder = 2 },
            new Category { StoreId = store.Id, NameEn = "Dress materials", NameTe = "డ్రెస్ మెటీరియల్స్", SortOrder = 3 });
        await db.SaveChangesAsync();

        return Ok(new AuthResponse(jwt.Issue(owner, store), store.Id, store.Slug, store.Name, owner.Role.ToString(), false));
    }

    /// <summary>Login: phone may belong to several stores; pass StoreSlug to pick one, otherwise the list is returned.</summary>
    [HttpPost("login")]
    public async Task<IActionResult> Login(VerifyOtpRequest req)
    {
        if (!await otp.VerifyAsync(req.Phone, req.Code)) return Unauthorized(new { error = "Invalid or expired code" });
        var phone = PhoneUtil.Normalize(req.Phone);

        var users = await db.Users.IgnoreQueryFilters().Where(u => u.Phone == phone).ToListAsync();
        if (users.Count == 0) return NotFound(new { error = "No store for this phone. Sign up first." });

        var storeIds = users.Select(u => u.StoreId).ToList();
        var stores = await db.Stores.IgnoreQueryFilters().Where(s => storeIds.Contains(s.Id)).ToListAsync();

        var slug = req.StoreSlug ?? tenant.Slug;
        if (slug is null && stores.Count > 1)
            return Ok(new { chooseStore = stores.Select(s => new { s.Slug, s.Name }) });

        var store = slug is null ? stores[0] : stores.FirstOrDefault(s => s.Slug == slug);
        if (store is null) return Unauthorized();
        var user = users.First(u => u.StoreId == store.Id);
        user.LastLoginAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return Ok(new AuthResponse(jwt.Issue(user, store), store.Id, store.Slug, store.Name, user.Role.ToString(), store.OnboardingCompleted));
    }

    private async Task<string> UniqueSlugAsync(string name)
    {
        var basis = new string(name.ToLowerInvariant().Select(c => char.IsLetterOrDigit(c) ? c : '-').ToArray()).Trim('-');
        basis = System.Text.RegularExpressions.Regex.Replace(basis, "-+", "-");
        if (basis.Length < 3 || !basis.Any(char.IsLetter)) basis = "store";
        var slug = basis; var i = 2;
        while (await db.Stores.IgnoreQueryFilters().AnyAsync(s => s.Slug == slug)) slug = $"{basis}-{i++}";
        return slug;
    }
}
