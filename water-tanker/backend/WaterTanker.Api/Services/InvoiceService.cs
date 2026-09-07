using Microsoft.EntityFrameworkCore;
using WaterTanker.Api.Data;
using WaterTanker.Api.Models;

namespace WaterTanker.Api.Services;

public class InvoiceService
{
    private readonly AppDbContext _db;

    public InvoiceService(AppDbContext db) => _db = db;

    /// <summary>Builds (or returns) the statement for one community + operator + calendar month from un-invoiced metered deliveries.</summary>
    public async Task<(Invoice? invoice, string? error)> GenerateAsync(int communityId, int operatorId, int year, int month, CancellationToken ct = default)
    {
        var start = new DateOnly(year, month, 1);
        var end = start.AddMonths(1).AddDays(-1);
        var fromUtc = start.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        var toUtc = end.AddDays(1).ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);

        var deliveries = await _db.Deliveries
            .Where(d => d.CommunityId == communityId && d.OperatorId == operatorId && d.InvoiceId == null
                        && (d.Status == DeliveryStatus.Completed || d.Status == DeliveryStatus.Verified)
                        && d.StartedAt >= fromUtc && d.StartedAt < toUtc)
            .OrderBy(d => d.StartedAt)
            .ToListAsync(ct);

        if (deliveries.Count == 0) return (null, "No un-invoiced deliveries in that month.");

        var seq = await _db.Invoices.CountAsync(i => i.PeriodStart == start && i.CommunityId == communityId, ct) + 1;
        var invoice = new Invoice
        {
            Number = $"AQ-{year:0000}{month:00}-{communityId:000}-{seq}",
            CommunityId = communityId,
            OperatorId = operatorId,
            PeriodStart = start,
            PeriodEnd = end,
            DeliveryCount = deliveries.Count,
            TotalLitres = deliveries.Sum(d => d.LitresDelivered),
            Amount = deliveries.Sum(d => d.Amount),
            Status = InvoiceStatus.Issued,
            IssuedAt = DateTime.UtcNow,
        };
        _db.Invoices.Add(invoice);
        foreach (var d in deliveries) d.Invoice = invoice;
        await _db.SaveChangesAsync(ct);
        return (invoice, null);
    }
}
