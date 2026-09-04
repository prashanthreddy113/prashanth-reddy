using System.Text;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using StudyRoom.Api.Data;
using StudyRoom.Api.Models;
using StudyRoom.Api.Services;

var builder = WebApplication.CreateBuilder(args);

// ----- Database -----
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(DbInitializer.ResolveConnectionString(builder.Configuration)));

// ----- Auth -----
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
            ValidIssuer = builder.Configuration["Jwt:Issuer"] ?? "StudyRoom",
            ValidAudience = builder.Configuration["Jwt:Audience"] ?? "StudyRoom",
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
            ClockSkew = TimeSpan.FromMinutes(1),
        };
    });
builder.Services.AddAuthorization();
builder.Services.AddScoped<IPasswordHasher<Admin>, PasswordHasher<Admin>>();
builder.Services.AddScoped<TokenService>();
builder.Services.AddScoped<SettingsService>();
builder.Services.AddHttpClient<WhatsAppService>(c => c.Timeout = TimeSpan.FromSeconds(20));
builder.Services.AddScoped<ReminderService>();
builder.Services.AddHostedService<ReminderScheduler>();

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
    c.SwaggerDoc("v1", new OpenApiInfo { Title = "BrightLoop Reading Room API", Version = "v1" });
    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        In = ParameterLocation.Header,
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        Description = "Paste the token returned by POST /api/auth/login",
    });
    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        { new OpenApiSecurityScheme { Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" } }, Array.Empty<string>() }
    });
});

// ----- CORS: allow the Netlify frontend (and local dev) -----
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

// Render/Railway/etc. inject PORT; honour it when ASPNETCORE_URLS is not set explicitly.
if (Environment.GetEnvironmentVariable("PORT") is { Length: > 0 } port && string.IsNullOrEmpty(Environment.GetEnvironmentVariable("ASPNETCORE_URLS")))
    app.Urls.Add($"http://0.0.0.0:{port}");

await DbInitializer.InitializeAsync(app.Services, app.Configuration, app.Logger);

app.UseStatusCodePages();
app.UseSwagger();
app.UseSwaggerUI(c => c.SwaggerEndpoint("/swagger/v1/swagger.json", "BrightLoop Reading Room API v1"));

app.UseCors();
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapGet("/", () => Results.Redirect("/swagger")).ExcludeFromDescription();
app.MapGet("/api/health", () => Results.Ok(new { status = "ok", time = DateTime.UtcNow })).AllowAnonymous();

app.Run();

public partial class Program { }
