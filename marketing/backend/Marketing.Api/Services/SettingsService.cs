using Marketing.Api.Data;
using Marketing.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Marketing.Api.Services;

public class SettingsService
{
    private readonly AppDbContext _db;

    public SettingsService(AppDbContext db) => _db = db;

    public async Task<CompanySettings> GetAsync()
    {
        var s = await _db.Settings.OrderBy(x => x.Id).FirstOrDefaultAsync();
        if (s is null)
        {
            s = new CompanySettings();
            _db.Settings.Add(s);
            await _db.SaveChangesAsync();
        }
        return s;
    }

    public static TimeZoneInfo ResolveTimeZone(string? id)
    {
        try { return TimeZoneInfo.FindSystemTimeZoneById(string.IsNullOrWhiteSpace(id) ? "Asia/Kolkata" : id); }
        catch { return TimeZoneInfo.Utc; }
    }

    public async Task<DateOnly> TodayAsync()
    {
        var s = await GetAsync();
        return DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, ResolveTimeZone(s.TimeZoneId)));
    }

    /// <summary>Digits only; strips a leading 0 or the default country code so the same number always compares equal.</summary>
    public static string NormalizeMobile(string? raw, string countryCode)
    {
        if (string.IsNullOrWhiteSpace(raw)) return string.Empty;
        var digits = new string(raw.Where(char.IsDigit).ToArray());
        if (digits.Length > 10 && digits.StartsWith("0")) digits = digits.TrimStart('0');
        if (!string.IsNullOrEmpty(countryCode) && digits.Length > 10 && digits.StartsWith(countryCode))
            digits = digits[countryCode.Length..];
        return digits;
    }
}
