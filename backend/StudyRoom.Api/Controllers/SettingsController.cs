using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudyRoom.Api.Data;
using StudyRoom.Api.Dtos;
using StudyRoom.Api.Services;

namespace StudyRoom.Api.Controllers;

[ApiController]
[Route("api/settings")]
[Authorize]
public class SettingsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly SettingsService _settings;

    public SettingsController(AppDbContext db, SettingsService settings)
    {
        _db = db;
        _settings = settings;
    }

    [HttpGet]
    public async Task<ActionResult<SettingsDto>> Get()
    {
        var s = await _settings.GetAsync();
        return new SettingsDto
        {
            RoomName = s.RoomName, DueSoonDays = s.DueSoonDays, TimeZoneId = s.TimeZoneId, Currency = s.Currency,
            RemindersEnabled = s.RemindersEnabled, ReminderDaysBefore = s.ReminderDaysBefore, RemindOnDueDay = s.RemindOnDueDay,
            OverdueRepeatEveryDays = s.OverdueRepeatEveryDays, OverdueStopAfterDays = s.OverdueStopAfterDays, ReminderHour = s.ReminderHour,
            WhatsAppTemplateName = s.WhatsAppTemplateName, WhatsAppLanguageCode = s.WhatsAppLanguageCode,
        };
    }

    [HttpPut]
    public async Task<ActionResult<SettingsDto>> Update(SettingsDto request)
    {
        try { TimeZoneInfo.FindSystemTimeZoneById(request.TimeZoneId); }
        catch (Exception) { return BadRequest(new { message = $"Unknown time zone '{request.TimeZoneId}'. Use an IANA id such as Asia/Kolkata." }); }

        var s = await _settings.GetAsync();
        s.RoomName = request.RoomName.Trim();
        s.DueSoonDays = request.DueSoonDays;
        s.TimeZoneId = request.TimeZoneId.Trim();
        s.Currency = request.Currency.Trim().ToUpperInvariant();
        s.RemindersEnabled = request.RemindersEnabled;
        s.ReminderDaysBefore = string.Join(",", ReminderService.ParseDays(request.ReminderDaysBefore));
        s.RemindOnDueDay = request.RemindOnDueDay;
        s.OverdueRepeatEveryDays = request.OverdueRepeatEveryDays;
        s.OverdueStopAfterDays = request.OverdueStopAfterDays;
        s.ReminderHour = request.ReminderHour;
        s.WhatsAppTemplateName = request.WhatsAppTemplateName.Trim();
        s.WhatsAppLanguageCode = request.WhatsAppLanguageCode.Trim();
        await _db.SaveChangesAsync();
        return await Get();
    }
}
