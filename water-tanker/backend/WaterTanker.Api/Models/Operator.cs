namespace WaterTanker.Api.Models;

/// <summary>A tanker operator / fleet company.</summary>
public class Operator
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public string? Gstin { get; set; }
    public string? Address { get; set; }
    /// <summary>Default price the operator charges per kilolitre (1000 L).</summary>
    public decimal RatePerKl { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public List<Tanker> Tankers { get; set; } = new();
    public List<Device> Devices { get; set; } = new();
}
