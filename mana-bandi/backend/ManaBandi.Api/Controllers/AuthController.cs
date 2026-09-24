using ManaBandi.Api.Auth;
using ManaBandi.Api.Data;
using ManaBandi.Api.Infrastructure;
using ManaBandi.Api.Models;
using ManaBandi.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

namespace ManaBandi.Api.Controllers;

public record OtpRequestBody(string? Phone, string? Role, string? Channel, string? Lang);
public record OtpVerifyBody(string? Phone, string? Role, string? Code, string? Name, string? Lang);
public record LoginBody(string? Email, string? Password, string? Otp);
public record ChangePasswordBody(string? CurrentPassword, string? NewPassword);

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly OtpService _otp;
    private readonly TokenService _tokens;
    private readonly AccountService _accounts;
    private readonly IPasswordHasher<User> _hasher;
    private readonly IClock _clock;

    public AuthController(AppDbContext db, OtpService otp, TokenService tokens, AccountService accounts, IPasswordHasher<User> hasher, IClock clock)
    {
        _db = db;
        _otp = otp;
        _tokens = tokens;
        _accounts = accounts;
        _hasher = hasher;
        _clock = clock;
    }

    public static readonly string[] Langs = { "te", "en", "hi", "ur", "kn", "mr" };
    private static string Lang(string? l) => l != null && Langs.Contains(l) ? l : "te";

    [HttpPost("otp/request")]
    [EnableRateLimiting("otp")]
    public async Task<IActionResult> RequestOtp([FromBody] OtpRequestBody body, CancellationToken ct)
    {
        var (exp, dev) = await _otp.RequestAsync(body.Phone, body.Role, body.Channel, body.Lang, HttpContext.Connection.RemoteIpAddress?.ToString(), ct);
        var res = new Dictionary<string, object> { ["sent"] = true, ["expiresInSec"] = exp };
        if (dev != null) res["devCode"] = dev;
        return Ok(res);
    }

    [HttpPost("otp/verify")]
    [EnableRateLimiting("otp")]
    public async Task<IActionResult> VerifyOtp([FromBody] OtpVerifyBody body, CancellationToken ct)
    {
        var phone = await _otp.VerifyAsync(body.Phone, body.Role, body.Code, ct);
        var role = body.Role!;
        var now = _clock.UtcNow;
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Phone == phone && u.Role == role, ct);
        var name = RideService.Trim(body.Name, 100);
        if (user is null)
        {
            user = new User { Id = IdGen.New("u"), Phone = phone, Role = role, Name = name ?? "", Lang = Lang(body.Lang), CreatedAt = now };
            _db.Users.Add(user);
        }
        else
        {
            if (user.Disabled) throw new ApiException(403, "forbidden", "This account is disabled. Call support.");
            if (name != null && string.IsNullOrWhiteSpace(user.Name)) user.Name = name;
            if (body.Lang != null) user.Lang = Lang(body.Lang);
        }
        user.LastLoginAt = now;
        await _db.SaveChangesAsync(ct);

        object? captain = null;
        if (role == Roles.Captain)
        {
            var c = await _accounts.EnsureCaptainAsync(user, ct);
            captain = await _accounts.CaptainMeAsync(c, ct);
        }
        var res = new Dictionary<string, object?>
        {
            ["token"] = _tokens.CreateToken(user),
            ["user"] = await _accounts.UserViewAsync(user, ct),
        };
        if (captain != null) res["captain"] = captain;
        return Ok(res);
    }

    /// <summary>Owner portal login (email + password). `otp` is accepted for forward compatibility and ignored in v1.</summary>
    [HttpPost("login")]
    [EnableRateLimiting("login")]
    public async Task<IActionResult> Login([FromBody] LoginBody body, CancellationToken ct)
    {
        var email = (body.Email ?? "").Trim().ToLowerInvariant();
        if (email.Length == 0 || string.IsNullOrEmpty(body.Password)) throw new ApiException(401, "unauthorized", "Email or password is wrong");
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == email && (u.Role == Roles.Owner || u.Role == Roles.TownManager), ct);
        if (user is null || user.Disabled || user.PasswordHash is null)
        {
            _hasher.HashPassword(new User(), body.Password); // similar timing for unknown emails
            throw new ApiException(401, "unauthorized", "Email or password is wrong");
        }
        var check = _hasher.VerifyHashedPassword(user, user.PasswordHash, body.Password);
        if (check == PasswordVerificationResult.Failed) throw new ApiException(401, "unauthorized", "Email or password is wrong");
        if (check == PasswordVerificationResult.SuccessRehashNeeded) user.PasswordHash = _hasher.HashPassword(user, body.Password);
        user.LastLoginAt = _clock.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Ok(new { token = _tokens.CreateToken(user), user = await _accounts.UserViewAsync(user, ct) });
    }

    [HttpPost("password")]
    [Authorize(Policy = Policies.Admin)]
    [EnableRateLimiting("login")]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordBody body, CancellationToken ct)
    {
        var user = await _db.Users.FirstAsync(u => u.Id == User.UserId(), ct);
        if (string.IsNullOrEmpty(body.CurrentPassword) || user.PasswordHash is null ||
            _hasher.VerifyHashedPassword(user, user.PasswordHash, body.CurrentPassword) == PasswordVerificationResult.Failed)
            throw new ApiException(401, "unauthorized", "Current password is wrong");
        if ((body.NewPassword ?? "").Length < 10) throw ApiException.Validation("New password must be at least 10 characters");
        user.PasswordHash = _hasher.HashPassword(user, body.NewPassword!);
        await _db.SaveChangesAsync(ct);
        return Ok(new { ok = true });
    }
}

