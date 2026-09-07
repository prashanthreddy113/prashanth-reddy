using Microsoft.EntityFrameworkCore;
using WaterTanker.Api.Data;
using WaterTanker.Api.Dtos;
using WaterTanker.Api.Models;

namespace WaterTanker.Api.Services;

/// <summary>
/// Turns raw device telemetry into deliveries. A delivery opens when flow starts (or the firmware sends a
/// "start" event), accumulates readings, and is finalised when the firmware sends "end" or the idle timer fires.
/// </summary>
public class DeliveryService
{
    private readonly AppDbContext _db;
    private readonly QualityService _quality;
    private readonly ILogger<DeliveryService> _log;
    private readonly double _flowStartLpm;
    private readonly decimal _minLitresToKeep;
    private readonly decimal _defaultRatePerKl;

    public DeliveryService(AppDbContext db, QualityService quality, IConfiguration config, ILogger<DeliveryService> log)
    {
        _db = db;
        _quality = quality;
        _log = log;
        _flowStartLpm = config.GetValue("Delivery:FlowStartLpm", 5.0);
        _minLitresToKeep = config.GetValue("Delivery:MinLitresToKeep", 200m);
        _defaultRatePerKl = config.GetValue("Delivery:DefaultRatePerKl", 550m);
    }

    public async Task<IngestResult> IngestAsync(Device device, TelemetryBatch batch, CancellationToken ct = default)
    {
        var now = DateTime.UtcNow;
        device.LastSeenAt = now;
        if (!string.IsNullOrWhiteSpace(batch.Firmware)) device.FirmwareVersion = batch.Firmware;

        var readings = (batch.Readings ?? new List<TelemetrySample>())
            .Select(s => new TelemetryReading
            {
                DeviceId = device.Id,
                RecordedAt = s.T?.ToUniversalTime() ?? now,
                FlowLpm = s.FlowLpm ?? 0,
                CumulativeLitres = s.Litres ?? (s.Pulses is long p ? p / Math.Max(device.PulsesPerLitre, 0.01) : 0),
                TdsPpm = s.Tds,
                TurbidityNtu = s.Ntu,
                WaterTempC = s.TempC,
                Latitude = s.Lat,
                Longitude = s.Lng,
                BatteryVolts = s.Batt,
                SignalCsq = s.Csq,
                Tamper = s.Tamper ?? false,
            })
            .OrderBy(r => r.RecordedAt)
            .ToList();

        var tampered = readings.Any(r => r.Tamper);
        device.Status = tampered ? DeviceStatus.Tampered : DeviceStatus.Online;
        var last = readings.LastOrDefault();
        if (last is not null)
        {
            if (last.Latitude is not null) { device.LastLatitude = last.Latitude; device.LastLongitude = last.Longitude; }
            device.LastBatteryVolts = last.BatteryVolts ?? device.LastBatteryVolts;
            device.LastSignalCsq = last.SignalCsq ?? device.LastSignalCsq;
        }

        // Find the delivery these readings belong to: by session key first (idempotent retries), else the open one.
        Delivery? delivery = null;
        if (!string.IsNullOrWhiteSpace(batch.SessionKey))
            delivery = await _db.Deliveries.FirstOrDefaultAsync(d => d.DeviceId == device.Id && d.SessionKey == batch.SessionKey, ct);
        delivery ??= await _db.Deliveries.FirstOrDefaultAsync(d => d.DeviceId == device.Id && d.Status == DeliveryStatus.InProgress, ct);

        var evt = (batch.Event ?? "reading").Trim().ToLowerInvariant();
        var opened = false;

        foreach (var r in readings)
        {
            var shouldOpen = delivery is null && (evt == "start" || r.FlowLpm >= _flowStartLpm);
            if (shouldOpen)
            {
                delivery = new Delivery
                {
                    DeviceId = device.Id,
                    OperatorId = device.OperatorId,
                    TankerId = device.TankerId,
                    SessionKey = string.IsNullOrWhiteSpace(batch.SessionKey) ? null : batch.SessionKey,
                    StartedAt = r.RecordedAt,
                    LastReadingAt = r.RecordedAt,
                    StartCumulativeLitres = r.CumulativeLitres,
                    Status = DeliveryStatus.InProgress,
                };
                _db.Deliveries.Add(delivery);
                opened = true;
            }

            if (delivery is not null)
            {
                r.Delivery = delivery;
                if (delivery.Status == DeliveryStatus.InProgress)
                {
                    delivery.LastReadingAt = r.RecordedAt > delivery.LastReadingAt ? r.RecordedAt : delivery.LastReadingAt;
                    delivery.LitresDelivered = (decimal)Math.Max(0, Math.Round(r.CumulativeLitres - delivery.StartCumulativeLitres, 1));
                    delivery.PeakFlowLpm = Math.Max(delivery.PeakFlowLpm ?? 0, r.FlowLpm);
                    delivery.ReadingCount++;
                    if (r.Tamper) delivery.TamperFlag = true;
                    if (r.Latitude is not null) { delivery.Latitude = r.Latitude; delivery.Longitude = r.Longitude; }
                }
            }
            _db.Readings.Add(r);
        }

        var finalised = false;
        if (evt == "end" && delivery is { Status: DeliveryStatus.InProgress })
        {
            await FinaliseAsync(delivery, ct);
            finalised = true;
        }
        else if (readings.Count > 0 && delivery is { Status: DeliveryStatus.Completed or DeliveryStatus.Discarded } && delivery.InvoiceId is null)
        {
            // Late readings for a session the idle timer already closed (device buffered them offline):
            // recompute totals so nothing pumped is lost. Verified/disputed/invoiced loads are left alone.
            await FinaliseAsync(delivery, ct);
            finalised = true;
        }

        await _db.SaveChangesAsync(ct);
        return new IngestResult(readings.Count, delivery?.Id, opened, finalised, delivery?.Status.ToString());
    }

