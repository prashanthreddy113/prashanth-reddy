using ManaBandi.Api.Infrastructure;
using ManaBandi.Api.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace ManaBandi.Api.Data;

public static class DbInitializer
{
    /// <summary>Applies migrations, then seeds launch configuration once per table (idempotent).</summary>
    public static async Task InitializeAsync(IServiceProvider services, IConfiguration config, ILogger logger)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var hasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher<User>>();
        var clock = scope.ServiceProvider.GetRequiredService<IClock>();
        var now = clock.UtcNow;

        await db.Database.MigrateAsync();

        if (!await db.Towns.AnyAsync())
        {
            db.Towns.AddRange(SeedData.Towns(now));
            logger.LogInformation("Seeded towns nkd, zhb with landmarks and fares");
        }
        if (!await db.CommissionRules.AnyAsync()) db.CommissionRules.AddRange(SeedData.Commission(now));
        if (!await db.Company.AnyAsync()) db.Company.Add(SeedData.Company());
        if (!await db.TermsVersions.AnyAsync()) db.TermsVersions.AddRange(SeedData.Terms());
        if (!await db.MessageTemplates.AnyAsync()) db.MessageTemplates.AddRange(SeedData.Templates());

        if (!await db.Users.AnyAsync(u => u.Role == Roles.Owner))
        {
            var email = (config["Seed:OwnerEmail"] ?? "owner@manabandi.in").Trim().ToLowerInvariant();
            var password = config["Seed:OwnerPassword"];
            var generated = string.IsNullOrWhiteSpace(password);
            if (generated) password = IdGen.Token(16);
            var owner = new User { Id = IdGen.New("u"), Email = email, Role = Roles.Owner, Name = config["Seed:OwnerName"] ?? "Owner", CreatedAt = now };
            owner.PasswordHash = hasher.HashPassword(owner, password!);
            db.Users.Add(owner);
            if (generated)
                logger.LogWarning("Seeded owner {Email} with generated password {Password} — shown ONCE. Log in and change it (POST /api/auth/password).", email, password);
            else
                logger.LogInformation("Seeded owner {Email} from Seed:OwnerEmail / Seed:OwnerPassword", email);
        }
        await db.SaveChangesAsync();

        if (config.GetValue<bool>("Seed:DemoData") && !await db.Captains.AnyAsync(c => c.IsDemo))
        {
            foreach (var (u, c) in SeedData.DemoCaptains(now, Ist.Today(clock)))
            {
                if (await db.Users.AnyAsync(x => x.Phone == u.Phone && x.Role == Roles.Captain)) continue;
                db.Users.Add(u);
                db.Captains.Add(c);
            }
            await db.SaveChangesAsync();
            logger.LogWarning("Seed:DemoData=true → inserted demo captains (+919000000000…09). Do not enable in production.");
        }
    }

    /// <summary>ConnectionStrings:Default, or a DATABASE_URL (postgres://user:pass@host:port/db) as given by Render/Railway/Neon.</summary>
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
