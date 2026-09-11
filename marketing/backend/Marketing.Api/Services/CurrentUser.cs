using System.Security.Claims;
using Marketing.Api.Models;

namespace Marketing.Api.Services;

public static class CurrentUser
{
    public static int Id(this ClaimsPrincipal user)
    {
        var raw = user.FindFirstValue(ClaimTypes.NameIdentifier) ?? user.FindFirstValue("sub");
        return int.TryParse(raw, out var id) ? id : 0;
    }

    public static bool IsAdmin(this ClaimsPrincipal user) => user.IsInRole(UserRole.Admin.ToString());
}
