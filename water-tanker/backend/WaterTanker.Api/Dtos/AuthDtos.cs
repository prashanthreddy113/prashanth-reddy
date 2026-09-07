namespace WaterTanker.Api.Dtos;

public record LoginRequest(string Email, string Password);

public record LoginResponse(
    string Token, DateTime ExpiresAt, string Email, string DisplayName, string Role,
    int? OperatorId, string? OperatorName, int? CommunityId, string? CommunityName);

public record ChangePasswordRequest(string CurrentPassword, string NewPassword);
