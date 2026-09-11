using System.ComponentModel.DataAnnotations;

namespace Marketing.Api.Dtos;

public record CompanyPublicDto(string CompanyName, string? Tagline, bool HasLogo, string? LogoVersion, string Currency, string DefaultCountryCode);

public record SettingsDto(
    string CompanyName, string? Tagline, bool HasLogo, string? LogoVersion, string Currency, string DefaultCountryCode,
    string TimeZoneId, int DefaultFollowUpDays, int HotInterestThreshold);

public record UpdateSettingsRequest(
    [Required, MaxLength(120)] string CompanyName,
    string? Tagline,
    [MaxLength(8)] string? Currency,
    [MaxLength(6)] string? DefaultCountryCode,
    [MaxLength(64)] string? TimeZoneId,
    [Range(0, 60)] int? DefaultFollowUpDays,
    [Range(1, 5)] int? HotInterestThreshold);

public record LogoUploadRequest(string? ContentType, [Required] string DataBase64);
