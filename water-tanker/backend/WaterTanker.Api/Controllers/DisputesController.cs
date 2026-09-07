using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WaterTanker.Api.Data;
using WaterTanker.Api.Dtos;
using WaterTanker.Api.Models;
using WaterTanker.Api.Services;

namespace WaterTanker.Api.Controllers;

[ApiController]
[Route("api/disputes")]
[Authorize]
public class DisputesController : ControllerBase
{
    private readonly AppDbContext _db;
    public DisputesController(AppDbContext db) => _db = db;

    private IQueryable<Dispute> Scoped()
    {
        var q = _db.Disputes.Include(x => x.RaisedBy).Include(x => x.Delivery!).ThenInclude(d => d.Community).AsQueryable();
        return User.Role() switch
        {
            UserRole.Admin => q,
            UserRole.Operator => q.Where(x => x.Delivery!.OperatorId == User.OperatorId()),
            _ => q.Where(x => x.Delivery!.CommunityId == User.CommunityId()),
        };
    }

    private static DisputeDto Map(Dispute x) => new(x.Id, x.DeliveryId, x.Reason, x.Status.ToString(), x.Resolution, x.RaisedBy?.DisplayName ?? "",
        x.CreatedAt, x.ResolvedAt, x.Delivery?.Community?.Name, x.Delivery?.StartedAt, x.Delivery?.LitresDelivered);

    [HttpGet]
    public async Task<ActionResult<List<DisputeDto>>> List([FromQuery] DisputeStatus? status)
    {
        var q = Scoped();
        if (status is not null) q = q.Where(x => x.Status == status);
        var items = await q.OrderByDescending(x => x.CreatedAt).Take(200).ToListAsync();
        return items.Select(Map).ToList();
    }

    /// <summary>Operator: accept (optionally correcting the litres and amount) or reject a dispute.</summary>
    [HttpPost("{id:int}/resolve")]
    [Authorize(Roles = "Operator,Admin")]
    public async Task<ActionResult<DisputeDto>> Resolve(int id, ResolveDisputeRequest request)
    {
        var x = await Scoped().FirstOrDefaultAsync(d => d.Id == id);
        if (x is null) return NotFound();
        if (x.Status != DisputeStatus.Open) return BadRequest(new { message = "Dispute is already closed." });

        var delivery = x.Delivery!;
        if (request.Accept && request.AdjustedLitres is decimal litres)
        {
            if (litres < 0) return BadRequest(new { message = "Litres cannot be negative." });
            if (delivery.InvoiceId is not null) return BadRequest(new { message = "Delivery is invoiced; issue a credit instead of editing it." });
            delivery.Notes = $"{delivery.Notes}\nAdjusted from {delivery.LitresDelivered} L to {litres} L on dispute #{x.Id}.".Trim();
            delivery.LitresDelivered = litres;
            delivery.Amount = Math.Round(litres / 1000m * delivery.RatePerKl, 2);
        }
        x.Status = request.Accept ? DisputeStatus.Resolved : DisputeStatus.Rejected;
        x.Resolution = request.Resolution?.Trim();
        x.ResolvedAt = DateTime.UtcNow;
        x.ResolvedByUserId = User.UserId();
        delivery.Status = DeliveryStatus.Completed; // back to the RWA to verify
        await _db.SaveChangesAsync();
        return Map(x);
    }
}
