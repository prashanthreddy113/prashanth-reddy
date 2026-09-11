using Marketing.Api.Controllers;
using Marketing.Api.Data;
using Marketing.Api.Dtos;
using Marketing.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Marketing.Api.Services;

public class DashboardService
{
    private readonly AppDbContext _db;
    private readonly SettingsService _settings;

    public DashboardService(AppDbContext db, SettingsService settings)
    {
        _db = db;
        _settings = settings;
    }

    /// <summary>
    /// Company-wide numbers for admins, personal numbers for executives.
    /// <paramref name="days"/> controls the daily chart window (default 30).
    /// </summary>
    public async Task<DashboardDto> BuildAsync(bool isAdmin, int currentUserId, int? projectId, int? userId, int days = 30)
    {
        var s = await _settings.GetAsync();
        var tz = SettingsService.ResolveTimeZone(s.TimeZoneId);
        var today = await _settings.TodayAsync();
        var hot = s.HotInterestThreshold;
        if (!isAdmin) userId = currentUserId;
        days = Math.Clamp(days, 7, 180);

        DateTime Utc(DateOnly d) => TimeZoneInfo.ConvertTimeToUtc(d.ToDateTime(TimeOnly.MinValue), tz);
        var todayUtc = Utc(today);
        var tomorrowUtc = Utc(today.AddDays(1));
        var weekStart = today.AddDays(-(((int)today.DayOfWeek + 6) % 7)); // Monday
        var weekUtc = Utc(weekStart);
        var monthUtc = Utc(new DateOnly(today.Year, today.Month, 1));
        var chartStart = today.AddDays(-(days - 1));
        var chartUtc = Utc(chartStart);
        var staleUtc = DateTime.UtcNow.AddDays(-7);

        var leads = _db.Leads.AsQueryable();
        if (projectId is { } pid) leads = leads.Where(l => l.ProjectId == pid);
        if (userId is { } uid) leads = leads.Where(l => l.AssignedToUserId == uid);
        var open = leads.Where(l => l.Status != LeadStatus.Converted && l.Status != LeadStatus.Lost);

        var visits = _db.Activities.Where(a => a.Type == ActivityType.Visit);
        if (projectId is { } pid2) visits = visits.Where(a => a.Lead.ProjectId == pid2);
        if (userId is { } uid2) visits = visits.Where(a => a.UserId == uid2);

        var totals = new DashboardTotals(
            Leads: await leads.CountAsync(),
            OpenLeads: await open.CountAsync(),
            NewThisMonth: await leads.CountAsync(l => l.CreatedAt >= monthUtc),
            NewThisWeek: await leads.CountAsync(l => l.CreatedAt >= weekUtc),
            NewToday: await leads.CountAsync(l => l.CreatedAt >= todayUtc && l.CreatedAt < tomorrowUtc),
            VisitsToday: await visits.CountAsync(a => a.CreatedAt >= todayUtc && a.CreatedAt < tomorrowUtc),
            VisitsThisWeek: await visits.CountAsync(a => a.CreatedAt >= weekUtc),
            VisitsThisMonth: await visits.CountAsync(a => a.CreatedAt >= monthUtc),
            Converted: await leads.CountAsync(l => l.Status == LeadStatus.Converted),
            ConvertedThisMonth: await leads.CountAsync(l => l.Status == LeadStatus.Converted && l.ConvertedAt >= monthUtc),
            ConversionRate: 0,
            Hot: await open.CountAsync(l => l.Interest >= hot),
            FollowUpsToday: await open.CountAsync(l => l.NextFollowUpAt == today),
            OverdueFollowUps: await open.CountAsync(l => l.NextFollowUpAt < today),
            Untouched7Days: await open.CountAsync(l => l.LastActivityAt < staleUtc),
            PipelineValue: await open.SumAsync(l => l.ExpectedValue) ?? 0m,
            WonValue: await leads.Where(l => l.Status == LeadStatus.Converted).SumAsync(l => l.ExpectedValue) ?? 0m,
            ActiveExecutives: await _db.Users.CountAsync(u => u.IsActive && u.Role == UserRole.Executive));
        totals = totals with { ConversionRate = totals.Leads == 0 ? 0 : Math.Round(100.0 * totals.Converted / totals.Leads, 1) };

        var byStatus = (await leads.GroupBy(l => l.Status).Select(g => new { g.Key, Count = g.Count() }).ToListAsync())
            .OrderBy(x => (int)x.Key).Select(x => new CountItem(x.Key.ToString(), DashboardController.StatusLabel(x.Key), x.Count)).ToList();
        foreach (var st in Enum.GetValues<LeadStatus>())
            if (byStatus.All(b => b.Key != st.ToString())) byStatus.Add(new CountItem(st.ToString(), DashboardController.StatusLabel(st), 0));
        byStatus = byStatus.OrderBy(b => (int)Enum.Parse<LeadStatus>(b.Key)).ToList();

        var interestCounts = await leads.GroupBy(l => l.Interest).Select(g => new { g.Key, Count = g.Count() }).ToListAsync();
        var byInterest = Enumerable.Range(1, 5).Select(i => new CountItem(i.ToString(), DashboardController.InterestLabel(i), interestCounts.FirstOrDefault(x => x.Key == i)?.Count ?? 0)).ToList();

        var projectAgg = await leads.GroupBy(l => l.ProjectId).Select(g => new
        {
            g.Key,
            Leads = g.Count(),
            Converted = g.Count(l => l.Status == LeadStatus.Converted),
            Hot = g.Count(l => l.Interest >= hot && l.Status != LeadStatus.Converted && l.Status != LeadStatus.Lost),
            Pipeline = g.Where(l => l.Status != LeadStatus.Converted && l.Status != LeadStatus.Lost).Sum(l => l.ExpectedValue) ?? 0m,
            Won = g.Where(l => l.Status == LeadStatus.Converted).Sum(l => l.ExpectedValue) ?? 0m,
        }).ToListAsync();
        var projectsQ = _db.Projects.AsQueryable();
        if (!isAdmin) projectsQ = projectsQ.Where(p => p.IsActive && p.UserProjects.Any(up => up.UserId == userId));
        else projectsQ = projectsQ.Where(p => p.IsActive || p.Leads.Any());
        var projects = await projectsQ.OrderBy(p => p.Name).Select(p => new { p.Id, p.Name, p.Color, p.TargetLeads }).ToListAsync();
        var byProject = projects.Select(p =>
        {
            var a = projectAgg.FirstOrDefault(x => x.Key == p.Id);
            return new ProjectStat(p.Id, p.Name, p.Color, p.TargetLeads, a?.Leads ?? 0, a?.Converted ?? 0, a?.Hot ?? 0, a?.Pipeline ?? 0m, a?.Won ?? 0m);
        }).OrderByDescending(p => p.Leads).ToList();

        var execQ = _db.Users.Where(u => u.Role == UserRole.Executive || _db.Leads.Any(l => l.AssignedToUserId == u.Id));
        if (userId is { } uid3) execQ = execQ.Where(u => u.Id == uid3);
        var byExecutive = await execQ.Select(u => new ExecutiveStat(
            u.Id, u.DisplayName, u.IsActive,
            _db.Leads.Count(l => l.AssignedToUserId == u.Id && (projectId == null || l.ProjectId == projectId)),
            _db.Leads.Count(l => l.AssignedToUserId == u.Id && (projectId == null || l.ProjectId == projectId) && l.CreatedAt >= monthUtc),
            _db.Activities.Count(a => a.UserId == u.Id && a.Type == ActivityType.Visit && (projectId == null || a.Lead.ProjectId == projectId)),
            _db.Activities.Count(a => a.UserId == u.Id && a.Type == ActivityType.Visit && (projectId == null || a.Lead.ProjectId == projectId) && a.CreatedAt >= monthUtc),
            _db.Leads.Count(l => l.AssignedToUserId == u.Id && (projectId == null || l.ProjectId == projectId) && l.Status == LeadStatus.Converted),
            _db.Leads.Count(l => l.AssignedToUserId == u.Id && (projectId == null || l.ProjectId == projectId) && l.Interest >= hot && l.Status != LeadStatus.Converted && l.Status != LeadStatus.Lost),
            _db.Leads.Count(l => l.AssignedToUserId == u.Id && (projectId == null || l.ProjectId == projectId) && l.NextFollowUpAt < today && l.Status != LeadStatus.Converted && l.Status != LeadStatus.Lost),
            _db.Activities.Where(a => a.UserId == u.Id).Max(a => (DateTime?)a.CreatedAt)))
            .ToListAsync();
        byExecutive = byExecutive.OrderByDescending(e => e.VisitsThisMonth).ThenByDescending(e => e.LeadsThisMonth).ThenByDescending(e => e.Leads).ToList();

        var topCities = (await leads.Where(l => l.City != null && l.City != "").GroupBy(l => l.City!).Select(g => new { g.Key, Count = g.Count() })
            .OrderByDescending(x => x.Count).Take(6).ToListAsync()).Select(x => new CountItem(x.Key, x.Key, x.Count)).ToList();
        var topShopTypes = (await leads.Where(l => l.ShopType != null && l.ShopType != "").GroupBy(l => l.ShopType!).Select(g => new { g.Key, Count = g.Count() })
            .OrderByDescending(x => x.Count).Take(6).ToListAsync()).Select(x => new CountItem(x.Key, x.Key, x.Count)).ToList();

        var leadDays = await leads.Where(l => l.CreatedAt >= chartUtc).Select(l => l.CreatedAt).ToListAsync();
        var visitDays = await visits.Where(a => a.CreatedAt >= chartUtc).Select(a => a.CreatedAt).ToListAsync();
        DateOnly LocalDay(DateTime utc) => DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utc, DateTimeKind.Utc), tz));
        var leadsPerDay = leadDays.GroupBy(LocalDay).ToDictionary(g => g.Key, g => g.Count());
        var visitsPerDay = visitDays.GroupBy(LocalDay).ToDictionary(g => g.Key, g => g.Count());
        var daily = Enumerable.Range(0, days).Select(i => chartStart.AddDays(i))
            .Select(d => new DailyPoint(d, leadsPerDay.GetValueOrDefault(d), visitsPerDay.GetValueOrDefault(d))).ToList();

        var recentQ = _db.Activities.AsQueryable();
        if (projectId is { } pid3) recentQ = recentQ.Where(a => a.Lead.ProjectId == pid3);
        if (userId is { } uid4) recentQ = recentQ.Where(a => a.Lead.AssignedToUserId == uid4);
        var recent = await recentQ.OrderByDescending(a => a.CreatedAt).ThenByDescending(a => a.Id).Take(12)
            .Select(a => new { a.Id, a.LeadId, a.Lead.ShopName, a.Type, a.Note, UserName = a.User.DisplayName, a.ToStatus, a.Interest, a.CreatedAt }).ToListAsync();
        var recentActivities = recent.Select(a => new RecentActivityDto(a.Id, a.LeadId, a.ShopName, a.Type.ToString(), a.Note, a.UserName, a.ToStatus?.ToString(), a.Interest, a.CreatedAt)).ToList();

        var due = await LeadQueries.ToSummariesAsync(open.Where(l => l.NextFollowUpAt <= today).OrderBy(l => l.NextFollowUpAt).ThenByDescending(l => l.Interest).Take(10), today);

        return new DashboardDto(today, totals, byStatus, byInterest, byProject, byExecutive, topCities, topShopTypes, daily, recentActivities, due);
    }

}
