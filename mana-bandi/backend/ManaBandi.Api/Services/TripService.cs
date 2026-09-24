using System.Security.Cryptography;
using System.Text;
using ManaBandi.Api.Data;
using ManaBandi.Api.Infrastructure;
using ManaBandi.Api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace ManaBandi.Api.Services;

public class LocationPointInput
{
    public double Lat { get; set; }
    public double Lng { get; set; }
    public double? Accuracy { get; set; }
    public double? Speed { get; set; }
    public double? Heading { get; set; }
    public DateTime? At { get; set; }
}

/// <summary>Captain side: heartbeat, offers, the trip state machine and earnings.</summary>
public class TripService
{
    private readonly AppDbContext _db;
    private readonly AccountService _accounts;
    private readonly CommissionService _commission;
    private readonly SettlementService _settlements;
    private readonly AreaService _area;
    private readonly IClock _clock;
    private readonly DispatchOptions _dispatch;

    public TripService(AppDbContext db, AccountService accounts, CommissionService commission, SettlementService settlements,
        AreaService area, IClock clock, IOptions<DispatchOptions> dispatch)
    {
        _db = db;
        _accounts = accounts;
        _commission = commission;
        _settlements = settlements;
        _area = area;
        _clock = clock;
        _dispatch = dispatch.Value;
    }

    private IQueryable<Ride> TripQuery(string captainId) =>
        _db.Rides.Include(r => r.Rider).Include(r => r.Events)
            .Where(r => r.CaptainId == captainId &&
                        (r.Status == RideStatus.Accepted || r.Status == RideStatus.Arrived || r.Status == RideStatus.Started ||
                         (r.Status == RideStatus.Finished && r.CollectedAt == null)));

    public Task<Ride?> CurrentTripAsync(string captainId, CancellationToken ct = default) =>
        TripQuery(captainId).OrderByDescending(r => r.AcceptedAt).FirstOrDefaultAsync(ct);

    private async Task<Ride> RequireTripAsync(Captain c, CancellationToken ct) =>
        await CurrentTripAsync(c.Id, ct) ?? throw new ApiException(404, "not_found", "You have no active trip");

    public async Task<object> TripViewAsync(Ride r, Captain c, CancellationToken ct = default)
    {
        CommissionResult commission;
        if (r.CommissionPct is { } pct && r.CommissionAmount is { } amt && r.FareFinal is { } ff)
            commission = new CommissionResult(pct, amt, ff - amt, r.CommissionRule ?? "", r.CommissionRule ?? "");
        else
            commission = await _commission.ResolveAsync(r.TownId, r.Service, r.FareQuoted, c.JoinedAt, ct);
        return Views.ForCaptain(r, commission);
    }

    // ---------------------------------------------------------------- online / heartbeat

    public async Task SetOnlineAsync(Captain c, bool online, double? lat, double? lng, CancellationToken ct = default)
    {
        var now = _clock.UtcNow;
        if (online)
        {
            if (c.Status != CaptainStatus.Verified)
                throw new ApiException(403, "kyc_required", c.Status == CaptainStatus.Blocked ? "Your account is blocked. Call the town office." : "Your documents are not verified yet");
            if (c.PoliceStatus != "done" && c.ApprovedAt is { } ap && now - ap > TimeSpan.FromDays(30))
                throw new ApiException(403, "kyc_required", "Police verification certificate is pending for more than 30 days. Upload it at the office.");
            if (lat is null || lng is null || !Geo.ValidLatLng(lat.Value, lng.Value))
                throw ApiException.Validation("Your location is needed to go online");
            if (c.TownId is null)
            {
                var towns = await _area.EnabledTownsAsync(ct);
                c.TownId = towns.Select(t => (t, d: AreaService.DistanceFromCenter(t, lat.Value, lng.Value)))
                    .Where(x => x.d <= x.t.ExtendedRadiusKm).OrderBy(x => x.d).Select(x => x.t.Id).FirstOrDefault();
            }
            var townId = c.TownId;
            // ExecuteUpdate (no row-version check) so a heartbeat in flight never makes this fail
            await _db.Captains.Where(x => x.Id == c.Id).ExecuteUpdateAsync(s => s
                .SetProperty(x => x.Online, true).SetProperty(x => x.TownId, townId)
                .SetProperty(x => x.LastLat, lat).SetProperty(x => x.LastLng, lng)
                .SetProperty(x => x.LastSeenAt, now).SetProperty(x => x.LastPointAt, now), ct);
            c.Online = true;
            c.LastLat = lat;
            c.LastLng = lng;
            c.LastSeenAt = now;
            c.LastPointAt = now;
        }
        else
        {
            await _db.Captains.Where(x => x.Id == c.Id).ExecuteUpdateAsync(s => s.SetProperty(x => x.Online, false), ct);
            c.Online = false;
            await _db.Offers.Where(o => o.CaptainId == c.Id && o.Status == OfferStatus.Pending)
                .ExecuteUpdateAsync(s => s.SetProperty(o => o.Status, OfferStatus.Rejected).SetProperty(o => o.RespondedAt, now), ct);
        }
        if (_db.Entry(c).State != EntityState.Detached) _db.Entry(c).State = EntityState.Detached; // values already written above; never save this copy
    }

