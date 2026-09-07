namespace WaterTanker.Api.Models;

/// <summary>A gated community / apartment complex represented by its RWA.</summary>
public class Community
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    /// <summary>Locality, e.g. Manikonda, Gachibowli.</summary>
    public string Area { get; set; } = string.Empty;
    public string? Address { get; set; }
    public string? ContactName { get; set; }
    public string? ContactPhone { get; set; }
    public int? Flats { get; set; }

    /// <summary>Geofence centre; a delivery whose GPS fix is within <see cref="GeofenceRadiusM"/> metres is attributed to this community.</summary>
    public double Latitude { get; set; }
    public double Longitude { get; set; }
    public int GeofenceRadiusM { get; set; } = 150;

    /// <summary>Negotiated price per kilolitre with the preferred operator; null = operator default.</summary>
    public decimal? RatePerKl { get; set; }
    public int? PreferredOperatorId { get; set; }
    public Operator? PreferredOperator { get; set; }

    /// <summary>Monthly platform subscription in INR (₹1-2k for verified deliveries and dispute-free billing).</summary>
    public decimal SubscriptionPerMonth { get; set; } = 1500;

    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
