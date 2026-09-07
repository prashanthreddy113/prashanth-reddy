namespace WaterTanker.Api.Models;

/// <summary>An RWA's request for a tanker load.</summary>
public class Booking
{
    public int Id { get; set; }
    public int CommunityId { get; set; }
    public Community? Community { get; set; }
    public int OperatorId { get; set; }
    public Operator? Operator { get; set; }

    public int RequestedLitres { get; set; } = 10000;
    public int Loads { get; set; } = 1;
    public DateTime ScheduledFor { get; set; }
    public BookingStatus Status { get; set; } = BookingStatus.Requested;
    public decimal RatePerKl { get; set; }

    public int? TankerId { get; set; }
    public Tanker? Tanker { get; set; }

    public string? Notes { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public List<Delivery> Deliveries { get; set; } = new();
}
