namespace WaterTanker.Api.Models;

/// <summary>One pumping session from a tanker: opened when flow starts, closed when flow stops.</summary>
public class Delivery
{
    public int Id { get; set; }

    public int DeviceId { get; set; }
    public Device? Device { get; set; }

    public int OperatorId { get; set; }
    public Operator? Operator { get; set; }

    public int? TankerId { get; set; }
    public Tanker? Tanker { get; set; }

    /// <summary>Community matched by geofence (or assigned by the operator afterwards).</summary>
    public int? CommunityId { get; set; }
    public Community? Community { get; set; }

    public int? BookingId { get; set; }
    public Booking? Booking { get; set; }

    /// <summary>Firmware-generated session id so retried uploads do not create duplicate deliveries.</summary>
    public string? SessionKey { get; set; }

    /// <summary>Device cumulative litre counter when the session opened; litres delivered = latest counter - this.</summary>
    public double StartCumulativeLitres { get; set; }

    public DateTime StartedAt { get; set; }
    public DateTime? EndedAt { get; set; }
    public DateTime LastReadingAt { get; set; }
    public DeliveryStatus Status { get; set; } = DeliveryStatus.InProgress;

    // Measured
    public decimal LitresDelivered { get; set; }
    public double? AvgTdsPpm { get; set; }
    public double? MaxTdsPpm { get; set; }
    public double? AvgTurbidityNtu { get; set; }
    public double? MaxTurbidityNtu { get; set; }
    public double? PeakFlowLpm { get; set; }
    public QualityGrade QualityGrade { get; set; } = QualityGrade.Unknown;

    // Where
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
    public bool GeofenceMatched { get; set; }
    public double? DistanceToCommunityM { get; set; }

    // Proof
    public string? SealPhotoPath { get; set; }
    public DateTime? SealPhotoAt { get; set; }
    public bool TamperFlag { get; set; }
    public int ReadingCount { get; set; }

    // Money
    public decimal RatePerKl { get; set; }
    public decimal Amount { get; set; }
    public int? InvoiceId { get; set; }
    public Invoice? Invoice { get; set; }

    public DateTime? VerifiedAt { get; set; }
    public int? VerifiedByUserId { get; set; }
    public string? Notes { get; set; }

    public List<TelemetryReading> Readings { get; set; } = new();
}
