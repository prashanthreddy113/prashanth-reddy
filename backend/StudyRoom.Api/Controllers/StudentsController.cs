using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using StudyRoom.Api.Data;
using StudyRoom.Api.Dtos;
using StudyRoom.Api.Models;
using StudyRoom.Api.Services;

namespace StudyRoom.Api.Controllers;

[ApiController]
[Route("api/students")]
[Authorize]
public class StudentsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly SettingsService _settings;

    public StudentsController(AppDbContext db, SettingsService settings)
    {
        _db = db;
        _settings = settings;
    }

    /// <summary>List students with computed due status. Filter by status, search by name/mobile/seat.</summary>
    [HttpGet]
    public async Task<ActionResult<List<StudentDto>>> List(
        [FromQuery] string? search,
        [FromQuery] DueStatus? status,
        [FromQuery] bool includeInactive = true)
    {
        var settings = await _settings.GetAsync();
        var today = SettingsService.Today(settings);

        var query = _db.Students.Include(s => s.Seat).AsNoTracking().AsQueryable();
        if (!includeInactive) query = query.Where(s => s.IsActive);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            var lowered = term.ToLower();
            var isNumber = int.TryParse(term, out var seatNo);
            query = query.Where(s =>
                s.Name.ToLower().Contains(lowered) ||
                s.Mobile.Contains(term) ||
                (s.Study != null && s.Study.ToLower().Contains(lowered)) ||
                (isNumber && s.Seat != null && s.Seat.Number == seatNo));
        }

        var students = await query.ToListAsync();
        var dtos = students.Select(s => StudentMapper.ToDto(s, today, settings.DueSoonDays));
        if (status.HasValue) dtos = dtos.Where(d => d.Status == status.Value);

        return dtos
            .OrderBy(d => d.Status == DueStatus.Inactive ? 1 : 0)
            .ThenBy(d => d.DueDate)
            .ThenBy(d => d.Name)
            .ToList();
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<StudentDto>> Get(int id)
    {
        var settings = await _settings.GetAsync();
        var today = SettingsService.Today(settings);
        var student = await _db.Students.Include(s => s.Seat).Include(s => s.Payments)
            .AsNoTracking().FirstOrDefaultAsync(s => s.Id == id);
        if (student is null) return NotFound();
        return StudentMapper.ToDto(student, today, settings.DueSoonDays, includePayments: true);
    }

    [HttpPost]
    public async Task<ActionResult<StudentDto>> Create(StudentUpsertRequest request)
    {
        var settings = await _settings.GetAsync();
        var today = SettingsService.Today(settings);

        var student = new Student();
        var error = await ApplyAsync(student, request);
        if (error is not null) return BadRequest(new { message = error });

        if (student.TotalPaid > 0)
        {
            student.Payments.Add(new Payment
            {
                Amount = student.TotalPaid,
                PaidOn = request.JoiningDate,
                Note = "Initial payment at registration"
            });
        }

        _db.Students.Add(student);
        await _db.SaveChangesAsync();
        await _db.Entry(student).Reference(s => s.Seat).LoadAsync();

        var dto = StudentMapper.ToDto(student, today, settings.DueSoonDays, includePayments: true);
        return CreatedAtAction(nameof(Get), new { id = student.Id }, dto);
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<StudentDto>> Update(int id, StudentUpsertRequest request)
    {
        var settings = await _settings.GetAsync();
        var today = SettingsService.Today(settings);

        var student = await _db.Students.Include(s => s.Seat).Include(s => s.Payments).FirstOrDefaultAsync(s => s.Id == id);
        if (student is null) return NotFound();

        var error = await ApplyAsync(student, request);
        if (error is not null) return BadRequest(new { message = error });

        student.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        await _db.Entry(student).Reference(s => s.Seat).LoadAsync();

        return StudentMapper.ToDto(student, today, settings.DueSoonDays, includePayments: true);
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var student = await _db.Students.FindAsync(id);
        if (student is null) return NotFound();
        _db.Students.Remove(student);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    /// <summary>Mark a student as left/inactive and free their seat.</summary>
    [HttpPost("{id:int}/deactivate")]
    public async Task<ActionResult<StudentDto>> Deactivate(int id)
    {
        var student = await _db.Students.Include(s => s.Seat).FirstOrDefaultAsync(s => s.Id == id);
        if (student is null) return NotFound();
        student.IsActive = false;
        student.SeatId = null;
        student.Seat = null;
        student.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        var settings = await _settings.GetAsync();
        return StudentMapper.ToDto(student, SettingsService.Today(settings), settings.DueSoonDays);
    }

    [HttpPost("{id:int}/activate")]
    public async Task<ActionResult<StudentDto>> Activate(int id, [FromQuery] int? seatNumber)
    {
        var student = await _db.Students.Include(s => s.Seat).FirstOrDefaultAsync(s => s.Id == id);
        if (student is null) return NotFound();

        if (seatNumber.HasValue)
        {
            var (seat, err) = await ResolveSeatAsync(seatNumber.Value, student.Id);
            if (err is not null) return BadRequest(new { message = err });
            student.Seat = seat;
            student.SeatId = seat!.Id;
        }

        student.IsActive = true;
        student.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        var settings = await _settings.GetAsync();
        return StudentMapper.ToDto(student, SettingsService.Today(settings), settings.DueSoonDays);
    }

    /// <summary>Record a payment; increases the student's total paid amount.</summary>
    [HttpPost("{id:int}/payments")]
    public async Task<ActionResult<StudentDto>> AddPayment(int id, PaymentRequest request)
    {
        var settings = await _settings.GetAsync();
        var today = SettingsService.Today(settings);

        var student = await _db.Students.Include(s => s.Seat).Include(s => s.Payments).FirstOrDefaultAsync(s => s.Id == id);
        if (student is null) return NotFound();

        student.Payments.Add(new Payment
        {
            Amount = request.Amount,
            PaidOn = request.PaidOn ?? today,
            Note = request.Note?.Trim()
        });
        student.TotalPaid += request.Amount;
        student.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return StudentMapper.ToDto(student, today, settings.DueSoonDays, includePayments: true);
    }

    [HttpDelete("{id:int}/payments/{paymentId:int}")]
    public async Task<ActionResult<StudentDto>> DeletePayment(int id, int paymentId)
    {
        var settings = await _settings.GetAsync();
        var today = SettingsService.Today(settings);

        var student = await _db.Students.Include(s => s.Seat).Include(s => s.Payments).FirstOrDefaultAsync(s => s.Id == id);
        if (student is null) return NotFound();
        var payment = student.Payments.FirstOrDefault(p => p.Id == paymentId);
        if (payment is null) return NotFound();

        student.Payments.Remove(payment);
        student.TotalPaid = Math.Max(0, student.TotalPaid - payment.Amount);
        student.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return StudentMapper.ToDto(student, today, settings.DueSoonDays, includePayments: true);
    }

    /// <summary>Extend the subscription by N months (optionally collecting a payment).</summary>
    [HttpPost("{id:int}/renew")]
    public async Task<ActionResult<StudentDto>> Renew(int id, RenewRequest request)
    {
        var settings = await _settings.GetAsync();
        var today = SettingsService.Today(settings);

        var student = await _db.Students.Include(s => s.Seat).Include(s => s.Payments).FirstOrDefaultAsync(s => s.Id == id);
        if (student is null) return NotFound();

        student.Months += request.Months;
        if (request.AmountPerMonth.HasValue) student.AmountPerMonth = request.AmountPerMonth.Value;
        student.IsActive = true;

        if (request.PaidAmount is > 0)
        {
            student.Payments.Add(new Payment
            {
                Amount = request.PaidAmount.Value,
                PaidOn = request.PaidOn ?? today,
                Note = request.Note?.Trim() ?? $"Renewal (+{request.Months} month{(request.Months > 1 ? "s" : "")})"
            });
            student.TotalPaid += request.PaidAmount.Value;
        }

        student.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return StudentMapper.ToDto(student, today, settings.DueSoonDays, includePayments: true);
    }

    // ----- helpers -----

    private async Task<string?> ApplyAsync(Student student, StudentUpsertRequest request)
    {
        student.Name = request.Name.Trim();
        student.Mobile = request.Mobile.Trim();
        student.Address = Clean(request.Address);
        student.Aadhaar = Clean(request.Aadhaar);
        student.Study = Clean(request.Study);
        student.Notes = Clean(request.Notes);
        student.Months = request.Months;
        student.AmountPerMonth = request.AmountPerMonth;
        student.TotalPaid = request.TotalPaid;
        student.JoiningDate = request.JoiningDate;
        student.IsActive = request.IsActive;

        if (request.SeatNumber.HasValue && request.IsActive)
        {
            var (seat, err) = await ResolveSeatAsync(request.SeatNumber.Value, student.Id);
            if (err is not null) return err;
            student.Seat = seat;
            student.SeatId = seat!.Id;
        }
        else
        {
            student.Seat = null;
            student.SeatId = null;
        }

        return null;
    }

    private async Task<(Seat? seat, string? error)> ResolveSeatAsync(int seatNumber, int currentStudentId)
    {
        var seat = await _db.Seats.Include(s => s.Student).FirstOrDefaultAsync(s => s.Number == seatNumber);
        if (seat is null) return (null, $"Seat {seatNumber} does not exist. Create seats from the Seats page first.");
        if (!seat.IsActive) return (null, $"Seat {seatNumber} is marked unavailable.");
        if (seat.Student is not null && seat.Student.Id != currentStudentId)
            return (null, $"Seat {seatNumber} is already occupied by {seat.Student.Name}.");
        return (seat, null);
    }

    private static string? Clean(string? value)
    {
        var trimmed = value?.Trim();
        return string.IsNullOrEmpty(trimmed) ? null : trimmed;
    }
}
