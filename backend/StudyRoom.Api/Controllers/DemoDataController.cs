using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using StudyRoom.Api.Data;
using StudyRoom.Api.Models;
using StudyRoom.Api.Services;

namespace StudyRoom.Api.Controllers;

/// <summary>
/// Loads (and removes) a realistic set of sample students, payments and expenses so a new room can be explored
/// before real registrations exist. Everything created here is tagged with "[demo]" so it can be removed cleanly.
/// </summary>
[ApiController]
[Route("api/demo")]
[Authorize]
public class DemoDataController : ControllerBase
{
    public const string Tag = "[demo]";
    private const int MinSeats = 40;

    private readonly AppDbContext _db;
    private readonly SettingsService _settings;
    private readonly SeatAllocationService _allocation;

    public DemoDataController(AppDbContext db, SettingsService settings, SeatAllocationService allocation)
    {
        _db = db;
        _settings = settings;
        _allocation = allocation;
    }

    public record DemoStatusDto(int Students, int Payments, int Expenses);
    public record DemoSeedResult(int Students, int Payments, int Expenses, int SeatsAdded, string Message);

    // name, gender, study, months, ac seat, days until due (relative to today), share of the fee already paid, active
    private sealed record Sample(string Name, Gender Gender, string Study, int Months, bool Ac, int DueIn, decimal PaidShare, bool Active = true);

    private static readonly Sample[] Samples =
    {
        // Overdue
        new("Ravi Kumar", Gender.Male, "UPSC Civil Services", 1, false, -12, 1.0m),
        new("Sneha Reddy", Gender.Female, "Bank PO (IBPS)", 2, true, -6, 0.5m),
        new("Mohammed Irfan", Gender.Male, "SSC CGL", 1, false, -3, 1.0m),
        new("Kavya Nair", Gender.Female, "NEET", 3, true, -1, 0.67m),
        // Due today
        new("Arjun Menon", Gender.Male, "CA Inter", 1, true, 0, 1.0m),
        new("Priya Sharma", Gender.Female, "GATE (CSE)", 2, false, 0, 1.0m),
        // Due tomorrow
        new("Vikram Singh", Gender.Male, "TSPSC Group 2", 1, false, 1, 1.0m),
        new("Lakshmi Devi", Gender.Female, "B.Ed entrance", 1, false, 1, 0.6m),
        // Due soon
        new("Suresh Babu", Gender.Male, "Railway NTPC", 1, false, 3, 1.0m),
        new("Ananya Iyer", Gender.Female, "CAT", 2, true, 4, 1.0m),
        // Running
        new("Karthik Raj", Gender.Male, "JEE Advanced", 3, true, 9, 1.0m),
        new("Meera Krishnan", Gender.Female, "UPSC Civil Services", 6, true, 15, 0.5m),
        new("Rahul Verma", Gender.Male, "Degree (B.Com)", 1, false, 22, 1.0m),
        new("Divya Prasad", Gender.Female, "SSC CHSL", 2, false, 27, 1.0m),
        new("Naveen Chandra", Gender.Male, "CA Final", 3, true, 40, 1.0m),
        new("Pooja Patel", Gender.Female, "NEET", 3, true, 55, 0.67m),
        new("Sai Teja", Gender.Male, "APPSC Group 1", 3, false, 70, 1.0m),
        new("Harini S", Gender.Female, "GATE (ECE)", 6, false, 85, 1.0m),
        new("Anil Kumar Goud", Gender.Male, "Police SI", 6, false, 100, 0.5m),
        new("Farhan Ali", Gender.Male, "UPSC Civil Services", 6, true, 120, 1.0m),
        new("Deepika Rao", Gender.Female, "Bank Clerk", 1, false, 12, 1.0m),
        new("Manoj Yadav", Gender.Male, "Intermediate (MPC)", 1, false, 18, 1.0m),
        // Left the room
        new("Sandeep Reddy", Gender.Male, "SSC CGL", 2, false, -40, 1.0m, Active: false),
        new("Nikitha Joshi", Gender.Female, "Bank PO (IBPS)", 1, false, -25, 1.0m, Active: false),
        new("Bhaskar Rao", Gender.Male, "Group 4", 1, false, -70, 0.5m, Active: false),
    };

    [HttpGet]
    public async Task<ActionResult<DemoStatusDto>> Status()
    {
        var studentIds = _db.Students.Where(s => s.Notes != null && s.Notes.StartsWith(Tag)).Select(s => s.Id);
        return new DemoStatusDto(
            await studentIds.CountAsync(),
            await _db.Payments.CountAsync(p => studentIds.Contains(p.StudentId)),
            await _db.Expenses.CountAsync(e => e.Note != null && e.Note.StartsWith(Tag)));
    }

