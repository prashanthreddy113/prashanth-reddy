using System.Globalization;
using System.Text;
using Anthropic;
using Anthropic.Models.Messages;
using Microsoft.EntityFrameworkCore;
using StudyRoom.Api.Data;
using StudyRoom.Api.Dtos;
using StudyRoom.Api.Models;

namespace StudyRoom.Api.Services;

public record AiChatMessage(string Role, string Content);
public record AiChatResult(string Reply, string Model, long InputTokens, long OutputTokens);

/// <summary>
/// Claude-powered assistant for the admin: answers questions about the room from a live snapshot of the data
/// and drafts WhatsApp messages for students. Configure with Anthropic__ApiKey (and optionally Anthropic__Model).
/// </summary>
public class AiService
{
    private const int MaxHistoryMessages = 24;
    private const int MaxStudentsInSnapshot = 400;

    private readonly AppDbContext _db;
    private readonly SettingsService _settings;
    private readonly IConfiguration _config;
    private readonly ILogger<AiService> _logger;

    public AiService(AppDbContext db, SettingsService settings, IConfiguration config, ILogger<AiService> logger)
    {
        _db = db;
        _settings = settings;
        _config = config;
        _logger = logger;
    }

    public string Model => _config["Anthropic:Model"] is { Length: > 0 } m ? m.Trim() : "claude-opus-5";

    private string? ApiKey
    {
        get
        {
            var v = _config["Anthropic:ApiKey"];
            if (v is null) return null;
            v = v.Trim().Trim('"', '\'', '`').Trim();
            return v.Length == 0 ? null : v;
        }
    }

    public bool IsConfigured => !string.IsNullOrWhiteSpace(ApiKey);

    private AnthropicClient Client() => new() { ApiKey = ApiKey };

    // ---------------------------------------------------------------- chat

    public async Task<AiChatResult> ChatAsync(IReadOnlyList<AiChatMessage> history, CancellationToken ct = default)
    {
        var settings = await _settings.GetAsync(ct);
        var today = SettingsService.Today(settings);
        var snapshot = await BuildSnapshotAsync(settings, today, ct);
        var system = ChatInstructions(settings, today) + "\n\n" + snapshot;

        var messages = new List<MessageParam>();
        foreach (var m in history.TakeLast(MaxHistoryMessages))
        {
            var isAssistant = string.Equals(m.Role, "assistant", StringComparison.OrdinalIgnoreCase);
            if (messages.Count == 0 && isAssistant) continue; // the conversation must start with the admin
            messages.Add(new MessageParam { Role = isAssistant ? Role.Assistant : Role.User, Content = m.Content });
        }
        if (messages.Count == 0) throw new ArgumentException("Ask a question first.");

        var response = await Client().Messages.Create(new MessageCreateParams
        {
            Model = Model,
            MaxTokens = 4096,
            System = system,
            OutputConfig = new OutputConfig { Effort = Effort.Medium },
            Messages = messages,
        });

        var sbReply = new StringBuilder();
        foreach (var block in response.Content)
            if (block.TryPickText(out TextBlock? textBlock)) sbReply.Append(textBlock.Text);
        var reply = sbReply.ToString();
        if (response.StopReason == "refusal")
            reply = "I can't help with that request. Try asking about students, seats, dues, payments or expenses.";
        if (string.IsNullOrWhiteSpace(reply))
            reply = "I couldn't come up with an answer. Please rephrase the question.";

        _logger.LogInformation("AI chat: {In} in / {Out} out tokens on {Model}", response.Usage.InputTokens, response.Usage.OutputTokens, Model);
        return new AiChatResult(reply.Trim(), Model, response.Usage.InputTokens, response.Usage.OutputTokens);
    }

    // ---------------------------------------------------------------- message drafting