    /// <summary>Closes deliveries that stopped sending readings (device lost signal or firmware never sent "end").</summary>
    public async Task<int> CloseIdleAsync(TimeSpan idle, CancellationToken ct = default)
    {
        var cutoff = DateTime.UtcNow - idle;
        var stale = await _db.Deliveries
            .Where(d => d.Status == DeliveryStatus.InProgress && d.LastReadingAt < cutoff)
            .ToListAsync(ct);
        foreach (var d in stale) await FinaliseAsync(d, ct);
        if (stale.Count > 0) await _db.SaveChangesAsync(ct);
        return stale.Count;
    }

    public async Task FinaliseAsync(Delivery delivery, CancellationToken ct = default)
    {
        // Pull the readings that belong to this delivery (already tracked ones included).
        var tracked = _db.ChangeTracker.Entries<TelemetryReading>()
            .Where(e => e.Entity.Delivery == delivery || e.Entity.DeliveryId == delivery.Id)
            .Select(e => e.Entity);
        var stored = delivery.Id > 0
            ? await _db.Readings.Where(r => r.DeliveryId == delivery.Id).ToListAsync(ct)
            : new List<TelemetryReading>();
        var readings = stored.Concat(tracked).DistinctBy(r => (r.RecordedAt, r.CumulativeLitres)).OrderBy(r => r.RecordedAt).ToList();

        var flowing = readings.Where(r => r.FlowLpm >= _flowStartLpm).ToList();
        var sample = flowing.Count > 0 ? flowing : readings;
        var tds = sample.Where(r => r.TdsPpm is not null).Select(r => r.TdsPpm!.Value).ToList();
        var ntu = sample.Where(r => r.TurbidityNtu is not null).Select(r => r.TurbidityNtu!.Value).ToList();

        delivery.AvgTdsPpm = tds.Count > 0 ? Math.Round(tds.Average(), 0) : null;
        delivery.MaxTdsPpm = tds.Count > 0 ? tds.Max() : null;
        delivery.AvgTurbidityNtu = ntu.Count > 0 ? Math.Round(ntu.Average(), 2) : null;
        delivery.MaxTurbidityNtu = ntu.Count > 0 ? ntu.Max() : null;
        delivery.QualityGrade = _quality.Grade(delivery.AvgTdsPpm, delivery.AvgTurbidityNtu);
        delivery.ReadingCount = readings.Count;
        delivery.TamperFlag = delivery.TamperFlag || readings.Any(r => r.Tamper);

        if (readings.Count > 0)
        {
            var lastCounter = readings[^1].CumulativeLitres;
            delivery.LitresDelivered = (decimal)Math.Max(0, Math.Round(lastCounter - delivery.StartCumulativeLitres, 1));
            delivery.PeakFlowLpm = readings.Max(r => r.FlowLpm);
            delivery.LastReadingAt = readings[^1].RecordedAt;
            var fix = readings.LastOrDefault(r => r.Latitude is not null) ?? readings.FirstOrDefault(r => r.Latitude is not null);
            if (fix is not null) { delivery.Latitude = fix.Latitude; delivery.Longitude = fix.Longitude; }
        }
        delivery.EndedAt = delivery.LastReadingAt;

        await MatchCommunityAsync(delivery, ct);
        await MatchBookingAsync(delivery, ct);
        await PriceAsync(delivery, ct);

        delivery.Status = delivery.LitresDelivered < _minLitresToKeep ? DeliveryStatus.Discarded : DeliveryStatus.Completed;
        _log.LogInformation("Delivery {Id} finalised: {Litres} L, grade {Grade}, community {Community}", delivery.Id, delivery.LitresDelivered, delivery.QualityGrade, delivery.CommunityId);
    }

