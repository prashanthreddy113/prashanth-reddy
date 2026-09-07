using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WaterTanker.Api.Data;
using WaterTanker.Api.Dtos;
using WaterTanker.Api.Models;
using WaterTanker.Api.Services;

namespace WaterTanker.Api.Controllers;

[ApiController]
[Route("api/deliveries")]
[Authorize]
public class DeliveriesController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly DeliveryService _service;
    private readonly PhotoStorage _photos;

    public DeliveriesController(AppDbContext db, DeliveryService service, PhotoStorage photos)
    {
        _db = db; _service = service; _photos = photos;
    }

    private IQueryable<Delivery> Scoped()
    {
        var q = _db.Deliveries
            .Include(d => d.Operator).Include(d => d.Tanker).Include(d => d.Device)
            .Include(d => d.Community).Include(d => d.Invoice)
            .AsQueryable();
        return User.Role() switch
        {
            UserRole.Admin => q,
            UserRole.Operator => q.Where(d => d.OperatorId == User.OperatorId()),
            _ => q.Where(d => d.CommunityId == User.CommunityId() && d.Status != DeliveryStatus.Discarded),
        };
    }

    [HttpGet]
    public async Task<ActionResult<PagedResult<DeliveryDto>>> List(
        [FromQuery] DateTime? from, [FromQuery] DateTime? to, [FromQuery] DeliveryStatus? status,
        [FromQuery] int? communityId, [FromQuery] int? tankerId, [FromQuery] QualityGrade? grade,
        [FromQuery] int page = 1, [FromQuery] int pageSize = 25)
    {
        var q = Scoped();
        if (from is not null) q = q.Where(d => d.StartedAt >= DateTime.SpecifyKind(from.Value, DateTimeKind.Utc));
        if (to is not null) q = q.Where(d => d.StartedAt < DateTime.SpecifyKind(to.Value, DateTimeKind.Utc));
        if (status is not null) q = q.Where(d => d.Status == status);
        if (communityId is not null) q = q.Where(d => d.CommunityId == communityId);
        if (tankerId is not null) q = q.Where(d => d.TankerId == tankerId);
        if (grade is not null) q = q.Where(d => d.QualityGrade == grade);

        pageSize = Math.Clamp(pageSize, 1, 200);
        page = Math.Max(1, page);
        var total = await q.CountAsync();
        var items = await q.OrderByDescending(d => d.StartedAt).Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();
        var ids = items.Select(d => d.Id).ToList();
        var open = await _db.Disputes.Where(x => ids.Contains(x.DeliveryId) && x.Status == DisputeStatus.Open)
            .GroupBy(x => x.DeliveryId).Select(g => new { g.Key, Count = g.Count() }).ToDictionaryAsync(g => g.Key, g => g.Count);
        return new PagedResult<DeliveryDto>(items.Select(d => DeliveryDto.From(d, open.GetValueOrDefault(d.Id))).ToList(), total, page, pageSize);
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<DeliveryDetailDto>> Get(int id)
    {
        var d = await Scoped().FirstOrDefaultAsync(x => x.Id == id);
        if (d is null) return NotFound();

        var readings = await _db.Readings.Where(r => r.DeliveryId == id).OrderBy(r => r.RecordedAt).ToListAsync();
        // Downsample long sessions so the chart stays light.
        var step = Math.Max(1, readings.Count / 300);
        var points = readings.Where((_, i) => i % step == 0 || i == readings.Count - 1)
            .Select(r => new ReadingPoint(r.RecordedAt, r.FlowLpm, Math.Round(Math.Max(0, r.CumulativeLitres - d.StartCumulativeLitres), 1), r.TdsPpm, r.TurbidityNtu, r.Latitude, r.Longitude, r.Tamper))
            .ToList();

        var disputes = await _db.Disputes.Include(x => x.RaisedBy).Where(x => x.DeliveryId == id).OrderByDescending(x => x.CreatedAt)
            .Select(x => new DisputeDto(x.Id, x.DeliveryId, x.Reason, x.Status.ToString(), x.Resolution, x.RaisedBy!.DisplayName, x.CreatedAt, x.ResolvedAt, null, null, null))
            .ToListAsync();

        return new DeliveryDetailDto(DeliveryDto.From(d, disputes.Count(x => x.Status == "Open")), points, disputes);
    }

    /// <summary>Operator: attribute a delivery to a community when the geofence did not match (or fix a wrong match).</summary>
    [HttpPut("{id:int}/community")]
    [Authorize(Roles = "Operator,Admin")]
    public async Task<ActionResult<DeliveryDto>> AssignCommunity(int id, AssignCommunityRequest request)
    {
        var d = await Scoped().FirstOrDefaultAsync(x => x.Id == id);
        if (d is null) return NotFound();
        if (d.InvoiceId is not null) return BadRequest(new { message = "This delivery is already invoiced." });

        if (request.CommunityId is int cid)
        {
            var c = await _db.Communities.FindAsync(cid);
            if (c is null) return BadRequest(new { message = "Community not found." });
            d.CommunityId = cid;
            d.GeofenceMatched = d.Latitude is not null && GeoService.DistanceM(d.Latitude.Value, d.Longitude!.Value, c.Latitude, c.Longitude) <= c.GeofenceRadiusM;
            d.DistanceToCommunityM = d.Latitude is null ? null : Math.Round(GeoService.DistanceM(d.Latitude.Value, d.Longitude!.Value, c.Latitude, c.Longitude), 0);
            var rate = c.RatePerKl ?? d.Operator?.RatePerKl ?? d.RatePerKl;
            if (rate > 0) { d.RatePerKl = rate; d.Amount = Math.Round(d.LitresDelivered / 1000m * rate, 2); }
        }
        else
        {
            d.CommunityId = null; d.GeofenceMatched = false; d.DistanceToCommunityM = null;
        }
        await _db.SaveChangesAsync();
        await _db.Entry(d).Reference(x => x.Community).LoadAsync();
        return DeliveryDto.From(d);
    }

    [HttpPut("{id:int}/notes")]
    [Authorize(Roles = "Operator,Admin")]
    public async Task<ActionResult<DeliveryDto>> Notes(int id, NotesRequest request)
    {
        var d = await Scoped().FirstOrDefaultAsync(x => x.Id == id);
        if (d is null) return NotFound();
        d.Notes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim();
        await _db.SaveChangesAsync();
        return DeliveryDto.From(d);
    }

    /// <summary>Operator: force-close a delivery that is stuck in progress (device died mid-pump).</summary>
    [HttpPost("{id:int}/close")]
    [Authorize(Roles = "Operator,Admin")]
    public async Task<ActionResult<DeliveryDto>> Close(int id)
    {
        var d = await Scoped().FirstOrDefaultAsync(x => x.Id == id);
        if (d is null) return NotFound();
        if (d.Status != DeliveryStatus.InProgress) return BadRequest(new { message = "Delivery is not in progress." });
        await _service.FinaliseAsync(d);
        await _db.SaveChangesAsync();
        await _db.Entry(d).Reference(x => x.Community).LoadAsync();
        return DeliveryDto.From(d);
    }

    /// <summary>RWA: confirm the delivery (litres, quality and location look right).</summary>
    [HttpPost("{id:int}/verify")]
    [Authorize(Roles = "Rwa,Admin")]
    public async Task<ActionResult<DeliveryDto>> Verify(int id)
    {
        var d = await Scoped().FirstOrDefaultAsync(x => x.Id == id);
        if (d is null) return NotFound();
        if (d.Status is not (DeliveryStatus.Completed or DeliveryStatus.Disputed))
            return BadRequest(new { message = $"A {d.Status} delivery cannot be verified." });
        if (await _db.Disputes.AnyAsync(x => x.DeliveryId == id && x.Status == DisputeStatus.Open))
            return BadRequest(new { message = "Resolve the open dispute first." });
        d.Status = DeliveryStatus.Verified;
        d.VerifiedAt = DateTime.UtcNow;
        d.VerifiedByUserId = User.UserId();
        await _db.SaveChangesAsync();
        return DeliveryDto.From(d);
    }

    /// <summary>RWA: raise a dispute on a delivery.</summary>
    [HttpPost("{id:int}/dispute")]
    [Authorize(Roles = "Rwa,Admin")]
    public async Task<ActionResult<DisputeDto>> Dispute(int id, DisputeRequest request)
    {
        var d = await Scoped().FirstOrDefaultAsync(x => x.Id == id);
        if (d is null) return NotFound();
        if (string.IsNullOrWhiteSpace(request.Reason)) return BadRequest(new { message = "Give a reason." });
        if (d.Status == DeliveryStatus.InProgress) return BadRequest(new { message = "Wait for the delivery to finish." });
        if (await _db.Disputes.AnyAsync(x => x.DeliveryId == id && x.Status == DisputeStatus.Open))
            return BadRequest(new { message = "There is already an open dispute on this delivery." });

        var user = await _db.Users.FindAsync(User.UserId());
        var dispute = new Dispute { DeliveryId = id, RaisedByUserId = User.UserId(), Reason = request.Reason.Trim() };
        d.Status = DeliveryStatus.Disputed;
        d.VerifiedAt = null; d.VerifiedByUserId = null;
        _db.Disputes.Add(dispute);
        await _db.SaveChangesAsync();
        return new DisputeDto(dispute.Id, id, dispute.Reason, dispute.Status.ToString(), null, user?.DisplayName ?? "", dispute.CreatedAt, null, d.Community?.Name, d.StartedAt, d.LitresDelivered);
    }

    /// <summary>Driver/operator: upload the photo of the outlet seal taken at the delivery point.</summary>
    [HttpPost("{id:int}/seal-photo")]
    [Authorize(Roles = "Operator,Admin")]
    [RequestSizeLimit(10 * 1024 * 1024)]
    public async Task<ActionResult<DeliveryDto>> UploadSealPhoto(int id, IFormFile photo, CancellationToken ct)
    {
        var d = await Scoped().FirstOrDefaultAsync(x => x.Id == id, ct);
        if (d is null) return NotFound();
        if (photo is null || photo.Length == 0) return BadRequest(new { message = "Attach a photo." });
        try
        {
            d.SealPhotoPath = await _photos.SaveAsync(photo, $"seal-{id}", ct);
            d.SealPhotoAt = DateTime.UtcNow;
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        await _db.SaveChangesAsync(ct);
        return DeliveryDto.From(d);
    }

    [HttpGet("{id:int}/seal-photo")]
    public async Task<IActionResult> GetSealPhoto(int id)
    {
        var d = await Scoped().FirstOrDefaultAsync(x => x.Id == id);
        if (d?.SealPhotoPath is null) return NotFound();
        var opened = _photos.Open(d.SealPhotoPath);
        if (opened is null) return NotFound();
        return File(opened.Value.stream, opened.Value.contentType);
    }
}
