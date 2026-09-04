using System.ComponentModel.DataAnnotations;

namespace StudyRoom.Api.Dtos;

public class SettingsDto
{
    [Required, StringLength(120, MinimumLength = 1)] public string RoomName { get; set; } = "BrightLoop Reading Room";
    [Range(0, 60)] public int DueSoonDays { get; set; } = 5;
    [Required, StringLength(64)] public string TimeZoneId { get; set; } = "Asia/Kolkata";
    [Required, StringLength(8)] public string Currency { get; set; } = "INR";

    public bool RemindersEnabled { get; set; }
    [StringLength(64), RegularExpression(@"^\s*(\d{1,3}\s*(,\s*\d{1,3}\s*)*)?$", ErrorMessage = "Days before must be numbers separated by commas, e.g. 5,1")]
    public string ReminderDaysBefore { get; set; } = "5,1";
    public bool RemindOnDueDay { get; set; } = true;
    [Range(0, 60)] public int OverdueRepeatEveryDays { get; set; } = 3;
    [Range(0, 365)] public int OverdueStopAfterDays { get; set; } = 30;
    [Range(0, 23)] public int ReminderHour { get; set; } = 9;
    [Required, StringLength(120)] public string WhatsAppTemplateName { get; set; } = "due_reminder";
    [Required, StringLength(16)] public string WhatsAppLanguageCode { get; set; } = "en";
}
