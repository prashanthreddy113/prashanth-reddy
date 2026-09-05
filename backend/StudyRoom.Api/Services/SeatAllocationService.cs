using Microsoft.EntityFrameworkCore;
using StudyRoom.Api.Data;
using StudyRoom.Api.Dtos;
using StudyRoom.Api.Models;

namespace StudyRoom.Api.Services;

/// <summary>
/// Seat counts and the women's reservation, computed per branch (or across all branches).
/// A share of a branch's active seats (branch override, else Settings → FemaleReservationPercent) is held for women:
/// women may take any free seat, men/others may only occupy seats outside the reserved share.
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

    public static int ReservedSeats(int activeSeats, int percent) =>
        percent <= 0 ? 0 : Math.Min(activeSeats, (int)Math.Ceiling(activeSeats * percent / 100.0));

    private async Task<int> PercentForBranchAsync(int branchId, RoomSettings settings, CancellationToken ct)
    {
        var overridePct = await _db.Branches.Where(b => b.Id == branchId).Select(b => b.FemaleReservationPercent).FirstOrDefaultAsync(ct);
        return overridePct ?? settings.FemaleReservationPercent;
    }

    /// <summary>Summary for one branch, or for every branch combined when branchId is null (quota figures are summed per branch).</summary>
    public async Task<SeatSummaryDto> SummaryAsync(int? branchId, CancellationToken ct = default)
    {
        var settings = await _settings.GetAsync(ct);
        var branchIds = branchId.HasValue ? new[] { branchId.Value } : await _db.Branches.Select(b => b.Id).ToArrayAsync(ct);

        int total = 0, active = 0, occupied = 0, women = 0, reserved = 0, generalCap = 0, generalOcc = 0, ac = 0, acFree = 0, nonAc = 0, nonAcFree = 0;
        var pctShown = branchId.HasValue ? await PercentForBranchAsync(branchId.Value, settings, ct) : settings.FemaleReservationPercent;

        foreach (var id in branchIds)
        {
            var seats = await _db.Seats.Where(s => s.BranchId == id)
                .Select(s => new { s.IsActive, s.IsAc, Occupied = s.Student != null, Female = s.Student != null && s.Student.Gender == Gender.Female })
                .ToListAsync(ct);
            var bActive = seats.Count(s => s.IsActive);
            var bOccupied = seats.Count(s => s.Occupied);
            var bWomen = seats.Count(s => s.Female);
            var pct = await PercentForBranchAsync(id, settings, ct);
            var bReserved = ReservedSeats(bActive, pct);

            total += seats.Count; active += bActive; occupied += bOccupied; women += bWomen; reserved += bReserved;
            generalCap += Math.Max(0, bActive - bReserved); generalOcc += bOccupied - bWomen;
            ac += seats.Count(s => s.IsAc && s.IsActive); acFree += seats.Count(s => s.IsAc && s.IsActive && !s.Occupied);
            nonAc += seats.Count(s => !s.IsAc && s.IsActive); nonAcFree += seats.Count(s => !s.IsAc && s.IsActive && !s.Occupied);
        }

        return new SeatSummaryDto(total, active, occupied, Math.Max(0, active - occupied),
            pctShown, reserved, women, generalCap, generalOcc, Math.Max(0, generalCap - generalOcc), generalOcc > generalCap,
            ac, acFree, nonAc, nonAcFree);
    }

    /// <summary>Returns an error message if giving a seat in this branch to this student would eat into the women's reservation; null when allowed.</summary>
    public async Task<string?> CheckAsync(int branchId, Gender? gender, int currentStudentId, CancellationToken ct = default)
    {
        if (gender == Gender.Female) return null;

        var settings = await _settings.GetAsync(ct);
        var pct = await PercentForBranchAsync(branchId, settings, ct);
        if (pct <= 0) return null;

        // Keeping or moving a seat inside the same branch does not change the count.
        if (currentStudentId > 0 && await _db.Students.AnyAsync(s => s.Id == currentStudentId && s.SeatId != null && s.BranchId == branchId, ct))
            return null;

        var active = await _db.Seats.CountAsync(s => s.BranchId == branchId && s.IsActive, ct);
        var reserved = ReservedSeats(active, pct);
        var generalCapacity = Math.Max(0, active - reserved);
        var generalOccupied = await _db.Students.CountAsync(
            s => s.BranchId == branchId && s.SeatId != null && s.Gender != Gender.Female && s.Id != currentStudentId, ct);

        if (generalOccupied + 1 > generalCapacity)
            return $"No seat available for this student in this branch: {reserved} of {active} seats ({pct}%) are reserved for women and all {generalCapacity} general seats are taken. Free a seat or change the reservation.";

        return null;
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
                students.Sum(s => Math.Max(0, s.Balance)), collected, spent, collected - spent));
        }
        return result;
    }
}
