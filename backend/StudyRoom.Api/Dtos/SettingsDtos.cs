using System.ComponentModel.DataAnnotations;

namespace StudyRoom.Api.Dtos;

public class SettingsDto
{
    [Required, StringLength(120, MinimumLength = 1)] public string RoomName { get; set; } = "Reading Room";
    [Range(0, 60)] public int DueSoonDays { get; set; } = 5;
    [Required, StringLength(64)] public string TimeZoneId { get; set; } = "Asia/Kolkata";
    [Required, StringLength(8)] public string Currency { get; set; } = "INR";
}
