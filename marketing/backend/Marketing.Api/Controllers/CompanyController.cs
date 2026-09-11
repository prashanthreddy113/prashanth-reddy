using Marketing.Api.Dtos;
using Marketing.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Marketing.Api.Controllers;

/// <summary>Public branding used by the login screen (no auth required).</summary>
[ApiController]
[Route("api/company")]
[AllowAnonymous]
public class CompanyController : ControllerBase
{
    private readonly SettingsService _settings;

    public CompanyController(SettingsService settings) => _settings = settings;

    [HttpGet]
    public async Task<ActionResult<CompanyPublicDto>> Get()
    {
        var s = await _settings.GetAsync();
        return new CompanyPublicDto(s.CompanyName, s.Tagline, s.LogoData != null, s.LogoUpdatedAt?.Ticks.ToString(), s.Currency, s.DefaultCountryCode);
    }

    [HttpGet("logo")]
    [ResponseCache(Duration = 300, Location = ResponseCacheLocation.Any)]
    public async Task<IActionResult> Logo()
    {
        var s = await _settings.GetAsync();
        if (s.LogoData is null || s.LogoData.Length == 0) return NotFound();
        return File(s.LogoData, s.LogoContentType ?? "image/png");
    }
}
