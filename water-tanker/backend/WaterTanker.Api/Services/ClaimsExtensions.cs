using System.Security.Claims;
using WaterTanker.Api.Models;

namespace WaterTanker.Api.Services;

public static class ClaimsExtensions
{
    public static int UserId(this ClaimsPrincipal user) =>
        int.TryParse(user.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : 0;

    public static UserRole Role(this ClaimsPrincipal user) =>
        Enum.TryParse<UserRole>(user.FindFirstValue(ClaimTypes.Role), out var r) ? r : UserRole.Rwa;

    public static int? OperatorId(this ClaimsPrincipal user) =>
        int.TryParse(user.FindFirstValue("operatorId"), out var id) ? id : null;

    public static int? CommunityId(this ClaimsPrincipal user) =>
        int.TryParse(user.FindFirstValue("communityId"), out var id) ? id : null;

    public static bool IsAdmin(this ClaimsPrincipal user) => user.Role() == UserRole.Admin;
}
