using Marketing.Api.Data;
using Marketing.Api.Dtos;
using Marketing.Api.Models;
using Marketing.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Marketing.Api.Controllers;

[ApiController]
[Route("api/dashboard")]
[Authorize]
public class DashboardController : ControllerBase
{
    private readonly DashboardService _dashboard;

    public DashboardController(DashboardService dashboard) => _dashboard = dashboard;

    [HttpGet]
    public async Task<ActionResult<DashboardDto>> Get([FromQuery] int? projectId, [FromQuery] int? userId, [FromQuery] int days = 30)
        => await _dashboard.BuildAsync(User.IsAdmin(), User.Id(), projectId, userId, days);

    public static string StatusLabel(LeadStatus s) => s switch
    {
        LeadStatus.New => "New",
        LeadStatus.FollowUp => "Follow-up",
        LeadStatus.Negotiation => "Negotiation",
        LeadStatus.Converted => "Converted",
        LeadStatus.Lost => "Lost",
        _ => s.ToString(),
    };

    public static string InterestLabel(int i) => i switch
    {
        1 => "Not interested",
        2 => "Low",
        3 => "Medium",
        4 => "High",
        5 => "Ready to buy",
        _ => i.ToString(),
    };
}
