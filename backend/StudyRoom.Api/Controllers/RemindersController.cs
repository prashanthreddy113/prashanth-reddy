using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using StudyRoom.Api.Data;
using StudyRoom.Api.Dtos;
using StudyRoom.Api.Services;

namespace StudyRoom.Api.Controllers;

[ApiController]
[Route("api/reminders")]
[Authorize]
public class RemindersController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly SettingsService _settings;
    private readonly ReminderService _reminders;
    private readonly WhatsAppService _whatsApp;
    private readonly IConfiguration _config;

    public RemindersController(AppDbContext db, SettingsService settings, ReminderService reminders, WhatsAppService whatsApp, IConfiguration config)
    {
        _db = db;
        _settings = settings;
        _reminders = reminders;
        _whatsApp = whatsApp;
        _config = config;
    }

    [HttpGet("status")]
    public async Task<ActionResult<ReminderStatusDto>> Status()
    {
        var s = await _settings.GetAsync();
        var localNow = SettingsService.LocalNow(s);
        var today = DateOnly.FromDateTime(localNow);
        var candidates = await _reminders.PreviewAsync();

        DateTime? next = null;
        if (s.RemindersEnabled)
        {
            var todayRun = localNow.Date.AddHours(s.ReminderHour);
            next = s.LastReminderRunDate == today || localNow >= todayRun ? todayRun.AddDays(1) : todayRun;
            if (s.LastReminderRunDate != today && localNow >= todayRun) next = localNow; // will catch up on the next tick
        }

        var masked = _whatsApp.PhoneNumberId is { Length: > 4 } id ? "…" + id[^4..] : null;
        return new ReminderStatusDto(_whatsApp.IsConfigured, masked, s.RemindersEnabled, s.ReminderHour, s.TimeZoneId, today,
            s.LastReminderRunDate, next, candidates.Count(c => !c.AlreadySentToday), !string.IsNullOrWhiteSpace(_config["Reminders:TriggerKey"]));
    }

    /// <summary>Checks the WhatsApp token and phone number id against Meta without sending anything.</summary>
    [HttpGet("whatsapp-test")]
    public async Task<ActionResult> TestWhatsApp()
    {
        var (ok, detail, error) = await _whatsApp.TestConnectionAsync();
        return Ok(new { ok, detail, error, hints = ok ? null : _whatsApp.TokenDiagnostics() });
    }

    /// <summary>Who would be reminded today (nothing is sent).</summary>
    [HttpGet("preview")]
    public async Task<ActionResult<List<ReminderCandidateDto>>> Preview() => await _reminders.PreviewAsync();

    /// <summary>Send today's reminders now.</summary>
    [HttpPost("run")]
    public async Task<ActionResult<ReminderRunResultDto>> Run() => await _reminders.RunAsync(markRunDate: true);

    /// <summary>
    /// Same as run, for external schedulers (cron-job.org, GitHub Actions, UptimeRobot) when the host sleeps.
    /// Protect with the Reminders__TriggerKey environment variable; pass it as the X-Reminder-Key header or ?key= query.
    /// </summary>
    [HttpPost("run-external")]
    [AllowAnonymous]
    public async Task<ActionResult<ReminderRunResultDto>> RunExternal([FromQuery] string? key)
    {
        var expected = _config["Reminders:TriggerKey"];
        var provided = key ?? Request.Headers["X-Reminder-Key"].FirstOrDefault();
        if (string.IsNullOrWhiteSpace(expected) || provided != expected)
            return Unauthorized(new { message = "Invalid or missing trigger key." });
        return await _reminders.RunAsync(markRunDate: true);
    }

    /// <summary>Send a reminder to one student right now.</summary>
    [HttpPost("send/{studentId:int}")]
    public async Task<ActionResult<ReminderLogDto>> Send(int studentId)
    {
        var log = await _reminders.SendManualAsync(studentId);
        if (log is null) return NotFound();
        if (log.Status == Models.ReminderStatus.Failed) return BadRequest(new { message = log.Error ?? "Sending failed.", log });
        return log;
    }

    [HttpGet("logs")]
    public async Task<ActionResult<List<ReminderLogDto>>> Logs([FromQuery] int days = 30, [FromQuery] int? studentId = null, [FromQuery] int limit = 200)
    {
        var settings = await _settings.GetAsync();
        var since = SettingsService.Today(settings).AddDays(-Math.Clamp(days, 1, 365));
        var query = _db.ReminderLogs.Include(r => r.Student).AsNoTracking().Where(r => r.SentOn >= since);
        if (studentId.HasValue) query = query.Where(r => r.StudentId == studentId.Value);

        return await query
            .OrderByDescending(r => r.CreatedAt)
            .Take(Math.Clamp(limit, 1, 1000))
            .Select(r => new ReminderLogDto(r.Id, r.StudentId, r.Student!.Name, r.Mobile, r.Kind, r.Status, r.SentOn, r.Message, r.ProviderMessageId, r.Error, r.CreatedAt))
            .ToListAsync();
    }
}
