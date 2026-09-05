namespace StudyRoom.Api.Models;

public enum ExpenseCategory
{
    Rent,
    Electricity,
    Internet,
    Salary,
    Maintenance,
    Water,
    Furniture,
    Marketing,
    Other
}

/// <summary>Money going out: rent, bills, salaries. Netted against payments to show real revenue per branch.</summary>
public class Expense
{
    public int Id { get; set; }
    public int BranchId { get; set; }
    public Branch? Branch { get; set; }
    public ExpenseCategory Category { get; set; } = ExpenseCategory.Other;
    public string? Title { get; set; }
    public decimal Amount { get; set; }
    public DateOnly PaidOn { get; set; }
    public string? Note { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
