namespace Marketing.Api.Models;

/// <summary>Single-row table with the company profile shown across the app.</summary>
public class CompanySettings
{
    public int Id { get; set; }
    public string CompanyName { get; set; } = "My Company";
    public string? Tagline { get; set; }
    public string? LogoContentType { get; set; }
    public byte[]? LogoData { get; set; }
    public DateTime? LogoUpdatedAt { get; set; }
    public string Currency { get; set; } = "INR";
    public string DefaultCountryCode { get; set; } = "91";
    public string TimeZoneId { get; set; } = "Asia/Kolkata";
    /// <summary>Default gap (days) suggested for the next follow-up when an executive logs a visit.</summary>
    public int DefaultFollowUpDays { get; set; } = 3;
    /// <summary>Interest score (1–5) at or above which a lead counts as "hot".</summary>
    public int HotInterestThreshold { get; set; } = 4;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
