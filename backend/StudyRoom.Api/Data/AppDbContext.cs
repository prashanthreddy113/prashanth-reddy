using Microsoft.EntityFrameworkCore;
using StudyRoom.Api.Models;

namespace StudyRoom.Api.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<Admin> Admins => Set<Admin>();
    public DbSet<Branch> Branches => Set<Branch>();
    public DbSet<Seat> Seats => Set<Seat>();
    public DbSet<Student> Students => Set<Student>();
    public DbSet<Payment> Payments => Set<Payment>();
    public DbSet<RoomSettings> Settings => Set<RoomSettings>();
    public DbSet<ReminderLog> ReminderLogs => Set<ReminderLog>();
    public DbSet<Expense> Expenses => Set<Expense>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Admin>(e =>
        {
            e.HasIndex(a => a.Username).IsUnique();
            e.Property(a => a.Username).HasMaxLength(64).IsRequired();
            e.Property(a => a.DisplayName).HasMaxLength(100);
        });

        modelBuilder.Entity<Branch>(e =>
        {
            e.Property(b => b.Name).HasMaxLength(120).IsRequired();
            e.Property(b => b.Code).HasMaxLength(20);
            e.Property(b => b.Address).HasMaxLength(500);
            e.Property(b => b.Phone).HasMaxLength(20);
            e.HasIndex(b => b.Name).IsUnique();
        });

        modelBuilder.Entity<Seat>(e =>
        {
            e.HasIndex(s => new { s.BranchId, s.Number }).IsUnique();
            e.Property(s => s.Label).HasMaxLength(50);
            e.Property(s => s.Section).HasMaxLength(80);
            e.HasOne(s => s.Branch).WithMany(b => b.Seats).HasForeignKey(s => s.BranchId).OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<Student>(e =>
        {
            e.Property(s => s.Name).HasMaxLength(120).IsRequired();
            e.Property(s => s.Mobile).HasMaxLength(20).IsRequired();
            e.Property(s => s.Address).HasMaxLength(500);
            e.Property(s => s.Aadhaar).HasMaxLength(12);
            e.Property(s => s.Study).HasMaxLength(200);
            e.Property(s => s.Notes).HasMaxLength(1000);
            e.Property(s => s.AmountPerMonth).HasPrecision(12, 2);
            e.Property(s => s.TotalPaid).HasPrecision(12, 2);
            e.HasIndex(s => s.Mobile);
            e.HasIndex(s => s.BranchId);
            e.Property(s => s.Gender).HasConversion<string>().HasMaxLength(10);
            e.HasOne(s => s.Branch).WithMany(b => b.Students).HasForeignKey(s => s.BranchId).OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(s => s.SeatId).IsUnique().HasFilter("\"SeatId\" IS NOT NULL");

            e.HasOne(s => s.Seat)
             .WithOne(seat => seat.Student)
             .HasForeignKey<Student>(s => s.SeatId)
             .OnDelete(DeleteBehavior.SetNull);

            e.Ignore(s => s.DueDate);
            e.Ignore(s => s.ScheduledDueDate);
            e.Ignore(s => s.TotalFee);
            e.Ignore(s => s.Balance);
        });

        modelBuilder.Entity<Payment>(e =>
        {
            e.Property(p => p.Amount).HasPrecision(12, 2);
            e.Property(p => p.Note).HasMaxLength(300);
            e.HasOne(p => p.Student)
             .WithMany(s => s.Payments)
             .HasForeignKey(p => p.StudentId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Expense>(e =>
        {
            e.Property(x => x.Amount).HasPrecision(12, 2);
            e.Property(x => x.Title).HasMaxLength(120);
            e.Property(x => x.Note).HasMaxLength(500);
            e.Property(x => x.Category).HasConversion<string>().HasMaxLength(20);
            e.HasIndex(x => new { x.BranchId, x.PaidOn });
            e.HasOne(x => x.Branch).WithMany().HasForeignKey(x => x.BranchId).OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<RoomSettings>(e =>
        {
            e.Property(s => s.RoomName).HasMaxLength(120);
            e.Property(s => s.TimeZoneId).HasMaxLength(64);
            e.Property(s => s.Currency).HasMaxLength(8);
            e.Property(s => s.ReminderDaysBefore).HasMaxLength(64);
            e.Property(s => s.WhatsAppTemplateName).HasMaxLength(120);
            e.Property(s => s.WhatsAppReceiptTemplateName).HasMaxLength(120);
            e.Property(s => s.MinimumMonthlyFee).HasPrecision(12, 2);
            e.Property(s => s.WhatsAppLanguageCode).HasMaxLength(16);
        });

        modelBuilder.Entity<ReminderLog>(e =>
        {
            e.Property(r => r.Mobile).HasMaxLength(20);
            e.Property(r => r.Message).HasMaxLength(1000);
            e.Property(r => r.ProviderMessageId).HasMaxLength(200);
            e.Property(r => r.Error).HasMaxLength(1000);
            e.HasIndex(r => new { r.StudentId, r.SentOn, r.Kind });
            e.HasIndex(r => r.CreatedAt);
            e.HasOne(r => r.Student)
             .WithMany()
             .HasForeignKey(r => r.StudentId)
             .OnDelete(DeleteBehavior.Cascade);
        });
    }
}
