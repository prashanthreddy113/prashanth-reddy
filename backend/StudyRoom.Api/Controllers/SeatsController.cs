using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using StudyRoom.Api.Data;
using StudyRoom.Api.Dtos;
using StudyRoom.Api.Models;
using StudyRoom.Api.Services;

namespace StudyRoom.Api.Controllers;

[ApiController]
[Route("api/seats")]
[Authorize]
public class SeatsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly SettingsService _settings;
    private readonly SeatAllocationService _allocation;

    public SeatsController(AppDbContext db, SettingsService settings, SeatAllocationService allocation)
    {
        _db = db;
        _settings = settings;
        _allocation = allocation;
    }

    /// <summary>Seats of one branch (branchId) or of every branch.</summary>
    [HttpGet]
    public async Task<ActionResult<List<SeatDto>>> List([FromQuery] int? branchId)
    {
        var settings = await _settings.GetAsync();
        var today = SettingsService.Today(settings);

        var q = _db.Seats.Include(s => s.Student).Include(s => s.Branch).AsNoTracking().AsQueryable();
        if (branchId.HasValue) q = q.Where(s => s.BranchId == branchId.Value);
        var seats = await q.OrderBy(s => s.Branch!.Name).ThenBy(s => s.Number).ToListAsync();

        return seats.Select(s => ToDto(s, today, settings.DueSoonDays)).ToList();
    }

    [HttpGet("summary")]
    public async Task<ActionResult<SeatSummaryDto>> Summary([FromQuery] int? branchId) => await _allocation.SummaryAsync(branchId);

    /// <summary>Sections (floor/room/section groups) of a branch with their counts.</summary>
    [HttpGet("sections")]
    public async Task<ActionResult<List<SeatSectionDto>>> Sections([FromQuery] int? branchId)
    {
        var bid = branchId ?? await _settings.DefaultBranchIdAsync();
        var seats = await _db.Seats.AsNoTracking().Where(s => s.BranchId == bid)
            .Select(s => new { s.Section, s.IsActive, s.IsAc, s.ReservedForWomen, Occupied = s.Student != null }).ToListAsync();
        return seats.GroupBy(s => s.Section)
            .OrderBy(g => g.Key == null ? 1 : 0).ThenBy(g => g.Key)
            .Select(g => new SeatSectionDto(g.Key, g.Count(), g.Count(x => x.IsActive), g.Count(x => x.Occupied),
                g.Count(x => x.IsActive && !x.Occupied), g.Count(x => x.IsAc), g.Count(x => x.ReservedForWomen)))
            .ToList();
    }

    /// <summary>Direct setup: set the total number of seats in a branch. Adds seats (numbered after the highest) or removes the highest-numbered free seats.</summary>
    [HttpPut("capacity")]
    public async Task<ActionResult<SeatSummaryDto>> SetCapacity(SeatCapacityRequest request)
    {
        request.BranchId ??= await _settings.DefaultBranchIdAsync();
        if (!await _db.Branches.AnyAsync(b => b.Id == request.BranchId)) return BadRequest(new { message = "Branch not found." });

        var seats = await _db.Seats.Include(s => s.Student).Where(s => s.BranchId == request.BranchId.Value).OrderBy(s => s.Number).ToListAsync();
        var current = seats.Count;

        if (request.TotalSeats > current)
        {
            AddSeats(request.BranchId.Value, seats, request.TotalSeats - current, Clean(request.Section), request.IsAc);
        }
        else if (request.TotalSeats < current)
        {
            var toRemove = seats.OrderByDescending(s => s.Number).Take(current - request.TotalSeats).ToList();
            var occupied = toRemove.Where(s => s.Student != null).Select(s => s.Number).OrderBy(n => n).ToList();
            if (occupied.Count > 0)
                return BadRequest(new { message = $"Cannot reduce seats: seat(s) {string.Join(", ", occupied)} are occupied. Move those students first." });
            _db.Seats.RemoveRange(toRemove);
        }

        await _db.SaveChangesAsync();
        await _allocation.ApplyReservationAsync(request.BranchId.Value);
        return await _allocation.SummaryAsync(request.BranchId);
    }

    /// <summary>Structured setup: add N seats under a floor/room/section name (numbers continue from the branch's highest seat).</summary>
    [HttpPost("sections")]
    public async Task<ActionResult<List<SeatSectionDto>>> AddSection(SeatSectionRequest request)
    {
        request.BranchId ??= await _settings.DefaultBranchIdAsync();
        if (!await _db.Branches.AnyAsync(b => b.Id == request.BranchId)) return BadRequest(new { message = "Branch not found." });
        var seats = await _db.Seats.Where(s => s.BranchId == request.BranchId.Value).ToListAsync();
        AddSeats(request.BranchId.Value, seats, request.Seats, request.Name.Trim(), request.IsAc);
        await _db.SaveChangesAsync();
        await _allocation.ApplyReservationAsync(request.BranchId.Value);
        return await Sections(request.BranchId);
    }

    /// <summary>Rename a section, switch it between AC / Non-AC, or add more seats to it.</summary>
    [HttpPut("sections")]
    public async Task<ActionResult<List<SeatSectionDto>>> UpdateSection(SeatSectionUpdateRequest request)
    {
        request.BranchId ??= await _settings.DefaultBranchIdAsync();
        var all = await _db.Seats.Where(s => s.BranchId == request.BranchId.Value).ToListAsync();
        var inSection = all.Where(s => s.Section == request.Name.Trim()).ToList();
        if (inSection.Count == 0) return NotFound(new { message = $"Section '{request.Name}' not found." });

        var newName = string.IsNullOrWhiteSpace(request.NewName) ? request.Name.Trim() : request.NewName.Trim();
        foreach (var s in inSection)
        {
            s.Section = newName;
            if (request.IsAc.HasValue) s.IsAc = request.IsAc.Value;
        }
        if (request.AddSeats > 0)
            AddSeats(request.BranchId.Value, all, request.AddSeats, newName, request.IsAc ?? inSection.All(s => s.IsAc));

        await _db.SaveChangesAsync();
        await _allocation.ApplyReservationAsync(request.BranchId.Value);
        return await Sections(request.BranchId);
    }

    /// <summary>Remove a section's seats (only if none are occupied).</summary>
    [HttpDelete("sections")]
    public async Task<ActionResult<List<SeatSectionDto>>> DeleteSection([FromQuery] int? branchId, [FromQuery] string name)
    {
        branchId ??= await _settings.DefaultBranchIdAsync();
        var inSection = await _db.Seats.Include(s => s.Student).Where(s => s.BranchId == branchId && s.Section == name).ToListAsync();
        if (inSection.Count == 0) return NotFound(new { message = $"Section '{name}' not found." });
        var occupied = inSection.Where(s => s.Student != null).Select(s => s.Number).OrderBy(n => n).ToList();
        if (occupied.Count > 0)
            return BadRequest(new { message = $"Section '{name}' still has occupied seat(s) {string.Join(", ", occupied)}. Move those students first." });
        _db.Seats.RemoveRange(inSection);
        await _db.SaveChangesAsync();
        await _allocation.ApplyReservationAsync(branchId.Value);
        return await Sections(branchId);
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<SeatDto>> Update(int id, SeatUpdateRequest request)
    {
        var seat = await _db.Seats.Include(s => s.Student).Include(s => s.Branch).FirstOrDefaultAsync(s => s.Id == id);
        if (seat is null) return NotFound();
        if (!request.IsActive && seat.Student is not null)
            return BadRequest(new { message = $"Seat {seat.Number} is occupied by {seat.Student.Name}; move them before disabling it." });

        if (request.ReservedForWomen == true && seat.Student is not null && seat.Student.Gender != Gender.Female)
            return BadRequest(new { message = $"Seat {seat.Number} is occupied by {seat.Student.Name}; move him to another seat before reserving it for women." });

        seat.Label = Clean(request.Label);
        if (request.Section is not null) seat.Section = Clean(request.Section);
        if (request.IsAc.HasValue) seat.IsAc = request.IsAc.Value;
        if (request.ReservedForWomen.HasValue) seat.ReservedForWomen = request.ReservedForWomen.Value;
        var wasActive = seat.IsActive;
        seat.IsActive = request.IsActive;
        await _db.SaveChangesAsync();
        if (wasActive != seat.IsActive) await _allocation.ApplyReservationAsync(seat.BranchId);

        var settings = await _settings.GetAsync();
        return ToDto(seat, SettingsService.Today(settings), settings.DueSoonDays);
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var seat = await _db.Seats.Include(s => s.Student).FirstOrDefaultAsync(s => s.Id == id);
        if (seat is null) return NotFound();
        if (seat.Student is not null)
            return BadRequest(new { message = $"Seat {seat.Number} is occupied by {seat.Student.Name}." });
        _db.Seats.Remove(seat);
        await _db.SaveChangesAsync();
        await _allocation.ApplyReservationAsync(seat.BranchId);
        return NoContent();
    }

    /// <summary>Re-designates reserved seats from the branch's percentage (e.g. after toggling seats by hand).</summary>
    [HttpPost("apply-reservation")]
    public async Task<ActionResult<SeatSummaryDto>> ApplyReservation([FromQuery] int? branchId)
    {
        branchId ??= await _settings.DefaultBranchIdAsync();
        if (!await _db.Branches.AnyAsync(b => b.Id == branchId)) return NotFound(new { message = "Branch not found." });
        await _allocation.ApplyReservationAsync(branchId.Value);
        return await _allocation.SummaryAsync(branchId);
    }

    // ----- helpers -----

    private void AddSeats(int branchId, List<Seat> existing, int count, string? section, bool isAc)
    {
        var next = existing.Count == 0 ? 1 : existing.Max(s => s.Number) + 1;
        for (var i = 0; i < count; i++)
        {
            var seat = new Seat { BranchId = branchId, Number = next++, Section = section, IsAc = isAc };
            _db.Seats.Add(seat);
            existing.Add(seat);
        }
    }

    private static string? Clean(string? v) => string.IsNullOrWhiteSpace(v) ? null : v.Trim();

    private static SeatDto ToDto(Seat s, DateOnly today, int dueSoonDays) => new()
    {
        Id = s.Id,
        BranchId = s.BranchId,
        BranchName = s.Branch?.Name ?? string.Empty,
        Number = s.Number,
        Section = s.Section,
        IsAc = s.IsAc,
        ReservedForWomen = s.ReservedForWomen,
        Label = s.Label,
        IsActive = s.IsActive,
        StudentId = s.Student?.Id,
        StudentName = s.Student?.Name,
        StudentGender = s.Student?.Gender,
        StudentStatus = s.Student is null ? null : StudentMapper.ComputeStatus(s.Student, today, dueSoonDays),
        StudentDueDate = s.Student?.DueDate,
    };
}
