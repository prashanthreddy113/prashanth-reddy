using Marketing.Api.Data;
using Marketing.Api.Dtos;
using Marketing.Api.Models;
using Marketing.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Marketing.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly TokenService _tokens;
    private readonly IPasswordHasher<User> _hasher;

    public AuthController(AppDbContext db, TokenService tokens, IPasswordHasher<User> hasher)
    {
        _db = db;
        _tokens = tokens;
        _hasher = hasher;
    }

    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<ActionResult<LoginResponse>> Login(LoginRequest request)
    {
        var username = request.Username.Trim().ToLowerInvariant();
        var user = await _db.Users.Include(u => u.UserProjects).ThenInclude(up => up.Project)
            .FirstOrDefaultAsync(u => u.Username == username);
        if (user is null)
            return Unauthorized(new { message = "Invalid username or password." });

        var result = _hasher.VerifyHashedPassword(user, user.PasswordHash, request.Password);
        if (result == PasswordVerificationResult.Failed)
            return Unauthorized(new { message = "Invalid username or password." });
        if (!user.IsActive)
            return Unauthorized(new { message = "This account has been deactivated. Contact your admin." });

        if (result == PasswordVerificationResult.SuccessRehashNeeded)
            user.PasswordHash = _hasher.HashPassword(user, request.Password);
        user.LastLoginAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        var (token, expires) = _tokens.CreateToken(user);
        return new LoginResponse(token, expires, ToInfo(user));
    }

    [HttpGet("me")]
    [Authorize]
    public async Task<ActionResult<UserInfo>> Me()
    {
        var user = await _db.Users.Include(u => u.UserProjects).ThenInclude(up => up.Project)
            .FirstOrDefaultAsync(u => u.Id == User.Id());
        if (user is null) return Unauthorized();
        return ToInfo(user);
    }

    [HttpPost("change-password")]
    [Authorize]
    public async Task<ActionResult> ChangePassword(ChangePasswordRequest request)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == User.Id());
        if (user is null) return Unauthorized();

        if (_hasher.VerifyHashedPassword(user, user.PasswordHash, request.CurrentPassword) == PasswordVerificationResult.Failed)
            return BadRequest(new { message = "Current password is incorrect." });

        user.PasswordHash = _hasher.HashPassword(user, request.NewPassword);
        await _db.SaveChangesAsync();
        return Ok(new { message = "Password updated." });
    }

    public static UserInfo ToInfo(User user) => new(
        user.Id, user.Username, user.DisplayName, user.Role.ToString(), user.Mobile,
        user.Role == UserRole.Admin
            ? new List<ProjectRef>()
            : user.UserProjects.Where(up => up.Project.IsActive).OrderBy(up => up.Project.Name)
                .Select(up => new ProjectRef(up.ProjectId, up.Project.Name, up.Project.Color)).ToList());
}
