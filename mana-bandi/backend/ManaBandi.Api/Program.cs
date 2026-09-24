using System.Text;
using System.Threading.RateLimiting;
using ManaBandi.Api.Auth;
using ManaBandi.Api.Data;
using ManaBandi.Api.Infrastructure;
using ManaBandi.Api.Models;
using ManaBandi.Api.Services;
using ManaBandi.Api.Sms;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;

var builder = WebApplication.CreateBuilder(args);
var config = builder.Configuration;

// ----- Options -----
builder.Services.Configure<OtpOptions>(config.GetSection("Otp"));
builder.Services.Configure<DispatchOptions>(config.GetSection("Dispatch"));
builder.Services.Configure<FilesOptions>(config.GetSection("Files"));
builder.Services.Configure<PublicOptions>(config.GetSection("Public"));
builder.Services.Configure<Msg91Options>(config.GetSection("Msg91"));
builder.WebHost.ConfigureKestrel(k =>
{
    k.Limits.MaxRequestBodySize = 10 * 1024 * 1024;
    k.AddServerHeader = false;
});

// ----- Database -----
builder.Services.AddDbContext<AppDbContext>(o => o.UseNpgsql(DbInitializer.ResolveConnectionString(config)));

// ----- Auth -----
var jwtKey = TokenService.ResolveKey(config);
builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(o =>
    {
        o.MapInboundClaims = false;
        o.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = TokenService.Issuer,
            ValidAudience = TokenService.Issuer,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
            ClockSkew = TimeSpan.FromMinutes(1),
            RoleClaimType = "role",
            NameClaimType = "name",
        };
        o.Events = new JwtBearerEvents
        {
            // Disabled or removed users lose access immediately, not when their token expires.
            OnTokenValidated = async ctx =>
            {
                var id = ctx.Principal?.FindFirst("sub")?.Value;
                var db = ctx.HttpContext.RequestServices.GetRequiredService<AppDbContext>();
                var ok = id != null && await db.Users.AsNoTracking().AnyAsync(u => u.Id == id && !u.Disabled);
                if (!ok) ctx.Fail("user disabled");
            },
            OnChallenge = async ctx =>
            {
                ctx.HandleResponse();
                await Problems.WriteAsync(ctx.HttpContext, 401, "unauthorized", "Login required");
            },
            OnForbidden = ctx => Problems.WriteAsync(ctx.HttpContext, 403, "forbidden", "You are not allowed to do this"),
        };
    });
builder.Services.AddAuthorization(o =>
{
    o.AddPolicy(Policies.Rider, p => p.RequireAuthenticatedUser().RequireClaim("role", Roles.Rider));
    o.AddPolicy(Policies.Captain, p => p.RequireAuthenticatedUser().RequireClaim("role", Roles.Captain));
    o.AddPolicy(Policies.Admin, p => p.RequireAuthenticatedUser().RequireClaim("role", Roles.Owner, Roles.TownManager));
    o.AddPolicy(Policies.Owner, p => p.RequireAuthenticatedUser().RequireClaim("role", Roles.Owner));
});

// ----- Rate limiting (per client IP) -----
builder.Services.AddRateLimiter(o =>
{
    o.RejectionStatusCode = 429;
    static string Ip(HttpContext c) => c.Connection.RemoteIpAddress?.ToString() ?? "unknown";
    o.AddPolicy("otp", ctx => RateLimitPartition.GetFixedWindowLimiter(Ip(ctx), _ => new FixedWindowRateLimiterOptions
    {
        PermitLimit = config.GetValue("RateLimit:OtpPerMinute", 20), Window = TimeSpan.FromMinutes(1), QueueLimit = 0,
    }));
    o.AddPolicy("login", ctx => RateLimitPartition.GetFixedWindowLimiter(Ip(ctx), _ => new FixedWindowRateLimiterOptions
    {
        PermitLimit = config.GetValue("RateLimit:LoginPerMinute", 10), Window = TimeSpan.FromMinutes(1), QueueLimit = 0,
    }));
    o.OnRejected = async (ctx, ct) =>
    {
        var otp = ctx.HttpContext.Request.Path.StartsWithSegments("/api/auth/otp");
        await Problems.WriteAsync(ctx.HttpContext, 429, otp ? "otp_rate_limited" : "rate_limited", "Too many attempts. Please wait a minute.");
    };
});

// ----- App services -----
builder.Services.AddHttpContextAccessor();
builder.Services.AddSingleton<IClock, SystemClock>();
builder.Services.AddScoped<IPasswordHasher<User>, PasswordHasher<User>>();
builder.Services.AddScoped<TokenService>();
builder.Services.AddScoped<OtpService>();
builder.Services.AddScoped<AccountService>();
builder.Services.AddScoped<AreaService>();
builder.Services.AddScoped<CommissionService>();
builder.Services.AddScoped<RideService>();
builder.Services.AddScoped<TripService>();
builder.Services.AddScoped<SettlementService>();
builder.Services.AddScoped<AdminStatsService>();
builder.Services.AddScoped<FileStorage>();
builder.Services.AddScoped<AuditService>();
builder.Services.AddScoped<DispatchEngine>();
builder.Services.AddHostedService<DispatchService>();
// KYC: manual checks today; a DigiLocker aggregator implements IKycProvider and is registered here instead.
builder.Services.AddScoped<IKycProvider, ManualKycProvider>();
if (string.Equals(config["Otp:Provider"], "msg91", StringComparison.OrdinalIgnoreCase))
    builder.Services.AddHttpClient<ISmsSender, Msg91SmsSender>(c => c.Timeout = TimeSpan.FromSeconds(15));
