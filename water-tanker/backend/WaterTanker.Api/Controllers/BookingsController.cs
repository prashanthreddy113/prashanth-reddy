using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WaterTanker.Api.Data;
using WaterTanker.Api.Dtos;
using WaterTanker.Api.Models;
using WaterTanker.Api.Services;

namespace WaterTanker.Api.Controllers;

[ApiController]
[Route("api/bookings")]
[Authorize]
public class BookingsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly decimal _defaultRate;

    public BookingsController(AppDbContext db, IConfiguration config)
    {
        _db = db;
        _defaultRate = config.GetValue("Delivery:DefaultRatePerKl", 550m);
    }

    private IQueryable<Booking> Scoped()
    {
        var q = _db.Bookings.Include(b => b.Community).Include(b => b.Operator).Include(b => b.Tanker).Include(b => b.Deliveries).AsQueryable();
        return User.Role() switch
        {
            UserRole.Admin => q,
            UserRole.Operator => q.Where(b => b.OperatorId == User.OperatorId()),
            _ => q.Where(b => b.CommunityId == User.CommunityId()),
        };
    }

    [HttpGet]
    public async Task<ActionResult<List<BookingDto>>> List([FromQuery] BookingStatus? status, [FromQuery] bool upcomingOnly = false)
    {
        var q = Scoped();
        if (status is not null) q = q.Where(b => b.Status == status);
        if (upcomingOnly) q = q.Where(b => b.ScheduledFor >= DateTime.UtcNow.AddHours(-12) && b.Status != BookingStatus.Cancelled && b.Status != BookingStatus.Delivered);
        var items = await q.OrderByDescending(b => b.ScheduledFor).Take(300).ToListAsync();
        return items.Select(BookingDto.From).ToList();
    }

    /// <summary>RWA: request loads from an operator (defaults to the community's preferred operator).</summary>
    [HttpPost]
    [Authorize(Roles = "Rwa,Admin")]
    public async Task<ActionResult<BookingDto>> Create(BookingRequest request, [FromQuery] int? communityId)
    {
        var cid = User.IsAdmin() ? communityId : User.CommunityId();
        if (cid is null) return BadRequest(new { message = "communityId is required." });
        var community = await _db.Communities.FindAsync(cid);
        if (community is null) return BadRequest(new { message = "Community not found." });

        var operatorId = request.OperatorId ?? community.PreferredOperatorId;
        if (operatorId is null) return BadRequest(new { message = "Choose an operator." });
        var op = await _db.Operators.FindAsync(operatorId);
        if (op is null || !op.IsActive) return BadRequest(new { message = "Operator not found." });
        if (request.RequestedLitres < 1000) return BadRequest(new { message = "Minimum load is 1,000 litres." });

        var b = new Booking
        {
            CommunityId = community.Id, OperatorId = op.Id,
            RequestedLitres = request.RequestedLitres, Loads = Math.Max(1, request.Loads),
            ScheduledFor = DateTime.SpecifyKind(request.ScheduledFor, DateTimeKind.Utc),
            RatePerKl = community.RatePerKl ?? (op.RatePerKl > 0 ? op.RatePerKl : _defaultRate),
            Notes = request.Notes?.Trim(),
        };
        _db.Bookings.Add(b);
        await _db.SaveChangesAsync();
        b.Community = community; b.Operator = op;
        return CreatedAtAction(nameof(List), new { id = b.Id }, BookingDto.From(b));
    }

    /// <summary>Operator: accept a request and (optionally) assign a tanker.</summary>
    [HttpPost("{id:int}/accept")]
    [Authorize(Roles = "Operator,Admin")]
    public async Task<ActionResult<BookingDto>> Accept(int id, BookingAcceptRequest request)
    {
        var b = await Scoped().FirstOrDefaultAsync(x => x.Id == id);
        if (b is null) return NotFound();
        if (b.Status is not (BookingStatus.Requested or BookingStatus.Accepted)) return BadRequest(new { message = $"Booking is {b.Status}." });
        if (request.TankerId is int tid)
        {
            var tanker = await _db.Tankers.FirstOrDefaultAsync(t => t.Id == tid && t.OperatorId == b.OperatorId && t.IsActive);
            if (tanker is null) return BadRequest(new { message = "Tanker not found." });
            b.TankerId = tid; b.Tanker = tanker;
        }
        if (request.RatePerKl is > 0) b.RatePerKl = request.RatePerKl.Value;
        b.Status = BookingStatus.Accepted;
        b.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return BookingDto.From(b);
    }

    [HttpPost("{id:int}/dispatch")]
    [Authorize(Roles = "Operator,Admin")]
    public async Task<ActionResult<BookingDto>> Dispatch(int id)
    {
        var b = await Scoped().FirstOrDefaultAsync(x => x.Id == id);
        if (b is null) return NotFound();
        if (b.Status != BookingStatus.Accepted) return BadRequest(new { message = "Accept the booking first." });
        if (b.TankerId is null) return BadRequest(new { message = "Assign a tanker before dispatching." });
        b.Status = BookingStatus.Dispatched;
        b.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return BookingDto.From(b);
    }

    [HttpPost("{id:int}/cancel")]
    public async Task<ActionResult<BookingDto>> Cancel(int id)
    {
        var b = await Scoped().FirstOrDefaultAsync(x => x.Id == id);
        if (b is null) return NotFound();
        if (b.Status is BookingStatus.Delivered or BookingStatus.Cancelled) return BadRequest(new { message = $"Booking is already {b.Status}." });
        if (User.Role() == UserRole.Rwa && b.Status == BookingStatus.Dispatched) return BadRequest(new { message = "The tanker is already on its way; call the operator." });
        b.Status = BookingStatus.Cancelled;
        b.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return BookingDto.From(b);
    }
}
