using Marketing.Api.Data;
using Marketing.Api.Dtos;
using Marketing.Api.Models;
using Marketing.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace Marketing.Api.Controllers;

[ApiController]
[Route("api/ai")]
[Authorize]
public class AiController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly AiService _ai;
    private readonly SettingsService _settings;
    private readonly DashboardService _dashboard;

    public AiController(AppDbContext db, AiService ai, SettingsService settings, DashboardService dashboard)
    {
        _db = db;
        _ai = ai;
        _settings = settings;
        _dashboard = dashboard;
    }

    [HttpGet("status")]
    public async Task<ActionResult<AiStatusDto>> Status()
    {
        var s = await _settings.GetAsync();
        var today = await _settings.TodayAsync();
        var monthStart = TimeZoneInfo.ConvertTimeToUtc(new DateOnly(today.Year, today.Month, 1).ToDateTime(TimeOnly.MinValue), SettingsService.ResolveTimeZone(s.TimeZoneId));
        var q = _db.AiUsages.Where(u => u.CreatedAt >= monthStart);
        if (!User.IsAdmin()) q = q.Where(u => u.UserId == User.Id());
        var calls = await q.CountAsync();
        var tokens = calls == 0 ? 0 : await q.SumAsync(u => u.InputTokens + u.OutputTokens);
        return new AiStatusDto(_ai.IsConfigured(s), User.IsAdmin() ? _ai.KeySource(s) : null, _ai.ModelFor(s), calls, tokens);
    }

    /// <summary>Turns a dictated / typed visit note and shop photos into form fields.</summary>
    [HttpPost("capture-assist")]
    public async Task<ActionResult<CaptureSuggestion>> CaptureAssist(CaptureAssistRequest req, CancellationToken ct)
    {
        var s = await _settings.GetAsync();
        string? projectName = null;
        if (req.ProjectId is { } pid) projectName = await _db.Projects.Where(p => p.Id == pid).Select(p => p.Name + (p.Description == null ? "" : " – " + p.Description)).FirstOrDefaultAsync(ct);
        try { return await _ai.CaptureAssistAsync(User.Id(), s, req, projectName, ct); }
        catch (AiException e) { return StatusCode(e.Status, new { message = e.Message }); }
    }

    [HttpGet("leads/{id:int}/insight")]
    public async Task<ActionResult<LeadInsight>> Insight(int id, [FromQuery] string language = "en", [FromQuery] bool refresh = false, CancellationToken ct = default)
    {
        var lead = await LoadLeadAsync(id);
        if (lead is null) return NotFound();
        var s = await _settings.GetAsync();
        var key = $"insight:{id}:{language}:{lead.UpdatedAt.Ticks}:{lead.LastActivityAt.Ticks}:{lead.Activities.Count}";
        if (!refresh && _ai.Cache.TryGetValue(key, out LeadInsight? cached) && cached is not null) return cached;
        try
        {
            var insight = await _ai.LeadInsightAsync(User.Id(), s, lead, language, await ExecutiveNameAsync(lead), ct);
            _ai.Cache.Set(key, insight, TimeSpan.FromHours(6));
            return insight;
        }
        catch (AiException e) { return StatusCode(e.Status, new { message = e.Message }); }
    }

    [HttpPost("leads/{id:int}/message")]
    public async Task<ActionResult<DraftMessageResponse>> Message(int id, DraftMessageRequest req, CancellationToken ct)
    {
        var lead = await LoadLeadAsync(id);
        if (lead is null) return NotFound();
        var s = await _settings.GetAsync();
        try { return await _ai.DraftMessageAsync(User.Id(), s, lead, req, await ExecutiveNameAsync(lead), ct); }
        catch (AiException e) { return StatusCode(e.Status, new { message = e.Message }); }
    }

    /// <summary>Team briefing for admins, a personal plan for the day for executives. Cached for an hour per user.</summary>
    [HttpGet("briefing")]
    public async Task<ActionResult<Briefing>> BriefingEndpoint([FromQuery] bool refresh = false, CancellationToken ct = default)
    {
        var s = await _settings.GetAsync();
        var today = await _settings.TodayAsync();
        var isAdmin = User.IsAdmin();
        var uid = User.Id();
        var key = $"briefing:{uid}:{today:yyyyMMdd}";
        if (!refresh && _ai.Cache.TryGetValue(key, out Briefing? cached) && cached is not null) return cached;

        var dashboard = await _dashboard.BuildAsync(isAdmin, uid, null, null, 14);
        var hotQ = _db.Leads.Where(l => l.Status != LeadStatus.Converted && l.Status != LeadStatus.Lost && l.Interest >= s.HotInterestThreshold);
        if (!isAdmin) hotQ = hotQ.Where(l => l.AssignedToUserId == uid);
        var hot = await LeadQueries.ToSummariesAsync(hotQ.OrderByDescending(l => l.Interest).ThenBy(l => l.LastActivityAt).Take(12), today, ct);
        var name = await _db.Users.Where(u => u.Id == uid).Select(u => u.DisplayName).FirstAsync(ct);
        try
        {
            var briefing = await _ai.BriefingAsync(uid, s, isAdmin, name, dashboard, hot, ct);
            _ai.Cache.Set(key, briefing, TimeSpan.FromHours(1));
            return briefing;
        }
        catch (AiException e) { return StatusCode(e.Status, new { message = e.Message }); }
    }

    private async Task<LeadDetailDto?> LoadLeadAsync(int id)
    {
        var uid = User.Id();
        var q = User.IsAdmin() ? _db.Leads : _db.Leads.Where(l => l.AssignedToUserId == uid);
        var lead = await q.Include(l => l.Project).Include(l => l.AssignedTo).Include(l => l.CreatedBy)
            .Include(l => l.Activities).ThenInclude(a => a.User).AsSplitQuery().FirstOrDefaultAsync(l => l.Id == id);
        if (lead is null) return null;
        var photos = await _db.LeadPhotos.Where(p => p.LeadId == id).OrderBy(p => p.Id)
            .Select(p => new PhotoDto(p.Id, p.ContentType, p.Size, p.Caption, p.Thumbnail != null, p.CreatedAt)).ToListAsync();
        return LeadQueries.ToDetail(lead, await _settings.TodayAsync(), photos);
    }

    /// <summary>Messages are signed by whoever is asking (the assigned executive, or the admin on their behalf).</summary>
    private async Task<string> ExecutiveNameAsync(LeadDetailDto lead)
    {
        var me = await _db.Users.Where(u => u.Id == User.Id()).Select(u => u.DisplayName).FirstOrDefaultAsync();
        return User.IsAdmin() ? lead.AssignedToName : me ?? lead.AssignedToName;
    }
}
