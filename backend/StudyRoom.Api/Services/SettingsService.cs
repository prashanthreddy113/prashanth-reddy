using Microsoft.EntityFrameworkCore;
using StudyRoom.Api.Data;
using StudyRoom.Api.Models;

namespace StudyRoom.Api.Services;

/// <summary>Loads the single settings row (creating it if missing) and resolves "today" in the configured time zone.</summary>
public class SettingsService
{
    private readonly AppDbContext _db;

    public SettingsService(AppDbContext db) => _db = db;

    /// <summary>The app runs a single branch; every seat, student and expense belongs to it.</summary>
    public async Task<int> DefaultBranchIdAsync(CancellationToken ct = default)
    {
        var id = await _db.Branches.OrderBy(b => b.Id).Select(b => (int?)b.Id).FirstOrDefaultAsync(ct);
        if (id.HasValue) return id.Value;
        var branch = new Branch { Name = "Main" };
        _db.Branches.Add(branch);
        await _db.SaveChangesAsync(ct);
        return branch.Id;
    }

    public async Task<RoomSettings> GetAsync(CancellationToken ct = default)
    {
        var settings = await _db.Settings.OrderBy(s => s.Id).FirstOrDefaultAsync(ct);
        if (settings is null)
        {
            settings = new RoomSettings();
            _db.Settings.Add(settings);
            await _db.SaveChangesAsync(ct);
        }
        return settings;
    }

    public static DateOnly Today(RoomSettings settings) => DateOnly.FromDateTime(LocalNow(settings));

    public static DateTime LocalNow(RoomSettings settings)
    {
        try
        {
            var tz = TimeZoneInfo.FindSystemTimeZoneById(settings.TimeZoneId);
            return TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, tz);
        }
        catch (Exception)
        {
            return DateTime.UtcNow;
        }
    }
}
