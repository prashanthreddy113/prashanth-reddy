using System.ComponentModel.DataAnnotations;
using StudyRoom.Api.Models;

namespace StudyRoom.Api.Dtos;

public class SeatDto
{
    public int Id { get; set; }
    public int BranchId { get; set; }
    public string BranchName { get; set; } = string.Empty;
    public int Number { get; set; }
    public string? Section { get; set; }
    public bool IsAc { get; set; }
    public bool ReservedForWomen { get; set; }
    public string? Label { get; set; }
    public bool IsActive { get; set; }
    public bool IsOccupied => StudentId.HasValue;
    public int? StudentId { get; set; }
    public string? StudentName { get; set; }
    public Gender? StudentGender { get; set; }
    public DueStatus? StudentStatus { get; set; }
    public DateOnly? StudentDueDate { get; set; }
}

/// <summary>Direct setup: "this branch has N seats". New seats go to Section (optional) with the given AC flag.</summary>
public class SeatCapacityRequest
{
    [Required, Range(1, int.MaxValue)] public int BranchId { get; set; }
    [Range(0, 10_000)] public int TotalSeats { get; set; }
    [StringLength(80)] public string? Section { get; set; }
    public bool IsAc { get; set; }
}

/// <summary>Structured setup: add N seats under a floor/room/section name.</summary>
public class SeatSectionRequest
{
    [Required, Range(1, int.MaxValue)] public int BranchId { get; set; }
    [Required, StringLength(80, MinimumLength = 1)] public string Name { get; set; } = string.Empty;
    [Range(1, 5_000)] public int Seats { get; set; }
    public bool IsAc { get; set; }
}

public class SeatSectionUpdateRequest
{
    [Required, Range(1, int.MaxValue)] public int BranchId { get; set; }
    [Required, StringLength(80, MinimumLength = 1)] public string Name { get; set; } = string.Empty;
    [StringLength(80)] public string? NewName { get; set; }
    public bool? IsAc { get; set; }
    /// <summary>Add this many more seats to the section.</summary>
    [Range(0, 5_000)] public int AddSeats { get; set; }
}

public class SeatUpdateRequest
{
    [StringLength(50)] public string? Label { get; set; }
    [StringLength(80)] public string? Section { get; set; }
    public bool? IsAc { get; set; }
    public bool? ReservedForWomen { get; set; }
    public bool IsActive { get; set; } = true;
}

public record SeatSectionDto(string? Name, int Total, int Active, int Occupied, int Free, int AcSeats, int ReservedForWomen);

/// <summary>
/// Seat counts including the women's reservation quota.
/// ReservedForWomen = ceil(Active × percent). GeneralCapacity = Active − ReservedForWomen is the most seats men/others may occupy.
/// </summary>
public record SeatSummaryDto(
    int Total, int Active, int Occupied, int Free,
    int FemaleReservationPercent, int ReservedForWomen, int WomenSeated,
    int GeneralCapacity, int GeneralOccupied, int GeneralFree, bool QuotaExceeded,
    int AcSeats, int AcFree, int NonAcSeats, int NonAcFree,
    int ReservedFree, int WomenOnReservedSeats);
