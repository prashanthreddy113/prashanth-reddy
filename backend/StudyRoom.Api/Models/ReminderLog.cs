namespace StudyRoom.Api.Models;

public enum ReminderKind
{
    DueSoon,    // N days before the due date
    DueToday,   // on the due date
    Overdue,    // after the due date
    Manual      // sent by the admin from the UI
}

public enum ReminderStatus
{
    Sent,
    Failed
}

/// <summary>One WhatsApp reminder attempt. Used to show history and to avoid sending twice on the same day.</summary>
public class ReminderLog
{
    public int Id { get; set; }
    public int StudentId { get; set; }
    public Student? Student { get; set; }
    public ReminderKind Kind { get; set; }
    public ReminderStatus Status { get; set; }
    /// <summary>The date (in the room's time zone) the reminder was for.</summary>
    public DateOnly SentOn { get; set; }
    public string Mobile { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public string? ProviderMessageId { get; set; }
    public string? Error { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