    /// <summary>
    /// Creates 25 sample students (overdue, due today, due tomorrow, due soon, running, and a few who left),
    /// their payments, seat assignments and two months of expenses. Adds seats if the room has fewer than 40.
    /// Pass ?mobile=98xxxxxxxx to give every sample student your own number so test reminders reach you.
    /// </summary>
    [HttpPost("seed")]
    public async Task<ActionResult<DemoSeedResult>> Seed([FromQuery] string? mobile)
    {
        if (await _db.Students.AnyAsync(s => s.Notes != null && s.Notes.StartsWith(Tag)))
            return BadRequest(new { message = "Sample data is already loaded. Remove it first if you want a fresh set." });

        var settings = await _settings.GetAsync();
        var today = SettingsService.Today(settings);
        var branchId = await _settings.DefaultBranchIdAsync();
        var fee = settings.MinimumMonthlyFee > 0 ? settings.MinimumMonthlyFee : 1500m;
        var acFee = Math.Round(fee * 1.2m / 100m, MidpointRounding.AwayFromZero) * 100m;

        var ownMobile = string.IsNullOrWhiteSpace(mobile) ? null : new string(mobile.Where(char.IsDigit).ToArray());
        if (ownMobile is { Length: < 10 }) return BadRequest(new { message = "Mobile must have at least 10 digits." });

        // Make sure there are enough seats to show a busy room.
        var seats = await _db.Seats.Include(s => s.Student).Where(s => s.BranchId == branchId).OrderBy(s => s.Number).ToListAsync();
        var seatsAdded = 0;
        if (seats.Count < MinSeats)
        {
            var next = seats.Count == 0 ? 1 : seats.Max(s => s.Number) + 1;
            var fresh = seats.Count == 0;
            while (seats.Count < MinSeats)
            {
                var seat = new Seat { BranchId = branchId, Number = next, IsAc = fresh && next <= MinSeats / 2, Section = fresh ? (next <= MinSeats / 2 ? "AC hall" : "Non-AC hall") : null };
                _db.Seats.Add(seat);
                seats.Add(seat);
                next++;
                seatsAdded++;
            }
            await _db.SaveChangesAsync();
            await _allocation.ApplyReservationAsync(branchId);
            seats = await _db.Seats.Include(s => s.Student).Where(s => s.BranchId == branchId).OrderBy(s => s.Number).ToListAsync();
        }

        var free = seats.Where(s => s.IsActive && s.Student == null).ToList();
        var students = new List<Student>();
        var payments = 0;

        for (var i = 0; i < Samples.Length; i++)
        {
            var x = Samples[i];
            var perMonth = x.Ac ? acFee : fee;
            var dueDate = today.AddDays(x.DueIn);
            var joining = dueDate.AddMonths(-x.Months);
            var total = perMonth * x.Months;
            var paid = Math.Round(total * x.PaidShare / 50m, MidpointRounding.AwayFromZero) * 50m;
            if (paid <= 0) paid = Math.Min(total, 500m);

            var student = new Student
            {
                BranchId = branchId,
                Name = x.Name,
                Mobile = ownMobile ?? $"10000000{i + 1:D2}",
                Gender = x.Gender,
                Study = x.Study,
                Address = DemoAddress(i),
                Months = x.Months,
                AmountPerMonth = perMonth,
                TotalPaid = paid,
                JoiningDate = joining,
                IsActive = x.Active,
                Notes = x.Active ? $"{Tag} Sample student" : $"{Tag} Sample student · left on {today.AddDays(x.DueIn + 5):dd MMM yyyy}",
                CreatedAt = joining.ToDateTime(TimeOnly.FromTimeSpan(TimeSpan.FromHours(10)), DateTimeKind.Utc),
                UpdatedAt = DateTime.UtcNow,
            };

            // Payment history: a registration payment, and for a few students a later top-up so the history looks real.
            var splitLater = paid >= 1000m && i % 3 == 0 && x.Months > 1;
            if (splitLater)
            {
                var first = Math.Round(paid / 2m / 50m, MidpointRounding.AwayFromZero) * 50m;
                student.Payments.Add(new Payment { Amount = first, PaidOn = joining, Note = "Initial payment at registration" });
                student.Payments.Add(new Payment { Amount = paid - first, PaidOn = joining.AddDays(20), Note = "Balance paid" });
                payments += 2;
            }
            else
            {
                student.Payments.Add(new Payment { Amount = paid, PaidOn = joining, Note = "Initial payment at registration" });
                payments++;
            }

            if (x.Active)
            {
                var seat = PickSeat(free, x.Gender, x.Ac);
                if (seat is not null)
                {
                    student.Seat = seat;
                    student.SeatId = seat.Id;
                    free.Remove(seat);
                }
            }

            students.Add(student);
        }

        _db.Students.AddRange(students);

        // Two months of running costs.
        var firstOfMonth = new DateOnly(today.Year, today.Month, 1);
        var lastMonth = firstOfMonth.AddMonths(-1);
        var expenses = new List<Expense>
        {
            Exp(branchId, ExpenseCategory.Rent, "Room rent", 25000m, lastMonth.AddDays(2)),
            Exp(branchId, ExpenseCategory.Electricity, "Electricity bill", 3800m, lastMonth.AddDays(9)),
            Exp(branchId, ExpenseCategory.Internet, "Broadband", 1200m, lastMonth.AddDays(4)),
            Exp(branchId, ExpenseCategory.Salary, "Caretaker salary", 12000m, lastMonth.AddDays(29)),
            Exp(branchId, ExpenseCategory.Water, "Drinking water cans", 650m, lastMonth.AddDays(15)),
            Exp(branchId, ExpenseCategory.Rent, "Room rent", 25000m, firstOfMonth.AddDays(2)),
            Exp(branchId, ExpenseCategory.Electricity, "Electricity bill", 4200m, firstOfMonth.AddDays(9)),
            Exp(branchId, ExpenseCategory.Internet, "Broadband", 1200m, firstOfMonth.AddDays(4)),
            Exp(branchId, ExpenseCategory.Maintenance, "AC servicing", 2500m, firstOfMonth.AddDays(6)),
        }.Where(e => e.PaidOn <= today).ToList();
        _db.Expenses.AddRange(expenses);

        await _db.SaveChangesAsync();

        var active = students.Count(s => s.IsActive);
        var seated = students.Count(s => s.SeatId != null);
        var message = $"Added {students.Count} students ({active} active, {seated} with seats), {payments} payments and {expenses.Count} expenses" +
                      (seatsAdded > 0 ? $"; created {seatsAdded} seats" : "") + ".";
        return new DemoSeedResult(students.Count, payments, expenses.Count, seatsAdded, message);
    }

