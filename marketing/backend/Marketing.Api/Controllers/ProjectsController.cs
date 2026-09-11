using Marketing.Api.Data;
using Marketing.Api.Dtos;
using Marketing.Api.Models;
using Marketing.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Marketing.Api.Controllers;

[ApiController]
[Route("api/projects")]
[Authorize]
public class ProjectsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly SettingsService _settings;

    public ProjectsController(AppDbContext db, SettingsService settings)
    {
        _db = db;
        _settings = settings;
    }

    /// <summary>Admins see every project; executives only the active ones assigned to them.</summary>
    [HttpGet]
    public async Task<ActionResult<List<ProjectDto>>> List([FromQuery] bool includeInactive = true)
    {
        var uid = User.Id();
        var isAdmin = User.IsAdmin();
        var q = _db.Projects.AsQueryable();
        if (!isAdmin)
            q = q.Where(p => p.IsActive && p.UserProjects.Any(up => up.UserId == uid));
        else if (!includeInactive)
            q = q.Where(p => p.IsActive);

        var hot = (await _settings.GetAsync()).HotInterestThreshold;
        var rows = await q.OrderByDescending(p => p.IsActive).ThenBy(p => p.Name).Select(p => new
        {
            p.Id, p.Name, p.Description, p.Color, p.TargetLeads, p.IsActive, p.CreatedAt,
            LeadCount = isAdmin ? p.Leads.Count : p.Leads.Count(l => l.AssignedToUserId == uid),
            ConvertedCount = p.Leads.Count(l => l.Status == LeadStatus.Converted && (isAdmin || l.AssignedToUserId == uid)),
            HotCount = p.Leads.Count(l => l.Interest >= hot && l.Status != LeadStatus.Converted && l.Status != LeadStatus.Lost && (isAdmin || l.AssignedToUserId == uid)),
            PipelineValue = p.Leads.Where(l => l.Status != LeadStatus.Converted && l.Status != LeadStatus.Lost && (isAdmin || l.AssignedToUserId == uid)).Sum(l => l.ExpectedValue) ?? 0m,
            WonValue = p.Leads.Where(l => l.Status == LeadStatus.Converted && (isAdmin || l.AssignedToUserId == uid)).Sum(l => l.ExpectedValue) ?? 0m,
            Executives = p.UserProjects.Where(up => up.User.Role == UserRole.Executive).OrderBy(up => up.User.DisplayName)
                .Select(up => new ProjectMemberDto(up.UserId, up.User.DisplayName, up.User.IsActive)).ToList(),
        }).ToListAsync();

        return rows.Select(r => new ProjectDto(r.Id, r.Name, r.Description, r.Color, r.TargetLeads, r.IsActive, r.CreatedAt,
            r.LeadCount, r.ConvertedCount, r.HotCount, r.Executives.Count(e => e.IsActive), r.PipelineValue, r.WonValue,
            isAdmin ? r.Executives : new List<ProjectMemberDto>())).ToList();
    }

    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ProjectDto>> Create(SaveProjectRequest req)
    {
        var name = req.Name.Trim();
        if (await _db.Projects.AnyAsync(p => p.Name.ToLower() == name.ToLower()))
            return Conflict(new { message = $"A project named '{name}' already exists." });

        var project = new Project
        {
            Name = name,
            Description = Clean(req.Description),
            Color = ValidColor(req.Color) ?? "#4f46e5",
            TargetLeads = req.TargetLeads,
            IsActive = req.IsActive ?? true,
        };
        _db.Projects.Add(project);
        await _db.SaveChangesAsync();
        if (req.ExecutiveIds is not null) await SyncExecutivesAsync(project.Id, req.ExecutiveIds);
        await _db.SaveChangesAsync();
        return CreatedAtAction(nameof(List), new { id = project.Id }, (await List()).Value!.First(p => p.Id == project.Id));
    }

    [HttpPut("{id:int}")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ProjectDto>> Update(int id, SaveProjectRequest req)
    {
        var project = await _db.Projects.FindAsync(id);
        if (project is null) return NotFound();
        var name = req.Name.Trim();
        if (await _db.Projects.AnyAsync(p => p.Id != id && p.Name.ToLower() == name.ToLower()))
            return Conflict(new { message = $"A project named '{name}' already exists." });

        project.Name = name;
        project.Description = Clean(req.Description);
        if (ValidColor(req.Color) is { } c) project.Color = c;
        project.TargetLeads = req.TargetLeads;
        if (req.IsActive is { } active) project.IsActive = active;
        if (req.ExecutiveIds is not null) await SyncExecutivesAsync(id, req.ExecutiveIds);
        await _db.SaveChangesAsync();
        return (await List()).Value!.First(p => p.Id == id);
    }

    /// <summary>Deletes a project that has no leads; otherwise deactivate it instead.</summary>
    [HttpDelete("{id:int}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Delete(int id)
    {
        var project = await _db.Projects.FindAsync(id);
        if (project is null) return NotFound();
        if (await _db.Leads.AnyAsync(l => l.ProjectId == id))
            return BadRequest(new { message = "This project already has leads. Mark it inactive instead of deleting it." });
        _db.Projects.Remove(project);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    private async Task SyncExecutivesAsync(int projectId, List<int> userIds)
    {
        var wanted = userIds.Distinct().ToHashSet();
        var existing = await _db.UserProjects.Where(up => up.ProjectId == projectId).ToListAsync();
        _db.UserProjects.RemoveRange(existing.Where(e => !wanted.Contains(e.UserId)));
        var have = existing.Select(e => e.UserId).ToHashSet();
        var valid = await _db.Users.Where(u => wanted.Contains(u.Id)).Select(u => u.Id).ToListAsync();
        foreach (var uid in valid.Where(v => !have.Contains(v)))
            _db.UserProjects.Add(new UserProject { UserId = uid, ProjectId = projectId });
    }

    private static string? Clean(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();

    public static string? ValidColor(string? c)
    {
        if (string.IsNullOrWhiteSpace(c)) return null;
        c = c.Trim();
        return System.Text.RegularExpressions.Regex.IsMatch(c, "^#[0-9a-fA-F]{6}$") ? c.ToLowerInvariant() : null;
    }
}
