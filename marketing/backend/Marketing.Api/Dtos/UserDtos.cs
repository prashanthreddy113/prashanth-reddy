using System.ComponentModel.DataAnnotations;

namespace Marketing.Api.Dtos;

public record UserDto(
    int Id, string Username, string DisplayName, string? Mobile, string Role, bool IsActive,
    DateTime CreatedAt, DateTime? LastLoginAt, List<ProjectRef> Projects,
    int LeadCount, int ConvertedCount, int HotCount, int VisitsThisMonth, int OverdueFollowUps);

public record CreateUserRequest(
    [Required, MinLength(3), MaxLength(64)] string Username,
    [Required, MinLength(6)] string Password,
    [Required, MaxLength(120)] string DisplayName,
    string? Mobile,
    string? Role,
    List<int>? ProjectIds);

public record UpdateUserRequest(
    [Required, MaxLength(120)] string DisplayName,
    string? Mobile,
    string? Role,
    bool? IsActive,
    List<int>? ProjectIds);

public record ResetPasswordRequest([Required, MinLength(6)] string NewPassword);