else
    builder.Services.AddSingleton<ISmsSender, ConsoleSmsSender>();

// ----- API -----
builder.Services.AddControllers().ConfigureApiBehaviorOptions(o => o.InvalidModelStateResponseFactory = Problems.InvalidModel);
builder.Services.AddProblemDetails();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo { Title = "Mana Bandi API", Version = "v1", Description = "Contract: mana-bandi/docs/07-API.md" });
    c.CustomSchemaIds(t => t.FullName?.Replace("+", "."));
    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme { In = ParameterLocation.Header, Name = "Authorization", Type = SecuritySchemeType.Http, Scheme = "bearer", BearerFormat = "JWT" });
    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        { new OpenApiSecurityScheme { Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" } }, Array.Empty<string>() },
    });
});

// ----- CORS (owner portal origins) -----
var origins = (config["Cors:AllowedOrigins"] ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
builder.Services.AddCors(o => o.AddDefaultPolicy(p =>
{
    if (origins.Contains("*")) p.AllowAnyOrigin();
    else if (origins.Length > 0) p.WithOrigins(origins);
    else if (builder.Environment.IsDevelopment()) p.SetIsOriginAllowed(o => new Uri(o).IsLoopback);
    else p.SetIsOriginAllowed(_ => false);
    p.AllowAnyHeader().AllowAnyMethod();
}));

builder.Services.Configure<ForwardedHeadersOptions>(o =>
{
    o.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    o.KnownNetworks.Clear(); // behind Render/Railway/Caddy the proxy address is not known in advance
    o.KnownProxies.Clear();
});

var app = builder.Build();

if (Environment.GetEnvironmentVariable("PORT") is { Length: > 0 } port && string.IsNullOrEmpty(Environment.GetEnvironmentVariable("ASPNETCORE_URLS")))
    app.Urls.Add($"http://0.0.0.0:{port}");

var startupLog = app.Services.GetRequiredService<ILoggerFactory>().CreateLogger("Startup");
TokenService.ResolveKey(config, startupLog);
var otpOpt = config.GetSection("Otp").Get<OtpOptions>() ?? new OtpOptions();
if (!app.Environment.IsDevelopment() && otpOpt.DevMode)
    startupLog.LogWarning("Otp:DevMode=true outside Development: OTP codes are returned in API responses. NEVER run real users like this.");
if (!app.Environment.IsDevelopment() && !otpOpt.DevMode && !string.Equals(otpOpt.Provider, "msg91", StringComparison.OrdinalIgnoreCase))
    startupLog.LogWarning("Otp:Provider=console in production: OTP SMS are not delivered. Set Otp__Provider=msg91.");

await DbInitializer.InitializeAsync(app.Services, config, startupLog);

if (config.GetValue("Proxy:TrustForwardedHeaders", true)) app.UseForwardedHeaders();
app.UseMiddleware<RequestLogging>();
app.UseMiddleware<ErrorHandlingMiddleware>();
app.UseStatusCodePages(async ctx =>
{
    var res = ctx.HttpContext.Response;
    if (res.HasStarted || res.ContentLength > 0 || !string.IsNullOrEmpty(res.ContentType)) return;
    await Problems.WriteAsync(ctx.HttpContext, res.StatusCode, Problems.CodeForStatus(res.StatusCode), res.StatusCode == 404 ? "Not found" : "Request failed");
});
if (app.Environment.IsDevelopment() || config.GetValue<bool>("Swagger:Enabled"))
{
    app.UseSwagger();
    app.UseSwaggerUI(c => c.SwaggerEndpoint("/swagger/v1/swagger.json", "Mana Bandi API v1"));
}
app.Use(async (ctx, next) =>
{
    ctx.Response.Headers["X-Content-Type-Options"] = "nosniff";
    await next();
});
app.UseCors();
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapGet("/healthz", async (AppDbContext db, CancellationToken ct) =>
{
    var ok = false;
    try { ok = await db.Database.CanConnectAsync(ct); } catch { /* reported below */ }
    return ok ? Results.Ok(new { status = "ok", db = "ok", time = DateTime.UtcNow })
              : Results.Json(new { status = "error", db = "unreachable", time = DateTime.UtcNow }, statusCode: 503);
}).AllowAnonymous().ExcludeFromDescription();
app.MapGet("/", () => Results.Ok(new { name = "Mana Bandi API", docs = "/swagger", health = "/healthz" })).ExcludeFromDescription();

app.Run();

public partial class Program { }
