using System.Text;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using WaterTanker.Api.Data;
using WaterTanker.Api.Models;
using WaterTanker.Api.Services;

var builder = WebApplication.CreateBuilder(args);

// ----- Database -----
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(DbInitializer.ResolveConnectionString(builder.Configuration)));

// ----- Auth (JWT for people; X-Device-Id / X-Device-Key headers for tanker nodes) -----
var jwtKey = TokenService.ResolveKey(builder.Configuration);
builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"] ?? "AquaProof",
            ValidAudience = builder.Configuration["Jwt:Audience"] ?? "AquaProof",
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
            ClockSkew = TimeSpan.FromMinutes(1),
        };
    });
builder.Services.AddAuthorization();
builder.Services.AddScoped<IPasswordHasher<User>, PasswordHasher<User>>();
builder.Services.AddScoped<TokenService>();
builder.Services.AddScoped<DeviceAuthService>();
builder.Services.AddSingleton<QualityService>();
builder.Services.AddSingleton<PhotoStorage>();
builder.Services.AddScoped<DeliveryService>();
builder.Services.AddScoped<InvoiceService>();
builder.Services.AddHostedService<DeliveryCloser>();

// ----- API -----
builder.Services.AddControllers().AddJsonOptions(o =>
{
    o.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
    o.JsonSerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
});
builder.Services.AddProblemDetails();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "AquaProof Tanker API",
        Version = "v1",
        Description = "Metered, geo-tagged, quality-graded water tanker deliveries. People sign in with JWT (POST /api/auth/login); tanker devices send X-Device-Id and X-Device-Key headers to /api/telemetry.",
    });
    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        In = ParameterLocation.Header, Name = "Authorization", Type = SecuritySchemeType.Http,
        Scheme = "bearer", BearerFormat = "JWT", Description = "Paste the token returned by POST /api/auth/login",
    });
    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        { new OpenApiSecurityScheme { Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" } }, Array.Empty<string>() }
    });
});

// ----- CORS -----
var allowedOrigins = (builder.Configuration["Cors:AllowedOrigins"] ?? "")
    .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
builder.Services.AddCors(options => options.AddDefaultPolicy(policy =>
{
    if (allowedOrigins.Length == 0 || allowedOrigins.Contains("*"))
        policy.AllowAnyOrigin();
    else
        policy.WithOrigins(allowedOrigins).SetIsOriginAllowedToAllowWildcardSubdomains();
    policy.AllowAnyHeader().AllowAnyMethod();
}));

var app = builder.Build();

if (Environment.GetEnvironmentVariable("PORT") is { Length: > 0 } port && string.IsNullOrEmpty(Environment.GetEnvironmentVariable("ASPNETCORE_URLS")))
    app.Urls.Add($"http://0.0.0.0:{port}");

await DbInitializer.InitializeAsync(app.Services, app.Configuration, app.Logger);

app.UseStatusCodePages();
app.UseSwagger();
app.UseSwaggerUI(c => c.SwaggerEndpoint("/swagger/v1/swagger.json", "AquaProof Tanker API v1"));

app.UseCors();
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapGet("/", () => Results.Redirect("/swagger")).ExcludeFromDescription();
app.MapGet("/api/health", () => Results.Ok(new { status = "ok", time = DateTime.UtcNow })).AllowAnonymous();

app.Run();

public partial class Program { }
