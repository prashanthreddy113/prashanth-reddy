namespace StudyRoom.Api.Models;

public enum Gender
{
    Male,
    Female,
    Other
}

public class Student
{
    public int Id { get; set; }

    public int BranchId { get; set; }
    public Branch? Branch { get; set; }

    // Mandatory
    public string Name { get; set; } = string.Empty;
    public string Mobile { get; set; } = string.Empty;

    /// <summary>Required for new registrations; null only for records created before the field existed.</summary>
    public Gender? Gender { get; set; }

    // Optional
    public string? Address { get; set; }
    public string? Aadhaar { get; set; }
    public string? Study { get; set; }
    public string? Notes { get; set; }

    /// <summary>Number of months the student has subscribed for (cumulative across renewals).</summary>
    public int Months { get; set; } = 1;

    public decimal AmountPerMonth { get; set; }
    public decimal TotalPaid { get; set; }

    public DateOnly JoiningDate { get; set; }

    public int? SeatId { get; set; }
    public Seat? Seat { get; set; }

    public bool IsActive { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public List<Payment> Payments { get; set; } = new();

    /// <summary>Admin-edited due date. When set it replaces the scheduled date everywhere (status, reminders, popups, lists).</summary>
    public DateOnly? DueDateOverride { get; set; }

    /// <summary>The "real" due date from the plan: joining date + subscribed months.</summary>
    public DateOnly ScheduledDueDate => JoiningDate.AddMonths(Months);

    /// <summary>Effective due date: the admin override if set, otherwise the scheduled date.</summary>
    public DateOnly DueDate => DueDateOverride ?? ScheduledDueDate;

    public decimal TotalFee => Months * AmountPerMonth;
    public decimal Balance => TotalFee - TotalPaid;
}
