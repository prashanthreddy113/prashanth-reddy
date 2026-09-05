namespace StudyRoom.Api.Dtos;

public class DashboardDto
{
    public int? BranchId { get; set; }
    public string? BranchName { get; set; }
    public DateOnly Today { get; set; }
    public int DueSoonDays { get; set; }
    public string RoomName { get; set; } = string.Empty;
    public string Currency { get; set; } = "INR";

    public int TotalStudents { get; set; }
    public int ActiveStudents { get; set; }
    public int DueSoonCount { get; set; }
    public int DueTodayCount { get; set; }
    public int OverdueCount { get; set; }
    public int InactiveStudents { get; set; }
    public int FemaleStudents { get; set; }

    public decimal TotalCollected { get; set; }
    public decimal TotalOutstanding { get; set; }
    public decimal CollectedThisMonth { get; set; }
    public decimal ExpensesThisMonth { get; set; }
    public decimal NetThisMonth { get; set; }
    public decimal ExpensesAllTime { get; set; }
    public decimal NetAllTime { get; set; }
    public decimal ExpectedMonthlyRevenue { get; set; }

    public SeatSummaryDto Seats { get; set; } = new(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, false, 0, 0, 0, 0);
    /// <summary>Per-branch roll-up, populated when the dashboard is not filtered to one branch.</summary>
    public List<BranchSummaryDto> Branches { get; set; } = new();
    public List<StudentDto> Students { get; set; } = new();
    public List<PaymentActivityDto> RecentPayments { get; set; } = new();
}

public record PaymentActivityDto(int Id, int StudentId, string StudentName, decimal Amount, DateOnly PaidOn, string? Note);
