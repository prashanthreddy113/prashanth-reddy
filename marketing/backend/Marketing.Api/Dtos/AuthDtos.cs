using System.ComponentModel.DataAnnotations;

namespace Marketing.Api.Dtos;

public record LoginRequest([Required] string Username, [Required] string Password);

public record ProjectRef(int Id, string Name, string Color);

public record UserInfo(int Id, string Username, string DisplayName, string Role, string? Mobile, List<ProjectRef> Projects);

public record LoginResponse(string Token, DateTime ExpiresAt, UserInfo User);

public record ChangePasswordRequest([Required] string CurrentPassword, [Required, MinLength(6)] string NewPassword);
