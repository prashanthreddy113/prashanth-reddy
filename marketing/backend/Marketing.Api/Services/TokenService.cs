using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Marketing.Api.Models;
using Microsoft.IdentityModel.Tokens;

namespace Marketing.Api.Services;

public class TokenService
{
    private readonly IConfiguration _config;

    public TokenService(IConfiguration config) => _config = config;

    public static string ResolveKey(IConfiguration config, ILogger? logger = null)
    {
        var key = config["Jwt:Key"];
        if (string.IsNullOrWhiteSpace(key) || key.Length < 32)
        {
            // Generate a per-process key so the app still runs; tokens will not survive restarts.
            key = Convert.ToBase64String(System.Security.Cryptography.RandomNumberGenerator.GetBytes(48));
            logger?.LogWarning("Jwt:Key is not configured (or shorter than 32 chars). Using a random key; logins will be invalidated on restart. Set the JWT__KEY environment variable in production.");
            config["Jwt:Key"] = key;
        }
        return key;
    }

    public (string token, DateTime expires) CreateToken(User user)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_config["Jwt:Key"]!));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var hours = int.TryParse(_config["Jwt:ExpiryHours"], out var h) ? h : 72;
        var expires = DateTime.UtcNow.AddHours(hours);

        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(JwtRegisteredClaimNames.UniqueName, user.Username),
            new Claim(ClaimTypes.Name, user.Username),
            new Claim("displayName", user.DisplayName),
            new Claim(ClaimTypes.Role, user.Role.ToString()),
        };

        var token = new JwtSecurityToken(
            issuer: _config["Jwt:Issuer"] ?? "MarketingTool",
            audience: _config["Jwt:Audience"] ?? "MarketingTool",
            claims: claims,
            expires: expires,
            signingCredentials: creds);

        return (new JwtSecurityTokenHandler().WriteToken(token), expires);
    }
}
