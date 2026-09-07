namespace WaterTanker.Api.Models;

/// <summary>Monthly statement from an operator to a community built from verified metered deliveries.</summary>
public class Invoice
{
    public int Id { get; set; }
    public string Number { get; set; } = string.Empty;
    public int CommunityId { get; set; }
    public Community? Community { get; set; }
    public int OperatorId { get; set; }
    public Operator? Operator { get; set; }

    public DateOnly PeriodStart { get; set; }
    public DateOnly PeriodEnd { get; set; }
    public int DeliveryCount { get; set; }
    public decimal TotalLitres { get; set; }
    public decimal Amount { get; set; }
    public InvoiceStatus Status { get; set; } = InvoiceStatus.Draft;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? IssuedAt { get; set; }
    public DateTime? PaidAt { get; set; }
    public string? PaymentReference { get; set; }
    public string? PaymentMethod { get; set; }

    public List<Delivery> Deliveries { get; set; } = new();
}
