using System.ComponentModel.DataAnnotations;

namespace Marketing.Api.Dtos;

public record PhotoUpload(string? ContentType, [Required] string DataBase64, string? ThumbBase64, string? Caption);

public record PhotoDto(int Id, string ContentType, int Size, string? Caption, bool HasThumbnail, DateTime CreatedAt);

public record ActivityDto(
    int Id, string Type, string? Note, int? Interest, string? FromStatus, string? ToStatus, DateOnly? NextFollowUpAt,
    double? Latitude, double? Longitude, int UserId, string UserName, DateTime CreatedAt);

public record LeadSummaryDto(
    int Id, string ShopName, string? ContactName, string Mobile, string? ShopType, string? Area, string? City,
    int ProjectId, string ProjectName, string ProjectColor,
    int AssignedToUserId, string AssignedToName,
    int Interest, string Status, decimal? ExpectedValue,
    DateOnly? NextFollowUpAt, string FollowUpState,
    int PhotoCount, int? CoverPhotoId,
    double? Latitude, double? Longitude,
    DateTime CreatedAt, DateTime LastActivityAt);

public record LeadDetailDto(
    int Id, string ShopName, string? ContactName, string Mobile, string? AltMobile, string? Email, string? ShopType,
    string? Address, string? Area, string? City, string? Pincode, double? Latitude, double? Longitude,
    int ProjectId, string ProjectName, string ProjectColor,
    int AssignedToUserId, string AssignedToName, int CreatedByUserId, string CreatedByName,
    int Interest, string Status, decimal? ExpectedValue, string? Notes, DateOnly? NextFollowUpAt, string FollowUpState,
    string? LostReason, DateTime CreatedAt, DateTime UpdatedAt, DateTime LastActivityAt, DateTime? ConvertedAt,
    List<PhotoDto> Photos, List<ActivityDto> Activities);

public record PagedResult<T>(List<T> Items, int Total, int Page, int PageSize);

public class SaveLeadRequest
{
    [Required] public int ProjectId { get; set; }
    [Required, MaxLength(160)] public string ShopName { get; set; } = string.Empty;
    [MaxLength(120)] public string? ContactName { get; set; }
    [Required, MaxLength(20)] public string Mobile { get; set; } = string.Empty;
    [MaxLength(20)] public string? AltMobile { get; set; }
    [MaxLength(160)] public string? Email { get; set; }
    [MaxLength(60)] public string? ShopType { get; set; }
    public string? Address { get; set; }
    [MaxLength(120)] public string? Area { get; set; }
    [MaxLength(80)] public string? City { get; set; }
    [MaxLength(12)] public string? Pincode { get; set; }
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
    [Range(1, 5)] public int Interest { get; set; } = 3;
    public string? Status { get; set; }
    public decimal? ExpectedValue { get; set; }
    public string? Notes { get; set; }
    public DateOnly? NextFollowUpAt { get; set; }
    public string? LostReason { get; set; }
    /// <summary>Admin only: assign to a specific executive. Executives always get their own leads.</summary>
    public int? AssignedToUserId { get; set; }
    /// <summary>Only used on create.</summary>
    public List<PhotoUpload>? Photos { get; set; }
    /// <summary>Only used on create: note stored with the first-visit activity.</summary>
    public string? VisitNote { get; set; }
}

public record AddPhotosRequest([Required] List<PhotoUpload> Photos);

public class AddActivityRequest
{
    [Required] public string Type { get; set; } = "Visit";
    public string? Note { get; set; }
    [Range(1, 5)] public int? Interest { get; set; }
    public string? Status { get; set; }
    public string? LostReason { get; set; }
    public decimal? ExpectedValue { get; set; }
    public DateOnly? NextFollowUpAt { get; set; }
    public bool ClearFollowUp { get; set; }
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
}

public record AssignLeadRequest([Required] int UserId, string? Note);

public record MobileCheckDto(bool Exists, List<LeadSummaryDto> Matches);
