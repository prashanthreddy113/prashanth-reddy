using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;
using WaterTanker.Api.Models;

namespace WaterTanker.Api.Services;

public class TokenService
{
    private readonly IConfiguration _config;

    public TokenService(IConfiguration config) => _config = config;

    public static string ResolveKey(IConfiguration config, ILogger? logger = null)
    {
        var key = config["Jwt:Key"];
        if (string.IsNullOrWhiteSpace(key) || key.Length < 32)
        {
            key = Convert.ToBase64String(System.Security.Cryptography.RandomNumberGenerator.GetBytes(48));
            logger?.LogWarning("Jwt:Key is not configured (or shorter than 32 chars). Using a random key; logins will be invalidated on restart. Set JWT__KEY in production.");
            config["Jwt:Key"] = key;
        }
        return key;
    }

    public (string token, DateTime expires) CreateToken(User user)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_config["Jwt:Key"]!));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var hours = int.TryParse(_config["Jwt:ExpiryHours"], out var h) ? h : 12;
        var expires = DateTime.UtcNow.AddHours(hours);

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new(ClaimTypes.Name, user.Email),
            new(JwtRegisteredClaimNames.Email, user.Email),
            new("displayName", user.DisplayName),
            new(ClaimTypes.Role, user.Role.ToString()),
        };
        if (user.OperatorId is int op) claims.Add(new Claim("operatorId", op.ToString()));
        if (user.CommunityId is int c) claims.Add(new Claim("communityId", c.ToString()));

        var token = new JwtSecurityToken(
            issuer: _config["Jwt:Issuer"] ?? "AquaProof",
            audience: _config["Jwt:Audience"] ?? "AquaProof",
            claims: claims,
            expires: expires,
            signingCredentials: creds);

        return (new JwtSecurityTokenHandler().WriteToken(token), expires);
    }
}
