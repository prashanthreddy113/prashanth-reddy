using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using WaterTanker.Api.Models;
using WaterTanker.Api.Services;

namespace WaterTanker.Api.Data;

public static class DbInitializer
{
    /// <summary>Applies pending migrations, seeds the platform admin and (optionally) a demo operator + communities.</summary>
    public static async Task InitializeAsync(IServiceProvider services, IConfiguration config, ILogger logger)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var hasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher<User>>();

        await db.Database.MigrateAsync();

        if (!await db.Users.AnyAsync(u => u.Role == UserRole.Admin))
        {
            var email = (config["Admin:Email"] ?? "admin@aquaproof.local").Trim().ToLowerInvariant();
            var admin = new User { Email = email, DisplayName = config["Admin:DisplayName"] ?? "Platform Admin", Role = UserRole.Admin };
            admin.PasswordHash = hasher.HashPassword(admin, config["Admin:Password"] ?? "admin123");
            db.Users.Add(admin);
            await db.SaveChangesAsync();
            logger.LogInformation("Seeded platform admin '{Email}'. Change the password after first login.", email);
        }

        if (config.GetValue("Demo:Seed", false) && !await db.Operators.AnyAsync())
        {
            await DemoSeeder.SeedAsync(db, hasher, scope.ServiceProvider.GetRequiredService<QualityService>());
            logger.LogInformation("Seeded demo operator, communities, devices and two weeks of deliveries. Logins: operator@demo.local / rwa@demo.local (password demo123). Device key for AQ-DEMO-0001: demo-device-key-0001");
        }
    }

    /// <summary>Accepts ConnectionStrings:Default or a DATABASE_URL URI (postgres://user:pass@host:port/db) as given by Render, Neon, Supabase, etc.</summary>
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
