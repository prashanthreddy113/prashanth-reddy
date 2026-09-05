using System.ComponentModel.DataAnnotations;
using StudyRoom.Api.Models;

namespace StudyRoom.Api.Dtos;

public enum DueStatus
{
    Active,     // more than DueSoonDays away
    DueSoon,    // due within DueSoonDays
    DueToday,   // due date is today
    Overdue,    // due date has passed
    Inactive    // student deactivated / left
}

public class StudentUpsertRequest
{
    /// <summary>Optional; the app uses its single branch when omitted.</summary>
    public int? BranchId { get; set; }

    [Required, StringLength(120, MinimumLength = 2)]
    public string Name { get; set; } = string.Empty;

    [Required, RegularExpression(@"^\+?[0-9]{10,15}$", ErrorMessage = "Mobile must be 10-15 digits.")]
    public string Mobile { get; set; } = string.Empty;

    [Required(ErrorMessage = "Gender is required.")]
    public Gender? Gender { get; set; }

    [StringLength(500)] public string? Address { get; set; }

    [RegularExpression(@"^[0-9]{12}$", ErrorMessage = "Aadhaar must be exactly 12 digits.")]
    public string? Aadhaar { get; set; }

    [StringLength(200)] public string? Study { get; set; }
    [StringLength(1000)] public string? Notes { get; set; }

    [Range(1, 120)] public int Months { get; set; } = 1;

    [Range(0, 10_000_000)] public decimal AmountPerMonth { get; set; }

    [Range(0, 100_000_000)] public decimal TotalPaid { get; set; }

    [Required] public DateOnly JoiningDate { get; set; }

    /// <summary>Seat number (not id). Null = no seat.</summary>
    public int? SeatNumber { get; set; }

    /// <summary>Custom due date; null keeps the scheduled date (joining date + months).</summary>
    public DateOnly? DueDateOverride { get; set; }

    public bool IsActive { get; set; } = true;
}

public class DueDateRequest
{
    /// <summary>New due date; null resets to the scheduled (real) due date.</summary>
    public DateOnly? DueDate { get; set; }
    [StringLength(300)] public string? Reason { get; set; }
}

public record PaymentDto(int Id, decimal Amount, DateOnly PaidOn, string? Note, DateTime CreatedAt);

public class PaymentRequest
{
    [Range(0.01, 100_000_000)] public decimal Amount { get; set; }
    public DateOnly? PaidOn { get; set; }
    [StringLength(300)] public string? Note { get; set; }
}

public class RenewRequest
{
    /// <summary>Months to add to the current subscription.</summary>
    [Range(1, 120)] public int Months { get; set; } = 1;

    /// <summary>Optionally update the monthly rate going forward.</summary>
    [Range(0, 10_000_000)] public decimal? AmountPerMonth { get; set; }

    /// <summary>Optional payment collected while renewing.</summary>
    [Range(0, 100_000_000)] public decimal? PaidAmount { get; set; }

    public DateOnly? PaidOn { get; set; }
    [StringLength(300)] public string? Note { get; set; }
}

public class TransferSeatRequest
{
    /// <summary>Target branch; defaults to the student's current branch.</summary>
    public int? BranchId { get; set; }
    [Required, Range(1, int.MaxValue)] public int SeatNumber { get; set; }
    /// <summary>If the target seat is occupied, swap seats with its occupant instead of failing.</summary>
    public bool Swap { get; set; }
}

public class StudentDto
{
    public int Id { get; set; }
    public int BranchId { get; set; }
    public string BranchName { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Mobile { get; set; } = string.Empty;
    public Gender? Gender { get; set; }
    public string? Address { get; set; }
    public string? Aadhaar { get; set; }
    public string? Study { get; set; }
    public string? Notes { get; set; }
    public int Months { get; set; }
    public decimal AmountPerMonth { get; set; }
    public decimal TotalFee { get; set; }
    public decimal TotalPaid { get; set; }
    public decimal Balance { get; set; }
    public DateOnly JoiningDate { get; set; }
    public DateOnly DueDate { get; set; }
    /// <summary>Joining date + months, regardless of any override.</summary>
    public DateOnly ScheduledDueDate { get; set; }
    public bool DueDateOverridden { get; set; }
    public int DaysUntilDue { get; set; }
    public DueStatus Status { get; set; }
    public int? SeatId { get; set; }
    public int? SeatNumber { get; set; }
    public string? SeatLabel { get; set; }
    public string? SeatSection { get; set; }
    public bool? SeatIsAc { get; set; }
    public bool? SeatReservedForWomen { get; set; }
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public List<PaymentDto>? Payments { get; set; }
    /// <summary>Set on payment/renewal responses: whether a WhatsApp receipt went out.</summary>
    public bool? ReceiptSent { get; set; }
    public string? ReceiptError { get; set; }
}
