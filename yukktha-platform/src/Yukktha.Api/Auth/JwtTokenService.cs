using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;
using Yukktha.Api.Data.Entities;

namespace Yukktha.Api.Auth;

public class JwtTokenService(IConfiguration cfg)
{
    public string Issue(User user, Store store)
    {
        var jwt = cfg.GetSection("Jwt");
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt["Key"]!));
        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new("store_id", store.Id.ToString()),
            new("store_slug", store.Slug),
            new(ClaimTypes.Name, user.Name),
            new(ClaimTypes.MobilePhone, user.Phone),
            new(ClaimTypes.Role, user.Role.ToString()),
        };
        var token = new JwtSecurityToken(jwt["Issuer"], jwt["Audience"], claims,
            expires: DateTime.UtcNow.AddHours(jwt.GetValue<int>("ExpiryHours", 168)),
            signingCredentials: new SigningCredentials(key, SecurityAlgorithms.HmacSha256));
        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}

public static class ClaimsExt
{
    public static Guid StoreId(this ClaimsPrincipal p) => Guid.Parse(p.FindFirstValue("store_id")!);
    public static Guid UserId(this ClaimsPrincipal p) => Guid.Parse(p.FindFirstValue(JwtRegisteredClaimNames.Sub) ?? p.FindFirstValue(ClaimTypes.NameIdentifier)!);
}
