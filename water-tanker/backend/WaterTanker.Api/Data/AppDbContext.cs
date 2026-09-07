using Microsoft.EntityFrameworkCore;
using WaterTanker.Api.Models;

namespace WaterTanker.Api.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<User> Users => Set<User>();
    public DbSet<Operator> Operators => Set<Operator>();
    public DbSet<Community> Communities => Set<Community>();
    public DbSet<Tanker> Tankers => Set<Tanker>();
    public DbSet<Device> Devices => Set<Device>();
    public DbSet<Delivery> Deliveries => Set<Delivery>();
    public DbSet<TelemetryReading> Readings => Set<TelemetryReading>();
    public DbSet<Booking> Bookings => Set<Booking>();
    public DbSet<Invoice> Invoices => Set<Invoice>();
    public DbSet<Dispute> Disputes => Set<Dispute>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<User>(e =>
        {
            e.HasIndex(u => u.Email).IsUnique();
            e.Property(u => u.Email).HasMaxLength(160).IsRequired();
            e.Property(u => u.DisplayName).HasMaxLength(120);
            e.Property(u => u.Phone).HasMaxLength(20);
            e.Property(u => u.Role).HasConversion<string>().HasMaxLength(16);
            e.HasOne(u => u.Operator).WithMany().HasForeignKey(u => u.OperatorId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(u => u.Community).WithMany().HasForeignKey(u => u.CommunityId).OnDelete(DeleteBehavior.Restrict);
        });

        b.Entity<Operator>(e =>
        {
            e.Property(o => o.Name).HasMaxLength(160).IsRequired();
            e.Property(o => o.Phone).HasMaxLength(20);
            e.Property(o => o.Gstin).HasMaxLength(20);
            e.Property(o => o.Address).HasMaxLength(500);
            e.Property(o => o.RatePerKl).HasPrecision(12, 2);
            e.HasIndex(o => o.Name).IsUnique();
        });

        b.Entity<Community>(e =>
        {
            e.Property(c => c.Name).HasMaxLength(160).IsRequired();
            e.Property(c => c.Area).HasMaxLength(120);
            e.Property(c => c.Address).HasMaxLength(500);
            e.Property(c => c.ContactName).HasMaxLength(120);
            e.Property(c => c.ContactPhone).HasMaxLength(20);
            e.Property(c => c.RatePerKl).HasPrecision(12, 2);
            e.Property(c => c.SubscriptionPerMonth).HasPrecision(12, 2);
            e.HasOne(c => c.PreferredOperator).WithMany().HasForeignKey(c => c.PreferredOperatorId).OnDelete(DeleteBehavior.SetNull);
        });

        b.Entity<Tanker>(e =>
        {
            e.Property(t => t.RegistrationNumber).HasMaxLength(20).IsRequired();
            e.Property(t => t.DriverName).HasMaxLength(120);
            e.Property(t => t.DriverPhone).HasMaxLength(20);
            e.HasIndex(t => new { t.OperatorId, t.RegistrationNumber }).IsUnique();
            e.HasOne(t => t.Operator).WithMany(o => o.Tankers).HasForeignKey(t => t.OperatorId).OnDelete(DeleteBehavior.Restrict);
        });

        b.Entity<Device>(e =>
        {
            e.Property(d => d.DeviceCode).HasMaxLength(40).IsRequired();
            e.Property(d => d.ApiKeyHash).HasMaxLength(128).IsRequired();
            e.Property(d => d.FirmwareVersion).HasMaxLength(40);
            e.Property(d => d.Status).HasConversion<string>().HasMaxLength(16);
            e.HasIndex(d => d.DeviceCode).IsUnique();
            e.HasIndex(d => d.TankerId).IsUnique().HasFilter("\"TankerId\" IS NOT NULL");
            e.HasOne(d => d.Operator).WithMany(o => o.Devices).HasForeignKey(d => d.OperatorId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(d => d.Tanker).WithOne(t => t.Device).HasForeignKey<Device>(d => d.TankerId).OnDelete(DeleteBehavior.SetNull);
        });

        b.Entity<Delivery>(e =>
        {
            e.Property(d => d.Status).HasConversion<string>().HasMaxLength(16);
            e.Property(d => d.QualityGrade).HasConversion<string>().HasMaxLength(16);
            e.Property(d => d.SessionKey).HasMaxLength(64);
            e.Property(d => d.SealPhotoPath).HasMaxLength(300);
            e.Property(d => d.Notes).HasMaxLength(1000);
            e.Property(d => d.LitresDelivered).HasPrecision(12, 1);
            e.Property(d => d.RatePerKl).HasPrecision(12, 2);
            e.Property(d => d.Amount).HasPrecision(12, 2);
            e.HasIndex(d => new { d.DeviceId, d.SessionKey }).IsUnique().HasFilter("\"SessionKey\" IS NOT NULL");
            e.HasIndex(d => new { d.OperatorId, d.StartedAt });
            e.HasIndex(d => new { d.CommunityId, d.StartedAt });
            e.HasIndex(d => d.Status);
            e.HasOne(d => d.Device).WithMany().HasForeignKey(d => d.DeviceId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(d => d.Operator).WithMany().HasForeignKey(d => d.OperatorId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(d => d.Tanker).WithMany().HasForeignKey(d => d.TankerId).OnDelete(DeleteBehavior.SetNull);
            e.HasOne(d => d.Community).WithMany().HasForeignKey(d => d.CommunityId).OnDelete(DeleteBehavior.SetNull);
            e.HasOne(d => d.Booking).WithMany(bk => bk.Deliveries).HasForeignKey(d => d.BookingId).OnDelete(DeleteBehavior.SetNull);
            e.HasOne(d => d.Invoice).WithMany(i => i.Deliveries).HasForeignKey(d => d.InvoiceId).OnDelete(DeleteBehavior.SetNull);
        });

        b.Entity<TelemetryReading>(e =>
        {
            e.HasIndex(r => new { r.DeviceId, r.RecordedAt });
            e.HasIndex(r => r.DeliveryId);
            e.HasOne(r => r.Delivery).WithMany(d => d.Readings).HasForeignKey(r => r.DeliveryId).OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<Booking>(e =>
        {
            e.Property(bk => bk.Status).HasConversion<string>().HasMaxLength(16);
            e.Property(bk => bk.RatePerKl).HasPrecision(12, 2);
            e.Property(bk => bk.Notes).HasMaxLength(500);
            e.HasIndex(bk => new { bk.CommunityId, bk.ScheduledFor });
            e.HasIndex(bk => new { bk.OperatorId, bk.Status });
            e.HasOne(bk => bk.Community).WithMany().HasForeignKey(bk => bk.CommunityId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(bk => bk.Operator).WithMany().HasForeignKey(bk => bk.OperatorId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(bk => bk.Tanker).WithMany().HasForeignKey(bk => bk.TankerId).OnDelete(DeleteBehavior.SetNull);
        });

        b.Entity<Invoice>(e =>
        {
            e.Property(i => i.Number).HasMaxLength(32).IsRequired();
            e.Property(i => i.Status).HasConversion<string>().HasMaxLength(16);
            e.Property(i => i.TotalLitres).HasPrecision(14, 1);
            e.Property(i => i.Amount).HasPrecision(12, 2);
            e.Property(i => i.PaymentReference).HasMaxLength(120);
            e.Property(i => i.PaymentMethod).HasMaxLength(40);
            e.HasIndex(i => i.Number).IsUnique();
            e.HasIndex(i => new { i.CommunityId, i.OperatorId, i.PeriodStart });
            e.HasOne(i => i.Community).WithMany().HasForeignKey(i => i.CommunityId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(i => i.Operator).WithMany().HasForeignKey(i => i.OperatorId).OnDelete(DeleteBehavior.Restrict);
        });

        b.Entity<Dispute>(e =>
        {
            e.Property(d => d.Reason).HasMaxLength(1000).IsRequired();
            e.Property(d => d.Resolution).HasMaxLength(1000);
            e.Property(d => d.Status).HasConversion<string>().HasMaxLength(16);
            e.HasIndex(d => new { d.DeliveryId, d.Status });
            e.HasOne(d => d.Delivery).WithMany().HasForeignKey(d => d.DeliveryId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(d => d.RaisedBy).WithMany().HasForeignKey(d => d.RaisedByUserId).OnDelete(DeleteBehavior.Restrict);
        });
    }
}
