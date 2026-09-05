using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using StudyRoom.Api.Data;
using StudyRoom.Api.Dtos;
using StudyRoom.Api.Models;
using StudyRoom.Api.Services;

namespace StudyRoom.Api.Controllers;

[ApiController]
[Route("api/dashboard")]
[Authorize]
public class DashboardController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly SettingsService _settings;
    private readonly SeatAllocationService _allocation;

    public DashboardController(AppDbContext db, SettingsService settings, SeatAllocationService allocation)
    {
        _db = db;
        _settings = settings;
        _allocation = allocation;
    }

    [HttpGet]
    public async Task<ActionResult<DashboardDto>> Get([FromQuery] int? branchId)
    {
        var settings = await _settings.GetAsync();
        var today = SettingsService.Today(settings);

        string? branchName = null;
        if (branchId.HasValue)
        {
            branchName = await _db.Branches.Where(b => b.Id == branchId.Value).Select(b => b.Name).FirstOrDefaultAsync();
            if (branchName is null) return NotFound(new { message = "Branch not found." });
        }

        var studentQuery = _db.Students.Include(s => s.Seat).Include(s => s.Branch).AsNoTracking().AsQueryable();
        if (branchId.HasValue) studentQuery = studentQuery.Where(s => s.BranchId == branchId.Value);
        var students = await studentQuery.ToListAsync();
        var dtos = students
            .Select(s => StudentMapper.ToDto(s, today, settings.DueSoonDays))
            .OrderBy(d => d.Status == DueStatus.Inactive ? 1 : 0)
            .ThenBy(d => d.DueDate)
            .ThenBy(d => d.Name)
            .ToList();

        var active = dtos.Where(d => d.IsActive).ToList();
        var monthStart = new DateOnly(today.Year, today.Month, 1);

        var seatSummary = await _allocation.SummaryAsync(branchId);

        var paymentQuery = _db.Payments.Include(p => p.Student).AsNoTracking().AsQueryable();
        if (branchId.HasValue) paymentQuery = paymentQuery.Where(p => p.Student!.BranchId == branchId.Value);

        var recent = await paymentQuery
            .OrderByDescending(p => p.PaidOn).ThenByDescending(p => p.Id)
            .Take(8)
            .Select(p => new PaymentActivityDto(p.Id, p.StudentId, p.Student!.Name, p.Amount, p.PaidOn, p.Note))
            .ToListAsync();

        var collectedThisMonth = await paymentQuery.Where(p => p.PaidOn >= monthStart && p.PaidOn <= today).SumAsync(p => (decimal?)p.Amount) ?? 0m;
        var expenseQuery = _db.Expenses.AsNoTracking().AsQueryable();
        if (branchId.HasValue) expenseQuery = expenseQuery.Where(e => e.BranchId == branchId.Value);
        var expensesThisMonth = await expenseQuery.Where(e => e.PaidOn >= monthStart && e.PaidOn <= today).SumAsync(e => (decimal?)e.Amount) ?? 0m;
        var expensesAllTime = await expenseQuery.SumAsync(e => (decimal?)e.Amount) ?? 0m;
        var collectedAllTime = await paymentQuery.SumAsync(p => (decimal?)p.Amount) ?? 0m;

        return new DashboardDto
        {
            BranchId = branchId,
            BranchName = branchName,
            Today = today,
            DueSoonDays = settings.DueSoonDays,
            RoomName = settings.RoomName,
            Currency = settings.Currency,
            TotalStudents = dtos.Count,
            ActiveStudents = active.Count,
            DueSoonCount = active.Count(d => d.Status == DueStatus.DueSoon),
            DueTodayCount = active.Count(d => d.Status == DueStatus.DueToday),
            OverdueCount = active.Count(d => d.Status == DueStatus.Overdue),
            InactiveStudents = dtos.Count - active.Count,
            TotalCollected = dtos.Sum(d => d.TotalPaid),
            TotalOutstanding = active.Sum(d => Math.Max(0, d.Balance)),
            CollectedThisMonth = collectedThisMonth,
            ExpensesThisMonth = expensesThisMonth,
            NetThisMonth = collectedThisMonth - expensesThisMonth,
            ExpensesAllTime = expensesAllTime,
            NetAllTime = collectedAllTime - expensesAllTime,
            ExpectedMonthlyRevenue = active.Sum(d => d.AmountPerMonth),
            Seats = seatSummary,
            FemaleStudents = active.Count(d => d.Gender == Gender.Female),
            Students = dtos,
            RecentPayments = recent,
            Branches = branchId.HasValue ? new() : await _allocation.BranchSummariesAsync(),
        };
    }
}
