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

    [HttpGet]
    public async Task<ActionResult<List<SeatDto>>> List()
    {
        var settings = await _settings.GetAsync();
        var today = SettingsService.Today(settings);

        var seats = await _db.Seats.Include(s => s.Student).AsNoTracking().OrderBy(s => s.Number).ToListAsync();
        return seats.Select(s => new SeatDto
        {
            Id = s.Id,
            Number = s.Number,
            Label = s.Label,
            IsActive = s.IsActive,
            StudentId = s.Student?.Id,
            StudentName = s.Student?.Name,
            StudentGender = s.Student?.Gender,
            StudentStatus = s.Student is null ? null : StudentMapper.ComputeStatus(s.Student, today, settings.DueSoonDays),
            StudentDueDate = s.Student?.DueDate,
        }).ToList();
    }

    [HttpGet("summary")]
    public async Task<ActionResult<SeatSummaryDto>> Summary() => await _allocation.SummaryAsync();

    /// <summary>Set the total number of seats. Adds seats to reach the target, or removes the highest-numbered free seats.</summary>
    [HttpPut("capacity")]
    public async Task<ActionResult<SeatSummaryDto>> SetCapacity(SeatCapacityRequest request)
    {
        var seats = await _db.Seats.Include(s => s.Student).OrderBy(s => s.Number).ToListAsync();
        var current = seats.Count;

        if (request.TotalSeats > current)
        {
            var maxNumber = seats.Count == 0 ? 0 : seats.Max(s => s.Number);
            for (var n = maxNumber + 1; seats.Count < request.TotalSeats; n++)
            {
                var seat = new Seat { Number = n };
                _db.Seats.Add(seat);
                seats.Add(seat);
            }
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
        return await Summary();
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<SeatDto>> Update(int id, SeatUpdateRequest request)
    {
        var seat = await _db.Seats.Include(s => s.Student).FirstOrDefaultAsync(s => s.Id == id);
        if (seat is null) return NotFound();
        if (!request.IsActive && seat.Student is not null)
            return BadRequest(new { message = $"Seat {seat.Number} is occupied by {seat.Student.Name}; move them before disabling it." });

        seat.Label = string.IsNullOrWhiteSpace(request.Label) ? null : request.Label.Trim();
        seat.IsActive = request.IsActive;
        await _db.SaveChangesAsync();

        return new SeatDto { Id = seat.Id, Number = seat.Number, Label = seat.Label, IsActive = seat.IsActive, StudentId = seat.Student?.Id, StudentName = seat.Student?.Name, StudentGender = seat.Student?.Gender };
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
        return NoContent();
    }
}
