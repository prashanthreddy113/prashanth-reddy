namespace WaterTanker.Api.Models;

public class User
{
    public int Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public UserRole Role { get; set; }

    /// <summary>Set for Operator users: the fleet company they belong to.</summary>
    public int? OperatorId { get; set; }
    public Operator? Operator { get; set; }

    /// <summary>Set for RWA users: the community they represent.</summary>
    public int? CommunityId { get; set; }
    public Community? Community { get; set; }

    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