    public async Task<object> HeartbeatAsync(Captain c, List<LocationPointInput>? points, CancellationToken ct = default)
    {
        if (points is null || points.Count is < 1 or > 20) throw ApiException.Validation("Send 1 to 20 points");
        var now = _clock.UtcNow;
        var clean = new List<LocationPoint>();
        foreach (var p in points)
        {
            if (!Geo.ValidLatLng(p.Lat, p.Lng)) throw ApiException.Validation("Invalid point coordinates");
            if (p.Accuracy is < 0 or > 100000 || p.Speed is < 0 or > 150 || p.Heading is < 0 or > 360)
                throw ApiException.Validation("Invalid accuracy, speed or heading");
            var at = p.At is { } a ? DateTime.SpecifyKind(a.ToUniversalTime(), DateTimeKind.Utc) : now;
            if (at > now.AddMinutes(2)) at = now;          // phone clock ahead: trust the server
            if (at < now.AddHours(-24)) continue;           // too old to be useful
            clean.Add(new LocationPoint { CaptainId = c.Id, Lat = p.Lat, Lng = p.Lng, Accuracy = p.Accuracy, Speed = p.Speed, Heading = p.Heading, At = at, ReceivedAt = now });
        }

        var activeRideId = await _db.Rides.Where(r => r.CaptainId == c.Id && RideStatus.Active.Contains(r.Status))
            .Select(r => r.Id).FirstOrDefaultAsync(ct);
        if (clean.Count > 0 && (c.Online || activeRideId != null))
        {
            foreach (var p in clean) p.RideId = activeRideId;
            _db.LocationPoints.AddRange(clean);
            await _db.SaveChangesAsync(ct);
            var newest = clean.OrderBy(p => p.At).Last();
            if (c.LastPointAt is null || newest.At >= c.LastPointAt)
            {
                await _db.Captains.Where(x => x.Id == c.Id).ExecuteUpdateAsync(s => s
                    .SetProperty(x => x.LastLat, newest.Lat).SetProperty(x => x.LastLng, newest.Lng)
                    .SetProperty(x => x.LastHeading, newest.Heading).SetProperty(x => x.LastPointAt, newest.At)
                    .SetProperty(x => x.LastSeenAt, now), ct);
            }
            else
            {
                await _db.Captains.Where(x => x.Id == c.Id).ExecuteUpdateAsync(s => s.SetProperty(x => x.LastSeenAt, now), ct);
            }
        }

        object? offer = null;
        if (c.Online && activeRideId is null)
        {
            var o = await _db.Offers.AsNoTracking().Include(x => x.Ride)
                .Where(x => x.CaptainId == c.Id && x.Status == OfferStatus.Pending && x.ExpiresAt > now && x.Ride!.Status == RideStatus.Searching)
                .OrderByDescending(x => x.CreatedAt).FirstOrDefaultAsync(ct);
            if (o != null) offer = Views.ForOffer(o, o.Ride!, now);
        }
        var trip = await CurrentTripAsync(c.Id, ct);
        return new { online = c.Online, offer, trip = trip is null ? null : await TripViewAsync(trip, c, ct), serverTime = now };
    }

    // ---------------------------------------------------------------- offers

