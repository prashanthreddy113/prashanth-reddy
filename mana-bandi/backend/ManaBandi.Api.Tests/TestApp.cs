using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using ManaBandi.Api.Data;
using ManaBandi.Api.Models;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;

namespace ManaBandi.Api.Tests;

/// <summary>
/// The real API against a throwaway PostgreSQL database (manabandi_test_&lt;guid&gt;), dropped on dispose.
/// Dispatch runs for real with short timings (offer 2 s, max search 8 s, 200 ms tick).
/// </summary>
public sealed class TestApp : WebApplicationFactory<Program>, IAsyncDisposable
{
    public static readonly string PgHost = Environment.GetEnvironmentVariable("TEST_PG_HOST") ?? "localhost";
    public static readonly string PgUser = Environment.GetEnvironmentVariable("TEST_PG_USER") ?? "manabandi";
    public static readonly string PgPassword = Environment.GetEnvironmentVariable("TEST_PG_PASSWORD") ?? "manabandi";
    public const string OwnerEmail = "owner@test.manabandi.in";
    public const string OwnerPassword = "owner-test-password";

    public string DbName { get; } = $"manabandi_test_{Guid.NewGuid():N}";
    public string FilesRoot { get; } = Path.Combine(Path.GetTempPath(), "manabandi-test-files", Guid.NewGuid().ToString("N"));
    private readonly Dictionary<string, string?> _settings;

    private TestApp(Dictionary<string, string?>? overrides)
    {
        _settings = new Dictionary<string, string?>
        {
            ["ConnectionStrings:Default"] = ConnectionString,
            ["Otp:DevMode"] = "true",
            ["Dispatch:OfferSeconds"] = "2",
            ["Dispatch:MaxSearchSeconds"] = "8",
            ["Dispatch:TickMs"] = "200",
            ["Files:Root"] = FilesRoot,
            ["Public:BaseUrl"] = "https://track.test",
            ["Seed:OwnerEmail"] = OwnerEmail,
            ["Seed:OwnerPassword"] = OwnerPassword,
            ["Seed:DemoData"] = "false",
            ["RateLimit:OtpPerMinute"] = "1000",
            ["RateLimit:LoginPerMinute"] = "1000",
            ["Logging:LogLevel:Default"] = "Warning",
            ["Logging:LogLevel:ManaBandi"] = "Warning",
        };
        if (overrides != null) foreach (var (k, v) in overrides) _settings[k] = v;
    }

    public string ConnectionString => $"Host={PgHost};Database={DbName};Username={PgUser};Password={PgPassword};Include Error Detail=true";

    public static TestApp Create(Dictionary<string, string?>? overrides = null)
    {
        var app = new TestApp(overrides);
        _ = app.Server; // start host: runs migrations + seed
        return app;
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        foreach (var (k, v) in _settings) builder.UseSetting(k, v);
    }

    public async Task WithDb(Func<AppDbContext, Task> action)
    {
        using var scope = Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        await action(db);
    }

    public async Task<T> WithDb<T>(Func<AppDbContext, Task<T>> action)
    {
        using var scope = Services.CreateScope();
        return await action(scope.ServiceProvider.GetRequiredService<AppDbContext>());
    }

    public HttpClient Anonymous() => CreateClient();

    public HttpClient Authed(string token)
    {
        var c = CreateClient();
        c.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        c.DefaultRequestHeaders.Add("X-App-Version", "0.2.0-test");
        return c;
    }

    // ---------------------------------------------------------------- login helpers

    public async Task<(HttpClient client, JsonElement body)> LoginPhone(string phone, string role, string? name = null, bool acceptTerms = true)
    {
        var anon = Anonymous();
        var req = await anon.PostAsJsonAsync("/api/auth/otp/request", new { phone, role, channel = "sms", lang = "te" });
        Assert.Equal(HttpStatusCode.OK, req.StatusCode);
        var code = (await req.Json()).GetProperty("devCode").GetString();
        var ver = await anon.PostAsJsonAsync("/api/auth/otp/verify", new { phone, role, code, name = name ?? $"{role} {phone[^4..]}", lang = "te" });
        Assert.Equal(HttpStatusCode.OK, ver.StatusCode);
        var body = await ver.Json();
        var client = Authed(body.GetProperty("token").GetString()!);
        if (acceptTerms)
        {
            var t = await client.PostAsJsonAsync("/api/me/terms", new { version = "1.0" });
            Assert.Equal(HttpStatusCode.OK, t.StatusCode);
        }
        return (client, body);
    }

    public async Task<HttpClient> Rider(string phone, string? name = null) => (await LoginPhone(phone, "rider", name)).client;

