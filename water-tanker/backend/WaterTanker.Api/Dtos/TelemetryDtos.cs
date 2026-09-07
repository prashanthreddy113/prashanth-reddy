namespace WaterTanker.Api.Dtos;

/// <summary>What the ESP32 posts. Field names are short to save bytes over 4G.</summary>
public class TelemetryBatch
{
    /// <summary>Firmware-generated id for the pumping session (e.g. deviceCode + boot counter + session counter).</summary>
    public string? SessionKey { get; set; }
    /// <summary>"start" | "reading" | "end" | "heartbeat"</summary>
    public string? Event { get; set; }
    public string? Firmware { get; set; }
    public List<TelemetrySample>? Readings { get; set; }
}

public class TelemetrySample
{
    /// <summary>UTC timestamp of the sample (from GPS/NTP). Server time is used when missing.</summary>
    public DateTime? T { get; set; }
    public double? FlowLpm { get; set; }
    /// <summary>Cumulative litres since boot (preferred).</summary>
    public double? Litres { get; set; }
    /// <summary>Cumulative raw pulses since boot (used when Litres is absent; converted with the device K-factor).</summary>
    public long? Pulses { get; set; }
    public double? Tds { get; set; }
    public double? Ntu { get; set; }
    public double? TempC { get; set; }
    public double? Lat { get; set; }
    public double? Lng { get; set; }
    public double? Batt { get; set; }
    public int? Csq { get; set; }
    public bool? Tamper { get; set; }
}

public record IngestResult(int Accepted, int? DeliveryId, bool Opened, bool Finalised, string? DeliveryStatus);
