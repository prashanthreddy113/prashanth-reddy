namespace StudyRoom.Api.Models;

public class Payment
{
    public int Id { get; set; }
    public int StudentId { get; set; }
    public Student? Student { get; set; }
    public decimal Amount { get; set; }
    public DateOnly PaidOn { get; set; }
    public string? Note { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
