using Marketing.Api.Data;
using Marketing.Api.Dtos;
using Marketing.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Marketing.Api.Controllers;

[ApiController]
[Route("api/settings")]
[Authorize]
public class SettingsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly SettingsService _settings;

    public SettingsController(AppDbContext db, SettingsService settings)
    {
        _db = db;
        _settings = settings;
    }

    [HttpGet]
    public async Task<ActionResult<SettingsDto>> Get()
    {
        var s = await _settings.GetAsync();
        return new SettingsDto(s.CompanyName, s.Tagline, s.LogoData != null, s.LogoUpdatedAt?.Ticks.ToString(), s.Currency, s.DefaultCountryCode,
            s.TimeZoneId, s.DefaultFollowUpDays, s.HotInterestThreshold);
    }

    [HttpPut]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<SettingsDto>> Update(UpdateSettingsRequest req)
    {
        var s = await _settings.GetAsync();
        s.CompanyName = req.CompanyName.Trim();
        s.Tagline = string.IsNullOrWhiteSpace(req.Tagline) ? null : req.Tagline.Trim();
        if (!string.IsNullOrWhiteSpace(req.Currency)) s.Currency = req.Currency.Trim().ToUpperInvariant();
        if (!string.IsNullOrWhiteSpace(req.DefaultCountryCode)) s.DefaultCountryCode = new string(req.DefaultCountryCode.Where(char.IsDigit).ToArray());
        if (!string.IsNullOrWhiteSpace(req.TimeZoneId))
        {
            try { TimeZoneInfo.FindSystemTimeZoneById(req.TimeZoneId); s.TimeZoneId = req.TimeZoneId; }
            catch { return BadRequest(new { message = $"Unknown time zone '{req.TimeZoneId}'." }); }
        }
        if (req.DefaultFollowUpDays is { } d) s.DefaultFollowUpDays = d;
        if (req.HotInterestThreshold is { } h) s.HotInterestThreshold = h;
        s.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return await Get();
    }

    [HttpPost("logo")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<SettingsDto>> UploadLogo(LogoUploadRequest req)
    {
        var decoded = ImageUpload.Decode(req.DataBase64, req.ContentType, ImageUpload.MaxLogoBytes, out var error);
        if (decoded is null) return BadRequest(new { message = error });
        var s = await _settings.GetAsync();
        s.LogoData = decoded.Value.bytes;
        s.LogoContentType = decoded.Value.contentType;
        s.LogoUpdatedAt = DateTime.UtcNow;
        s.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return await Get();
    }

    [HttpDelete("logo")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<SettingsDto>> RemoveLogo()
    {
        var s = await _settings.GetAsync();
        s.LogoData = null;
        s.LogoContentType = null;
        s.LogoUpdatedAt = null;
        await _db.SaveChangesAsync();
        return await Get();
    }
}
