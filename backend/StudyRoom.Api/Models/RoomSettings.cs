namespace StudyRoom.Api.Models;

/// <summary>Single-row table holding admin-configurable settings.</summary>
public class RoomSettings
{
    public int Id { get; set; }
    public string RoomName { get; set; } = "Reading Room";
    /// <summary>Students whose due date falls within this many days are highlighted as "due soon".</summary>
    public int DueSoonDays { get; set; } = 5;
    /// <summary>IANA time zone used to decide "today" for due-date calculations.</summary>
    public string TimeZoneId { get; set; } = "Asia/Kolkata";
    public string Currency { get; set; } = "INR";
}
