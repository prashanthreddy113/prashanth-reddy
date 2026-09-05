namespace StudyRoom.Api.Models;

public class Seat
{
    public int Id { get; set; }

    public int BranchId { get; set; }
    public Branch? Branch { get; set; }

    /// <summary>Human-visible seat number (1..N). Unique within a branch.</summary>
    public int Number { get; set; }

    /// <summary>Grouping such as "Ground floor", "Room A" or "Section 2". Null = ungrouped.</summary>
    public string? Section { get; set; }

    /// <summary>Air-conditioned seat.</summary>
    public bool IsAc { get; set; }

    /// <summary>Only women may be given this seat. Auto-designated from the branch's reservation percentage; admins can toggle per seat.</summary>
    public bool ReservedForWomen { get; set; }

    /// <summary>Optional label, e.g. "Window", "Near door".</summary>
    public string? Label { get; set; }

    /// <summary>Inactive seats are hidden from allocation (e.g. broken chair).</summary>
    public bool IsActive { get; set; } = true;

    public Student? Student { get; set; }
}
