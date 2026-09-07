using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WaterTanker.Api.Data;
using WaterTanker.Api.Dtos;
using WaterTanker.Api.Models;
using WaterTanker.Api.Services;

namespace WaterTanker.Api.Controllers;

[ApiController]
[Route("api/invoices")]
[Authorize]
public class InvoicesController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly InvoiceService _service;

    public InvoicesController(AppDbContext db, InvoiceService service) { _db = db; _service = service; }

    private IQueryable<Invoice> Scoped()
    {
        var q = _db.Invoices.Include(i => i.Community).Include(i => i.Operator).AsQueryable();
        return User.Role() switch
        {
            UserRole.Admin => q,
            UserRole.Operator => q.Where(i => i.OperatorId == User.OperatorId()),
            _ => q.Where(i => i.CommunityId == User.CommunityId() && i.Status != InvoiceStatus.Draft),
        };
    }

    [HttpGet]
    public async Task<ActionResult<List<InvoiceDto>>> List([FromQuery] InvoiceStatus? status)
    {
        var q = Scoped();
        if (status is not null) q = q.Where(i => i.Status == status);
        var items = await q.OrderByDescending(i => i.PeriodStart).ThenByDescending(i => i.Id).Take(300).ToListAsync();
        return items.Select(InvoiceDto.From).ToList();
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult> Get(int id)
    {
        var i = await Scoped().FirstOrDefaultAsync(x => x.Id == id);
        if (i is null) return NotFound();
        var deliveries = await _db.Deliveries.Include(d => d.Tanker).Include(d => d.Community).Include(d => d.Operator)
            .Where(d => d.InvoiceId == id).OrderBy(d => d.StartedAt).ToListAsync();
        return Ok(new { Invoice = InvoiceDto.From(i), Deliveries = deliveries.Select(d => DeliveryDto.From(d)).ToList() });
    }

    /// <summary>Operator: build the month's statement for a community from un-invoiced deliveries.</summary>
    [HttpPost("generate")]
    [Authorize(Roles = "Operator,Admin")]
    public async Task<ActionResult<InvoiceDto>> Generate(GenerateInvoiceRequest request)
    {
        var operatorId = User.IsAdmin() ? request.OperatorId : User.OperatorId();
        if (operatorId is null) return BadRequest(new { message = "operatorId is required." });
        if (request.Month is < 1 or > 12 || request.Year < 2020) return BadRequest(new { message = "Invalid month." });
        var (invoice, error) = await _service.GenerateAsync(request.CommunityId, operatorId.Value, request.Year, request.Month);
        if (invoice is null) return BadRequest(new { message = error });
        await _db.Entry(invoice).Reference(i => i.Community).LoadAsync();
        await _db.Entry(invoice).Reference(i => i.Operator).LoadAsync();
        return InvoiceDto.From(invoice);
    }

    /// <summary>
    /// RWA: record payment. In the pilot this is a UPI/NEFT reference typed in by the treasurer;
    /// a Razorpay/PhonePe checkout can call the same endpoint from its webhook later.
    /// </summary>
    [HttpPost("{id:int}/pay")]
    [Authorize(Roles = "Rwa,Admin")]
    public async Task<ActionResult<InvoiceDto>> Pay(int id, PayInvoiceRequest request)
    {
        var i = await Scoped().FirstOrDefaultAsync(x => x.Id == id);
        if (i is null) return NotFound();
        if (i.Status != InvoiceStatus.Issued) return BadRequest(new { message = $"Invoice is {i.Status}." });
        i.Status = InvoiceStatus.Paid;
        i.PaidAt = DateTime.UtcNow;
        i.PaymentMethod = string.IsNullOrWhiteSpace(request.Method) ? "UPI" : request.Method.Trim();
        i.PaymentReference = request.Reference?.Trim();
        await _db.SaveChangesAsync();
        return InvoiceDto.From(i);
    }

    /// <summary>Operator: mark an invoice paid (cash / cheque received) or cancel it and release its deliveries.</summary>
    [HttpPost("{id:int}/mark-paid")]
    [Authorize(Roles = "Operator,Admin")]
    public async Task<ActionResult<InvoiceDto>> MarkPaid(int id, PayInvoiceRequest request)
    {
        var i = await Scoped().FirstOrDefaultAsync(x => x.Id == id);
        if (i is null) return NotFound();
        if (i.Status != InvoiceStatus.Issued) return BadRequest(new { message = $"Invoice is {i.Status}." });
        i.Status = InvoiceStatus.Paid; i.PaidAt = DateTime.UtcNow;
        i.PaymentMethod = string.IsNullOrWhiteSpace(request.Method) ? "Cash" : request.Method.Trim();
        i.PaymentReference = request.Reference?.Trim();
        await _db.SaveChangesAsync();
        return InvoiceDto.From(i);
    }

    [HttpPost("{id:int}/cancel")]
    [Authorize(Roles = "Operator,Admin")]
    public async Task<ActionResult<InvoiceDto>> Cancel(int id)
    {
        var i = await Scoped().FirstOrDefaultAsync(x => x.Id == id);
        if (i is null) return NotFound();
        if (i.Status == InvoiceStatus.Paid) return BadRequest(new { message = "Paid invoices cannot be cancelled." });
        i.Status = InvoiceStatus.Cancelled;
        await _db.Deliveries.Where(d => d.InvoiceId == id).ExecuteUpdateAsync(s => s.SetProperty(d => d.InvoiceId, (int?)null));
        await _db.SaveChangesAsync();
        return InvoiceDto.From(i);
    }
}
