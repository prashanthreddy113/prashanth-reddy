namespace Marketing.Api.Models;

public class User
{
    public int Id { get; set; }
    public string Username { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public string? Mobile { get; set; }
    public UserRole Role { get; set; } = UserRole.Executive;
    public bool IsActive { get; set; } = true;
    public bool IsDemo { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? LastLoginAt { get; set; }

    public List<UserProject> UserProjects { get; set; } = new();
}
