using System.ComponentModel.DataAnnotations;

namespace StudyRoom.Api.Dtos;

public class SeatDto
{
    public int Id { get; set; }
    public int Number { get; set; }
    public string? Label { get; set; }
    public bool IsActive { get; set; }
    public bool IsOccupied => StudentId.HasValue;
    public int? StudentId { get; set; }
    public string? StudentName { get; set; }
    public DueStatus? StudentStatus { get; set; }
    public DateOnly? StudentDueDate { get; set; }
}

public record SeatCapacityRequest([Range(0, 10_000)] int TotalSeats);

public class SeatUpdateRequest
{
    [StringLength(50)] public string? Label { get; set; }
    public bool IsActive { get; set; } = true;
}

public record SeatSummaryDto(int Total, int Active, int Occupied, int Free);
