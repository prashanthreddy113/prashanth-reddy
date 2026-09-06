using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Yukktha.Api.Data;
using Yukktha.Api.Data.Entities;
using Yukktha.Api.Services;

namespace Yukktha.Api.Auth;

/// <summary>Phone OTP login. In DevMode the code is returned in the response instead of sent.</summary>
public class OtpService(AppDbContext db, IConfiguration cfg, IWhatsAppService wa, ILogger<OtpService> log)
{
    public async Task<string?> SendAsync(string phone)
    {
        phone = PhoneUtil.Normalize(phone);
        var recent = await db.OtpCodes.CountAsync(o => o.Phone == phone && o.ExpiresAt > DateTime.UtcNow.AddMinutes(-10));
        if (recent >= 5) throw new InvalidOperationException("Too many OTP requests. Try again in 10 minutes.");

        var len = cfg.GetValue<int>("Otp:Length", 6);
        var code = RandomNumberGenerator.GetInt32((int)Math.Pow(10, len - 1), (int)Math.Pow(10, len)).ToString();
        db.OtpCodes.Add(new OtpCode
        {
            Phone = phone, CodeHash = Hash(code),
            ExpiresAt = DateTime.UtcNow.AddMinutes(cfg.GetValue<int>("Otp:ExpiryMinutes", 5))
        });
        await db.SaveChangesAsync();

        if (cfg.GetValue<bool>("Otp:DevMode")) { log.LogWarning("DEV OTP for {Phone}: {Code}", phone, code); return code; }
        await wa.SendOtpAsync(phone, code);
        return null;
    }

    public async Task<bool> VerifyAsync(string phone, string code)
    {
        phone = PhoneUtil.Normalize(phone);
        var otp = await db.OtpCodes.Where(o => o.Phone == phone && !o.Used && o.ExpiresAt > DateTime.UtcNow)
            .OrderByDescending(o => o.ExpiresAt).FirstOrDefaultAsync();
        if (otp is null) return false;
        otp.Attempts++;
        if (otp.Attempts > 5 || otp.CodeHash != Hash(code)) { await db.SaveChangesAsync(); return false; }
        otp.Used = true;
        await db.SaveChangesAsync();
        return true;
    }

    private static string Hash(string s) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(s)));
}

public static class PhoneUtil
{
    /// <summary>Accepts 10-digit Indian numbers or E.164; returns E.164.</summary>
    public static string Normalize(string raw)
    {
        var digits = new string(raw.Where(char.IsDigit).ToArray());
        if (digits.Length == 10) return "+91" + digits;
        if (digits.Length == 12 && digits.StartsWith("91")) return "+" + digits;
        if (raw.StartsWith('+')) return raw;
        throw new ArgumentException("Invalid phone number");
    }
}
