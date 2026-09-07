using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WaterTanker.Api.Data;
using WaterTanker.Api.Dtos;
using WaterTanker.Api.Models;
using WaterTanker.Api.Services;

namespace WaterTanker.Api.Controllers;

/// <summary>Operator-side fleet management: tankers and the devices bolted onto them.</summary>
[ApiController]
[Route("api/fleet")]
[Authorize(Roles = "Operator,Admin")]
public class FleetController : ControllerBase
{
    private static readonly TimeSpan OnlineWindow = TimeSpan.FromMinutes(10);
    private readonly AppDbContext _db;
    public FleetController(AppDbContext db) => _db = db;

    private int? OperatorScope([FromQuery] int? operatorId = null) => User.IsAdmin() ? operatorId : User.OperatorId();

    // ---------- Tankers ----------

    [HttpGet("tankers")]
    public async Task<ActionResult<List<TankerDto>>> Tankers([FromQuery] int? operatorId, [FromQuery] bool includeInactive = true)
    {
        var scope = OperatorScope(operatorId);
        var q = _db.Tankers.Include(t => t.Device).AsQueryable();
        if (scope is not null) q = q.Where(t => t.OperatorId == scope);
        if (!includeInactive) q = q.Where(t => t.IsActive);
        var items = await q.OrderBy(t => t.RegistrationNumber).ToListAsync();
        return items.Select(t => TankerDto.From(t, OnlineWindow)).ToList();
    }

    [HttpPost("tankers")]
    public async Task<ActionResult<TankerDto>> CreateTanker(TankerRequest request, [FromQuery] int? operatorId)
    {
        var scope = OperatorScope(operatorId);
        if (scope is null) return BadRequest(new { message = "operatorId is required." });
        var reg = request.RegistrationNumber.Trim().ToUpperInvariant().Replace(" ", "");
        if (reg.Length < 4) return BadRequest(new { message = "Enter the vehicle registration number." });
        if (await _db.Tankers.AnyAsync(t => t.OperatorId == scope && t.RegistrationNumber == reg))
            return Conflict(new { message = "A tanker with that registration already exists." });
        var t = new Tanker { OperatorId = scope.Value, RegistrationNumber = reg, CapacityLitres = request.CapacityLitres, DriverName = request.DriverName?.Trim(), DriverPhone = request.DriverPhone?.Trim(), IsActive = request.IsActive };
        _db.Tankers.Add(t);
        await _db.SaveChangesAsync();
        return CreatedAtAction(nameof(Tankers), new { id = t.Id }, TankerDto.From(t, OnlineWindow));
    }

    [HttpPut("tankers/{id:int}")]
    public async Task<ActionResult<TankerDto>> UpdateTanker(int id, TankerRequest request)
    {
        var t = await _db.Tankers.Include(x => x.Device).FirstOrDefaultAsync(x => x.Id == id);
        if (t is null || (!User.IsAdmin() && t.OperatorId != User.OperatorId())) return NotFound();
        t.RegistrationNumber = request.RegistrationNumber.Trim().ToUpperInvariant().Replace(" ", "");
        t.CapacityLitres = request.CapacityLitres;
        t.DriverName = request.DriverName?.Trim();
        t.DriverPhone = request.DriverPhone?.Trim();
        t.IsActive = request.IsActive;
        await _db.SaveChangesAsync();
        return TankerDto.From(t, OnlineWindow);
    }

    // ---------- Devices ----------

    [HttpGet("devices")]
    public async Task<ActionResult<List<DeviceDto>>> Devices([FromQuery] int? operatorId)
    {
        var scope = OperatorScope(operatorId);
        var q = _db.Devices.Include(d => d.Tanker).AsQueryable();
        if (scope is not null) q = q.Where(d => d.OperatorId == scope);
        var items = await q.OrderBy(d => d.DeviceCode).ToListAsync();
        return items.Select(d => DeviceDto.From(d, OnlineWindow)).ToList();
    }

