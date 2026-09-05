using System.ComponentModel.DataAnnotations;
using StudyRoom.Api.Models;

namespace StudyRoom.Api.Dtos;

public class ExpenseUpsertRequest
{
    public int? BranchId { get; set; }
    public ExpenseCategory Category { get; set; } = ExpenseCategory.Other;
    [StringLength(120)] public string? Title { get; set; }
    [Range(0.01, 100_000_000)] public decimal Amount { get; set; }
    [Required] public DateOnly PaidOn { get; set; }
    [StringLength(500)] public string? Note { get; set; }
}

public record ExpenseDto(int Id, int BranchId, string BranchName, ExpenseCategory Category, string? Title, decimal Amount, DateOnly PaidOn, string? Note, DateTime CreatedAt);

/// <summary>Money in vs money out for a period (and per branch when not filtered).</summary>
public record FinanceSummaryDto(
    DateOnly From, DateOnly To, int? BranchId,
    decimal Collected, decimal Expenses, decimal Net,
    decimal CollectedAllTime, decimal ExpensesAllTime, decimal NetAllTime,
    List<CategoryTotalDto> ByCategory, List<BranchFinanceDto> ByBranch);

public record CategoryTotalDto(ExpenseCategory Category, decimal Amount);
public record BranchFinanceDto(int BranchId, string BranchName, decimal Collected, decimal Expenses, decimal Net);