    /// <summary>Logs a captain in and marks them verified directly in the DB (KYC is covered by the admin tests).</summary>
    public async Task<(HttpClient client, string captainId)> VerifiedCaptain(string phone, string vehicle = "bike", DateOnly? joinedAt = null, string? name = null)
    {
        var (client, body) = await LoginPhone(phone, "captain", name ?? $"Captain {phone[^4..]}");
        var id = body.GetProperty("captain").GetProperty("id").GetString()!;
        await WithDb(async db =>
        {
            var c = await db.Captains.FirstAsync(x => x.Id == id);
            c.Status = CaptainStatus.Verified;
            c.VehicleType = vehicle;
            c.VehicleNo = $"TS 15 T {phone[^4..]}";
            c.VehicleModel = vehicle == "auto" ? "Bajaj RE" : "Hero Splendor+";
            c.TownId = "nkd";
            c.PoliceStatus = "done";
            c.ApprovedAt = DateTime.UtcNow;
            if (joinedAt != null) c.JoinedAt = joinedAt.Value;
            await db.SaveChangesAsync();
        });
        return (client, id);
    }

    public async Task<HttpClient> Owner()
    {
        var res = await Anonymous().PostAsJsonAsync("/api/auth/login", new { email = OwnerEmail, password = OwnerPassword });
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        return Authed((await res.Json()).GetProperty("token").GetString()!);
    }

    public override async ValueTask DisposeAsync()
    {
        await base.DisposeAsync();
        NpgsqlConnection.ClearAllPools();
        try
        {
            await using var conn = new NpgsqlConnection($"Host={PgHost};Database=postgres;Username={PgUser};Password={PgPassword}");
            await conn.OpenAsync();
            await using var cmd = new NpgsqlCommand($"DROP DATABASE IF EXISTS \"{DbName}\" WITH (FORCE)", conn);
            await cmd.ExecuteNonQueryAsync();
        }
        catch
        {
            // best effort: a leftover test database is harmless
        }
        try { Directory.Delete(FilesRoot, true); } catch { /* ignore */ }
    }
}

public static class Http
{
    public static async Task<JsonElement> Json(this HttpResponseMessage res)
    {
        var s = await res.Content.ReadAsStringAsync();
        return JsonDocument.Parse(string.IsNullOrEmpty(s) ? "null" : s).RootElement.Clone();
    }

    public static async Task<JsonElement> Ok(this Task<HttpResponseMessage> t, HttpStatusCode expected = HttpStatusCode.OK)
    {
        var res = await t;
        var body = await res.Content.ReadAsStringAsync();
        Assert.True(res.StatusCode == expected, $"{res.RequestMessage?.Method} {res.RequestMessage?.RequestUri?.PathAndQuery} → {(int)res.StatusCode}: {body}");
        return JsonDocument.Parse(string.IsNullOrEmpty(body) ? "null" : body).RootElement.Clone();
    }

    /// <summary>Asserts a problem response with the given status and contract `code`.</summary>
    public static async Task<JsonElement> Problem(this Task<HttpResponseMessage> t, int status, string code)
    {
        var res = await t;
        var body = await res.Content.ReadAsStringAsync();
        Assert.True((int)res.StatusCode == status, $"expected {status} {code}, got {(int)res.StatusCode}: {body}");
        var json = JsonDocument.Parse(body).RootElement.Clone();
        Assert.Equal(code, json.GetProperty("code").GetString());
        return json;
    }

    public static Task<HttpResponseMessage> PostJson(this HttpClient c, string url, object? body = null) => c.PostAsJsonAsync(url, body ?? new { });
    public static Task<HttpResponseMessage> PutJson(this HttpClient c, string url, object body) => c.PutAsJsonAsync(url, body);

    public static string Str(this JsonElement e, string prop) => e.GetProperty(prop).GetString()!;

    public static async Task<T> WaitFor<T>(Func<Task<T?>> probe, TimeSpan timeout, string what) where T : struct
    {
        var until = DateTime.UtcNow + timeout;
        while (DateTime.UtcNow < until)
        {
            var v = await probe();
            if (v.HasValue) return v.Value;
            await Task.Delay(150);
        }
        throw new TimeoutException($"Timed out waiting for {what}");
    }
}

/// <summary>Coordinates around Narayanakhed used by the tests.</summary>
public static class Nkd
{
    public static readonly (double lat, double lng) BusStand = (18.0338, 77.7562);
    public static readonly (double lat, double lng) Hospital = (18.0361, 77.7519);
    public static readonly (double lat, double lng) FarDrop = (18.0520, 77.7700);    // ~2.5 km NE of the bus stand
    public static readonly (double lat, double lng) Hyderabad = (17.3850, 78.4867);  // outside every town

    public static object Place((double lat, double lng) p, string? name = null) => new { lat = p.lat, lng = p.lng, name };

    public static object Point(double lat, double lng, DateTime? at = null) =>
        new { lat, lng, accuracy = 8.0, speed = 6.0, heading = 45.0, at = (at ?? DateTime.UtcNow).ToString("O") };
}