    public async Task<string?> DraftAsync(int studentId, string? purpose, string? language, string? instructions, CancellationToken ct = default)
    {
        var settings = await _settings.GetAsync(ct);
        var today = SettingsService.Today(settings);
        var s = await _db.Students.Include(x => x.Seat).AsNoTracking().FirstOrDefaultAsync(x => x.Id == studentId, ct);
        if (s is null) return null;

        var dto = StudentMapper.ToDto(s, today, settings.DueSoonDays);
        var purposeText = (purpose ?? "reminder").Trim().ToLowerInvariant() switch
        {
            "overdue" => "a firm but polite notice that the subscription has expired and the seat will be released if it is not renewed",
            "welcome" => "a warm welcome message after registration with the seat number, due date and the room's timings",
            "thanks" => "a short thank-you for the payment received, confirming the amount paid and any remaining balance",
            "custom" => "whatever the admin describes in the instructions",
            _ => "a friendly reminder that the subscription is due, asking them to renew and mentioning any pending balance",
        };
        var lang = string.IsNullOrWhiteSpace(language) ? "English" : language.Trim();

        var system = $"""
            You write WhatsApp messages sent by the admin of "{settings.RoomName}", a reading room (self-study library) in India, to its students.
            Write {purposeText}.
            Language: {lang}. If the language is Telugu or Hindi, write in that script; "Hinglish" or "Tenglish" means that language written in Latin letters mixed with English.
            Keep it under 80 words, warm and respectful, one or two short paragraphs, no bullet points, no subject line.
            Address the student by first name. Sign off as "{settings.RoomName}".
            Output only the message text - no quotes, no explanation, no placeholders.
            """;

        var facts = new StringBuilder();
        facts.AppendLine($"Today: {today:dd MMM yyyy}");
        facts.AppendLine($"Student: {s.Name}, {GenderText(s.Gender)}");
        facts.AppendLine($"Seat: {(s.Seat is null ? "no seat assigned" : $"{s.Seat.Number}{(s.Seat.IsAc ? " (AC)" : "")}{(s.Seat.Section is null ? "" : ", " + s.Seat.Section)}")}");
        if (!string.IsNullOrWhiteSpace(s.Study)) facts.AppendLine($"Preparing for: {s.Study}");
        facts.AppendLine($"Joined: {s.JoiningDate:dd MMM yyyy}, subscribed {s.Months} month(s) at {Money(s.AmountPerMonth, settings.Currency)} per month");
        facts.AppendLine($"Paid so far: {Money(s.TotalPaid, settings.Currency)}; pending balance: {Money(Math.Max(0, s.Balance), settings.Currency)}");
        facts.AppendLine($"Due date: {s.DueDate:dd MMM yyyy} ({StatusText(dto.Status, dto.DaysUntilDue)})");
        if (!string.IsNullOrWhiteSpace(instructions)) facts.AppendLine($"Admin's instructions: {instructions.Trim()}");

        var response = await Client().Messages.Create(new MessageCreateParams
        {
            Model = Model,
            MaxTokens = 1024,
            System = system,
            OutputConfig = new OutputConfig { Effort = Effort.Low },
            Messages = [new MessageParam { Role = Role.User, Content = facts.ToString() }],
        });

        var sbText = new StringBuilder();
        foreach (var block in response.Content)
            if (block.TryPickText(out TextBlock? textBlock)) sbText.Append(textBlock.Text);
        var text = sbText.ToString().Trim().Trim('"');
        return response.StopReason == "refusal" || text.Length == 0 ? "" : text;
    }

    // ---------------------------------------------------------------- snapshot

    private static string ChatInstructions(RoomSettings settings, DateOnly today) => $"""
        You are the assistant inside the admin console of "{settings.RoomName}", a reading room (self-study library) in India.
        You are talking to the admin. Today is {today:dddd, dd MMMM yyyy} in the {settings.TimeZoneId} time zone. Currency: {settings.Currency}.

        Answer from the data snapshot below. It is the complete, current state of the room. If something is not in the snapshot, say you don't have that information; never invent names, numbers or dates.
        Be brief and concrete: lead with the answer, then the supporting names and amounts. Use plain text - short lines and "-" bullets are fine, but no markdown headings, tables or bold.
        When listing students, give name, seat and the relevant amount or date, and mention the student id in parentheses only when the admin asks for it.
        Status meanings: OVERDUE = due date has passed; DUE TODAY; DUE SOON = due within {settings.DueSoonDays} days; RUNNING = more than {settings.DueSoonDays} days left; LEFT = deactivated, seat released.
        You cannot change any data. When the admin wants to do something, name the page: Students (register, edit, payments, renew, due date), Seats (capacity, reserved seats, transfer), Reminders (WhatsApp sending and history), Expenses, Settings.
        If asked to draft a WhatsApp message, write it ready to send: under 80 words, polite, first name, seat, due date and balance where relevant, signed "{settings.RoomName}". Write in the language the admin asks for; default English.
        """;

