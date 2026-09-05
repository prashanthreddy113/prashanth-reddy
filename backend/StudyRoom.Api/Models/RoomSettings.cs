namespace StudyRoom.Api.Models;

/// <summary>Single-row table holding admin-configurable settings.</summary>
public class RoomSettings
{
    public int Id { get; set; }
    public string RoomName { get; set; } = "BrightLoop Reading Room";
    /// <summary>Students whose due date falls within this many days are highlighted as "due soon".</summary>
    public int DueSoonDays { get; set; } = 5;
    /// <summary>IANA time zone used to decide "today" for due-date calculations.</summary>
    public string TimeZoneId { get; set; } = "Asia/Kolkata";
    public string Currency { get; set; } = "INR";

    /// <summary>Share of active seats reserved for women (0-100). Men/others can only occupy the remaining seats.</summary>
    public int FemaleReservationPercent { get; set; } = 20;

    // ---- WhatsApp due-date reminders ----
    public bool RemindersEnabled { get; set; } = false;
    /// <summary>Comma-separated days before the due date to remind, e.g. "5,1".</summary>
    public string ReminderDaysBefore { get; set; } = "5,1";
    public bool RemindOnDueDay { get; set; } = true;
    /// <summary>After the due date: remind again every N days (0 = only once, the day after).</summary>
    public int OverdueRepeatEveryDays { get; set; } = 3;
    /// <summary>Stop overdue reminders after this many days past due.</summary>
    public int OverdueStopAfterDays { get; set; } = 30;
    /// <summary>Hour of day (0-23, room time zone) at which the daily job runs.</summary>
    public int ReminderHour { get; set; } = 9;
    /// <summary>Approved WhatsApp template name and language.</summary>
    public string WhatsAppTemplateName { get; set; } = "due_reminder";
    public string WhatsAppLanguageCode { get; set; } = "en";
    /// <summary>Last date (room time zone) the automatic job completed. Prevents double runs.</summary>
    public DateOnly? LastReminderRunDate { get; set; }
}