    public async Task<Ride> AcceptAsync(Captain c, string offerId, CancellationToken ct = default)
    {
        var now = _clock.UtcNow;
        var offer = await _db.Offers.AsNoTracking().FirstOrDefaultAsync(o => o.Id == offerId && o.CaptainId == c.Id, ct)
                    ?? throw ApiException.NotFound("Offer not found");
        var ride = await _db.Rides.AsNoTracking().FirstAsync(r => r.Id == offer.RideId, ct);
        if (offer.Status == OfferStatus.Accepted && ride.CaptainId == c.Id && !RideStatus.IsTerminal(ride.Status))
            return (await CurrentTripAsync(c.Id, ct))!; // double tap on the same offer: idempotent
        if (c.Status != CaptainStatus.Verified) throw new ApiException(403, "kyc_required", "Your documents are not verified yet");
        if (ride.Status != RideStatus.Searching || ride.CaptainId != null)
            throw new ApiException(409, "offer_taken", "Another captain took this ride");
        if (offer.Status != OfferStatus.Pending || offer.ExpiresAt <= now)
            throw new ApiException(409, "offer_expired", "This request has expired");
        if (await CurrentTripAsync(c.Id, ct) != null) throw ApiException.InvalidState("Finish your current trip first");

        // Conditional UPDATE: only one captain can move the ride out of `searching`.
        var claimed = await _db.Rides
            .Where(r => r.Id == ride.Id && r.Status == RideStatus.Searching && r.CaptainId == null)
            .ExecuteUpdateAsync(s => s
                .SetProperty(r => r.Status, RideStatus.Accepted)
                .SetProperty(r => r.CaptainId, c.Id)
                .SetProperty(r => r.AcceptedAt, now)
                .SetProperty(r => r.UpdatedAt, now), ct);
        if (claimed == 0)
        {
            await _db.Offers.Where(o => o.Id == offer.Id && o.Status == OfferStatus.Pending)
                .ExecuteUpdateAsync(s => s.SetProperty(o => o.Status, OfferStatus.Taken).SetProperty(o => o.RespondedAt, now), ct);
            throw new ApiException(409, "offer_taken", "Another captain took this ride");
        }
        await _db.Offers.Where(o => o.Id == offer.Id)
            .ExecuteUpdateAsync(s => s.SetProperty(o => o.Status, OfferStatus.Accepted).SetProperty(o => o.RespondedAt, now), ct);
        await _db.Offers.Where(o => o.RideId == ride.Id && o.Id != offer.Id && o.Status == OfferStatus.Pending)
            .ExecuteUpdateAsync(s => s.SetProperty(o => o.Status, OfferStatus.Cancelled).SetProperty(o => o.RespondedAt, now), ct);
        _db.RideEvents.Add(new RideEvent { RideId = ride.Id, Type = "accepted", At = now, By = "captain", CaptainId = c.Id, Lat = c.LastLat, Lng = c.LastLng });
        await _db.SaveChangesAsync(ct);
        return await RequireTripAsync(c, ct);
    }

    public async Task RejectAsync(Captain c, string offerId, CancellationToken ct = default)
    {
        var exists = await _db.Offers.AnyAsync(o => o.Id == offerId && o.CaptainId == c.Id, ct);
        if (!exists) throw ApiException.NotFound("Offer not found");
        await _db.Offers.Where(o => o.Id == offerId && o.CaptainId == c.Id && o.Status == OfferStatus.Pending)
            .ExecuteUpdateAsync(s => s.SetProperty(o => o.Status, OfferStatus.Rejected).SetProperty(o => o.RespondedAt, _clock.UtcNow), ct);
    }

    // ---------------------------------------------------------------- trip state machine

    private static void Require(Ride r, params string[] allowed)
    {
        if (!allowed.Contains(r.Status)) throw ApiException.InvalidState($"Not allowed while the trip is {r.Status}");
    }

    private static bool SameCode(string? expected, string? given)
    {
        given = (given ?? "").Trim();
        if (string.IsNullOrEmpty(expected) || given.Length != expected.Length) return false;
        return CryptographicOperations.FixedTimeEquals(Encoding.ASCII.GetBytes(expected), Encoding.ASCII.GetBytes(given));
    }

    public async Task<Ride> ArrivedAsync(Captain c, CancellationToken ct = default)
    {
        var r = await RequireTripAsync(c, ct);
        Require(r, RideStatus.Accepted);
        var now = _clock.UtcNow;
        r.Status = RideStatus.Arrived;
        r.ArrivedAt = now;
        r.UpdatedAt = now;
        r.Events.Add(new RideEvent { RideId = r.Id, Type = "arrived", At = now, By = "captain", CaptainId = c.Id, Lat = c.LastLat, Lng = c.LastLng });
        await _db.SaveChangesAsync(ct);
        return r;
    }

