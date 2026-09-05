using System.ComponentModel.DataAnnotations;

namespace StudyRoom.Api.Dtos;

public class BranchUpsertRequest
{
    [Required, StringLength(120, MinimumLength = 2)] public string Name { get; set; } = string.Empty;
    [StringLength(20)] public string? Code { get; set; }
    [StringLength(500)] public string? Address { get; set; }
    [StringLength(20)] public string? Phone { get; set; }
    public bool IsActive { get; set; } = true;
    [Range(0, 100)] public int? FemaleReservationPercent { get; set; }
}

public class BranchDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Code { get; set; }
    public string? Address { get; set; }
    public string? Phone { get; set; }
    public bool IsActive { get; set; }
    public int? FemaleReservationPercent { get; set; }
    public int EffectiveFemaleReservationPercent { get; set; }
    public DateTime CreatedAt { get; set; }
}

public record BranchSummaryDto(int Id, string Name, string? Code, bool IsActive,
    int ActiveStudents, int DueSoon, int Overdue, int SeatsTotal, int SeatsActive, int SeatsOccupied, int SeatsFree,
    int AcSeats, int WomenSeated, int ReservedForWomen, int SeatsOpenFree, int SeatsReservedFree,
    decimal Outstanding, decimal CollectedThisMonth, decimal ExpensesThisMonth, decimal NetThisMonth);
