using ManaBandi.Api.Data;
using ManaBandi.Api.Infrastructure;
using ManaBandi.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace ManaBandi.Api.Services;

/// <summary>User / captain profile views, terms state and captain lookups shared by several controllers.</summary>
public class AccountService
{
    private readonly AppDbContext _db;
    private readonly CommissionService _commission;
    private readonly IClock _clock;

    public AccountService(AppDbContext db, CommissionService commission, IClock clock)
    {
        _db = db;
        _commission = commission;
        _clock = clock;
    }

    public static string TermsKind(string role) => role == Roles.Captain ? "terms_captain" : "terms_rider";

    public async Task<string?> CurrentTermsVersionAsync(CancellationToken ct = default) =>
        await _db.TermsVersions.AsNoTracking().OrderByDescending(t => t.PublishedAt).ThenByDescending(t => t.Id).Select(t => t.Version).FirstOrDefaultAsync(ct);

    public async Task<string?> AcceptedTermsVersionAsync(User u, CancellationToken ct = default)
    {
        var kind = TermsKind(u.Role);
        return await _db.Consents.AsNoTracking().Where(c => c.UserId == u.Id && c.Kind == kind)
            .OrderByDescending(c => c.At).Select(c => c.Version).FirstOrDefaultAsync(ct);
    }

    public async Task EnsureTermsAcceptedAsync(User u, CancellationToken ct = default)
    {
        var current = await CurrentTermsVersionAsync(ct);
        if (current is null) return;
        var accepted = await AcceptedTermsVersionAsync(u, ct);
        if (accepted != current) throw new ApiException(403, "terms_required", $"Please accept the terms (version {current}) to continue");
    }

    public async Task<Dictionary<string, object?>> UserViewAsync(User u, CancellationToken ct = default)
    {
        if (Roles.IsAdmin(u.Role))
            return new Dictionary<string, object?> { ["id"] = u.Id, ["name"] = u.Name, ["email"] = u.Email, ["role"] = u.Role, ["townId"] = u.TownId };
        var current = await CurrentTermsVersionAsync(ct);
        var accepted = await AcceptedTermsVersionAsync(u, ct);
        var townId = u.TownId;
        if (u.Role == Roles.Captain)
            townId = await _db.Captains.AsNoTracking().Where(c => c.UserId == u.Id).Select(c => c.TownId).FirstOrDefaultAsync(ct);
        return new Dictionary<string, object?>
        {
            ["id"] = u.Id,
            ["role"] = u.Role,
            ["phone"] = u.Phone,
            ["name"] = u.Name,
            ["lang"] = u.Lang,
            ["termsVersionAccepted"] = accepted,
            ["termsCurrentVersion"] = current,
            ["termsRequired"] = current != null && accepted != current,
            ["townId"] = townId,
            ["trustedContactPhone"] = u.TrustedContactPhone,
        };
    }

    public Task<Captain?> LoadCaptainByUserAsync(string userId, CancellationToken ct = default) =>
        _db.Captains.Include(c => c.User).Include(c => c.Kyc).Include(c => c.Documents)
            .FirstOrDefaultAsync(c => c.UserId == userId, ct);

    public async Task<Captain> RequireCaptainAsync(string userId, CancellationToken ct = default) =>
        await LoadCaptainByUserAsync(userId, ct) ?? throw ApiException.NotFound("Captain profile not found");

    public async Task<object> CaptainMeAsync(Captain c, CancellationToken ct = default) => new
    {
        id = c.Id,
        name = c.User?.Name,
        status = c.Status,
        vehicleType = c.VehicleType,
        vehicleNo = c.VehicleNo,
        vehicleModel = c.VehicleModel,
        townId = c.TownId,
        online = c.Online,
        rating = c.Rating,
        joinedAt = c.JoinedAt.ToString("yyyy-MM-dd"),
        policeStatus = c.PoliceStatus,
        rejectReason = c.RejectReason,
        blockReason = c.BlockReason,
        kyc = Views.KycSummary(c),
        commission = await _commission.CaptainCommissionAsync(c, ct),
    };

    /// <summary>Creates the captain profile (pending) for a captain user if it does not exist yet.</summary>
    public async Task<Captain> EnsureCaptainAsync(User u, CancellationToken ct = default)
    {
        var c = await LoadCaptainByUserAsync(u.Id, ct);
        if (c != null) return c;
        c = new Captain
        {
            Id = IdGen.New("c"),
            UserId = u.Id,
            User = u,
            Status = CaptainStatus.Pending,
            JoinedAt = Ist.Today(_clock),
            CreatedAt = _clock.UtcNow,
            Kyc = new CaptainKyc(),
        };
        c.Kyc.CaptainId = c.Id;
        _db.Captains.Add(c);
        await _db.SaveChangesAsync(ct);
        return c;
    }

    public async Task<Dictionary<string, Views.CaptainStats>> StatsAsync(IEnumerable<string> captainIds, CancellationToken ct = default)
    {
        var ids = captainIds.Distinct().ToList();
        var todayStart = Ist.StartUtc(Ist.Today(_clock));
        var rows = await _db.Rides.AsNoTracking()
            .Where(r => r.CaptainId != null && ids.Contains(r.CaptainId) && r.Status == RideStatus.Finished)
            .GroupBy(r => r.CaptainId!)
            .Select(g => new { id = g.Key, trips = g.Count(), today = g.Count(r => r.FinishedAt >= todayStart) })
            .ToListAsync(ct);
        var dict = rows.ToDictionary(x => x.id, x => new Views.CaptainStats(x.trips, x.today));
        foreach (var id in ids) dict.TryAdd(id, new Views.CaptainStats(0, 0));
        return dict;
    }
}
