namespace Marketing.Api.Dtos;

public record DashboardTotals(
    int Leads, int OpenLeads, int NewThisMonth, int NewThisWeek, int NewToday,
    int VisitsToday, int VisitsThisWeek, int VisitsThisMonth,
    int Converted, int ConvertedThisMonth, double ConversionRate,
    int Hot, int FollowUpsToday, int OverdueFollowUps, int Untouched7Days,
    decimal PipelineValue, decimal WonValue, int ActiveExecutives);

public record CountItem(string Key, string Label, int Count);

public record ProjectStat(int ProjectId, string Name, string Color, int? TargetLeads, int Leads, int Converted, int Hot, decimal PipelineValue, decimal WonValue);

public record ExecutiveStat(int UserId, string Name, bool IsActive, int Leads, int LeadsThisMonth, int Visits, int VisitsThisMonth, int Converted, int Hot, int Overdue, DateTime? LastActivityAt);

public record DailyPoint(DateOnly Date, int Leads, int Visits);

public record RecentActivityDto(int Id, int LeadId, string ShopName, string Type, string? Note, string UserName, string? ToStatus, int? Interest, DateTime CreatedAt);

public record DashboardDto(
    DateOnly Today,
    DashboardTotals Totals,
    List<CountItem> ByStatus,
    List<CountItem> ByInterest,
    List<ProjectStat> ByProject,
    List<ExecutiveStat> ByExecutive,
    List<CountItem> TopCities,
    List<CountItem> TopShopTypes,
    List<DailyPoint> Daily,
    List<RecentActivityDto> RecentActivities,
    List<LeadSummaryDto> DueFollowUps);