    public async Task<Ride> StartAsync(Captain c, string? otp, CancellationToken ct = default)
    {
        var r = await RequireTripAsync(c, ct);
        Require(r, RideStatus.Arrived);
        if (!SameCode(r.Otp, otp)) throw new ApiException(422, "wrong_ride_otp", "Wrong OTP. Ask the rider for the 4-digit code.");
        var now = _clock.UtcNow;
        r.Status = RideStatus.Started;
        r.StartedAt = now;
        r.PickupOtpVerified = true;
        r.UpdatedAt = now;
        r.Events.Add(new RideEvent { RideId = r.Id, Type = "started", At = now, By = "captain", CaptainId = c.Id, Lat = c.LastLat, Lng = c.LastLng });
        await _db.SaveChangesAsync(ct);
        return r;
    }

    public async Task<Ride> DeliverAsync(Captain c, string? deliveryOtp, CancellationToken ct = default)
    {
        var r = await RequireTripAsync(c, ct);
        if (!r.IsParcel) throw ApiException.InvalidState("Only parcels have a delivery OTP");
        Require(r, RideStatus.Started);
        if (r.DeliveryOtpVerified) throw ApiException.InvalidState("Parcel already delivered");
        if (!SameCode(r.DeliveryOtp, deliveryOtp)) throw new ApiException(422, "wrong_ride_otp", "Wrong delivery OTP. Ask the receiver for the code.");
        var now = _clock.UtcNow;
        r.DeliveryOtpVerified = true;
        r.DeliveredAt = now;
        r.UpdatedAt = now;
        r.Events.Add(new RideEvent { RideId = r.Id, Type = "delivered", At = now, By = "captain", CaptainId = c.Id, Lat = c.LastLat, Lng = c.LastLng });
        await _db.SaveChangesAsync(ct);
        return r;
    }

    /// <summary>
    /// Final fare: the GPS trail length is used when it is longer than the straight line and shorter than 2× it;
    /// otherwise the quote stands. Commission is frozen on the ride here.
    /// </summary>
    public async Task<Ride> FinishAsync(Captain c, double? lat, double? lng, CancellationToken ct = default)
    {
        var r = await RequireTripAsync(c, ct);
        Require(r, RideStatus.Started);
        if (r.IsParcel && !r.DeliveryOtpVerified) throw ApiException.InvalidState("Enter the receiver's delivery OTP first");
        var now = _clock.UtcNow;
        if (lat is { } la && lng is { } lo)
        {
            if (!Geo.ValidLatLng(la, lo)) throw ApiException.Validation("Invalid location");
            _db.LocationPoints.Add(new LocationPoint { CaptainId = c.Id, RideId = r.Id, Lat = la, Lng = lo, At = now, ReceivedAt = now });
            await _db.SaveChangesAsync(ct);
        }

        var from = (r.StartedAt ?? now).AddSeconds(-5);
        var pts = await _db.LocationPoints.AsNoTracking()
            .Where(p => p.RideId == r.Id && p.At >= from)
            .OrderBy(p => p.At).ThenBy(p => p.Id)
            .Select(p => new { p.Lat, p.Lng, p.At, p.Accuracy })
            .ToListAsync(ct);
        double trail = 0;
        var good = pts.Where(p => p.Accuracy is null or <= 100).ToList();
        for (var i = 1; i < good.Count; i++)
        {
            var d = Geo.HaversineKm(good[i - 1].Lat, good[i - 1].Lng, good[i].Lat, good[i].Lng);
            var hours = (good[i].At - good[i - 1].At).TotalHours;
            if (d > 0.5 && (hours <= 0 || d / hours > 150)) continue; // GPS jump: far and impossibly fast
            trail += d;
        }
        var straight = Geo.HaversineKm(r.PickupLat, r.PickupLng, r.DropLat, r.DropLng);
        r.TripKmGps = Math.Round(trail, 2);
        var fare = r.FareQuoted;
        if (trail > straight && trail < 2 * straight)
        {
            var town = await _db.Towns.AsNoTracking().FirstAsync(t => t.Id == r.TownId, ct);
            fare = AreaService.FareFor(town, r.Service, Geo.Round1(r.TripKmGps.Value), r.ParcelSize, r.Night);
        }
        var res = await _commission.ResolveAsync(r.TownId, r.Service, fare, c.JoinedAt, ct);
        r.FareFinal = fare;
        r.CommissionPct = res.Pct;
        r.CommissionAmount = res.Commission;
        r.CommissionRule = res.Reason.Length > 200 ? res.Reason[..200] : res.Reason;
        r.Status = RideStatus.Finished;
        r.FinishedAt = now;
        r.EndedAt = now;
        r.UpdatedAt = now;
        r.Events.Add(new RideEvent { RideId = r.Id, Type = "finished", At = now, By = "captain", CaptainId = c.Id, Lat = lat, Lng = lng });
        await _db.SaveChangesAsync(ct);
        return r;
    }

