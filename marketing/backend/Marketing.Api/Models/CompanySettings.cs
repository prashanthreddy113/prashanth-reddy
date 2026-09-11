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
    /// <summary>Anthropic API key entered by the admin in Settings (an Anthropic__ApiKey environment variable takes precedence). Never returned to clients.</summary>
    public string? AnthropicApiKey { get; set; }
    /// <summary>Claude model used for AI features.</summary>
    public string AiModel { get; set; } = "claude-opus-5";
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>One row per AI call, so the admin can see what the AI features cost.</summary>
public class AiUsage
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string Feature { get; set; } = string.Empty;
    public string Model { get; set; } = string.Empty;
    public long InputTokens { get; set; }
    public long OutputTokens { get; set; }
    public int DurationMs { get; set; }
    public bool Success { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
