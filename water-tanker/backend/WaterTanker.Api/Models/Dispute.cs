namespace WaterTanker.Api.Models;

public class Dispute
{
    public int Id { get; set; }
    public int DeliveryId { get; set; }
    public Delivery? Delivery { get; set; }
    public int RaisedByUserId { get; set; }
    public User? RaisedBy { get; set; }
    public string Reason { get; set; } = string.Empty;
    public DisputeStatus Status { get; set; } = DisputeStatus.Open;
    public string? Resolution { get; set; }
    public int? ResolvedByUserId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ResolvedAt { get; set; }
}