    /// <summary>Registers a new node. The API key is returned exactly once; flash it into the firmware.</summary>
    [HttpPost("devices")]
    public async Task<ActionResult<DeviceRegisteredResponse>> RegisterDevice(DeviceRegisterRequest request, [FromQuery] int? operatorId)
    {
        var scope = OperatorScope(operatorId);
        if (scope is null) return BadRequest(new { message = "operatorId is required." });
        var code = request.DeviceCode.Trim().ToUpperInvariant();
        if (code.Length < 4) return BadRequest(new { message = "Enter the device code printed on the enclosure." });
        if (await _db.Devices.AnyAsync(d => d.DeviceCode == code)) return Conflict(new { message = "That device code is already registered." });
        if (request.TankerId is int tid)
        {
            var tanker = await _db.Tankers.Include(t => t.Device).FirstOrDefaultAsync(t => t.Id == tid && t.OperatorId == scope);
            if (tanker is null) return BadRequest(new { message = "Tanker not found." });
            if (tanker.Device is not null) return BadRequest(new { message = "That tanker already has a device; unassign it first." });
        }

        var key = DeviceAuthService.GenerateKey();
        var device = new Device
        {
            DeviceCode = code, ApiKeyHash = DeviceAuthService.Hash(key), OperatorId = scope.Value, TankerId = request.TankerId,
            PulsesPerLitre = request.PulsesPerLitre is > 0 ? request.PulsesPerLitre.Value : 4.8,
            InstalledAt = request.TankerId is null ? null : DateTime.UtcNow,
        };
        _db.Devices.Add(device);
        await _db.SaveChangesAsync();
        await _db.Entry(device).Reference(d => d.Tanker).LoadAsync();
        return new DeviceRegisteredResponse(DeviceDto.From(device, OnlineWindow), key, "Store this key now; it is not shown again. Send it as the X-Device-Key header.");
    }

    [HttpPut("devices/{id:int}")]
    public async Task<ActionResult<DeviceDto>> UpdateDevice(int id, DeviceUpdateRequest request)
    {
        var device = await _db.Devices.Include(d => d.Tanker).FirstOrDefaultAsync(d => d.Id == id);
        if (device is null || (!User.IsAdmin() && device.OperatorId != User.OperatorId())) return NotFound();

        if (request.TankerId != device.TankerId)
        {
            if (request.TankerId is int tid)
            {
                var tanker = await _db.Tankers.Include(t => t.Device).FirstOrDefaultAsync(t => t.Id == tid && t.OperatorId == device.OperatorId);
                if (tanker is null) return BadRequest(new { message = "Tanker not found." });
                if (tanker.Device is not null && tanker.Device.Id != id) return BadRequest(new { message = "That tanker already has a device." });
                device.InstalledAt = DateTime.UtcNow;
            }
            device.TankerId = request.TankerId;
        }
        if (request.PulsesPerLitre is > 0) device.PulsesPerLitre = request.PulsesPerLitre.Value;
        if (request.Status is DeviceStatus s && (s == DeviceStatus.Retired || s == DeviceStatus.Provisioned)) device.Status = s;
        await _db.SaveChangesAsync();
        await _db.Entry(device).Reference(d => d.Tanker).LoadAsync();
        return DeviceDto.From(device, OnlineWindow);
    }

    /// <summary>Issues a new key (old one stops working immediately).</summary>
    [HttpPost("devices/{id:int}/rotate-key")]
    public async Task<ActionResult<DeviceRegisteredResponse>> RotateKey(int id)
    {
        var device = await _db.Devices.Include(d => d.Tanker).FirstOrDefaultAsync(d => d.Id == id);
        if (device is null || (!User.IsAdmin() && device.OperatorId != User.OperatorId())) return NotFound();
        var key = DeviceAuthService.GenerateKey();
        device.ApiKeyHash = DeviceAuthService.Hash(key);
        await _db.SaveChangesAsync();
        return new DeviceRegisteredResponse(DeviceDto.From(device, OnlineWindow), key, "New key issued. Re-flash the device with it.");
    }
}