    public async Task<object> CollectedAsync(Captain c, string? method, CancellationToken ct = default)
    {
        if (method is not ("cash" or "upi")) throw ApiException.Validation("method must be cash or upi");
        var r = await RequireTripAsync(c, ct);
        Require(r, RideStatus.Finished);
        var now = _clock.UtcNow;
        r.CollectedAt = now;
        r.Paid = true;
        r.PaidMethod = method;
        if (r.CodAmount > 0) r.CodCollected = true;
        r.UpdatedAt = now;
        r.Events.Add(new RideEvent { RideId = r.Id, Type = "collected", At = now, By = "captain", CaptainId = c.Id, Reason = method });
        await _db.SaveChangesAsync(ct);
        var today = await TotalsAsync(c.Id, Ist.StartUtc(Ist.Today(_clock)), ct);
        return new { ok = true, earningsToday = today.net, tripsToday = today.trips };
    }

    public async Task CancelByCaptainAsync(Captain c, string? reason, CancellationToken ct = default)
    {
        var r = await RequireTripAsync(c, ct);
        Require(r, RideStatus.Accepted, RideStatus.Arrived);
        var now = _clock.UtcNow;
        r.Status = RideStatus.Searching;
        r.CaptainId = null;
        r.AcceptedAt = null;
        r.ArrivedAt = null;
        r.SearchStartedAt = now;
        r.UpdatedAt = now;
        r.Events.Add(new RideEvent { RideId = r.Id, Type = "reassigning", At = now, By = "captain", CaptainId = c.Id, Reason = RideService.Trim(reason, 200) });
        await _db.SaveChangesAsync(ct);
    }

    // ---------------------------------------------------------------- earnings

    private async Task<(int gross, int commission, int net, int trips)> TotalsAsync(string captainId, DateTime fromUtc, CancellationToken ct)
    {
        var rows = await _db.Rides.AsNoTracking()
            .Where(r => r.CaptainId == captainId && r.Status == RideStatus.Finished && r.FinishedAt >= fromUtc)
            .Select(r => new { fare = r.FareFinal ?? 0, com = r.CommissionAmount ?? 0 }).ToListAsync(ct);
        var gross = rows.Sum(x => x.fare);
        var com = rows.Sum(x => x.com);
        return (gross, com, gross - com, rows.Count);
    }

    public async Task<object> EarningsAsync(Captain c, CancellationToken ct = default)
    {
        var today = Ist.Today(_clock);
        var t = await TotalsAsync(c.Id, Ist.StartUtc(today), ct);
        var weekStart = Ist.WeekStart(today);
        var w = await TotalsAsync(c.Id, Ist.StartUtc(weekStart), ct);
        var stl = await _settlements.ForCaptainAsync(c, weekStart, ct);
        var trips = await _db.Rides.AsNoTracking()
            .Where(r => r.CaptainId == c.Id && r.Status == RideStatus.Finished)
            .OrderByDescending(r => r.FinishedAt).Take(50)
            .Select(r => new { rideId = r.Id, service = r.Service, dropName = r.DropName, fare = r.FareFinal ?? 0, commission = r.CommissionAmount ?? 0, payment = r.PaidMethod ?? r.Payment, finishedAt = r.FinishedAt })
            .ToListAsync(ct);
        return new
        {
            today = new { gross = t.gross, commission = t.commission, net = t.net, trips = t.trips },
            week = new { gross = w.gross, commission = w.commission, net = w.net, trips = w.trips, from = weekStart.ToString("yyyy-MM-dd") },
            settlementDue = stl is null || stl.Status == "paid" ? 0 : stl.Payout,
            commission = await _commission.CaptainCommissionAsync(c, ct),
            trips,
        };
    }
}
