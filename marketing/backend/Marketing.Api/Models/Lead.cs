namespace Marketing.Api.Models;

/// <summary>A shop / client captured by a marketing executive during a field visit.</summary>
public class Lead
{
    public int Id { get; set; }

    public int ProjectId { get; set; }
    public Project Project { get; set; } = null!;

    public int CreatedByUserId { get; set; }
    public User CreatedBy { get; set; } = null!;

    public int AssignedToUserId { get; set; }
    public User AssignedTo { get; set; } = null!;

    public string ShopName { get; set; } = string.Empty;
    public string? ContactName { get; set; }
    /// <summary>Digits only, national format (e.g. 10 digits in India).</summary>
    public string Mobile { get; set; } = string.Empty;
    public string? AltMobile { get; set; }
    public string? Email { get; set; }
    public string? ShopType { get; set; }
    public string? Address { get; set; }
    public string? Area { get; set; }
    public string? City { get; set; }
    public string? Pincode { get; set; }
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }

    /// <summary>1 = not interested … 5 = ready to buy.</summary>
    public int Interest { get; set; } = 3;
    public LeadStatus Status { get; set; } = LeadStatus.New;
    public decimal? ExpectedValue { get; set; }
    public string? Notes { get; set; }
    public DateOnly? NextFollowUpAt { get; set; }
    public string? LostReason { get; set; }

    public bool IsDemo { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public DateTime LastActivityAt { get; set; } = DateTime.UtcNow;
    public DateTime? ConvertedAt { get; set; }

    public List<LeadPhoto> Photos { get; set; } = new();
    public List<Activity> Activities { get; set; } = new();
}

public class LeadPhoto
{
    public int Id { get; set; }
    public int LeadId { get; set; }
    public Lead Lead { get; set; } = null!;
    public string ContentType { get; set; } = "image/jpeg";
    public byte[] Data { get; set; } = Array.Empty<byte>();
    public byte[]? Thumbnail { get; set; }
    public int Size { get; set; }
    public string? Caption { get; set; }
    public int? UploadedByUserId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>A touch-point with the lead: a visit, call, note, status change…</summary>
public class Activity
{
    public int Id { get; set; }
    public int LeadId { get; set; }
    public Lead Lead { get; set; } = null!;
    public int UserId { get; set; }
    public User User { get; set; } = null!;
    public ActivityType Type { get; set; }
    public string? Note { get; set; }
    public int? Interest { get; set; }
    public LeadStatus? FromStatus { get; set; }
    public LeadStatus? ToStatus { get; set; }
    public DateOnly? NextFollowUpAt { get; set; }
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