public record UpdateMeBody(string? Name, string? Lang, string? TrustedContactPhone);
public record TermsBody(string? Version);

[ApiController]
[Authorize]
public class MeController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly AccountService _accounts;
    private readonly IClock _clock;

    public MeController(AppDbContext db, AccountService accounts, IClock clock)
    {
        _db = db;
        _accounts = accounts;
        _clock = clock;
    }

    private async Task<User> Me(CancellationToken ct) =>
        await _db.Users.FirstOrDefaultAsync(u => u.Id == User.UserId(), ct) ?? throw new ApiException(401, "unauthorized", "Login again");

    [HttpGet("api/me")]
    public async Task<IActionResult> Get(CancellationToken ct)
    {
        var u = await Me(ct);
        var view = await _accounts.UserViewAsync(u, ct);
        if (u.Role == Roles.Captain && await _accounts.LoadCaptainByUserAsync(u.Id, ct) is { } c)
            view["captain"] = await _accounts.CaptainMeAsync(c, ct);
        return Ok(view);
    }

    [HttpPut("api/me")]
    public async Task<IActionResult> Update([FromBody] UpdateMeBody body, CancellationToken ct)
    {
        var u = await Me(ct);
        if (body.Name != null)
        {
            var n = body.Name.Trim();
            if (n.Length is < 1 or > 100) throw ApiException.Validation("name must be 1–100 characters");
            u.Name = n;
        }
        if (body.Lang != null)
        {
            if (!AuthController.Langs.Contains(body.Lang)) throw ApiException.Validation("Unsupported language");
            u.Lang = body.Lang;
        }
        if (body.TrustedContactPhone != null)
        {
            u.TrustedContactPhone = body.TrustedContactPhone.Trim().Length == 0 ? null
                : Phone.Normalize(body.TrustedContactPhone) ?? throw ApiException.Validation("trustedContactPhone must be a valid mobile number");
        }
        await _db.SaveChangesAsync(ct);
        return Ok(await _accounts.UserViewAsync(u, ct));
    }

    [HttpPost("api/me/terms")]
    public async Task<IActionResult> AcceptTerms([FromBody] TermsBody body, CancellationToken ct)
    {
        var u = await Me(ct);
        if (Roles.IsAdmin(u.Role)) throw ApiException.Forbidden("Terms are accepted in the apps");
        var version = (body.Version ?? "").Trim();
        if (!await _db.TermsVersions.AnyAsync(t => t.Version == version, ct)) throw ApiException.Validation($"Unknown terms version '{version}'");
        var app = Request.Headers["X-App-Version"].FirstOrDefault();
        _db.Consents.Add(new Consent
        {
            UserId = u.Id,
            Kind = AccountService.TermsKind(u.Role),
            Version = version,
            At = _clock.UtcNow,
            Ip = HttpContext.Connection.RemoteIpAddress?.ToString(),
            AppVersion = app is null ? null : app.Length > 40 ? app[..40] : app,
        });
        await _db.SaveChangesAsync(ct);
        return Ok(new { ok = true });
    }

    /// <summary>Current terms text for the apps' Terms screen (docs/06 §D).</summary>
    [HttpGet("api/terms/current")]
    [AllowAnonymous]
    public async Task<IActionResult> CurrentTerms([FromQuery] string? audience, [FromQuery] string? lang, CancellationToken ct)
    {
        var t = await _db.TermsVersions.AsNoTracking().OrderByDescending(x => x.PublishedAt).ThenByDescending(x => x.Id).FirstOrDefaultAsync(ct)
                ?? throw ApiException.NotFound("No terms published");
        return Ok(new
        {
            version = t.Version,
            publishedAt = t.PublishedAt.ToString("yyyy-MM-dd"),
            audience = audience == "captain" ? "captain" : "rider",
            lang = lang == "en" ? "en" : "te",
            text = lang == "en" ? t.En : t.Te,
            te = t.Te,
            en = t.En,
        });
    }
}