    private async Task<string> BuildSnapshotAsync(RoomSettings settings, DateOnly today, CancellationToken ct)
    {
        var cur = settings.Currency;
        var firstOfMonth = new DateOnly(today.Year, today.Month, 1);
        var lastMonthStart = firstOfMonth.AddMonths(-1);

        var students = await _db.Students.Include(s => s.Seat).AsNoTracking().ToListAsync(ct);
        var seats = await _db.Seats.Include(s => s.Student).AsNoTracking().Where(s => s.IsActive).ToListAsync(ct);
        var recentPayments = await _db.Payments.Include(p => p.Student).AsNoTracking().OrderByDescending(p => p.PaidOn).ThenByDescending(p => p.Id).Take(15).ToListAsync(ct);
        var recentExpenses = await _db.Expenses.AsNoTracking().OrderByDescending(e => e.PaidOn).ThenByDescending(e => e.Id).Take(10).ToListAsync(ct);

        var collectedThisMonth = await _db.Payments.Where(p => p.PaidOn >= firstOfMonth && p.PaidOn <= today).SumAsync(p => (decimal?)p.Amount, ct) ?? 0m;
        var collectedLastMonth = await _db.Payments.Where(p => p.PaidOn >= lastMonthStart && p.PaidOn < firstOfMonth).SumAsync(p => (decimal?)p.Amount, ct) ?? 0m;
        var spentThisMonth = await _db.Expenses.Where(e => e.PaidOn >= firstOfMonth && e.PaidOn <= today).SumAsync(e => (decimal?)e.Amount, ct) ?? 0m;
        var spentLastMonth = await _db.Expenses.Where(e => e.PaidOn >= lastMonthStart && e.PaidOn < firstOfMonth).SumAsync(e => (decimal?)e.Amount, ct) ?? 0m;

        var weekAgo = today.AddDays(-7);
        var remindersSent = await _db.ReminderLogs.CountAsync(r => r.SentOn >= weekAgo && r.Status == ReminderStatus.Sent, ct);
        var remindersFailed = await _db.ReminderLogs.CountAsync(r => r.SentOn >= weekAgo && r.Status == ReminderStatus.Failed, ct);

        var rows = students.Select(s => (Student: s, Dto: StudentMapper.ToDto(s, today, settings.DueSoonDays))).ToList();
        var active = rows.Where(r => r.Student.IsActive).OrderBy(r => r.Dto.DueDate).ThenBy(r => r.Student.Name).ToList();
        var inactive = rows.Where(r => !r.Student.IsActive).OrderByDescending(r => r.Student.UpdatedAt).ToList();

        var sb = new StringBuilder();
        sb.AppendLine("=== ROOM ===");
        sb.AppendLine($"Standard monthly fee: {(settings.MinimumMonthlyFee > 0 ? Money(settings.MinimumMonthlyFee, cur) : "not set")}. Seats reserved for women: {settings.FemaleReservationPercent}%.");
        sb.AppendLine($"WhatsApp reminders: {(settings.RemindersEnabled ? $"on, daily at {settings.ReminderHour:00}:00, {settings.ReminderDaysBefore} days before, on the due day{(settings.OverdueRepeatEveryDays > 0 ? $", every {settings.OverdueRepeatEveryDays} days while overdue" : "")}" : "off")}. Last 7 days: {remindersSent} sent, {remindersFailed} failed.");

        sb.AppendLine();
        sb.AppendLine("=== SEATS ===");
        var occupied = seats.Count(s => s.Student != null);
        var free = seats.Where(s => s.Student == null).ToList();
        sb.AppendLine($"Active seats: {seats.Count}. Occupied: {occupied}. Free: {free.Count} (open to anyone: {free.Count(s => !s.ReservedForWomen)}, women only: {free.Count(s => s.ReservedForWomen)}). AC seats: {seats.Count(s => s.IsAc)} ({seats.Count(s => s.IsAc && s.Student == null)} free). Non-AC seats: {seats.Count(s => !s.IsAc)} ({seats.Count(s => !s.IsAc && s.Student == null)} free).");
        if (free.Count > 0)
            sb.AppendLine("Free seat numbers: " + string.Join(", ", free.OrderBy(s => s.Number).Select(s => $"{s.Number}{(s.IsAc ? "AC" : "")}{(s.ReservedForWomen ? "W" : "")}")) + "  (AC = air-conditioned, W = reserved for women)");
        var sections = seats.Where(s => s.Section != null).GroupBy(s => s.Section!).ToList();
        if (sections.Count > 0)
            sb.AppendLine("Sections: " + string.Join("; ", sections.Select(g => $"{g.Key}: {g.Count()} seats, {g.Count(s => s.Student == null)} free")));

        sb.AppendLine();
        sb.AppendLine("=== MONEY ===");
        sb.AppendLine($"This month ({firstOfMonth:MMM yyyy}): collected {Money(collectedThisMonth, cur)}, expenses {Money(spentThisMonth, cur)}, net {Money(collectedThisMonth - spentThisMonth, cur)}.");
        sb.AppendLine($"Last month ({lastMonthStart:MMM yyyy}): collected {Money(collectedLastMonth, cur)}, expenses {Money(spentLastMonth, cur)}, net {Money(collectedLastMonth - spentLastMonth, cur)}.");
        var outstanding = active.Sum(r => Math.Max(0, r.Student.Balance));
        sb.AppendLine($"Outstanding balance across active students: {Money(outstanding, cur)} from {active.Count(r => r.Student.Balance > 0)} students.");

        sb.AppendLine();
        sb.AppendLine("=== STUDENT SUMMARY ===");
        sb.AppendLine($"Active: {active.Count} (overdue {active.Count(r => r.Dto.Status == DueStatus.Overdue)}, due today {active.Count(r => r.Dto.Status == DueStatus.DueToday)}, due soon {active.Count(r => r.Dto.Status == DueStatus.DueSoon)}, running {active.Count(r => r.Dto.Status == DueStatus.Active)}). Left: {inactive.Count}. Women: {active.Count(r => r.Student.Gender == Gender.Female)}, men: {active.Count(r => r.Student.Gender == Gender.Male)}. Without a seat: {active.Count(r => r.Student.SeatId == null)}.");

        sb.AppendLine();
        sb.AppendLine("=== ACTIVE STUDENTS (sorted by due date) ===");
        sb.AppendLine("Format: id | name | gender | seat | course | joined | plan | paid | balance | due date | status | mobile");
        foreach (var (s, d) in active.Take(MaxStudentsInSnapshot))
            sb.AppendLine(StudentLine(s, d, cur));
        if (active.Count > MaxStudentsInSnapshot) sb.AppendLine($"... and {active.Count - MaxStudentsInSnapshot} more active students not listed.");

        if (inactive.Count > 0)
        {
            sb.AppendLine();
            sb.AppendLine("=== STUDENTS WHO LEFT (most recent first, up to 40) ===");
            foreach (var (s, d) in inactive.Take(40))
                sb.AppendLine($"#{s.Id} | {s.Name} | {GenderText(s.Gender)} | joined {s.JoiningDate:dd MMM yyyy} | last due {s.DueDate:dd MMM yyyy} | balance {Money(Math.Max(0, s.Balance), cur)} | {s.Mobile}");
        }

        sb.AppendLine();
        sb.AppendLine("=== RECENT PAYMENTS (latest 15) ===");
        if (recentPayments.Count == 0) sb.AppendLine("none");
        foreach (var p in recentPayments)
            sb.AppendLine($"{p.PaidOn:dd MMM yyyy} | {p.Student?.Name ?? "?"} (#{p.StudentId}) | {Money(p.Amount, cur)}{(string.IsNullOrWhiteSpace(p.Note) ? "" : " | " + p.Note)}");

        sb.AppendLine();
        sb.AppendLine("=== RECENT EXPENSES (latest 10) ===");
        if (recentExpenses.Count == 0) sb.AppendLine("none");
        foreach (var e in recentExpenses)
            sb.AppendLine($"{e.PaidOn:dd MMM yyyy} | {e.Category} | {e.Title ?? ""} | {Money(e.Amount, cur)}");

        return sb.ToString();
    }

