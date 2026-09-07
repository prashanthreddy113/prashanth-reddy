using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WaterTanker.Api.Data;
using WaterTanker.Api.Dtos;
using WaterTanker.Api.Models;
using WaterTanker.Api.Services;

namespace WaterTanker.Api.Controllers;

[ApiController]
[Route("api/dashboard")]
[Authorize]
public class DashboardController : ControllerBase
{
    private static readonly TimeSpan OnlineWindow = TimeSpan.FromMinutes(10);
    private readonly AppDbContext _db;
    public DashboardController(AppDbContext db) => _db = db;

    [HttpGet]
    public async Task<ActionResult> Get([FromQuery] string? timeZone)
    {
        var tz = ResolveTz(timeZone ?? "Asia/Kolkata");
        var nowLocal = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, tz);
        var todayStart = TimeZoneInfo.ConvertTimeToUtc(nowLocal.Date, tz);
        var monthStart = TimeZoneInfo.ConvertTimeToUtc(new DateTime(nowLocal.Year, nowLocal.Month, 1), tz);
        var last30 = DateTime.UtcNow.AddDays(-30);

        var q = _db.Deliveries.AsQueryable();
        var role = User.Role();
        if (role == UserRole.Operator) q = q.Where(d => d.OperatorId == User.OperatorId());
        if (role == UserRole.Rwa) q = q.Where(d => d.CommunityId == User.CommunityId());
        var billable = q.Where(d => d.Status != DeliveryStatus.Discarded && d.Status != DeliveryStatus.InProgress);

        var today = await billable.Where(d => d.StartedAt >= todayStart).GroupBy(_ => 1)
            .Select(g => new { Count = g.Count(), Litres = g.Sum(d => d.LitresDelivered), Amount = g.Sum(d => d.Amount) }).FirstOrDefaultAsync();
        var month = await billable.Where(d => d.StartedAt >= monthStart).GroupBy(_ => 1)
            .Select(g => new { Count = g.Count(), Litres = g.Sum(d => d.LitresDelivered), Amount = g.Sum(d => d.Amount) }).FirstOrDefaultAsync();

        var quality = await billable.Where(d => d.StartedAt >= last30).GroupBy(d => d.QualityGrade)
            .Select(g => new { Grade = g.Key.ToString(), Count = g.Count() }).ToListAsync();

        var perDay = await billable.Where(d => d.StartedAt >= last30.Date)
            .GroupBy(d => d.StartedAt.Date)
            .Select(g => new { Day = g.Key, Count = g.Count(), Litres = g.Sum(d => d.LitresDelivered) })
            .OrderBy(x => x.Day).ToListAsync();

        var inProgress = await q.Where(d => d.Status == DeliveryStatus.InProgress).CountAsync();
        var awaitingVerify = await q.Where(d => d.Status == DeliveryStatus.Completed).CountAsync();
        var disputed = await q.Where(d => d.Status == DeliveryStatus.Disputed).CountAsync();
        var shortLoads = await billable.Where(d => d.StartedAt >= last30 && d.Tanker != null && d.LitresDelivered < d.Tanker.CapacityLitres * 0.85m).CountAsync();

        var recent = await q.Include(d => d.Tanker).Include(d => d.Community).Include(d => d.Operator).Include(d => d.Device)
            .OrderByDescending(d => d.StartedAt).Take(8).ToListAsync();

        object? fleet = null;
        object? bookings = null;
        object? money = null;

        if (role != UserRole.Rwa)
        {
            var devices = await _db.Devices.Include(d => d.Tanker)
                .Where(d => role == UserRole.Admin || d.OperatorId == User.OperatorId()).ToListAsync();
            fleet = new
            {
                Tankers = await _db.Tankers.CountAsync(t => (role == UserRole.Admin || t.OperatorId == User.OperatorId()) && t.IsActive),
                Devices = devices.Count,
                Online = devices.Count(d => d.LastSeenAt is DateTime s && DateTime.UtcNow - s <= OnlineWindow),
                Tampered = devices.Count(d => d.Status == DeviceStatus.Tampered),
                Items = devices.Select(d => DeviceDto.From(d, OnlineWindow)).ToList(),
            };
            bookings = new
            {
                Pending = await _db.Bookings.CountAsync(b => (role == UserRole.Admin || b.OperatorId == User.OperatorId()) && b.Status == BookingStatus.Requested),
                Upcoming = await _db.Bookings.CountAsync(b => (role == UserRole.Admin || b.OperatorId == User.OperatorId()) && (b.Status == BookingStatus.Accepted || b.Status == BookingStatus.Dispatched)),
            };
            money = new
            {
                Outstanding = await _db.Invoices.Where(i => (role == UserRole.Admin || i.OperatorId == User.OperatorId()) && i.Status == InvoiceStatus.Issued).SumAsync(i => i.Amount),
                Uninvoiced = await billable.Where(d => d.InvoiceId == null && d.CommunityId != null).SumAsync(d => d.Amount),
            };
        }
        else
        {
            var cid = User.CommunityId();
            bookings = new
            {
                Pending = await _db.Bookings.CountAsync(b => b.CommunityId == cid && b.Status == BookingStatus.Requested),
                Upcoming = await _db.Bookings.CountAsync(b => b.CommunityId == cid && (b.Status == BookingStatus.Accepted || b.Status == BookingStatus.Dispatched)),
            };
            money = new
            {
                Outstanding = await _db.Invoices.Where(i => i.CommunityId == cid && i.Status == InvoiceStatus.Issued).SumAsync(i => i.Amount),
                Uninvoiced = await billable.Where(d => d.InvoiceId == null).SumAsync(d => d.Amount),
            };
        }

        return Ok(new
        {
            Role = role.ToString(),
            Today = new { today?.Count, Litres = today?.Litres ?? 0, Amount = today?.Amount ?? 0 },
            Month = new { month?.Count, Litres = month?.Litres ?? 0, Amount = month?.Amount ?? 0 },
            InProgress = inProgress, AwaitingVerification = awaitingVerify, Disputed = disputed, ShortLoads30d = shortLoads,
            Quality = quality, PerDay = perDay,
            Fleet = fleet, Bookings = bookings, Money = money,
            Recent = recent.Select(d => DeliveryDto.From(d)).ToList(),
        });
    }

    private static TimeZoneInfo ResolveTz(string id)
    {
        try { return TimeZoneInfo.FindSystemTimeZoneById(id); }
        catch { return TimeZoneInfo.Utc; }
    }
}
