using System.Security.Cryptography;
using System.Text;
using ManaBandi.Api.Data;
using ManaBandi.Api.Infrastructure;
using ManaBandi.Api.Models;
using ManaBandi.Api.Sms;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace ManaBandi.Api.Auth;

/// <summary>Phone OTP: HMAC-hashed codes, 5-minute expiry, 5 attempts, 3 requests per phone per 10 minutes.</summary>
public class OtpService
{
    private readonly AppDbContext _db;
    private readonly OtpOptions _opt;
    private readonly ISmsSender _sms;
    private readonly IConfiguration _config;
    private readonly IClock _clock;

    public OtpService(AppDbContext db, IOptions<OtpOptions> opt, ISmsSender sms, IConfiguration config, IClock clock)
    {
        _db = db;
        _opt = opt.Value;
        _sms = sms;
        _config = config;
        _clock = clock;
    }

    public OtpOptions Options => _opt;

    private string Hash(string phone, string role, string code)
    {
        var key = Encoding.UTF8.GetBytes((_config["Jwt:Key"] ?? "") + ":otp");
        return Convert.ToHexString(HMACSHA256.HashData(key, Encoding.UTF8.GetBytes($"{phone}|{role}|{code}"))).ToLowerInvariant();
    }

    public static string ValidRole(string? role) =>
        role is Roles.Rider or Roles.Captain ? role : throw ApiException.Validation("role must be rider or captain");

    public async Task<(int expiresInSec, string? devCode)> RequestAsync(string? rawPhone, string? role, string? channel, string? lang, string? ip, CancellationToken ct)
    {
        var phone = Phone.Normalize(rawPhone) ?? throw ApiException.Validation("Enter a valid 10-digit mobile number");
        role = ValidRole(role);
        channel = channel == "call" ? "call" : "sms";
        var now = _clock.UtcNow;

        await using var tx = await _db.Database.BeginTransactionAsync(ct);
        // serialise requests for the same phone so the per-phone limit cannot be raced
        await _db.Database.ExecuteSqlInterpolatedAsync($"SELECT pg_advisory_xact_lock(hashtext({"otp:" + phone}))", ct);
        var windowStart = now.AddMinutes(-_opt.WindowMinutes);
        var recent = await _db.OtpCodes.CountAsync(o => o.Phone == phone && o.CreatedAt > windowStart, ct);
        if (recent >= _opt.MaxPerWindow)
            throw new ApiException(429, "otp_rate_limited", $"Too many OTP requests. Try again in {_opt.WindowMinutes} minutes.");

        var code = IdGen.Digits(Math.Clamp(_opt.CodeLength, 4, 8));
        // older unused codes stop working as soon as a new one is issued
        await _db.OtpCodes.Where(o => o.Phone == phone && o.Role == role && o.ConsumedAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(o => o.ConsumedAt, now), ct);
        _db.OtpCodes.Add(new OtpCode
        {
            Phone = phone, Role = role, CodeHash = Hash(phone, role, code), CreatedAt = now,
            ExpiresAt = now.AddSeconds(_opt.ExpirySeconds), Ip = ip, Channel = channel,
        });
        await _db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);

        await _sms.SendOtpAsync(phone, code, string.IsNullOrWhiteSpace(lang) ? "te" : lang, channel, ct);
        return (_opt.ExpirySeconds, _opt.DevMode ? code : null);
    }

    /// <summary>Checks the code; returns the normalised phone on success or throws 422 invalid_otp.</summary>
    public async Task<string> VerifyAsync(string? rawPhone, string? role, string? code, CancellationToken ct)
    {
        var phone = Phone.Normalize(rawPhone) ?? throw ApiException.Validation("Enter a valid 10-digit mobile number");
        role = ValidRole(role);
        code = (code ?? "").Trim();
        if (code.Length is < 4 or > 8 || !code.All(char.IsDigit)) throw new ApiException(422, "invalid_otp", "Wrong OTP");
        var now = _clock.UtcNow;

        var otp = await _db.OtpCodes.AsNoTracking()
            .Where(o => o.Phone == phone && o.Role == role && o.ConsumedAt == null && o.ExpiresAt > now)
            .OrderByDescending(o => o.CreatedAt).FirstOrDefaultAsync(ct);
        if (otp is null) throw new ApiException(422, "invalid_otp", "OTP expired. Request a new one.");

        var counted = await _db.OtpCodes.Where(o => o.Id == otp.Id && o.Attempts < _opt.MaxAttempts && o.ConsumedAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(o => o.Attempts, o => o.Attempts + 1), ct);
        if (counted == 0) throw new ApiException(422, "invalid_otp", "Too many wrong attempts. Request a new OTP.");

        var ok = CryptographicOperations.FixedTimeEquals(Encoding.ASCII.GetBytes(otp.CodeHash), Encoding.ASCII.GetBytes(Hash(phone, role, code)));
        if (!ok) throw new ApiException(422, "invalid_otp", "Wrong OTP");

        var consumed = await _db.OtpCodes.Where(o => o.Id == otp.Id && o.ConsumedAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(o => o.ConsumedAt, now), ct);
        if (consumed == 0) throw new ApiException(422, "invalid_otp", "OTP already used. Request a new one.");
        return phone;
    }
}
