using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using StudyRoom.Api.Models;
using StudyRoom.Api.Services;

namespace StudyRoom.Api.Data;

public static class DbInitializer
{
    /// <summary>Applies pending migrations and seeds the first admin + settings row.</summary>
    public static async Task InitializeAsync(IServiceProvider services, IConfiguration config, ILogger logger)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var hasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher<Admin>>();

        await db.Database.MigrateAsync();

        if (!await db.Admins.AnyAsync())
        {
            var username = (config["Admin:Username"] ?? "admin").Trim().ToLowerInvariant();
            var password = config["Admin:Password"] ?? "admin123";
            var admin = new Admin { Username = username, DisplayName = config["Admin:DisplayName"] ?? "Administrator" };
            admin.PasswordHash = hasher.HashPassword(admin, password);
            db.Admins.Add(admin);
            logger.LogInformation("Seeded default admin '{Username}'. Change the password after first login.", username);
        }

        if (!await db.Settings.AnyAsync())
        {
            db.Settings.Add(new RoomSettings
            {
                RoomName = config["Room:Name"] ?? "BrightLoop Reading Room",
                DueSoonDays = int.TryParse(config["Room:DueSoonDays"], out var d) ? d : 5,
                TimeZoneId = config["Room:TimeZone"] ?? "Asia/Kolkata",
                Currency = config["Room:Currency"] ?? "INR",
            });
        }

        var branch = await db.Branches.OrderBy(b => b.Id).FirstOrDefaultAsync();
        if (branch is null)
        {
            branch = new Branch { Name = config["Room:BranchName"] ?? "Main Branch" };
            db.Branches.Add(branch);
            await db.SaveChangesAsync();
            logger.LogInformation("Created default branch '{Name}'.", branch.Name);
        }

        if (!await db.Seats.AnyAsync() && int.TryParse(config["Room:DefaultSeats"], out var seats) && seats > 0)
        {
            for (var n = 1; n <= seats; n++) db.Seats.Add(new Seat { BranchId = branch.Id, Number = n });
            logger.LogInformation("Seeded {Count} seats.", seats);
        }

        await db.SaveChangesAsync();

        // Keep reserved-for-women seats in line with the configured percentage (idempotent).
        await scope.ServiceProvider.GetRequiredService<SeatAllocationService>().ApplyReservationToAllAsync();
    }

    /// <summary>
    /// Builds an Npgsql connection string from either ConnectionStrings:Default or a
    /// DATABASE_URL style URI (postgres://user:pass@host:port/db) as provided by Render, Railway, Neon, Supabase, etc.
    /// </summary>
    public static string ResolveConnectionString(IConfiguration config)
    {
        var url = config["DATABASE_URL"];
        if (!string.IsNullOrWhiteSpace(url) && url.StartsWith("postgres", StringComparison.OrdinalIgnoreCase))
        {
            var uri = new Uri(url);
            var userInfo = uri.UserInfo.Split(':', 2);
            var user = Uri.UnescapeDataString(userInfo[0]);
            var pass = userInfo.Length > 1 ? Uri.UnescapeDataString(userInfo[1]) : "";
            var dbName = uri.AbsolutePath.TrimStart('/');
            var port = uri.Port > 0 ? uri.Port : 5432;
            var sslMode = config["DATABASE_SSL"] is { } s && s.Equals("false", StringComparison.OrdinalIgnoreCase) ? "Disable" : "Require";
            return $"Host={uri.Host};Port={port};Database={dbName};Username={user};Password={pass};SSL Mode={sslMode};Trust Server Certificate=true";
        }

        return config.GetConnectionString("Default")
            ?? throw new InvalidOperationException("No database configured. Set ConnectionStrings__Default or DATABASE_URL.");
    }
}