    /// <summary>Deletes every student, payment, reminder log and expense created by the seed. Seats are kept.</summary>
    [HttpDelete]
    public async Task<ActionResult<DemoStatusDto>> Remove()
    {
        var students = await _db.Students.Where(s => s.Notes != null && s.Notes.StartsWith(Tag)).ToListAsync();
        var ids = students.Select(s => s.Id).ToList();
        var paymentCount = await _db.Payments.CountAsync(p => ids.Contains(p.StudentId));
        var expenses = await _db.Expenses.Where(e => e.Note != null && e.Note.StartsWith(Tag)).ToListAsync();

        _db.Students.RemoveRange(students);   // payments and reminder logs cascade
        _db.Expenses.RemoveRange(expenses);
        await _db.SaveChangesAsync();

        return new DemoStatusDto(students.Count, paymentCount, expenses.Count);
    }

    /// <summary>Women take reserved seats first so the pink seats show as occupied; men only get unreserved seats.</summary>
    private static Seat? PickSeat(List<Seat> free, Gender gender, bool preferAc)
    {
        IEnumerable<Seat> pool = gender == Gender.Female
            ? free.OrderBy(s => s.ReservedForWomen ? 0 : 1)
            : free.Where(s => !s.ReservedForWomen);
        return pool.OrderBy(s => s.IsAc == preferAc ? 0 : 1).ThenBy(s => s.Number).FirstOrDefault();
    }

    private static Expense Exp(int branchId, ExpenseCategory category, string title, decimal amount, DateOnly paidOn) =>
        new() { BranchId = branchId, Category = category, Title = title, Amount = amount, PaidOn = paidOn, Note = $"{Tag} Sample expense" };

    private static string DemoAddress(int i) => (i % 6) switch
    {
        0 => "H.No 4-12, Gandhi Nagar",
        1 => "Flat 302, Sai Residency, KPHB",
        2 => "12-3-45, Ram Nagar Colony",
        3 => "Plot 88, Vivekananda Nagar",
        4 => "Near Bus Stand, Main Road",
        _ => "Opp. Government School, Old Town",
    };
}
