using System.ComponentModel.DataAnnotations;

namespace StudyRoom.Api.Dtos;

public record LoginRequest([Required] string Username, [Required] string Password);

public record LoginResponse(string Token, DateTime ExpiresAt, string Username, string DisplayName);

public record ChangePasswordRequest(
    [Required] string CurrentPassword,
    [Required, MinLength(6)] string NewPassword);
