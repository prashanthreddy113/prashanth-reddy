namespace WaterTanker.Api.Models;

public class Tanker
{
    public int Id { get; set; }
    public int OperatorId { get; set; }
    public Operator? Operator { get; set; }

    /// <summary>Vehicle registration, e.g. TS09UB1234.</summary>
    public string RegistrationNumber { get; set; } = string.Empty;
    public int CapacityLitres { get; set; } = 10000;
    public string? DriverName { get; set; }
    public string? DriverPhone { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Device? Device { get; set; }
}
