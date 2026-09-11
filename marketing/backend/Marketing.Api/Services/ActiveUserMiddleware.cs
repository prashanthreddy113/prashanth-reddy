using Marketing.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace Marketing.Api.Services;

/// <summary>
/// Rejects requests carrying a valid token for a user that has since been deactivated or deleted,
/// so an admin can immediately lock out an executive.
/// </summary>
public class ActiveUserMiddleware
{
    private readonly RequestDelegate _next;

    public ActiveUserMiddleware(RequestDelegate next) => _next = next;

    public async Task InvokeAsync(HttpContext context, AppDbContext db)
    {
        if (context.User.Identity?.IsAuthenticated == true)
        {
            var id = context.User.Id();
            var role = context.User.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value;
            var current = await db.Users.Where(u => u.Id == id).Select(u => new { u.IsActive, u.Role }).FirstOrDefaultAsync();
            if (current is null || !current.IsActive || current.Role.ToString() != role)
            {
                context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                context.Response.ContentType = "application/json";
                await context.Response.WriteAsJsonAsync(new { message = "Your account is no longer active. Please sign in again." });
                return;
            }
        }
        await _next(context);
    }
}
