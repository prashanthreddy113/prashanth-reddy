using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WaterTanker.Api.Dtos;
using WaterTanker.Api.Services;

namespace WaterTanker.Api.Controllers;

/// <summary>
/// Device ingestion. The ESP32 authenticates with X-Device-Id / X-Device-Key headers (no JWT).
/// At scale the same payload can arrive via Azure IoT Hub → Event Grid → this endpoint; the contract is identical.
/// </summary>
[ApiController]
[Route("api/telemetry")]
[AllowAnonymous]
public class TelemetryController : ControllerBase
{
    private readonly DeviceAuthService _auth;
    private readonly DeliveryService _deliveries;
    private readonly ILogger<TelemetryController> _log;

    public TelemetryController(DeviceAuthService auth, DeliveryService deliveries, ILogger<TelemetryController> log)
    {
        _auth = auth; _deliveries = deliveries; _log = log;
    }

    /// <summary>Post a batch of samples. Send event "start" when flow begins, "end" when it stops, "heartbeat" while idle.</summary>
    [HttpPost]
    public async Task<ActionResult<IngestResult>> Post(TelemetryBatch batch, CancellationToken ct)
    {
        var device = await _auth.AuthenticateAsync(Request);
        if (device is null) return Unauthorized(new { message = "Unknown device or bad key." });
        if (batch.Readings is { Count: > 500 }) return BadRequest(new { message = "At most 500 readings per batch." });

        var result = await _deliveries.IngestAsync(device, batch, ct);
        _log.LogDebug("Device {Code}: {Accepted} readings, delivery {Delivery} ({Status})", device.DeviceCode, result.Accepted, result.DeliveryId, result.DeliveryStatus);
        return result;
    }

    /// <summary>Lets the firmware confirm its credentials and fetch its calibration.</summary>
    [HttpGet("whoami")]
    public async Task<ActionResult> WhoAmI()
    {
        var device = await _auth.AuthenticateAsync(Request);
        if (device is null) return Unauthorized(new { message = "Unknown device or bad key." });
        return Ok(new
        {
            device.DeviceCode,
            device.PulsesPerLitre,
            Tanker = device.Tanker?.RegistrationNumber,
            CapacityLitres = device.Tanker?.CapacityLitres,
            ServerTime = DateTime.UtcNow,
        });
    }
}
