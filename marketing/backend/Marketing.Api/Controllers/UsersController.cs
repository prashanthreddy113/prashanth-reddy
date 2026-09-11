using Marketing.Api.Data;
using Marketing.Api.Dtos;
using Marketing.Api.Models;
using Marketing.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Marketing.Api.Controllers;

/// <summary>Admin-only management of marketing executives (and other admins).</summary>
[ApiController]
[Route("api/users")]
[Authorize(Roles = "Admin")]
public class UsersController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IPasswordHasher<User> _hasher;
    private readonly SettingsService _settings;

    public UsersController(AppDbContext db, IPasswordHasher<User> hasher, SettingsService settings)
    {
        _db = db;
        _hasher = hasher;
        _settings = settings;
    }

    [HttpGet]
    public async Task<ActionResult<List<UserDto>>> List()
    {
        var s = await _settings.GetAsync();
        var today = await _settings.TodayAsync();
        var tz = SettingsService.ResolveTimeZone(s.TimeZoneId);
        var monthStartUtc = TimeZoneInfo.ConvertTimeToUtc(new DateOnly(today.Year, today.Month, 1).ToDateTime(TimeOnly.MinValue), tz);
        var hot = s.HotInterestThreshold;

        var rows = await _db.Users.OrderBy(u => u.Role).ThenByDescending(u => u.IsActive).ThenBy(u => u.DisplayName).Select(u => new
        {
            u.Id, u.Username, u.DisplayName, u.Mobile, u.Role, u.IsActive, u.CreatedAt, u.LastLoginAt,
            Projects = u.UserProjects.OrderBy(up => up.Project.Name).Select(up => new ProjectRef(up.ProjectId, up.Project.Name, up.Project.Color)).ToList(),
            LeadCount = _db.Leads.Count(l => l.AssignedToUserId == u.Id),
            ConvertedCount = _db.Leads.Count(l => l.AssignedToUserId == u.Id && l.Status == LeadStatus.Converted),
            HotCount = _db.Leads.Count(l => l.AssignedToUserId == u.Id && l.Interest >= hot && l.Status != LeadStatus.Converted && l.Status != LeadStatus.Lost),
            VisitsThisMonth = _db.Activities.Count(a => a.UserId == u.Id && a.Type == ActivityType.Visit && a.CreatedAt >= monthStartUtc),
            Overdue = _db.Leads.Count(l => l.AssignedToUserId == u.Id && l.NextFollowUpAt < today && l.Status != LeadStatus.Converted && l.Status != LeadStatus.Lost),
        }).ToListAsync();

        return rows.Select(r => new UserDto(r.Id, r.Username, r.DisplayName, r.Mobile, r.Role.ToString(), r.IsActive, r.CreatedAt, r.LastLoginAt,
            r.Projects, r.LeadCount, r.ConvertedCount, r.HotCount, r.VisitsThisMonth, r.Overdue)).ToList();
    }

    [HttpPost]
    public async Task<ActionResult<UserDto>> Create(CreateUserRequest req)
    {
        var username = req.Username.Trim().ToLowerInvariant();
        if (!System.Text.RegularExpressions.Regex.IsMatch(username, "^[a-z0-9._-]{3,64}$"))
            return BadRequest(new { message = "Username may only contain letters, numbers, dots, dashes and underscores." });
        if (await _db.Users.AnyAsync(u => u.Username == username))
            return Conflict(new { message = $"Username '{username}' is already taken." });
        if (!TryRole(req.Role, out var role)) return BadRequest(new { message = "Role must be Admin or Executive." });

        var user = new User
        {
            Username = username,
            DisplayName = req.DisplayName.Trim(),
            Mobile = CleanMobile(req.Mobile),
            Role = role,
        };
        user.PasswordHash = _hasher.HashPassword(user, req.Password);
        _db.Users.Add(user);
        await _db.SaveChangesAsync();
        await SyncProjectsAsync(user.Id, req.ProjectIds ?? new List<int>());
        await _db.SaveChangesAsync();
        return CreatedAtAction(nameof(List), new { id = user.Id }, await OneAsync(user.Id));
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<UserDto>> Update(int id, UpdateUserRequest req)
    {
        var user = await _db.Users.FindAsync(id);
        if (user is null) return NotFound();

        user.DisplayName = req.DisplayName.Trim();
        user.Mobile = CleanMobile(req.Mobile);

        if (req.Role is not null)
        {
            if (!TryRole(req.Role, out var role)) return BadRequest(new { message = "Role must be Admin or Executive." });
            if (user.Role == UserRole.Admin && role != UserRole.Admin && await IsLastActiveAdminAsync(id))
                return BadRequest(new { message = "There must be at least one active admin." });
            user.Role = role;
        }
        if (req.IsActive is { } active)
        {
            if (!active && id == User.Id()) return BadRequest(new { message = "You cannot deactivate your own account." });
            if (!active && user.Role == UserRole.Admin && await IsLastActiveAdminAsync(id))
                return BadRequest(new { message = "There must be at least one active admin." });
            user.IsActive = active;
        }
        if (req.ProjectIds is not null) await SyncProjectsAsync(id, req.ProjectIds);
        await _db.SaveChangesAsync();
        return await OneAsync(id);
    }

    [HttpPost("{id:int}/reset-password")]
    public async Task<IActionResult> ResetPassword(int id, ResetPasswordRequest req)
    {
        var user = await _db.Users.FindAsync(id);
        if (user is null) return NotFound();
        user.PasswordHash = _hasher.HashPassword(user, req.NewPassword);
        await _db.SaveChangesAsync();
        return Ok(new { message = $"Password reset for {user.DisplayName}." });
    }

    /// <summary>Deletes a user that never captured any leads; otherwise deactivate.</summary>
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        if (id == User.Id()) return BadRequest(new { message = "You cannot delete your own account." });
        var user = await _db.Users.FindAsync(id);
        if (user is null) return NotFound();
        if (await _db.Leads.AnyAsync(l => l.AssignedToUserId == id || l.CreatedByUserId == id) || await _db.Activities.AnyAsync(a => a.UserId == id))
            return BadRequest(new { message = "This user has lead history. Deactivate the account instead (or reassign their leads first)." });
        if (user.Role == UserRole.Admin && await IsLastActiveAdminAsync(id))
            return BadRequest(new { message = "There must be at least one active admin." });
        _db.Users.Remove(user);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    private async Task<UserDto> OneAsync(int id) => (await List()).Value!.First(u => u.Id == id);

    private async Task<bool> IsLastActiveAdminAsync(int id) =>
        !await _db.Users.AnyAsync(u => u.Id != id && u.Role == UserRole.Admin && u.IsActive);

    private async Task SyncProjectsAsync(int userId, List<int> projectIds)
    {
        var wanted = projectIds.Distinct().ToHashSet();
        var existing = await _db.UserProjects.Where(up => up.UserId == userId).ToListAsync();
        _db.UserProjects.RemoveRange(existing.Where(e => !wanted.Contains(e.ProjectId)));
        var have = existing.Select(e => e.ProjectId).ToHashSet();
        var valid = await _db.Projects.Where(p => wanted.Contains(p.Id)).Select(p => p.Id).ToListAsync();
        foreach (var pid in valid.Where(v => !have.Contains(v)))
            _db.UserProjects.Add(new UserProject { UserId = userId, ProjectId = pid });
    }

    private static bool TryRole(string? raw, out UserRole role)
    {
        role = UserRole.Executive;
        if (string.IsNullOrWhiteSpace(raw)) return true;
        return Enum.TryParse(raw, true, out role);
    }

    private static string? CleanMobile(string? m)
    {
        if (string.IsNullOrWhiteSpace(m)) return null;
        var digits = new string(m.Where(c => char.IsDigit(c) || c == '+').ToArray());
        return digits.Length == 0 ? null : digits;
    }
}
