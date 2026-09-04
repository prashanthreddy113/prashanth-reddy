namespace StudyRoom.Api.Models;

public class Seat
{
    public int Id { get; set; }

    /// <summary>Human-visible seat number (1..N). Unique.</summary>
    public int Number { get; set; }

    /// <summary>Optional label, e.g. "Window", "AC Hall".</summary>
    public string? Label { get; set; }

    /// <summary>Inactive seats are hidden from allocation (e.g. broken chair).</summary>
    public bool IsActive { get; set; } = true;

    public Student? Student { get; set; }
}
