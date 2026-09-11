using System.Text;
using Marketing.Api.Data;
using Marketing.Api.Dtos;
using Marketing.Api.Models;
using Marketing.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Marketing.Api.Controllers;

[ApiController]
[Route("api/leads")]
[Authorize]
public class LeadsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly SettingsService _settings;

    public LeadsController(AppDbContext db, SettingsService settings)
    {
        _db = db;
        _settings = settings;
    }

    /// <summary>Executives only ever see leads assigned to them.</summary>
    private IQueryable<Lead> Scoped()
    {
        var uid = User.Id();
        return User.IsAdmin() ? _db.Leads : _db.Leads.Where(l => l.AssignedToUserId == uid);
    }

    private IQueryable<Lead> ApplyFilters(IQueryable<Lead> q, string? search, int? projectId, int? userId, string? status, int? interest, int? minInterest,
        string? followUp, DateOnly? from, DateOnly? to, string? city, string? shopType, DateOnly today, TimeZoneInfo tz)
    {
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = $"%{search.Trim()}%";
            var digits = new string(search.Where(char.IsDigit).ToArray());
            q = q.Where(l => EF.Functions.ILike(l.ShopName, term) || EF.Functions.ILike(l.ContactName ?? "", term)
                || EF.Functions.ILike(l.City ?? "", term) || EF.Functions.ILike(l.Area ?? "", term) || EF.Functions.ILike(l.Address ?? "", term)
                || (digits.Length >= 4 && (l.Mobile.Contains(digits) || (l.AltMobile ?? "").Contains(digits))));
        }
        if (projectId is { } pid) q = q.Where(l => l.ProjectId == pid);
        if (userId is { } uid) q = q.Where(l => l.AssignedToUserId == uid);
        if (!string.IsNullOrWhiteSpace(status))
        {
            if (status.Equals("open", StringComparison.OrdinalIgnoreCase))
                q = q.Where(l => l.Status != LeadStatus.Converted && l.Status != LeadStatus.Lost);
            else if (status.Equals("closed", StringComparison.OrdinalIgnoreCase))
                q = q.Where(l => l.Status == LeadStatus.Converted || l.Status == LeadStatus.Lost);
            else
            {
                var wanted = status.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                    .Select(s => Enum.TryParse<LeadStatus>(s, true, out var st) ? st : (LeadStatus?)null).Where(s => s != null).Select(s => s!.Value).ToList();
                if (wanted.Count > 0) q = q.Where(l => wanted.Contains(l.Status));
            }
        }
        if (interest is { } i) q = q.Where(l => l.Interest == i);
        if (minInterest is { } mi) q = q.Where(l => l.Interest >= mi);
        if (!string.IsNullOrWhiteSpace(followUp))
        {
            var open = q.Where(l => l.Status != LeadStatus.Converted && l.Status != LeadStatus.Lost);
            q = followUp.ToLowerInvariant() switch
            {
                "overdue" => open.Where(l => l.NextFollowUpAt < today),
                "today" => open.Where(l => l.NextFollowUpAt == today),
                "due" => open.Where(l => l.NextFollowUpAt <= today),
                "upcoming" => open.Where(l => l.NextFollowUpAt > today && l.NextFollowUpAt <= today.AddDays(7)),
                "week" => open.Where(l => l.NextFollowUpAt <= today.AddDays(7)),
                "none" => open.Where(l => l.NextFollowUpAt == null),
                _ => q,
            };
        }
        if (from is { } f) q = q.Where(l => l.CreatedAt >= TimeZoneInfo.ConvertTimeToUtc(f.ToDateTime(TimeOnly.MinValue), tz));
        if (to is { } t) q = q.Where(l => l.CreatedAt < TimeZoneInfo.ConvertTimeToUtc(t.AddDays(1).ToDateTime(TimeOnly.MinValue), tz));
        if (!string.IsNullOrWhiteSpace(city)) q = q.Where(l => l.City != null && l.City.ToLower() == city.Trim().ToLower());
        if (!string.IsNullOrWhiteSpace(shopType)) q = q.Where(l => l.ShopType != null && l.ShopType.ToLower() == shopType.Trim().ToLower());
        return q;
    }

    private static IQueryable<Lead> ApplySort(IQueryable<Lead> q, string? sort) => (sort ?? "recent").ToLowerInvariant() switch
    {
        "newest" => q.OrderByDescending(l => l.CreatedAt),
        "oldest" => q.OrderBy(l => l.CreatedAt),
        "followup" => q.OrderBy(l => l.NextFollowUpAt == null).ThenBy(l => l.NextFollowUpAt).ThenByDescending(l => l.Interest),
        "interest" => q.OrderByDescending(l => l.Interest).ThenByDescending(l => l.LastActivityAt),
        "name" => q.OrderBy(l => l.ShopName),
        "value" => q.OrderByDescending(l => l.ExpectedValue ?? 0).ThenByDescending(l => l.LastActivityAt),
        _ => q.OrderByDescending(l => l.LastActivityAt).ThenByDescending(l => l.Id),
    };

    [HttpGet]
    public async Task<ActionResult<PagedResult<LeadSummaryDto>>> List(
        [FromQuery] string? search, [FromQuery] int? projectId, [FromQuery] int? userId, [FromQuery] string? status,
        [FromQuery] int? interest, [FromQuery] int? minInterest, [FromQuery] string? followUp,
        [FromQuery] DateOnly? from, [FromQuery] DateOnly? to, [FromQuery] string? city, [FromQuery] string? shopType,
        [FromQuery] string? sort, [FromQuery] int page = 1, [FromQuery] int pageSize = 50)
    {
        var s = await _settings.GetAsync();
        var tz = SettingsService.ResolveTimeZone(s.TimeZoneId);
        var today = await _settings.TodayAsync();
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 200);

        var q = ApplyFilters(Scoped(), search, projectId, userId, status, interest, minInterest, followUp, from, to, city, shopType, today, tz);
        var total = await q.CountAsync();
        var items = await LeadQueries.ToSummariesAsync(ApplySort(q, sort).Skip((page - 1) * pageSize).Take(pageSize), today);
        return new PagedResult<LeadSummaryDto>(items, total, page, pageSize);
    }

    /// <summary>Distinct cities / areas / shop types for autocomplete in the capture form.</summary>
    [HttpGet("suggestions")]
    public async Task<ActionResult> Suggestions()
    {
        var cities = await _db.Leads.Where(l => l.City != null && l.City != "").GroupBy(l => l.City!).OrderByDescending(g => g.Count()).Select(g => g.Key).Take(30).ToListAsync();
        var areas = await _db.Leads.Where(l => l.Area != null && l.Area != "").GroupBy(l => l.Area!).OrderByDescending(g => g.Count()).Select(g => g.Key).Take(50).ToListAsync();
        var types = await _db.Leads.Where(l => l.ShopType != null && l.ShopType != "").GroupBy(l => l.ShopType!).OrderByDescending(g => g.Count()).Select(g => g.Key).Take(30).ToListAsync();
        var defaults = new[] { "Retail shop", "Wholesale", "Distributor", "Supermarket", "Pharmacy", "Hardware", "Electronics", "Restaurant / Hotel", "Clinic", "School / Institute", "Office", "Other" };
        return Ok(new { cities, areas, shopTypes = types.Union(defaults).Distinct().ToList() });
    }

    /// <summary>Live duplicate check used while an executive types a mobile number.</summary>
    [HttpGet("check-mobile")]
    public async Task<ActionResult<MobileCheckDto>> CheckMobile([FromQuery] string mobile, [FromQuery] int? excludeId)
    {
        var s = await _settings.GetAsync();
        var normalized = SettingsService.NormalizeMobile(mobile, s.DefaultCountryCode);
        if (normalized.Length < 6) return new MobileCheckDto(false, new List<LeadSummaryDto>());
        var today = await _settings.TodayAsync();
        var q = _db.Leads.Where(l => (l.Mobile == normalized || l.AltMobile == normalized) && (excludeId == null || l.Id != excludeId));
        var matches = await LeadQueries.ToSummariesAsync(q.OrderByDescending(l => l.LastActivityAt).Take(5), today);
        return new MobileCheckDto(matches.Count > 0, matches);
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<LeadDetailDto>> Get(int id)
    {
        var lead = await DetailQuery().FirstOrDefaultAsync(l => l.Id == id);
        if (lead is null) return NotFound();
        // Photo metadata only – the image bytes are served by GetPhoto on demand.
        var photos = await _db.LeadPhotos.Where(p => p.LeadId == id).OrderBy(p => p.Id)
            .Select(p => new PhotoDto(p.Id, p.ContentType, p.Size, p.Caption, p.Thumbnail != null, p.CreatedAt)).ToListAsync();
        return LeadQueries.ToDetail(lead, await _settings.TodayAsync(), photos);
    }

    private IQueryable<Lead> DetailQuery() => Scoped()
        .Include(l => l.Project).Include(l => l.AssignedTo).Include(l => l.CreatedBy)
        .Include(l => l.Activities).ThenInclude(a => a.User)
        .AsSplitQuery();

    [HttpPost]
    public async Task<ActionResult<LeadDetailDto>> Create(SaveLeadRequest req, [FromQuery] bool force = false)
    {
        var s = await _settings.GetAsync();
        var uid = User.Id();
        var isAdmin = User.IsAdmin();

        var project = await _db.Projects.FindAsync(req.ProjectId);
        if (project is null || !project.IsActive) return BadRequest(new { message = "Choose an active project / product." });
        if (!isAdmin && !await _db.UserProjects.AnyAsync(up => up.UserId == uid && up.ProjectId == req.ProjectId))
            return StatusCode(403, new { message = "You are not assigned to this project." });

        var assignedTo = uid;
        if (isAdmin && req.AssignedToUserId is { } target && target != uid)
        {
            var ok = await _db.Users.AnyAsync(u => u.Id == target && u.IsActive);
            if (!ok) return BadRequest(new { message = "Assigned executive not found or inactive." });
            assignedTo = target;
        }

        var mobile = SettingsService.NormalizeMobile(req.Mobile, s.DefaultCountryCode);
        if (mobile.Length < 6) return BadRequest(new { message = "Enter a valid mobile number." });

        if (!force)
        {
            var dup = await _db.Leads.Where(l => l.ProjectId == req.ProjectId && l.Mobile == mobile)
                .Select(l => new { l.Id, l.ShopName, Owner = l.AssignedTo.DisplayName }).FirstOrDefaultAsync();
            if (dup is not null)
                return Conflict(new { message = $"This mobile number already exists in {project.Name} as \"{dup.ShopName}\" (handled by {dup.Owner}).", existingLeadId = dup.Id });
        }

        var status = ParseStatus(req.Status) ?? LeadStatus.New;
        var now = DateTime.UtcNow;
        var lead = new Lead
        {
            ProjectId = req.ProjectId,
            CreatedByUserId = uid,
            AssignedToUserId = assignedTo,
            Mobile = mobile,
            AltMobile = OptionalMobile(req.AltMobile, s.DefaultCountryCode),
            Status = status,
            CreatedAt = now,
            UpdatedAt = now,
            LastActivityAt = now,
            ConvertedAt = status == LeadStatus.Converted ? now : null,
        };
        ApplyFields(lead, req);
        if (!LeadQueries.IsOpen(status)) lead.NextFollowUpAt = null;

        var photoError = AddPhotos(lead, req.Photos, uid);
        if (photoError is not null) return BadRequest(new { message = photoError });

        lead.Activities.Add(new Activity
        {
            UserId = uid,
            Type = ActivityType.Visit,
            Note = string.IsNullOrWhiteSpace(req.VisitNote) ? "First visit – lead captured" : req.VisitNote.Trim(),
            Interest = lead.Interest,
            ToStatus = status,
            NextFollowUpAt = lead.NextFollowUpAt,
            Latitude = lead.Latitude,
            Longitude = lead.Longitude,
            CreatedAt = now,
        });

        _db.Leads.Add(lead);
        await _db.SaveChangesAsync();
        return CreatedAtAction(nameof(Get), new { id = lead.Id }, (await Get(lead.Id)).Value);
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<LeadDetailDto>> Update(int id, SaveLeadRequest req)
    {
        var s = await _settings.GetAsync();
        var lead = await Scoped().Include(l => l.Activities).FirstOrDefaultAsync(l => l.Id == id);
        if (lead is null) return NotFound();
        var uid = User.Id();

        if (req.ProjectId != lead.ProjectId)
        {
            var project = await _db.Projects.FindAsync(req.ProjectId);
            if (project is null || !project.IsActive) return BadRequest(new { message = "Choose an active project / product." });
            if (!User.IsAdmin() && !await _db.UserProjects.AnyAsync(up => up.UserId == uid && up.ProjectId == req.ProjectId))
                return StatusCode(403, new { message = "You are not assigned to this project." });
            lead.ProjectId = req.ProjectId;
        }

        var mobile = SettingsService.NormalizeMobile(req.Mobile, s.DefaultCountryCode);
        if (mobile.Length < 6) return BadRequest(new { message = "Enter a valid mobile number." });
        if (mobile != lead.Mobile && await _db.Leads.AnyAsync(l => l.Id != id && l.ProjectId == lead.ProjectId && l.Mobile == mobile))
            return Conflict(new { message = "Another lead in this project already has that mobile number." });
        lead.Mobile = mobile;
        lead.AltMobile = OptionalMobile(req.AltMobile, s.DefaultCountryCode);

        if (User.IsAdmin() && req.AssignedToUserId is { } target && target != lead.AssignedToUserId)
        {
            var user = await _db.Users.FindAsync(target);
            if (user is null || !user.IsActive) return BadRequest(new { message = "Assigned executive not found or inactive." });
            lead.Activities.Add(new Activity { UserId = uid, Type = ActivityType.Assignment, Note = $"Reassigned to {user.DisplayName}" });
            lead.AssignedToUserId = target;
        }

        var oldInterest = lead.Interest;
        ApplyFields(lead, req);
        if (ParseStatus(req.Status) is { } newStatus) ChangeStatus(lead, newStatus, uid, null, req.LostReason);
        if (oldInterest != lead.Interest)
            lead.Activities.Add(new Activity { UserId = uid, Type = ActivityType.Note, Note = $"Interest updated to {lead.Interest}/5", Interest = lead.Interest });
        lead.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return (await Get(id)).Value!;
    }

    /// <summary>Log a follow-up visit / call / note; optionally update interest, status and the next follow-up date in one go.</summary>
    [HttpPost("{id:int}/activities")]
    public async Task<ActionResult<LeadDetailDto>> AddActivity(int id, AddActivityRequest req)
    {
        var lead = await Scoped().Include(l => l.Activities).FirstOrDefaultAsync(l => l.Id == id);
        if (lead is null) return NotFound();
        if (!Enum.TryParse<ActivityType>(req.Type, true, out var type) || type is ActivityType.StatusChange or ActivityType.Assignment)
            return BadRequest(new { message = "Activity type must be Visit, Call, WhatsApp, Meeting or Note." });

        var uid = User.Id();
        var now = DateTime.UtcNow;
        var activity = new Activity
        {
            UserId = uid,
            Type = type,
            Note = string.IsNullOrWhiteSpace(req.Note) ? null : req.Note.Trim(),
            Latitude = req.Latitude,
            Longitude = req.Longitude,
            CreatedAt = now,
        };
        if (req.Interest is { } interest) { lead.Interest = interest; activity.Interest = interest; }
        if (req.ExpectedValue is { } value) lead.ExpectedValue = value;
        if (ParseStatus(req.Status) is { } status && status != lead.Status)
        {
            activity.FromStatus = lead.Status;
            activity.ToStatus = status;
            ChangeStatus(lead, status, uid, null, req.LostReason, logActivity: false);
        }
        if (req.ClearFollowUp) lead.NextFollowUpAt = null;
        else if (req.NextFollowUpAt is { } next && LeadQueries.IsOpen(lead.Status)) { lead.NextFollowUpAt = next; activity.NextFollowUpAt = next; }
        if (!LeadQueries.IsOpen(lead.Status)) lead.NextFollowUpAt = null;

        // A visit / call that happened today counts as the follow-up being done.
        if (activity.NextFollowUpAt is null && !req.ClearFollowUp && lead.NextFollowUpAt is { } due && due <= await _settings.TodayAsync() && type is ActivityType.Visit or ActivityType.Call or ActivityType.WhatsApp or ActivityType.Meeting)
            lead.NextFollowUpAt = null;

        // Visit location: refresh the lead's coordinates if none were captured before.
        if (lead.Latitude is null && req.Latitude is not null) { lead.Latitude = req.Latitude; lead.Longitude = req.Longitude; }

        lead.Activities.Add(activity);
        lead.LastActivityAt = now;
        lead.UpdatedAt = now;
        await _db.SaveChangesAsync();
        return (await Get(id)).Value!;
    }

    [HttpDelete("{id:int}/activities/{activityId:int}")]
    public async Task<IActionResult> DeleteActivity(int id, int activityId)
    {
        var lead = await Scoped().FirstOrDefaultAsync(l => l.Id == id);
        if (lead is null) return NotFound();
        var activity = await _db.Activities.FirstOrDefaultAsync(a => a.Id == activityId && a.LeadId == id);
        if (activity is null) return NotFound();
        if (!User.IsAdmin() && activity.UserId != User.Id()) return Forbid();
        _db.Activities.Remove(activity);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpPost("{id:int}/assign")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<LeadDetailDto>> Assign(int id, AssignLeadRequest req)
    {
        var lead = await _db.Leads.Include(l => l.Activities).FirstOrDefaultAsync(l => l.Id == id);
        if (lead is null) return NotFound();
        var user = await _db.Users.FindAsync(req.UserId);
        if (user is null || !user.IsActive) return BadRequest(new { message = "Executive not found or inactive." });
        if (user.Role == UserRole.Executive && !await _db.UserProjects.AnyAsync(up => up.UserId == user.Id && up.ProjectId == lead.ProjectId))
            return BadRequest(new { message = $"{user.DisplayName} is not assigned to this lead's project. Assign the project first." });
        if (lead.AssignedToUserId != user.Id)
        {
            lead.Activities.Add(new Activity { UserId = User.Id(), Type = ActivityType.Assignment, Note = (string.IsNullOrWhiteSpace(req.Note) ? "" : req.Note.Trim() + " · ") + $"Reassigned to {user.DisplayName}" });
            lead.AssignedToUserId = user.Id;
            lead.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
        }
        return (await Get(id)).Value!;
    }

    [HttpDelete("{id:int}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Delete(int id)
    {
        var lead = await _db.Leads.FindAsync(id);
        if (lead is null) return NotFound();
        _db.Leads.Remove(lead);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    // ----- Photos -----

    [HttpPost("{id:int}/photos")]
    public async Task<ActionResult<LeadDetailDto>> UploadPhotos(int id, AddPhotosRequest req)
    {
        var lead = await Scoped().FirstOrDefaultAsync(l => l.Id == id);
        if (lead is null) return NotFound();
        var count = await _db.LeadPhotos.CountAsync(p => p.LeadId == id);
        if (count + req.Photos.Count > 20) return BadRequest(new { message = "A lead can have at most 20 photos." });
        var error = AddPhotos(lead, req.Photos, User.Id());
        if (error is not null) return BadRequest(new { message = error });
        lead.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return (await Get(id)).Value!;
    }

    [HttpGet("{id:int}/photos/{photoId:int}")]
    public async Task<IActionResult> GetPhoto(int id, int photoId, [FromQuery] bool thumb = false)
    {
        if (!await Scoped().AnyAsync(l => l.Id == id)) return NotFound();
        var photo = await _db.LeadPhotos.Where(p => p.Id == photoId && p.LeadId == id)
            .Select(p => new { p.ContentType, Bytes = thumb && p.Thumbnail != null ? p.Thumbnail : p.Data }).FirstOrDefaultAsync();
        if (photo is null) return NotFound();
        Response.Headers.CacheControl = "private, max-age=86400";
        return File(photo.Bytes!, photo.ContentType);
    }

    [HttpDelete("{id:int}/photos/{photoId:int}")]
    public async Task<IActionResult> DeletePhoto(int id, int photoId)
    {
        if (!await Scoped().AnyAsync(l => l.Id == id)) return NotFound();
        var photo = await _db.LeadPhotos.FirstOrDefaultAsync(p => p.Id == photoId && p.LeadId == id);
        if (photo is null) return NotFound();
        _db.LeadPhotos.Remove(photo);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    // ----- Export -----

    [HttpGet("export")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Export(
        [FromQuery] string? search, [FromQuery] int? projectId, [FromQuery] int? userId, [FromQuery] string? status,
        [FromQuery] int? interest, [FromQuery] int? minInterest, [FromQuery] string? followUp,
        [FromQuery] DateOnly? from, [FromQuery] DateOnly? to, [FromQuery] string? city, [FromQuery] string? shopType, [FromQuery] string? sort)
    {
        var s = await _settings.GetAsync();
        var tz = SettingsService.ResolveTimeZone(s.TimeZoneId);
        var today = await _settings.TodayAsync();
        var q = ApplySort(ApplyFilters(_db.Leads, search, projectId, userId, status, interest, minInterest, followUp, from, to, city, shopType, today, tz), sort);
        var rows = await q.Select(l => new
        {
            l.Id, l.ShopName, l.ContactName, l.Mobile, l.AltMobile, l.Email, l.ShopType, l.Address, l.Area, l.City, l.Pincode,
            l.Latitude, l.Longitude, Project = l.Project.Name, Executive = l.AssignedTo.DisplayName, l.Interest, l.Status,
            l.ExpectedValue, l.NextFollowUpAt, l.Notes, l.LostReason, l.CreatedAt, l.LastActivityAt, l.ConvertedAt,
            Photos = l.Photos.Count, Visits = l.Activities.Count(a => a.Type == ActivityType.Visit),
        }).ToListAsync();

        var sb = new StringBuilder();
        sb.AppendLine("Id,Shop,Contact,Mobile,AltMobile,Email,ShopType,Address,Area,City,Pincode,Latitude,Longitude,MapLink,Project,Executive,Interest,Status,ExpectedValue,NextFollowUp,Notes,LostReason,CreatedAt,LastActivityAt,ConvertedAt,Photos,Visits");
        foreach (var r in rows)
        {
            var map = r.Latitude is null ? "" : $"https://maps.google.com/?q={r.Latitude},{r.Longitude}";
            sb.AppendLine(string.Join(",", new[]
            {
                r.Id.ToString(), Csv(r.ShopName), Csv(r.ContactName), Csv(r.Mobile), Csv(r.AltMobile), Csv(r.Email), Csv(r.ShopType), Csv(r.Address), Csv(r.Area), Csv(r.City), Csv(r.Pincode),
                r.Latitude?.ToString(System.Globalization.CultureInfo.InvariantCulture) ?? "", r.Longitude?.ToString(System.Globalization.CultureInfo.InvariantCulture) ?? "", Csv(map),
                Csv(r.Project), Csv(r.Executive), r.Interest.ToString(), r.Status.ToString(), r.ExpectedValue?.ToString(System.Globalization.CultureInfo.InvariantCulture) ?? "",
                r.NextFollowUpAt?.ToString("yyyy-MM-dd") ?? "", Csv(r.Notes), Csv(r.LostReason),
                Csv(Local(r.CreatedAt, tz)), Csv(Local(r.LastActivityAt, tz)), Csv(r.ConvertedAt is null ? "" : Local(r.ConvertedAt.Value, tz)), r.Photos.ToString(), r.Visits.ToString(),
            }));
        }
        var bytes = Encoding.UTF8.GetPreamble().Concat(Encoding.UTF8.GetBytes(sb.ToString())).ToArray();
        return File(bytes, "text/csv; charset=utf-8", $"leads-{today:yyyy-MM-dd}.csv");
    }

    // ----- helpers -----

    private static string Local(DateTime utc, TimeZoneInfo tz) => TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utc, DateTimeKind.Utc), tz).ToString("yyyy-MM-dd HH:mm");

    private static string Csv(string? v)
    {
        if (string.IsNullOrEmpty(v)) return "";
        var needs = v.Contains(',') || v.Contains('"') || v.Contains('\n') || v.Contains('\r');
        return needs ? "\"" + v.Replace("\"", "\"\"") + "\"" : v;
    }

    private static LeadStatus? ParseStatus(string? raw) =>
        !string.IsNullOrWhiteSpace(raw) && Enum.TryParse<LeadStatus>(raw, true, out var s) ? s : null;

    private static string? OptionalMobile(string? raw, string cc)
    {
        var m = SettingsService.NormalizeMobile(raw, cc);
        return m.Length >= 6 ? m : null;
    }

    private static string? Clean(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();

    private static void ApplyFields(Lead lead, SaveLeadRequest req)
    {
        lead.ShopName = req.ShopName.Trim();
        lead.ContactName = Clean(req.ContactName);
        lead.Email = Clean(req.Email)?.ToLowerInvariant();
        lead.ShopType = Clean(req.ShopType);
        lead.Address = Clean(req.Address);
        lead.Area = Clean(req.Area);
        lead.City = Clean(req.City);
        lead.Pincode = Clean(req.Pincode);
        if (req.Latitude is not null && req.Longitude is not null) { lead.Latitude = req.Latitude; lead.Longitude = req.Longitude; }
        lead.Interest = Math.Clamp(req.Interest, 1, 5);
        lead.ExpectedValue = req.ExpectedValue is { } v && v >= 0 ? v : null;
        lead.Notes = Clean(req.Notes);
        lead.NextFollowUpAt = req.NextFollowUpAt;
        if (req.LostReason is not null) lead.LostReason = Clean(req.LostReason);
    }

    private static void ChangeStatus(Lead lead, LeadStatus status, int userId, string? note, string? lostReason, bool logActivity = true)
    {
        if (lead.Status == status) return;
        if (logActivity)
            lead.Activities.Add(new Activity { UserId = userId, Type = ActivityType.StatusChange, FromStatus = lead.Status, ToStatus = status, Note = note });
        lead.Status = status;
        lead.LastActivityAt = DateTime.UtcNow;
        if (status == LeadStatus.Converted) lead.ConvertedAt = DateTime.UtcNow;
        else if (lead.ConvertedAt is not null) lead.ConvertedAt = null;
        if (status == LeadStatus.Lost) lead.LostReason = Clean(lostReason) ?? lead.LostReason;
        else lead.LostReason = null;
        if (!LeadQueries.IsOpen(status)) lead.NextFollowUpAt = null;
    }

    private static string? AddPhotos(Lead lead, List<PhotoUpload>? photos, int userId)
    {
        if (photos is null || photos.Count == 0) return null;
        if (photos.Count > 10) return "Upload at most 10 photos at a time.";
        foreach (var p in photos)
        {
            var full = ImageUpload.Decode(p.DataBase64, p.ContentType, ImageUpload.MaxPhotoBytes, out var error);
            if (full is null) return error;
            byte[]? thumb = null;
            if (!string.IsNullOrWhiteSpace(p.ThumbBase64))
            {
                var t = ImageUpload.Decode(p.ThumbBase64, p.ContentType, 512 * 1024, out _);
                thumb = t?.bytes;
            }
            lead.Photos.Add(new LeadPhoto
            {
                ContentType = full.Value.contentType,
                Data = full.Value.bytes,
                Thumbnail = thumb,
                Size = full.Value.bytes.Length,
                Caption = Clean(p.Caption),
                UploadedByUserId = userId,
            });
        }
        return null;
    }
}
