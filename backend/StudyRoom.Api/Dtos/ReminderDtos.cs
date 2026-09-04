using StudyRoom.Api.Models;

namespace StudyRoom.Api.Dtos;

public record ReminderLogDto(int Id, int StudentId, string StudentName, string Mobile, ReminderKind Kind, ReminderStatus Status,
    DateOnly SentOn, string Message, string? ProviderMessageId, string? Error, DateTime CreatedAt);

public record ReminderCandidateDto(int StudentId, string StudentName, string Mobile, int? SeatNumber, DateOnly DueDate,
    int DaysUntilDue, decimal Balance, ReminderKind Kind, bool AlreadySentToday, string Message);

public record ReminderRunResultDto(DateOnly Date, int Checked, int Sent, int Failed, int Skipped, List<ReminderLogDto> Results);

public record ReminderStatusDto(bool WhatsAppConfigured, string? PhoneNumberId, bool Enabled, int ReminderHour, string TimeZoneId,
    DateOnly Today, DateOnly? LastRunDate, DateTime? NextRunLocal, int DueTodayCount, bool ExternalTriggerConfigured);
