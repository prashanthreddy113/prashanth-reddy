using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WaterTanker.Api.Data;
using WaterTanker.Api.Dtos;
using WaterTanker.Api.Models;
using WaterTanker.Api.Services;

namespace WaterTanker.Api.Controllers;

/// <summary>Platform admin: operators, communities and logins. Operators and RWAs get read access to what they need.</summary>
[ApiController]
[Route("api")]
[Authorize]
public class AdminController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IPasswordHasher<User> _hasher;

    public AdminController(AppDbContext db, IPasswordHasher<User> hasher) { _db = db; _hasher = hasher; }

    // ---------- Operators ----------

    [HttpGet("operators")]
    public async Task<ActionResult<List<OperatorDto>>> Operators()
    {
        var q = _db.Operators.Include(o => o.Tankers).Include(o => o.Devices).AsQueryable();
        if (!User.IsAdmin()) q = q.Where(o => o.IsActive);
        if (User.Role() == UserRole.Operator) q = q.Where(o => o.Id == User.OperatorId());
        var items = await q.OrderBy(o => o.Name).ToListAsync();
        return items.Select(OperatorDto.From).ToList();
    }

    [HttpPost("operators")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<OperatorDto>> CreateOperator(OperatorRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name)) return BadRequest(new { message = "Name is required." });
        if (await _db.Operators.AnyAsync(o => o.Name == request.Name.Trim())) return Conflict(new { message = "An operator with that name exists." });
        var o = new Operator { Name = request.Name.Trim(), Phone = request.Phone?.Trim(), Gstin = request.Gstin?.Trim(), Address = request.Address?.Trim(), RatePerKl = request.RatePerKl, IsActive = request.IsActive };
        _db.Operators.Add(o);
        await _db.SaveChangesAsync();
        return OperatorDto.From(o);
    }

    [HttpPut("operators/{id:int}")]
    [Authorize(Roles = "Admin,Operator")]
    public async Task<ActionResult<OperatorDto>> UpdateOperator(int id, OperatorRequest request)
    {
        if (!User.IsAdmin() && User.OperatorId() != id) return Forbid();
        var o = await _db.Operators.Include(x => x.Tankers).Include(x => x.Devices).FirstOrDefaultAsync(x => x.Id == id);
        if (o is null) return NotFound();
        o.Name = request.Name.Trim(); o.Phone = request.Phone?.Trim(); o.Gstin = request.Gstin?.Trim(); o.Address = request.Address?.Trim();
        o.RatePerKl = request.RatePerKl;
        if (User.IsAdmin()) o.IsActive = request.IsActive;
        await _db.SaveChangesAsync();
        return OperatorDto.From(o);
    }

    // ---------- Communities ----------

    [HttpGet("communities")]
    public async Task<ActionResult<List<CommunityDto>>> Communities([FromQuery] bool includeInactive = false)
    {
        var q = _db.Communities.Include(c => c.PreferredOperator).AsQueryable();
        if (User.Role() == UserRole.Rwa) q = q.Where(c => c.Id == User.CommunityId());
        else if (!includeInactive || !User.IsAdmin()) q = q.Where(c => c.IsActive);
        var items = await q.OrderBy(c => c.Area).ThenBy(c => c.Name).ToListAsync();
        return items.Select(CommunityDto.From).ToList();
    }

    [HttpPost("communities")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<CommunityDto>> CreateCommunity(CommunityRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name)) return BadRequest(new { message = "Name is required." });
        var c = new Community();
        Apply(c, request);
        _db.Communities.Add(c);
        await _db.SaveChangesAsync();
        await _db.Entry(c).Reference(x => x.PreferredOperator).LoadAsync();
        return CommunityDto.From(c);
    }

    [HttpPut("communities/{id:int}")]
    [Authorize(Roles = "Admin,Rwa")]
    public async Task<ActionResult<CommunityDto>> UpdateCommunity(int id, CommunityRequest request)
    {
        if (!User.IsAdmin() && User.CommunityId() != id) return Forbid();
        var c = await _db.Communities.FirstOrDefaultAsync(x => x.Id == id);
        if (c is null) return NotFound();
        if (User.IsAdmin()) Apply(c, request);
        else
        {
            // RWAs may fix their own contact details and preferred operator, not the commercial terms.
            c.ContactName = request.ContactName?.Trim(); c.ContactPhone = request.ContactPhone?.Trim(); c.Address = request.Address?.Trim();
            c.Flats = request.Flats; c.PreferredOperatorId = request.PreferredOperatorId;
        }
        await _db.SaveChangesAsync();
        await _db.Entry(c).Reference(x => x.PreferredOperator).LoadAsync();
        return CommunityDto.From(c);
    }

    private static void Apply(Community c, CommunityRequest r)
    {
        c.Name = r.Name.Trim(); c.Area = r.Area?.Trim() ?? ""; c.Address = r.Address?.Trim();
        c.ContactName = r.ContactName?.Trim(); c.ContactPhone = r.ContactPhone?.Trim(); c.Flats = r.Flats;
        c.Latitude = r.Latitude; c.Longitude = r.Longitude; c.GeofenceRadiusM = Math.Clamp(r.GeofenceRadiusM, 30, 2000);
        c.RatePerKl = r.RatePerKl; c.PreferredOperatorId = r.PreferredOperatorId;
        c.SubscriptionPerMonth = r.SubscriptionPerMonth; c.IsActive = r.IsActive;
    }

    // ---------- Users ----------

    [HttpGet("users")]
    [Authorize(Roles = "Admin,Operator")]
    public async Task<ActionResult<List<UserDto>>> Users()
    {
        var q = _db.Users.Include(u => u.Operator).Include(u => u.Community).AsQueryable();
        if (!User.IsAdmin()) q = q.Where(u => u.OperatorId == User.OperatorId());
        var items = await q.OrderBy(u => u.Role).ThenBy(u => u.Email).ToListAsync();
        return items.Select(UserDto.From).ToList();
    }

    /// <summary>Admin creates any login; an operator can add staff logins for their own company.</summary>
    [HttpPost("users")]
    [Authorize(Roles = "Admin,Operator")]
    public async Task<ActionResult<UserDto>> CreateUser(UserRequest request)
    {
        var email = request.Email.Trim().ToLowerInvariant();
        if (!email.Contains('@')) return BadRequest(new { message = "Enter a valid email." });
        if (string.IsNullOrWhiteSpace(request.Password) || request.Password.Length < 6) return BadRequest(new { message = "Password must be at least 6 characters." });
        if (await _db.Users.AnyAsync(u => u.Email == email)) return Conflict(new { message = "That email is already registered." });

        var u = new User { Email = email, DisplayName = request.DisplayName.Trim(), Phone = request.Phone?.Trim(), Role = request.Role, IsActive = request.IsActive };
        if (User.IsAdmin())
        {
            u.OperatorId = request.Role == UserRole.Operator ? request.OperatorId : null;
            u.CommunityId = request.Role == UserRole.Rwa ? request.CommunityId : null;
        }
        else
        {
            u.Role = UserRole.Operator;
            u.OperatorId = User.OperatorId();
        }
        if (u.Role == UserRole.Operator && u.OperatorId is null) return BadRequest(new { message = "Operator users need an operatorId." });
        if (u.Role == UserRole.Rwa && u.CommunityId is null) return BadRequest(new { message = "RWA users need a communityId." });
        u.PasswordHash = _hasher.HashPassword(u, request.Password);
        _db.Users.Add(u);
        await _db.SaveChangesAsync();
        await _db.Entry(u).Reference(x => x.Operator).LoadAsync();
        await _db.Entry(u).Reference(x => x.Community).LoadAsync();
        return UserDto.From(u);
    }

    [HttpPut("users/{id:int}")]
    [Authorize(Roles = "Admin,Operator")]
    public async Task<ActionResult<UserDto>> UpdateUser(int id, UserRequest request)
    {
        var u = await _db.Users.Include(x => x.Operator).Include(x => x.Community).FirstOrDefaultAsync(x => x.Id == id);
        if (u is null || (!User.IsAdmin() && u.OperatorId != User.OperatorId())) return NotFound();
        u.DisplayName = request.DisplayName.Trim(); u.Phone = request.Phone?.Trim(); u.IsActive = request.IsActive;
        if (!string.IsNullOrWhiteSpace(request.Password)) u.PasswordHash = _hasher.HashPassword(u, request.Password);
        if (User.IsAdmin())
        {
            u.Role = request.Role;
            u.OperatorId = request.Role == UserRole.Operator ? request.OperatorId : null;
            u.CommunityId = request.Role == UserRole.Rwa ? request.CommunityId : null;
        }
        await _db.SaveChangesAsync();
        return UserDto.From(u);
    }
}
