namespace WaterTanker.Api.Models;

/// <summary>A raw sample from the device (every few seconds while pumping, every minute idle).</summary>
public class TelemetryReading
{
    public long Id { get; set; }
    public int DeviceId { get; set; }
    public int? DeliveryId { get; set; }
    public Delivery? Delivery { get; set; }

    public DateTime RecordedAt { get; set; }
    public DateTime ReceivedAt { get; set; } = DateTime.UtcNow;

    public double FlowLpm { get; set; }
    /// <summary>Litres counted since the device booted (monotonic; the server diffs it).</summary>
    public double CumulativeLitres { get; set; }
    public double? TdsPpm { get; set; }
    public double? TurbidityNtu { get; set; }
    public double? WaterTempC { get; set; }
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
    public double? BatteryVolts { get; set; }
    public int? SignalCsq { get; set; }
    public bool Tamper { get; set; }
}
