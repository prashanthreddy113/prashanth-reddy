using Microsoft.EntityFrameworkCore;
using StudyRoom.Api.Data;
using StudyRoom.Api.Dtos;
using StudyRoom.Api.Models;

namespace StudyRoom.Api.Services;

/// <summary>
/// Women's seat reservation. Specific seats carry ReservedForWomen: only women may be given those seats,
/// every other seat is open to anyone. The number of reserved seats per branch follows the branch's percentage
/// (branch override, else Settings) and is re-applied whenever seats or the percentage change; admins can also
/// toggle individual seats.
/// </summary>
public class SeatAllocationService
{
    private readonly AppDbContext _db;
    private readonly SettingsService _settings;

    public SeatAllocationService(AppDbContext db, SettingsService settings)
    {
        _db = db;
        _settings = settings;
    }

    public static int TargetReserved(int activeSeats, int percent) =>
        percent <= 0 ? 0 : Math.Min(activeSeats, (int)Math.Ceiling(activeSeats * percent / 100.0));

    /// <summary>Error message when this student may not have this seat; null when allowed.</summary>
    public static string? CheckSeat(Seat seat, Gender? gender) =>
        seat.ReservedForWomen && gender != Gender.Female
            ? $"Seat {seat.Number} is reserved for women. Choose a seat that is not reserved, or change the reservation on the Seats page."
            : null;

    public async Task<int> PercentForBranchAsync(int branchId, CancellationToken ct = default)
    {
        var settings = await _settings.GetAsync(ct);
        var overridePct = await _db.Branches.Where(b => b.Id == branchId).Select(b => b.FemaleReservationPercent).FirstOrDefaultAsync(ct);
        return overridePct ?? settings.FemaleReservationPercent;
    }

    /// <summary>
    /// Marks/unmarks seats so the branch has ceil(active × percent) reserved seats.
    /// Adds reservation to the lowest-numbered free unreserved seats (never a seat held by a man);
    /// removes it from the highest-numbered free reserved seats first, then from seats held by women.
    /// </summary>
    public async Task<int> ApplyReservationAsync(int branchId, CancellationToken ct = default)
    {
        var pct = await PercentForBranchAsync(branchId, ct);
        var seats = await _db.Seats.Include(s => s.Student).Where(s => s.BranchId == branchId && s.IsActive).OrderBy(s => s.Number).ToListAsync(ct);
        var target = TargetReserved(seats.Count, pct);
        var current = seats.Count(s => s.ReservedForWomen);

        if (current < target)
        {
            foreach (var s in seats.Where(s => !s.ReservedForWomen && (s.Student == null || s.Student.Gender == Gender.Female)))
            {
                s.ReservedForWomen = true;
                if (++current >= target) break;
            }
        }
        else if (current > target)
        {
            var candidates = seats.Where(s => s.ReservedForWomen).OrderBy(s => s.Student == null ? 0 : 1).ThenByDescending(s => s.Number);
            foreach (var s in candidates)
            {
                s.ReservedForWomen = false;
                if (--current <= target) break;
            }
        }

        await _db.SaveChangesAsync(ct);
        return current;
    }

    public async Task ApplyReservationToAllAsync(CancellationToken ct = default)
    {
        foreach (var id in await _db.Branches.Select(b => b.Id).ToListAsync(ct))
            await ApplyReservationAsync(id, ct);
    }

    /// <summary>Summary for one branch, or every branch combined when branchId is null.</summary>
    public async Task<SeatSummaryDto> SummaryAsync(int? branchId, CancellationToken ct = default)
    {
        var settings = await _settings.GetAsync(ct);
        var q = _db.Seats.AsNoTracking().AsQueryable();
        if (branchId.HasValue) q = q.Where(s => s.BranchId == branchId.Value);
        var seats = await q.Select(s => new { s.IsActive, s.IsAc, s.ReservedForWomen, Occupied = s.Student != null, Female = s.Student != null && s.Student.Gender == Gender.Female }).ToListAsync(ct);

        var active = seats.Where(s => s.IsActive).ToList();
        var reserved = active.Where(s => s.ReservedForWomen).ToList();
        var general = active.Where(s => !s.ReservedForWomen).ToList();
        var pct = branchId.HasValue ? await PercentForBranchAsync(branchId.Value, ct) : settings.FemaleReservationPercent;

        return new SeatSummaryDto(
            seats.Count, active.Count, active.Count(s => s.Occupied), active.Count(s => !s.Occupied),
            pct, reserved.Count, active.Count(s => s.Female),
            general.Count, general.Count(s => s.Occupied), general.Count(s => !s.Occupied),
            QuotaExceeded: reserved.Any(s => s.Occupied && !s.Female),
            active.Count(s => s.IsAc), active.Count(s => s.IsAc && !s.Occupied), active.Count(s => !s.IsAc), active.Count(s => !s.IsAc && !s.Occupied),
            reserved.Count(s => !s.Occupied), reserved.Count(s => s.Female));
    }

    public async Task<List<BranchSummaryDto>> BranchSummariesAsync(CancellationToken ct = default)
    {
        var settings = await _settings.GetAsync(ct);
        var today = SettingsService.Today(settings);
        var monthStart = new DateOnly(today.Year, today.Month, 1);
        var branches = await _db.Branches.AsNoTracking().OrderBy(b => b.Name).ToListAsync(ct);
        var result = new List<BranchSummaryDto>();

        foreach (var b in branches)
        {
            var students = await _db.Students.AsNoTracking().Where(s => s.BranchId == b.Id && s.IsActive).ToListAsync(ct);
            var statuses = students.Select(s => StudentMapper.ComputeStatus(s, today, settings.DueSoonDays)).ToList();
            var seats = await SummaryAsync(b.Id, ct);
            var collected = await _db.Payments.Where(p => p.Student!.BranchId == b.Id && p.PaidOn >= monthStart && p.PaidOn <= today).SumAsync(p => (decimal?)p.Amount, ct) ?? 0m;
            var spent = await _db.Expenses.Where(e => e.BranchId == b.Id && e.PaidOn >= monthStart && e.PaidOn <= today).SumAsync(e => (decimal?)e.Amount, ct) ?? 0m;

            result.Add(new BranchSummaryDto(b.Id, b.Name, b.Code, b.IsActive,
                students.Count,
                statuses.Count(s => s == DueStatus.DueSoon),
                statuses.Count(s => s is DueStatus.Overdue or DueStatus.DueToday),
                seats.Total, seats.Active, seats.Occupied, seats.Free, seats.AcSeats, seats.WomenSeated, seats.ReservedForWomen,
                seats.GeneralFree, seats.ReservedFree,
                students.Sum(s => Math.Max(0, s.Balance)), collected, spent, collected - spent));
        }
        return result;
    }
}
