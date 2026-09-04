using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using StudyRoom.Api.Data;
using StudyRoom.Api.Dtos;
using StudyRoom.Api.Models;
using StudyRoom.Api.Services;

namespace StudyRoom.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly TokenService _tokens;
    private readonly IPasswordHasher<Admin> _hasher;

    public AuthController(AppDbContext db, TokenService tokens, IPasswordHasher<Admin> hasher)
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
        var admin = await _db.Admins.FirstOrDefaultAsync(a => a.Username == username);
        if (admin is null)
            return Unauthorized(new { message = "Invalid username or password." });

        var result = _hasher.VerifyHashedPassword(admin, admin.PasswordHash, request.Password);
        if (result == PasswordVerificationResult.Failed)
            return Unauthorized(new { message = "Invalid username or password." });

        if (result == PasswordVerificationResult.SuccessRehashNeeded)
        {
            admin.PasswordHash = _hasher.HashPassword(admin, request.Password);
            await _db.SaveChangesAsync();
        }

        var (token, expires) = _tokens.CreateToken(admin);
        return new LoginResponse(token, expires, admin.Username, admin.DisplayName);
    }

    [HttpGet("me")]
    [Authorize]
    public async Task<ActionResult> Me()
    {
        var admin = await CurrentAdminAsync();
        if (admin is null) return Unauthorized();
        return Ok(new { admin.Username, admin.DisplayName });
    }

    [HttpPost("change-password")]
    [Authorize]
    public async Task<ActionResult> ChangePassword(ChangePasswordRequest request)
    {
        var admin = await CurrentAdminAsync();
        if (admin is null) return Unauthorized();

        if (_hasher.VerifyHashedPassword(admin, admin.PasswordHash, request.CurrentPassword) == PasswordVerificationResult.Failed)
            return BadRequest(new { message = "Current password is incorrect." });

        admin.PasswordHash = _hasher.HashPassword(admin, request.NewPassword);
        await _db.SaveChangesAsync();
        return Ok(new { message = "Password updated." });
    }

    private async Task<Admin?> CurrentAdminAsync()
    {
        var username = User.Identity?.Name;
        if (string.IsNullOrEmpty(username)) return null;
        return await _db.Admins.FirstOrDefaultAsync(a => a.Username == username);
    }
}
