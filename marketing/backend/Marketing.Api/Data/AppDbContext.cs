using Marketing.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Marketing.Api.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<User> Users => Set<User>();
    public DbSet<Project> Projects => Set<Project>();
    public DbSet<UserProject> UserProjects => Set<UserProject>();
    public DbSet<Lead> Leads => Set<Lead>();
    public DbSet<LeadPhoto> LeadPhotos => Set<LeadPhoto>();
    public DbSet<Activity> Activities => Set<Activity>();
    public DbSet<CompanySettings> Settings => Set<CompanySettings>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<User>(e =>
        {
            e.HasIndex(u => u.Username).IsUnique();
            e.Property(u => u.Username).HasMaxLength(64);
            e.Property(u => u.DisplayName).HasMaxLength(120);
            e.Property(u => u.Mobile).HasMaxLength(20);
            e.Property(u => u.Role).HasConversion<string>().HasMaxLength(16);
        });

        b.Entity<Project>(e =>
        {
            e.Property(p => p.Name).HasMaxLength(120);
            e.Property(p => p.Color).HasMaxLength(16);
            e.HasIndex(p => p.Name).IsUnique();
        });

        b.Entity<UserProject>(e =>
        {
            e.HasKey(x => new { x.UserId, x.ProjectId });
            e.HasOne(x => x.User).WithMany(u => u.UserProjects).HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Project).WithMany(p => p.UserProjects).HasForeignKey(x => x.ProjectId).OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<Lead>(e =>
        {
            e.Property(l => l.ShopName).HasMaxLength(160);
            e.Property(l => l.ContactName).HasMaxLength(120);
            e.Property(l => l.Mobile).HasMaxLength(20);
            e.Property(l => l.AltMobile).HasMaxLength(20);
            e.Property(l => l.Email).HasMaxLength(160);
            e.Property(l => l.ShopType).HasMaxLength(60);
            e.Property(l => l.City).HasMaxLength(80);
            e.Property(l => l.Area).HasMaxLength(120);
            e.Property(l => l.Pincode).HasMaxLength(12);
            e.Property(l => l.Status).HasConversion<string>().HasMaxLength(20);
            e.Property(l => l.ExpectedValue).HasPrecision(14, 2);
            e.HasIndex(l => new { l.ProjectId, l.Mobile });
            e.HasIndex(l => l.AssignedToUserId);
            e.HasIndex(l => l.Status);
            e.HasIndex(l => l.NextFollowUpAt);
            e.HasIndex(l => l.CreatedAt);
            e.HasOne(l => l.Project).WithMany(p => p.Leads).HasForeignKey(l => l.ProjectId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(l => l.CreatedBy).WithMany().HasForeignKey(l => l.CreatedByUserId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(l => l.AssignedTo).WithMany().HasForeignKey(l => l.AssignedToUserId).OnDelete(DeleteBehavior.Restrict);
        });

        b.Entity<LeadPhoto>(e =>
        {
            e.Property(p => p.ContentType).HasMaxLength(60);
            e.Property(p => p.Caption).HasMaxLength(200);
            e.HasOne(p => p.Lead).WithMany(l => l.Photos).HasForeignKey(p => p.LeadId).OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<Activity>(e =>
        {
            e.Property(a => a.Type).HasConversion<string>().HasMaxLength(20);
            e.Property(a => a.FromStatus).HasConversion<string>().HasMaxLength(20);
            e.Property(a => a.ToStatus).HasConversion<string>().HasMaxLength(20);
            e.HasIndex(a => a.CreatedAt);
            e.HasIndex(a => new { a.LeadId, a.CreatedAt });
            e.HasOne(a => a.Lead).WithMany(l => l.Activities).HasForeignKey(a => a.LeadId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(a => a.User).WithMany().HasForeignKey(a => a.UserId).OnDelete(DeleteBehavior.Restrict);
        });

        b.Entity<CompanySettings>(e =>
        {
            e.Property(s => s.CompanyName).HasMaxLength(120);
            e.Property(s => s.Tagline).HasMaxLength(200);
            e.Property(s => s.Currency).HasMaxLength(8);
            e.Property(s => s.DefaultCountryCode).HasMaxLength(6);
            e.Property(s => s.TimeZoneId).HasMaxLength(64);
        });
    }
}
