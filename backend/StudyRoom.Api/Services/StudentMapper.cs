using StudyRoom.Api.Dtos;
using StudyRoom.Api.Models;

namespace StudyRoom.Api.Services;

/// <summary>Computes derived fields (due date, status, balance) for a student.</summary>
public static class StudentMapper
{
    public static DueStatus ComputeStatus(Student s, DateOnly today, int dueSoonDays)
    {
        if (!s.IsActive) return DueStatus.Inactive;
        var days = s.DueDate.DayNumber - today.DayNumber;
        if (days < 0) return DueStatus.Overdue;
        if (days == 0) return DueStatus.DueToday;
        if (days <= dueSoonDays) return DueStatus.DueSoon;
        return DueStatus.Active;
    }

    public static StudentDto ToDto(Student s, DateOnly today, int dueSoonDays, bool includePayments = false)
    {
        var dto = new StudentDto
        {
            Id = s.Id,
            Name = s.Name,
            Mobile = s.Mobile,
            Gender = s.Gender,
            Address = s.Address,
            Aadhaar = s.Aadhaar,
            Study = s.Study,
            Notes = s.Notes,
            Months = s.Months,
            AmountPerMonth = s.AmountPerMonth,
            TotalFee = s.TotalFee,
            TotalPaid = s.TotalPaid,
            Balance = s.Balance,
            JoiningDate = s.JoiningDate,
            DueDate = s.DueDate,
            DaysUntilDue = s.DueDate.DayNumber - today.DayNumber,
            Status = ComputeStatus(s, today, dueSoonDays),
            SeatId = s.SeatId,
            SeatNumber = s.Seat?.Number,
            SeatLabel = s.Seat?.Label,
            IsActive = s.IsActive,
            CreatedAt = s.CreatedAt,
            UpdatedAt = s.UpdatedAt,
        };

        if (includePayments)
        {
            dto.Payments = s.Payments
                .OrderByDescending(p => p.PaidOn).ThenByDescending(p => p.Id)
                .Select(p => new PaymentDto(p.Id, p.Amount, p.PaidOn, p.Note, p.CreatedAt))
                .ToList();
        }

        return dto;
    }
}
