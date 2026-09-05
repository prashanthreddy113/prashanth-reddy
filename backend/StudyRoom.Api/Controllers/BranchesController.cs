using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using StudyRoom.Api.Data;
using StudyRoom.Api.Dtos;
using StudyRoom.Api.Models;
using StudyRoom.Api.Services;

namespace StudyRoom.Api.Controllers;

[ApiController]
[Route("api/branches")]
[Authorize]
public class BranchesController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly SettingsService _settings;
    private readonly SeatAllocationService _allocation;

    public BranchesController(AppDbContext db, SettingsService settings, SeatAllocationService allocation)
    {
        _db = db;
        _settings = settings;
        _allocation = allocation;
    }

    [HttpGet]
    public async Task<ActionResult<List<BranchDto>>> List([FromQuery] bool includeInactive = true)
    {
        var settings = await _settings.GetAsync();
        var q = _db.Branches.AsNoTracking().AsQueryable();
        if (!includeInactive) q = q.Where(b => b.IsActive);
        var list = await q.OrderBy(b => b.Name).ToListAsync();
        return list.Select(b => ToDto(b, settings)).ToList();
    }

    [HttpGet("summary")]
    public async Task<ActionResult<List<BranchSummaryDto>>> Summary() => await _allocation.BranchSummariesAsync();

    [HttpGet("{id:int}")]
    public async Task<ActionResult<BranchDto>> Get(int id)
    {
        var b = await _db.Branches.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id);
        if (b is null) return NotFound();
        return ToDto(b, await _settings.GetAsync());
    }

    [HttpPost]
    public async Task<ActionResult<BranchDto>> Create(BranchUpsertRequest request)
    {
        var name = request.Name.Trim();
        if (await _db.Branches.AnyAsync(b => b.Name.ToLower() == name.ToLower()))
            return BadRequest(new { message = $"A branch named '{name}' already exists." });

        var b = new Branch();
        Apply(b, request);
        _db.Branches.Add(b);
        await _db.SaveChangesAsync();
        return CreatedAtAction(nameof(Get), new { id = b.Id }, ToDto(b, await _settings.GetAsync()));
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<BranchDto>> Update(int id, BranchUpsertRequest request)
    {
        var b = await _db.Branches.FirstOrDefaultAsync(x => x.Id == id);
        if (b is null) return NotFound();
        var name = request.Name.Trim();
        if (await _db.Branches.AnyAsync(x => x.Id != id && x.Name.ToLower() == name.ToLower()))
            return BadRequest(new { message = $"A branch named '{name}' already exists." });
        var pctChanged = b.FemaleReservationPercent != request.FemaleReservationPercent;
        Apply(b, request);
        await _db.SaveChangesAsync();
        if (pctChanged) await _allocation.ApplyReservationAsync(b.Id);
        return ToDto(b, await _settings.GetAsync());
    }

    /// <summary>Deletes a branch that has no students. Its free seats are removed with it.</summary>
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var b = await _db.Branches.Include(x => x.Seats).FirstOrDefaultAsync(x => x.Id == id);
        if (b is null) return NotFound();
        if (await _db.Branches.CountAsync() <= 1)
            return BadRequest(new { message = "At least one branch is required." });
        var students = await _db.Students.CountAsync(s => s.BranchId == id);
        if (students > 0)
            return BadRequest(new { message = $"This branch still has {students} student record(s). Move or delete them first, or mark the branch inactive instead." });
        _db.Seats.RemoveRange(b.Seats);
        _db.Branches.Remove(b);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    private static void Apply(Branch b, BranchUpsertRequest r)
    {
        b.Name = r.Name.Trim();
        b.Code = string.IsNullOrWhiteSpace(r.Code) ? null : r.Code.Trim().ToUpperInvariant();
        b.Address = string.IsNullOrWhiteSpace(r.Address) ? null : r.Address.Trim();
        b.Phone = string.IsNullOrWhiteSpace(r.Phone) ? null : r.Phone.Trim();
        b.IsActive = r.IsActive;
        b.FemaleReservationPercent = r.FemaleReservationPercent;
    }

    private static BranchDto ToDto(Branch b, RoomSettings settings) => new()
    {
        Id = b.Id, Name = b.Name, Code = b.Code, Address = b.Address, Phone = b.Phone, IsActive = b.IsActive,
        FemaleReservationPercent = b.FemaleReservationPercent,
        EffectiveFemaleReservationPercent = b.FemaleReservationPercent ?? settings.FemaleReservationPercent,
        CreatedAt = b.CreatedAt,
    };
}
