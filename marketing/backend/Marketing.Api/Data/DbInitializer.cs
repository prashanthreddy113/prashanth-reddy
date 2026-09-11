using Marketing.Api.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace Marketing.Api.Data;

public static class DbInitializer
{
    /// <summary>Applies pending migrations and seeds the first admin + company settings row.</summary>
    public static async Task InitializeAsync(IServiceProvider services, IConfiguration config, ILogger logger)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var hasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher<User>>();

        await db.Database.MigrateAsync();

        if (!await db.Users.AnyAsync(u => u.Role == UserRole.Admin))
        {
            var username = (config["Admin:Username"] ?? "admin").Trim().ToLowerInvariant();
            var password = config["Admin:Password"] ?? "admin123";
            var admin = new User
            {
                Username = username,
                DisplayName = config["Admin:DisplayName"] ?? "Administrator",
                Role = UserRole.Admin,
            };
            admin.PasswordHash = hasher.HashPassword(admin, password);
            db.Users.Add(admin);
            logger.LogInformation("Seeded default admin '{Username}'. Change the password after first login.", username);
        }

        if (!await db.Settings.AnyAsync())
        {
            db.Settings.Add(new CompanySettings
            {
                CompanyName = config["Company:Name"] ?? "My Company",
                Tagline = config["Company:Tagline"],
                Currency = config["Company:Currency"] ?? "INR",
                DefaultCountryCode = config["Company:DefaultCountryCode"] ?? "91",
                TimeZoneId = config["Company:TimeZone"] ?? "Asia/Kolkata",
            });
        }

        await db.SaveChangesAsync();
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
