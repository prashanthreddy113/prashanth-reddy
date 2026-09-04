using Microsoft.EntityFrameworkCore;
using StudyRoom.Api.Data;

namespace StudyRoom.Api.Services;

/// <summary>
/// Runs the reminder job once per day at the configured hour (room time zone).
/// Checks every minute; if the server was asleep at the scheduled hour it catches up the first time it is awake later that day.
/// </summary>
public class ReminderScheduler : BackgroundService
{
    private readonly IServiceProvider _services;
    private readonly ILogger<ReminderScheduler> _logger;

    public ReminderScheduler(IServiceProvider services, ILogger<ReminderScheduler> logger)
    {
        _services = services;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Give startup (migrations, seeding) a moment before the first check.
        try { await Task.Delay(TimeSpan.FromSeconds(20), stoppingToken); } catch (OperationCanceledException) { return; }

        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(1));
        do
        {
            try { await TickAsync(stoppingToken); }
            catch (OperationCanceledException) { break; }
            catch (Exception ex) { _logger.LogError(ex, "Reminder scheduler tick failed"); }
        }
        while (await timer.WaitForNextTickAsync(stoppingToken));
    }

    private async Task TickAsync(CancellationToken ct)
    {
        using var scope = _services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var settings = await db.Settings.AsNoTracking().OrderBy(s => s.Id).FirstOrDefaultAsync(ct);
        if (settings is null || !settings.RemindersEnabled) return;

        var localNow = SettingsService.LocalNow(settings);
        var today = DateOnly.FromDateTime(localNow);
        if (settings.LastReminderRunDate == today) return;
        if (localNow.Hour < settings.ReminderHour) return;

        _logger.LogInformation("Running scheduled WhatsApp reminders for {Date} at {Time}", today, localNow.ToString("HH:mm"));
        var reminders = scope.ServiceProvider.GetRequiredService<ReminderService>();
        await reminders.RunAsync(markRunDate: true, ct);
    }
}
