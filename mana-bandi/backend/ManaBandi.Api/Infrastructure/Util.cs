using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;

namespace ManaBandi.Api.Infrastructure;

public interface IClock
{
    DateTime UtcNow { get; }
}

public class SystemClock : IClock
{
    public DateTime UtcNow => DateTime.UtcNow;
}

/// <summary>India Standard Time helpers (fixed +05:30, no DST).</summary>
public static class Ist
{
    public static readonly TimeSpan Offset = TimeSpan.FromHours(5.5);
    public static DateTime ToIst(DateTime utc) => DateTime.SpecifyKind(utc, DateTimeKind.Utc).Add(Offset);
    public static DateOnly Today(IClock clock) => DateOnly.FromDateTime(ToIst(clock.UtcNow));
    public static DateOnly DateOf(DateTime utc) => DateOnly.FromDateTime(ToIst(utc));
    /// <summary>UTC instant of 00:00 IST on the given date.</summary>
    public static DateTime StartUtc(DateOnly d) => DateTime.SpecifyKind(d.ToDateTime(TimeOnly.MinValue) - Offset, DateTimeKind.Utc);
    /// <summary>Monday of the IST week containing d.</summary>
    public static DateOnly WeekStart(DateOnly d) => d.AddDays(-(((int)d.DayOfWeek + 6) % 7));
}

public static class IdGen
{
    private const string Crockford = "0123456789abcdefghjkmnpqrstvwxyz";
    private const string Alnum = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

    /// <summary>Time-sortable id: prefix + 10 chars of ms timestamp + 10 random chars.</summary>
    public static string New(string prefix)
    {
        var ms = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        var sb = new StringBuilder(prefix).Append('_');
        var ts = new char[10];
        for (var i = 9; i >= 0; i--) { ts[i] = Crockford[(int)(ms & 31)]; ms >>= 5; }
        sb.Append(ts);
        Span<byte> rnd = stackalloc byte[10];
        RandomNumberGenerator.Fill(rnd);
        foreach (var b in rnd) sb.Append(Crockford[b & 31]);
        return sb.ToString();
    }

    /// <summary>Random unguessable token (letters/digits without look-alikes).</summary>
    public static string Token(int length = 12)
    {
        var chars = new char[length];
        for (var i = 0; i < length; i++) chars[i] = Alnum[RandomNumberGenerator.GetInt32(Alnum.Length)];
        return new string(chars);
    }

    public static string Digits(int n)
    {
        var chars = new char[n];
        for (var i = 0; i < n; i++) chars[i] = (char)('0' + RandomNumberGenerator.GetInt32(10));
        return new string(chars);
    }
}

public static class Geo
{
    public static double HaversineKm(double lat1, double lng1, double lat2, double lng2)
    {
        const double R = 6371.0;
        var dLat = (lat2 - lat1) * Math.PI / 180;
        var dLng = (lng2 - lng1) * Math.PI / 180;
        var a = Math.Pow(Math.Sin(dLat / 2), 2) + Math.Cos(lat1 * Math.PI / 180) * Math.Cos(lat2 * Math.PI / 180) * Math.Pow(Math.Sin(dLng / 2), 2);
        return 2 * R * Math.Asin(Math.Min(1, Math.Sqrt(a)));
    }

    public static bool ValidLatLng(double lat, double lng) =>
        !double.IsNaN(lat) && !double.IsNaN(lng) && lat is >= -90 and <= 90 && lng is >= -180 and <= 180 && !(lat == 0 && lng == 0);

    public static double Round1(double x) => Math.Round(x, 1, MidpointRounding.AwayFromZero);
}

public static partial class Phone
{
    [GeneratedRegex("^[6-9][0-9]{9}$")]
    private static partial Regex Mobile();

    /// <summary>Normalises an Indian mobile number to +91XXXXXXXXXX, or null when invalid.</summary>
    public static string? Normalize(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        var digits = new string(raw.Where(char.IsDigit).ToArray());
        if (digits.Length == 12 && digits.StartsWith("91")) digits = digits[2..];
        else if (digits.Length == 11 && digits.StartsWith('0')) digits = digits[1..];
        return Mobile().IsMatch(digits) ? "+91" + digits : null;
    }

    public static string Mask(string? phone) =>
        string.IsNullOrEmpty(phone) || phone.Length < 4 ? "***" : new string('*', phone.Length - 2) + phone[^2..];
}

public static class Money
{
    /// <summary>JS Math.round semantics for positive values.</summary>
    public static int Round(double x) => (int)Math.Floor(x + 0.5);
}
