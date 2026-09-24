using ManaBandi.Api.Data;
using ManaBandi.Api.Infrastructure;
using ManaBandi.Api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Npgsql;

namespace ManaBandi.Api.Services;

/// <summary>
/// One dispatch pass (docs/07 "Dispatch rules"):
/// expire offers → time out rides (no_captain) → offer each searching ride without a live offer to the nearest
/// eligible captain (verified, online, heartbeat fresh, free, vehicle matches, not offered this ride before)
/// within the search radii. Radii grow per round (3 → 5 → 8 km); when no captain is inside the current round's
/// radius the next radius is tried straight away so a rider never waits while a captain a little further is idle.
/// Runs under a Postgres advisory lock so only one app instance dispatches at a time.
/// </summary>
public class DispatchEngine
{
    private const long LockKey = 72_010_001;
    private readonly AppDbContext _db;
    private readonly DispatchOptions _opt;
    private readonly IClock _clock;
    private readonly ILogger<DispatchEngine> _log;

    public DispatchEngine(AppDbContext db, IOptions<DispatchOptions> opt, IClock clock, ILogger<DispatchEngine> log)
    {
        _db = db;
        _opt = opt.Value;
        _clock = clock;
        _log = log;
    }

    public static string VehicleFor(Ride r) => r.Service switch
    {
        "parcel" => r.ParcelSize == "l" ? "auto" : "bike",
        var s => s,
    };

    public async Task<int> RunOnceAsync(CancellationToken ct = default)
    {
        var now = _clock.UtcNow;
        await using var tx = await _db.Database.BeginTransactionAsync(ct);
        var got = await _db.Database.SqlQuery<bool>($"SELECT pg_try_advisory_xact_lock({LockKey}) AS \"Value\"").SingleAsync(ct);
        if (!got) return 0;

        // 1. offers past their window
        await _db.Offers.Where(o => o.Status == OfferStatus.Pending && o.ExpiresAt <= now)
            .ExecuteUpdateAsync(s => s.SetProperty(o => o.Status, OfferStatus.Expired), ct);
        // 2. offers for rides that are no longer searching (accepted, cancelled…)
        await _db.Offers.Where(o => o.Status == OfferStatus.Pending && o.Ride!.Status != RideStatus.Searching)
            .ExecuteUpdateAsync(s => s.SetProperty(o => o.Status, OfferStatus.Cancelled), ct);
        // 3. captains whose app stopped reporting for 15 min are switched offline
        var goneBefore = now.AddMinutes(-15);
        await _db.Captains.Where(c => c.Online && c.LastSeenAt < goneBefore)
            .ExecuteUpdateAsync(s => s.SetProperty(c => c.Online, false), ct);

        // 4. searching too long → no_captain
        var timeoutBefore = now.AddSeconds(-_opt.MaxSearchSeconds);
        var timedOut = await _db.Rides.Where(r => r.Status == RideStatus.Searching && r.SearchStartedAt <= timeoutBefore)
            .Select(r => r.Id).ToListAsync(ct);
        foreach (var id in timedOut)
        {
            var n = await _db.Rides.Where(r => r.Id == id && r.Status == RideStatus.Searching)
                .ExecuteUpdateAsync(s => s.SetProperty(r => r.Status, RideStatus.NoCaptain).SetProperty(r => r.EndedAt, now).SetProperty(r => r.UpdatedAt, now), ct);
            if (n == 0) continue;
            await _db.Offers.Where(o => o.RideId == id && o.Status == OfferStatus.Pending)
                .ExecuteUpdateAsync(s => s.SetProperty(o => o.Status, OfferStatus.Cancelled), ct);
            _db.RideEvents.Add(new RideEvent { RideId = id, Type = "no_captain", At = now, Reason = $"No captain accepted in {_opt.MaxSearchSeconds} s" });
            _log.LogWarning("Ride {RideId} → no_captain after {Seconds} s", id, _opt.MaxSearchSeconds);
        }

        // 5. new offers
        var rides = await _db.Rides.AsNoTracking().Include(r => r.Rider)
            .Where(r => r.Status == RideStatus.Searching && !_db.Offers.Any(o => o.RideId == r.Id && o.Status == OfferStatus.Pending))
            .OrderBy(r => r.CreatedAt).Take(200).ToListAsync(ct);
        var created = 0;
        if (rides.Count > 0)
        {
            var staleBefore = now.AddSeconds(-_opt.HeartbeatStaleSeconds);
            var captains = await _db.Captains.AsNoTracking()
                .Where(c => c.Status == CaptainStatus.Verified && c.Online && c.LastSeenAt >= staleBefore && c.LastLat != null && c.LastLng != null)
                .Select(c => new { c.Id, c.VehicleType, Lat = c.LastLat!.Value, Lng = c.LastLng!.Value, c.User!.Phone })
                .ToListAsync(ct);
            var busy = (await _db.Rides.Where(r => r.CaptainId != null &&
                        (r.Status == RideStatus.Accepted || r.Status == RideStatus.Arrived || r.Status == RideStatus.Started ||
                         (r.Status == RideStatus.Finished && r.CollectedAt == null)))
                    .Select(r => r.CaptainId!).ToListAsync(ct)).ToHashSet();
            busy.UnionWith(await _db.Offers.Where(o => o.Status == OfferStatus.Pending).Select(o => o.CaptainId).ToListAsync(ct));
            var rideIds = rides.Select(r => r.Id).ToList();
            var alreadyOffered = (await _db.Offers.Where(o => rideIds.Contains(o.RideId)).Select(o => new { o.RideId, o.CaptainId }).ToListAsync(ct))
                .Select(x => (x.RideId, x.CaptainId)).ToHashSet();
            var radii = _opt.Radii();
            var free = captains.Where(c => !busy.Contains(c.Id)).ToList();

            foreach (var r in rides)
            {
                var vt = VehicleFor(r);
                var best = free
                    .Where(c => c.VehicleType == vt && !alreadyOffered.Contains((r.Id, c.Id)) && c.Phone != r.Rider?.Phone)
                    .Select(c => (c, d: Geo.HaversineKm(c.Lat, c.Lng, r.PickupLat, r.PickupLng)))
                    .Where(x => x.d <= radii[^1])
                    .OrderBy(x => x.d)
                    .FirstOrDefault();
                if (best.c is null) continue;
                var round = Array.FindIndex(radii, x => best.d <= x) + 1;
                _db.Offers.Add(new Offer
                {
                    Id = IdGen.New("o"), RideId = r.Id, CaptainId = best.c.Id, CreatedAt = now,
                    ExpiresAt = now.AddSeconds(_opt.OfferSeconds), Status = OfferStatus.Pending,
                    DistanceToPickupKm = best.d, Round = round,
                });
                free.Remove(best.c);
                created++;
            }
        }
        try
        {
            await _db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            // a captain/ride got a live offer concurrently; the next tick retries
            _log.LogInformation("Dispatch tick skipped: concurrent offer");
            return 0;
        }
        return created;
    }
}

