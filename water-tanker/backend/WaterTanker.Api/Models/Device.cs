namespace WaterTanker.Api.Models;

/// <summary>The sealed ESP32 + 4G node clamped on a tanker's outlet (flow meter + TDS + turbidity + GPS).</summary>
public class Device
{
    public int Id { get; set; }

    /// <summary>Printed on the enclosure; the firmware sends it in the X-Device-Id header.</summary>
    public string DeviceCode { get; set; } = string.Empty;

    /// <summary>SHA-256 of the device API key. The plain key is shown once when the device is registered.</summary>
    public string ApiKeyHash { get; set; } = string.Empty;

    public int OperatorId { get; set; }
    public Operator? Operator { get; set; }

    public int? TankerId { get; set; }
    public Tanker? Tanker { get; set; }

    /// <summary>Flow-meter K-factor (pulses per litre). Calibrated per unit; the server uses it if the firmware reports raw pulses.</summary>
    public double PulsesPerLitre { get; set; } = 4.8;

    public string? FirmwareVersion { get; set; }
    public DeviceStatus Status { get; set; } = DeviceStatus.Provisioned;
    public DateTime? LastSeenAt { get; set; }
    public double? LastLatitude { get; set; }
    public double? LastLongitude { get; set; }
    public double? LastBatteryVolts { get; set; }
    public int? LastSignalCsq { get; set; }
    public DateTime? InstalledAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
