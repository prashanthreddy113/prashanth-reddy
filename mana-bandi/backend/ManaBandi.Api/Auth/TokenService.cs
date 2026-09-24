using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using ManaBandi.Api.Models;
using Microsoft.IdentityModel.Tokens;

namespace ManaBandi.Api.Auth;

public class TokenService
{
    private readonly IConfiguration _config;

    public TokenService(IConfiguration config) => _config = config;

    public const string Issuer = "ManaBandi";

    public static string ResolveKey(IConfiguration config, ILogger? logger = null)
    {
        var key = config["Jwt:Key"];
        if (string.IsNullOrWhiteSpace(key) || key.Length < 32)
        {
            key = Convert.ToBase64String(System.Security.Cryptography.RandomNumberGenerator.GetBytes(48));
            logger?.LogWarning("Jwt:Key is not configured (or shorter than 32 chars). Using a random key; all logins end on restart. Set JWT__KEY in production.");
            config["Jwt:Key"] = key;
        }
        return key;
    }

    public string CreateToken(User user)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_config["Jwt:Key"]!));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var expires = Roles.IsAdmin(user.Role) ? DateTime.UtcNow.AddHours(12) : DateTime.UtcNow.AddDays(30);
        var claims = new List<Claim>
        {
            new("sub", user.Id),
            new("role", user.Role),
            new("name", user.Name ?? ""),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString("N")),
        };
        if (!string.IsNullOrEmpty(user.TownId) && user.Role == Roles.TownManager) claims.Add(new Claim("town", user.TownId));
        if (!string.IsNullOrEmpty(user.Email)) claims.Add(new Claim("email", user.Email));
        var token = new JwtSecurityToken(Issuer, Issuer, claims, expires: expires, signingCredentials: creds);
        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}

public static class Policies
{
    public const string Rider = "rider";
    public const string Captain = "captain";
    public const string Admin = "admin";
    public const string Owner = "owner";
}

public static class ClaimsExtensions
{
    public static string UserId(this ClaimsPrincipal p) => p.FindFirstValue("sub") ?? throw new Infrastructure.ApiException(401, "unauthorized", "Login required");
    public static string Role(this ClaimsPrincipal p) => p.FindFirstValue("role") ?? "";
    public static bool IsOwner(this ClaimsPrincipal p) => p.Role() == Roles.Owner;
    public static bool IsAdmin(this ClaimsPrincipal p) => Roles.IsAdmin(p.Role());
    /// <summary>Town a town manager is pinned to (null for owners).</summary>
    public static string? ManagerTown(this ClaimsPrincipal p) => p.Role() == Roles.TownManager ? p.FindFirstValue("town") ?? "__none__" : null;

    /// <summary>
    /// Effective town filter for admin list endpoints: town managers always get their own town;
    /// owners get the requested town, with "all"/empty meaning every town (null).
    /// </summary>
    public static string? ScopeTown(this ClaimsPrincipal p, string? requested)
    {
        var mt = p.ManagerTown();
        if (mt != null) return mt;
        return string.IsNullOrWhiteSpace(requested) || requested == "all" ? null : requested;
    }

    public static bool CanSeeTown(this ClaimsPrincipal p, string? townId)
    {
        var mt = p.ManagerTown();
        return mt == null || mt == townId;
    }
}