/// <summary>Hosted loop that runs <see cref="DispatchEngine"/> every Dispatch:TickMs (1 s).</summary>
public class DispatchService : BackgroundService
{
    private readonly IServiceScopeFactory _scopes;
    private readonly DispatchOptions _opt;
    private readonly ILogger<DispatchService> _log;

    public DispatchService(IServiceScopeFactory scopes, IOptions<DispatchOptions> opt, ILogger<DispatchService> log)
    {
        _scopes = scopes;
        _opt = opt.Value;
        _log = log;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!_opt.Enabled)
        {
            _log.LogWarning("Dispatch is disabled (Dispatch:Enabled=false)");
            return;
        }
        _log.LogInformation("Dispatch running: offer {Offer} s, radii {Radii} km, max search {Max} s", _opt.OfferSeconds, _opt.RadiiKm, _opt.MaxSearchSeconds);
        using var timer = new PeriodicTimer(TimeSpan.FromMilliseconds(Math.Max(100, _opt.TickMs)));
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = _scopes.CreateScope();
                var n = await scope.ServiceProvider.GetRequiredService<DispatchEngine>().RunOnceAsync(stoppingToken);
                if (n > 0) _log.LogInformation("Dispatch created {Count} offer(s)", n);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _log.LogError(ex, "Dispatch tick failed");
            }
            try
            {
                if (!await timer.WaitForNextTickAsync(stoppingToken)) break;
            }
            catch (OperationCanceledException)
            {
                break;
            }
        }
    }
}
