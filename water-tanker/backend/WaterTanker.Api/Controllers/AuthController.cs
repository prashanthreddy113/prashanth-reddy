using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WaterTanker.Api.Data;
using WaterTanker.Api.Dtos;
using WaterTanker.Api.Models;
using WaterTanker.Api.Services;

namespace WaterTanker.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly TokenService _tokens;
    private readonly IPasswordHasher<User> _hasher;

    public AuthController(AppDbContext db, TokenService tokens, IPasswordHasher<User> hasher)
    {
        _db = db; _tokens = tokens; _hasher = hasher;
    }

    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<ActionResult<LoginResponse>> Login(LoginRequest request)
    {
        var email = request.Email.Trim().ToLowerInvariant();
        var user = await _db.Users.Include(u => u.Operator).Include(u => u.Community).FirstOrDefaultAsync(u => u.Email == email);
        if (user is null || !user.IsActive)
            return Unauthorized(new { message = "Invalid email or password." });

        var result = _hasher.VerifyHashedPassword(user, user.PasswordHash, request.Password);
        if (result == PasswordVerificationResult.Failed)
            return Unauthorized(new { message = "Invalid email or password." });
        if (result == PasswordVerificationResult.SuccessRehashNeeded)
        {
            user.PasswordHash = _hasher.HashPassword(user, request.Password);
            await _db.SaveChangesAsync();
        }

        var (token, expires) = _tokens.CreateToken(user);
        return new LoginResponse(token, expires, user.Email, user.DisplayName, user.Role.ToString(),
            user.OperatorId, user.Operator?.Name, user.CommunityId, user.Community?.Name);
    }

    [HttpGet("me")]
    [Authorize]
    public async Task<ActionResult<UserDto>> Me()
    {
        var user = await _db.Users.Include(u => u.Operator).Include(u => u.Community).FirstOrDefaultAsync(u => u.Id == User.UserId());
        return user is null ? Unauthorized() : UserDto.From(user);
    }

    [HttpPost("change-password")]
    [Authorize]
    public async Task<ActionResult> ChangePassword(ChangePasswordRequest request)
    {
        var user = await _db.Users.FindAsync(User.UserId());
        if (user is null) return Unauthorized();
        if (_hasher.VerifyHashedPassword(user, user.PasswordHash, request.CurrentPassword) == PasswordVerificationResult.Failed)
            return BadRequest(new { message = "Current password is incorrect." });
        if (request.NewPassword.Length < 6)
            return BadRequest(new { message = "New password must be at least 6 characters." });
        user.PasswordHash = _hasher.HashPassword(user, request.NewPassword);
        await _db.SaveChangesAsync();
        return Ok(new { message = "Password updated." });
    }
}