    private static string StudentLine(Student s, StudentDto d, string cur)
    {
        var seat = s.Seat is null ? "no seat" : $"{s.Seat.Number}{(s.Seat.IsAc ? " AC" : "")}";
        var due = s.DueDateOverride is null ? $"{s.DueDate:dd MMM yyyy}" : $"{s.DueDate:dd MMM yyyy} (edited by admin; real {s.ScheduledDueDate:dd MMM yyyy})";
        return $"#{s.Id} | {s.Name} | {GenderText(s.Gender)} | {seat} | {s.Study ?? "-"} | {s.JoiningDate:dd MMM yyyy} | {s.Months} mo @ {Money(s.AmountPerMonth, cur)} | paid {Money(s.TotalPaid, cur)} | balance {Money(Math.Max(0, s.Balance), cur)} | {due} | {StatusText(d.Status, d.DaysUntilDue)} | {s.Mobile}";
    }

    private static string StatusText(DueStatus status, int daysUntilDue) => status switch
    {
        DueStatus.Overdue => $"OVERDUE by {-daysUntilDue} day(s)",
        DueStatus.DueToday => "DUE TODAY",
        DueStatus.DueSoon => $"DUE SOON in {daysUntilDue} day(s)",
        DueStatus.Inactive => "LEFT",
        _ => $"RUNNING, {daysUntilDue} day(s) left",
    };

    private static string GenderText(Gender? g) => g switch { Gender.Female => "F", Gender.Male => "M", Gender.Other => "other", _ => "?" };

    private static string Money(decimal amount, string currency) => ReminderService.FormatMoney(amount, currency);
}
