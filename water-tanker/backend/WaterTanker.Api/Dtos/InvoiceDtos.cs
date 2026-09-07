using WaterTanker.Api.Models;

namespace WaterTanker.Api.Dtos;

public record GenerateInvoiceRequest(int CommunityId, int? OperatorId, int Year, int Month);
public record PayInvoiceRequest(string Method, string? Reference);

public record InvoiceDto(
    int Id, string Number, int CommunityId, string? CommunityName, int OperatorId, string? OperatorName,
    DateOnly PeriodStart, DateOnly PeriodEnd, int DeliveryCount, decimal TotalLitres, decimal Amount, string Status,
    DateTime? IssuedAt, DateTime? PaidAt, string? PaymentReference, string? PaymentMethod)
{
    public static InvoiceDto From(Invoice i) => new(
        i.Id, i.Number, i.CommunityId, i.Community?.Name, i.OperatorId, i.Operator?.Name,
        i.PeriodStart, i.PeriodEnd, i.DeliveryCount, i.TotalLitres, i.Amount, i.Status.ToString(),
        i.IssuedAt, i.PaidAt, i.PaymentReference, i.PaymentMethod);
}
