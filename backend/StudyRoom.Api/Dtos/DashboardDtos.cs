namespace StudyRoom.Api.Dtos;

public class DashboardDto
{
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

    public decimal TotalCollected { get; set; }
    public decimal TotalOutstanding { get; set; }
    public decimal CollectedThisMonth { get; set; }
    public decimal ExpectedMonthlyRevenue { get; set; }

    public SeatSummaryDto Seats { get; set; } = new(0, 0, 0, 0);
    public List<StudentDto> Students { get; set; } = new();
    public List<PaymentActivityDto> RecentPayments { get; set; } = new();
}

public record PaymentActivityDto(int Id, int StudentId, string StudentName, decimal Amount, DateOnly PaidOn, string? Note);
