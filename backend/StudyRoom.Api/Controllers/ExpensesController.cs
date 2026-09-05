using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using StudyRoom.Api.Data;
using StudyRoom.Api.Dtos;
using StudyRoom.Api.Models;
using StudyRoom.Api.Services;

namespace StudyRoom.Api.Controllers;

[ApiController]
[Route("api/expenses")]
[Authorize]
public class ExpensesController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly SettingsService _settings;

    public ExpensesController(AppDbContext db, SettingsService settings)
    {
        _db = db;
        _settings = settings;
    }

    /// <summary>Expenses in a date range (defaults to the current month), optionally for one branch.</summary>
    [HttpGet]
    public async Task<ActionResult<List<ExpenseDto>>> List([FromQuery] int? branchId, [FromQuery] DateOnly? from, [FromQuery] DateOnly? to)
    {
        var (start, end) = await RangeAsync(from, to);
        var q = _db.Expenses.Include(e => e.Branch).AsNoTracking().Where(e => e.PaidOn >= start && e.PaidOn <= end);
        if (branchId.HasValue) q = q.Where(e => e.BranchId == branchId.Value);
        return await q.OrderByDescending(e => e.PaidOn).ThenByDescending(e => e.Id).Select(e => ToDto(e)).ToListAsync();
    }

    /// <summary>Collected vs spent for the range, per category and per branch.</summary>
    [HttpGet("summary")]
    public async Task<ActionResult<FinanceSummaryDto>> Summary([FromQuery] int? branchId, [FromQuery] DateOnly? from, [FromQuery] DateOnly? to)
    {
        var (start, end) = await RangeAsync(from, to);

        var pay = _db.Payments.AsNoTracking().AsQueryable();
        var exp = _db.Expenses.AsNoTracking().AsQueryable();
        if (branchId.HasValue)
        {
            pay = pay.Where(p => p.Student!.BranchId == branchId.Value);
            exp = exp.Where(e => e.BranchId == branchId.Value);
        }

        var collected = await pay.Where(p => p.PaidOn >= start && p.PaidOn <= end).SumAsync(p => (decimal?)p.Amount) ?? 0m;
        var expenses = await exp.Where(e => e.PaidOn >= start && e.PaidOn <= end).SumAsync(e => (decimal?)e.Amount) ?? 0m;
        var collectedAll = await pay.SumAsync(p => (decimal?)p.Amount) ?? 0m;
        var expensesAll = await exp.SumAsync(e => (decimal?)e.Amount) ?? 0m;

        var byCategory = (await exp.Where(e => e.PaidOn >= start && e.PaidOn <= end)
                .GroupBy(e => e.Category).Select(g => new { g.Key, Amount = g.Sum(e => e.Amount) }).ToListAsync())
            .Select(x => new CategoryTotalDto(x.Key, x.Amount))
            .OrderByDescending(c => c.Amount).ToList();

        var byBranch = new List<BranchFinanceDto>();
        if (!branchId.HasValue)
        {
            var branches = await _db.Branches.AsNoTracking().OrderBy(b => b.Name).ToListAsync();
            foreach (var b in branches)
            {
                var c = await _db.Payments.Where(p => p.Student!.BranchId == b.Id && p.PaidOn >= start && p.PaidOn <= end).SumAsync(p => (decimal?)p.Amount) ?? 0m;
                var x = await _db.Expenses.Where(e => e.BranchId == b.Id && e.PaidOn >= start && e.PaidOn <= end).SumAsync(e => (decimal?)e.Amount) ?? 0m;
                byBranch.Add(new BranchFinanceDto(b.Id, b.Name, c, x, c - x));
            }
        }

        return new FinanceSummaryDto(start, end, branchId, collected, expenses, collected - expenses,
            collectedAll, expensesAll, collectedAll - expensesAll, byCategory, byBranch);
    }

    [HttpPost]
    public async Task<ActionResult<ExpenseDto>> Create(ExpenseUpsertRequest request)
    {
        request.BranchId ??= await _settings.DefaultBranchIdAsync();
        if (!await _db.Branches.AnyAsync(b => b.Id == request.BranchId)) return BadRequest(new { message = "Branch not found." });
        var e = new Expense();
        Apply(e, request);
        _db.Expenses.Add(e);
        await _db.SaveChangesAsync();
        await _db.Entry(e).Reference(x => x.Branch).LoadAsync();
        return ToDto(e);
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<ExpenseDto>> Update(int id, ExpenseUpsertRequest request)
    {
        var e = await _db.Expenses.Include(x => x.Branch).FirstOrDefaultAsync(x => x.Id == id);
        if (e is null) return NotFound();
        request.BranchId ??= e.BranchId;
        if (!await _db.Branches.AnyAsync(b => b.Id == request.BranchId)) return BadRequest(new { message = "Branch not found." });
        Apply(e, request);
        await _db.SaveChangesAsync();
        await _db.Entry(e).Reference(x => x.Branch).LoadAsync();
        return ToDto(e);
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var e = await _db.Expenses.FindAsync(id);
        if (e is null) return NotFound();
        _db.Expenses.Remove(e);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    private async Task<(DateOnly start, DateOnly end)> RangeAsync(DateOnly? from, DateOnly? to)
    {
        var settings = await _settings.GetAsync();
        var today = SettingsService.Today(settings);
        var start = from ?? new DateOnly(today.Year, today.Month, 1);
        var end = to ?? start.AddMonths(1).AddDays(-1);
        return (start, end);
    }

    private static void Apply(Expense e, ExpenseUpsertRequest r)
    {
        e.BranchId = r.BranchId!.Value;
        e.Category = r.Category;
        e.Title = string.IsNullOrWhiteSpace(r.Title) ? null : r.Title.Trim();
        e.Amount = r.Amount;
        e.PaidOn = r.PaidOn;
        e.Note = string.IsNullOrWhiteSpace(r.Note) ? null : r.Note.Trim();
    }

    private static ExpenseDto ToDto(Expense e) => new(e.Id, e.BranchId, e.Branch?.Name ?? string.Empty, e.Category, e.Title, e.Amount, e.PaidOn, e.Note, e.CreatedAt);
}
