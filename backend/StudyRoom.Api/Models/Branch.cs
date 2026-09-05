namespace StudyRoom.Api.Models;

/// <summary>A physical location of the reading room. Seats and students belong to exactly one branch.</summary>
public class Branch
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Code { get; set; }
    public string? Address { get; set; }
    public string? Phone { get; set; }
    public bool IsActive { get; set; } = true;
    /// <summary>Overrides the global women's reservation percentage for this branch when set.</summary>
    public int? FemaleReservationPercent { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public List<Seat> Seats { get; set; } = new();
    public List<Student> Students { get; set; } = new();
}
