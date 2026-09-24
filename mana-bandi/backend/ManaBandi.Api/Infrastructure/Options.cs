using System.Globalization;

namespace ManaBandi.Api.Infrastructure;

public class OtpOptions
{
    /// <summary>true only for testing: the code is returned as `devCode` and logged.</summary>
    public bool DevMode { get; set; }
    /// <summary>console | msg91</summary>
    public string Provider { get; set; } = "console";
    public int ExpirySeconds { get; set; } = 300;
    public int MaxAttempts { get; set; } = 5;
    public int MaxPerWindow { get; set; } = 3;
    public int WindowMinutes { get; set; } = 10;
    public int CodeLength { get; set; } = 4;
}

public class DispatchOptions
{
    public bool Enabled { get; set; } = true;
    public int OfferSeconds { get; set; } = 15;
    /// <summary>Comma separated search radii per round, e.g. "3,5,8".</summary>
    public string RadiiKm { get; set; } = "3,5,8";
    public int MaxSearchSeconds { get; set; } = 90;
    public int TickMs { get; set; } = 1000;
    public int HeartbeatStaleSeconds { get; set; } = 60;
    public double AvgSpeedKmh { get; set; } = 20;

    public double[] Radii()
    {
        var r = (RadiiKm ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(s => double.TryParse(s, NumberStyles.Float, CultureInfo.InvariantCulture, out var v) ? v : 0)
            .Where(v => v > 0).OrderBy(v => v).ToArray();
        return r.Length > 0 ? r : new[] { 3.0, 5.0, 8.0 };
    }
}

public class FilesOptions
{
    public string Root { get; set; } = "data/files";
    public long MaxBytes { get; set; } = 8 * 1024 * 1024;
}

public class PublicOptions
{
    public string BaseUrl { get; set; } = "http://localhost:5080";
    public int TrackExpiryHours { get; set; } = 2;
}

public class Msg91Options
{
    public string AuthKey { get; set; } = "";
    /// <summary>DLT-approved OTP template id (MSG91 OTP API).</summary>
    public string TemplateId { get; set; } = "";
    public string BaseUrl { get; set; } = "https://control.msg91.com";
    /// <summary>Flow template ids for transactional SMS keyed by template key (e.g. sos_trusted_contact).</summary>
    public Dictionary<string, string> FlowTemplates { get; set; } = new();
}