    private async Task MatchCommunityAsync(Delivery delivery, CancellationToken ct)
    {
        if (delivery.CommunityId is not null || delivery.Latitude is null || delivery.Longitude is null) return;
        var communities = await _db.Communities.Where(c => c.IsActive).ToListAsync(ct);
        Community? best = null;
        double bestDist = double.MaxValue;
        foreach (var c in communities)
        {
            var d = GeoService.DistanceM(delivery.Latitude.Value, delivery.Longitude.Value, c.Latitude, c.Longitude);
            if (d <= c.GeofenceRadiusM && d < bestDist) { best = c; bestDist = d; }
        }
        if (best is not null)
        {
            delivery.CommunityId = best.Id;
            delivery.GeofenceMatched = true;
            delivery.DistanceToCommunityM = Math.Round(bestDist, 0);
        }
    }

    private async Task MatchBookingAsync(Delivery delivery, CancellationToken ct)
    {
        if (delivery.BookingId is not null || delivery.CommunityId is null) return;
        var from = delivery.StartedAt.AddHours(-36);
        var to = delivery.StartedAt.AddHours(36);
        var booking = await _db.Bookings
            .Where(b => b.CommunityId == delivery.CommunityId && b.OperatorId == delivery.OperatorId
                        && (b.Status == BookingStatus.Accepted || b.Status == BookingStatus.Dispatched)
                        && b.ScheduledFor >= from && b.ScheduledFor <= to)
            .OrderBy(b => b.TankerId == delivery.TankerId ? 0 : 1)
            .ThenBy(b => b.ScheduledFor)
            .FirstOrDefaultAsync(ct);
        if (booking is null) return;
        delivery.BookingId = booking.Id;
        booking.Status = BookingStatus.Delivered;
        booking.UpdatedAt = DateTime.UtcNow;
        if (booking.TankerId is null) booking.TankerId = delivery.TankerId;
    }

    private async Task PriceAsync(Delivery delivery, CancellationToken ct)
    {
        decimal? rate = null;
        if (delivery.BookingId is int bid)
            rate = await _db.Bookings.Where(b => b.Id == bid).Select(b => (decimal?)b.RatePerKl).FirstOrDefaultAsync(ct);
        if (rate is null or 0 && delivery.CommunityId is int cid)
            rate = await _db.Communities.Where(c => c.Id == cid).Select(c => c.RatePerKl).FirstOrDefaultAsync(ct);
        if (rate is null or 0)
            rate = await _db.Operators.Where(o => o.Id == delivery.OperatorId).Select(o => (decimal?)o.RatePerKl).FirstOrDefaultAsync(ct);
        if (rate is null or 0) rate = _defaultRatePerKl;

        delivery.RatePerKl = rate.Value;
        delivery.Amount = Math.Round(delivery.LitresDelivered / 1000m * rate.Value, 2);
    }
}
