using Microsoft.EntityFrameworkCore;
using StudyRoom.Api.Data;
using StudyRoom.Api.Dtos;
using StudyRoom.Api.Models;

namespace StudyRoom.Api.Services;

/// <summary>
/// Women's seat reservation. A share of active seats (Settings → FemaleReservationPercent) is held for women:
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

    public async Task<SeatSummaryDto> SummaryAsync(CancellationToken ct = default)
    {
        var settings = await _settings.GetAsync(ct);
        var total = await _db.Seats.CountAsync(ct);
        var active = await _db.Seats.CountAsync(s => s.IsActive, ct);
        var occupied = await _db.Seats.CountAsync(s => s.Student != null, ct);
        var womenSeated = await _db.Students.CountAsync(s => s.SeatId != null && s.Gender == Gender.Female, ct);
        var generalOccupied = occupied - womenSeated;

        var reserved = ReservedSeats(active, settings.FemaleReservationPercent);
        var generalCapacity = Math.Max(0, active - reserved);
        return new SeatSummaryDto(
            total, active, occupied, Math.Max(0, active - occupied),
            settings.FemaleReservationPercent, reserved, womenSeated,
            generalCapacity, generalOccupied, Math.Max(0, generalCapacity - generalOccupied),
            QuotaExceeded: generalOccupied > generalCapacity);
    }

    /// <summary>Returns an error message if giving a seat to this student would eat into the women's reservation; null when allowed.</summary>
    public async Task<string?> CheckAsync(Gender? gender, int currentStudentId, CancellationToken ct = default)
    {
        if (gender == Gender.Female) return null;

        var settings = await _settings.GetAsync(ct);
        if (settings.FemaleReservationPercent <= 0) return null;

        // Keeping or moving an existing seat does not change the count, so it is always allowed.
        if (currentStudentId > 0 && await _db.Students.AnyAsync(s => s.Id == currentStudentId && s.SeatId != null, ct))
            return null;

        var active = await _db.Seats.CountAsync(s => s.IsActive, ct);
        var reserved = ReservedSeats(active, settings.FemaleReservationPercent);
        var generalCapacity = Math.Max(0, active - reserved);

        // Other non-female students who currently hold a seat (excluding the one being edited).
        var generalOccupied = await _db.Students.CountAsync(
            s => s.SeatId != null && s.Gender != Gender.Female && s.Id != currentStudentId, ct);

        if (generalOccupied + 1 > generalCapacity)
            return $"No seat available for this student: {reserved} of {active} seats ({settings.FemaleReservationPercent}%) are reserved for women and all {generalCapacity} general seats are taken. Free a seat or change the reservation in Settings.";

        return null;
    }
}
