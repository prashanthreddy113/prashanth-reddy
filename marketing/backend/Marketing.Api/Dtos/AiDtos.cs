using System.ComponentModel.DataAnnotations;

namespace Marketing.Api.Dtos;

public record AiStatusDto(bool Configured, string? KeySource, string Model, int CallsThisMonth, long TokensThisMonth);

public class CaptureAssistRequest
{
    /// <summary>What the executive typed or dictated about the visit, in any language.</summary>
    public string? Text { get; set; }
    public List<PhotoUpload>? Photos { get; set; }
    public int? ProjectId { get; set; }
    /// <summary>Fields already filled in the form, so the AI only fills gaps and does not contradict them.</summary>
    public Dictionary<string, string?>? Current { get; set; }
}

public class CaptureSuggestion
{
    public string? ShopName { get; set; }
    public string? ContactName { get; set; }
    public string? Mobile { get; set; }
    public string? AltMobile { get; set; }
    public string? ShopType { get; set; }
    public string? Address { get; set; }
    public string? Area { get; set; }
    public string? City { get; set; }
    public string? Pincode { get; set; }
    public int? Interest { get; set; }
    public string? Status { get; set; }
    public decimal? ExpectedValue { get; set; }
    public int? NextFollowUpDays { get; set; }
    public string? Notes { get; set; }
    public string? SignboardText { get; set; }
    public List<string> Observations { get; set; } = new();
    public string? Summary { get; set; }
}

public class LeadInsight
{
    public string Priority { get; set; } = "Medium";
    public string Summary { get; set; } = string.Empty;
    public string NextBestAction { get; set; } = string.Empty;
    public List<string> TalkingPoints { get; set; } = new();
    public List<string> Risks { get; set; } = new();
    public string WhatsAppMessage { get; set; } = string.Empty;
    public string Language { get; set; } = "en";
    public DateTime GeneratedAt { get; set; } = DateTime.UtcNow;
}

public record DraftMessageRequest(string? Language, string? Purpose, string? Tone, string? Extra);

public record DraftMessageResponse(string Message, string Language);

public class BriefingItem
{
    public int? LeadId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Detail { get; set; } = string.Empty;
}

public class Briefing
{
    public string Scope { get; set; } = "team";
    public string Headline { get; set; } = string.Empty;
    public List<string> Highlights { get; set; } = new();
    public List<string> Concerns { get; set; } = new();
    public List<BriefingItem> Actions { get; set; } = new();
    public DateTime GeneratedAt { get; set; } = DateTime.UtcNow;
}
