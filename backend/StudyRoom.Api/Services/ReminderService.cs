using System.Globalization;
using Microsoft.EntityFrameworkCore;
using StudyRoom.Api.Data;
using StudyRoom.Api.Dtos;
using StudyRoom.Api.Models;

namespace StudyRoom.Api.Services;

/// <summary>Decides who should be reminded today and sends the WhatsApp messages.</summary>
public class ReminderService
{
    private readonly AppDbContext _db;
    private readonly SettingsService _settings;
    private readonly WhatsAppService _whatsApp;
    private readonly ILogger<ReminderService> _logger;

    public ReminderService(AppDbContext db, SettingsService settings, WhatsAppService whatsApp, ILogger<ReminderService> logger)
    {
        _db = db;
        _settings = settings;
        _whatsApp = whatsApp;
        _logger = logger;
    }

    public static int[] ParseDays(string? csv) =>
        (csv ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(s => int.TryParse(s, out var n) ? n : -1)
            .Where(n => n > 0)
            .Distinct()
            .OrderByDescending(n => n)
            .ToArray();

    /// <summary>Which automatic reminder (if any) applies to a student today.</summary>
    public static ReminderKind? KindForToday(Student s, DateOnly today, RoomSettings settings)
    {
        if (!s.IsActive) return null;
        var days = s.DueDate.DayNumber - today.DayNumber;

        if (days > 0)
            return ParseDays(settings.ReminderDaysBefore).Contains(days) ? ReminderKind.DueSoon : null;

        if (days == 0)
            return settings.RemindOnDueDay ? ReminderKind.DueToday : null;

        var overdueDays = -days;
        if (settings.OverdueStopAfterDays > 0 && overdueDays > settings.OverdueStopAfterDays) return null;
        if (overdueDays == 1) return ReminderKind.Overdue;
        if (settings.OverdueRepeatEveryDays > 0 && (overdueDays - 1) % settings.OverdueRepeatEveryDays == 0) return ReminderKind.Overdue;
        return null;
    }

    public static string BuildMessage(Student s, RoomSettings settings, ReminderKind kind)
    {
        var due = s.DueDate.ToString("dd MMM yyyy", CultureInfo.InvariantCulture);
        var balance = FormatMoney(Math.Max(0, s.Balance), settings.Currency);
        var seat = s.Seat?.Number.ToString() ?? "-";
        var when = kind switch
        {
            ReminderKind.DueToday => $"is due today ({due})",
            ReminderKind.Overdue => $"expired on {due}",
            _ => $"is due on {due}",
        };
        return $"Hi {s.Name}, your {settings.RoomName} subscription for seat {seat} {when}. Pending balance: {balance}. Please renew to keep your seat. Reply here or call us.";
    }

    /// <summary>Template body parameters in the order the approved template expects: name, seat, due date, balance.</summary>
    public static string[] TemplateParameters(Student s, RoomSettings settings) => new[]
    {
        s.Name,
        s.Seat?.Number.ToString() ?? "-",
        s.DueDate.ToString("dd MMM yyyy", CultureInfo.InvariantCulture),
        FormatMoney(Math.Max(0, s.Balance), settings.Currency),
    };

    public static string FormatMoney(decimal amount, string currency)
    {
        var symbol = currency.ToUpperInvariant() switch { "INR" => "₹", "USD" => "$", "EUR" => "€", "GBP" => "£", _ => currency + " " };
        return symbol + amount.ToString("#,##0", CultureInfo.InvariantCulture);
    }

    /// <summary>Dry run: everyone who would receive an automatic reminder today.</summary>
    public async Task<List<ReminderCandidateDto>> PreviewAsync(CancellationToken ct = default)
    {
        var settings = await _settings.GetAsync(ct);
        var today = SettingsService.Today(settings);
        var students = await _db.Students.Include(s => s.Seat).AsNoTracking().Where(s => s.IsActive).ToListAsync(ct);
        var sentToday = await SentTodayAsync(today, ct);

        var list = new List<ReminderCandidateDto>();
        foreach (var s in students)
        {
            var kind = KindForToday(s, today, settings);
            if (kind is null) continue;
            list.Add(new ReminderCandidateDto(s.Id, s.Name, s.Mobile, s.Seat?.Number, s.DueDate, s.DueDate.DayNumber - today.DayNumber,
                s.Balance, kind.Value, sentToday.Contains(s.Id), BuildMessage(s, settings, kind.Value)));
        }
        return list.OrderBy(c => c.DueDate).ThenBy(c => c.StudentName).ToList();
    }

    /// <summary>Runs the daily job: sends every applicable reminder not already sent today.</summary>
    public async Task<ReminderRunResultDto> RunAsync(bool markRunDate, CancellationToken ct = default)
    {
        var settings = await _settings.GetAsync(ct);
        var today = SettingsService.Today(settings);
        var students = await _db.Students.Include(s => s.Seat).AsNoTracking().Where(s => s.IsActive).ToListAsync(ct);
        var sentToday = await SentTodayAsync(today, ct);

        int sent = 0, failed = 0, skipped = 0, checkedCount = 0;
        var results = new List<ReminderLogDto>();

        foreach (var s in students)
        {
            var kind = KindForToday(s, today, settings);
            if (kind is null) continue;
            checkedCount++;
            if (sentToday.Contains(s.Id)) { skipped++; continue; }

            var log = await SendAsync(s, kind.Value, settings, today, ct);
            results.Add(ToDto(log, s.Name));
            if (log.Status == ReminderStatus.Sent) sent++; else failed++;
        }

        if (markRunDate)
        {
            var tracked = await _db.Settings.FirstAsync(x => x.Id == settings.Id, ct);
            tracked.LastReminderRunDate = today;
            await _db.SaveChangesAsync(ct);
        }

        _logger.LogInformation("Reminder run for {Date}: checked {Checked}, sent {Sent}, failed {Failed}, skipped {Skipped}", today, checkedCount, sent, failed, skipped);
        return new ReminderRunResultDto(today, checkedCount, sent, failed, skipped, results);
    }

    /// <summary>Sends one reminder immediately (manual, from the UI).</summary>
    public async Task<ReminderLogDto?> SendManualAsync(int studentId, CancellationToken ct = default)
    {
        var settings = await _settings.GetAsync(ct);
        var today = SettingsService.Today(settings);
        var s = await _db.Students.Include(x => x.Seat).AsNoTracking().FirstOrDefaultAsync(x => x.Id == studentId, ct);
        if (s is null) return null;
        var log = await SendAsync(s, ReminderKind.Manual, settings, today, ct);
        return ToDto(log, s.Name);
    }

    private async Task<ReminderLog> SendAsync(Student s, ReminderKind kind, RoomSettings settings, DateOnly today, CancellationToken ct)
    {
        var message = BuildMessage(s, settings, kind);
        var result = await _whatsApp.SendTemplateAsync(s.Mobile, settings.WhatsAppTemplateName, settings.WhatsAppLanguageCode, TemplateParameters(s, settings), ct);

        var log = new ReminderLog
        {
            StudentId = s.Id,
            Kind = kind,
            Status = result.Ok ? ReminderStatus.Sent : ReminderStatus.Failed,
            SentOn = today,
            Mobile = s.Mobile,
            Message = message,
            ProviderMessageId = result.MessageId,
            Error = result.Error,
        };
        _db.ReminderLogs.Add(log);
        await _db.SaveChangesAsync(ct);
        return log;
    }

    private async Task<HashSet<int>> SentTodayAsync(DateOnly today, CancellationToken ct) =>
        (await _db.ReminderLogs.AsNoTracking()
            .Where(r => r.SentOn == today && r.Status == ReminderStatus.Sent && r.Kind != ReminderKind.Manual)
            .Select(r => r.StudentId)
            .ToListAsync(ct)).ToHashSet();

    public static ReminderLogDto ToDto(ReminderLog r, string studentName) =>
        new(r.Id, r.StudentId, studentName, r.Mobile, r.Kind, r.Status, r.SentOn, r.Message, r.ProviderMessageId, r.Error, r.CreatedAt);
}
