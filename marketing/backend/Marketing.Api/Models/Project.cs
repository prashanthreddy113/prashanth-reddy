namespace Marketing.Api.Models;

/// <summary>A product or marketing project that executives promote in the field.</summary>
public class Project
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    /// <summary>Hex colour used as the project's badge in the UI.</summary>
    public string Color { get; set; } = "#4f46e5";
    /// <summary>Optional lead target for the project (used on the dashboard progress bar).</summary>
    public int? TargetLeads { get; set; }
    public bool IsActive { get; set; } = true;
    public bool IsDemo { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public List<UserProject> UserProjects { get; set; } = new();
    public List<Lead> Leads { get; set; } = new();
}

public class UserProject
{
    public int UserId { get; set; }
    public User User { get; set; } = null!;
    public int ProjectId { get; set; }
    public Project Project { get; set; } = null!;
    public DateTime AssignedAt { get; set; } = DateTime.UtcNow;
}
