using System.Text.Json;
using ManaBandi.Api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;

namespace ManaBandi.Api.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<User> Users => Set<User>();
    public DbSet<OtpCode> OtpCodes => Set<OtpCode>();
    public DbSet<Consent> Consents => Set<Consent>();
    public DbSet<Town> Towns => Set<Town>();
    public DbSet<Landmark> Landmarks => Set<Landmark>();
    public DbSet<Captain> Captains => Set<Captain>();
    public DbSet<CaptainKyc> CaptainKyc => Set<CaptainKyc>();
    public DbSet<CaptainDocument> CaptainDocuments => Set<CaptainDocument>();
    public DbSet<StoredFile> Files => Set<StoredFile>();
    public DbSet<Ride> Rides => Set<Ride>();
    public DbSet<RideEvent> RideEvents => Set<RideEvent>();
    public DbSet<Offer> Offers => Set<Offer>();
    public DbSet<LocationPoint> LocationPoints => Set<LocationPoint>();
    public DbSet<CommissionRule> CommissionRules => Set<CommissionRule>();
    public DbSet<Settlement> Settlements => Set<Settlement>();
    public DbSet<SosEvent> SosEvents => Set<SosEvent>();
    public DbSet<AuditEntry> AuditLog => Set<AuditEntry>();
    public DbSet<CompanySettings> Company => Set<CompanySettings>();
    public DbSet<TermsVersion> TermsVersions => Set<TermsVersion>();
    public DbSet<MessageTemplate> MessageTemplates => Set<MessageTemplate>();

    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web);

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<User>(e =>
        {
            e.ToTable("users");
            e.HasIndex(x => new { x.Phone, x.Role }).IsUnique().HasFilter("\"Phone\" IS NOT NULL");
            e.HasIndex(x => x.Email).IsUnique().HasFilter("\"Email\" IS NOT NULL");
        });
        b.Entity<OtpCode>(e =>
        {
            e.ToTable("otp_codes");
            e.HasIndex(x => new { x.Phone, x.CreatedAt });
        });
        b.Entity<Consent>(e =>
        {
            e.ToTable("consents");
            e.HasIndex(x => new { x.UserId, x.Kind });
        });
        b.Entity<Town>(e =>
        {
            e.ToTable("towns");
            e.Property(x => x.Version).IsRowVersion();
            var comparer = new ValueComparer<Dictionary<string, Fare>>(
                (a, c) => JsonSerializer.Serialize(a, JsonOpts) == JsonSerializer.Serialize(c, JsonOpts),
                v => JsonSerializer.Serialize(v, JsonOpts).GetHashCode(),
                v => JsonSerializer.Deserialize<Dictionary<string, Fare>>(JsonSerializer.Serialize(v, JsonOpts), JsonOpts)!);
            e.Property(x => x.Fares)
                .HasColumnType("jsonb")
                .HasConversion(
                    v => JsonSerializer.Serialize(v, JsonOpts),
                    v => JsonSerializer.Deserialize<Dictionary<string, Fare>>(v, JsonOpts) ?? new Dictionary<string, Fare>())
                .Metadata.SetValueComparer(comparer);
            e.HasMany(x => x.Landmarks).WithOne().HasForeignKey(x => x.TownId).OnDelete(DeleteBehavior.Cascade);
        });
        b.Entity<Landmark>(e => e.ToTable("landmarks"));
        b.Entity<Captain>(e =>
        {
            e.ToTable("captains");
            e.Property(x => x.Version).IsRowVersion();
            e.HasIndex(x => x.UserId).IsUnique();
            e.HasIndex(x => new { x.Status, x.Online });
            e.HasIndex(x => x.TownId);
            e.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.Kyc).WithOne().HasForeignKey<CaptainKyc>(x => x.CaptainId).OnDelete(DeleteBehavior.Cascade);
            e.HasMany(x => x.Documents).WithOne().HasForeignKey(x => x.CaptainId).OnDelete(DeleteBehavior.Cascade);
        });
        b.Entity<CaptainKyc>(e =>
        {
            e.ToTable("captain_kyc");
            e.HasKey(x => x.CaptainId);
            e.Property(x => x.ChecksJson).HasColumnType("jsonb");
            e.HasIndex(x => x.DlNumber);
        });
        b.Entity<CaptainDocument>(e =>
        {
            e.ToTable("captain_documents");
            e.HasIndex(x => new { x.CaptainId, x.Kind });
        });
        b.Entity<StoredFile>(e => e.ToTable("files"));
        b.Entity<Ride>(e =>
        {
            e.ToTable("rides");
            e.Property(x => x.Version).IsRowVersion();
            e.Ignore(x => x.IsParcel);
            e.HasIndex(x => new { x.RiderId, x.ClientId }).IsUnique();
            e.HasIndex(x => x.TrackToken).IsUnique();
            e.HasIndex(x => x.Status);
            e.HasIndex(x => new { x.CaptainId, x.Status });
            e.HasIndex(x => new { x.TownId, x.CreatedAt });
            e.HasOne(x => x.Rider).WithMany().HasForeignKey(x => x.RiderId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.Captain).WithMany().HasForeignKey(x => x.CaptainId).OnDelete(DeleteBehavior.Restrict);
            e.HasMany(x => x.Events).WithOne().HasForeignKey(x => x.RideId).OnDelete(DeleteBehavior.Cascade);
        });
        b.Entity<RideEvent>(e =>
        {
            e.ToTable("ride_events");
            e.HasIndex(x => new { x.RideId, x.At });
        });
        b.Entity<Offer>(e =>
        {
            e.ToTable("offers");
            e.HasOne(x => x.Ride).WithMany().HasForeignKey(x => x.RideId).OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(x => new { x.RideId, x.CaptainId });
            // a captain holds at most one live offer; the ride row's conditional UPDATE decides who gets a ride
            e.HasIndex(x => x.CaptainId).IsUnique().HasFilter("\"Status\" = 'pending'").HasDatabaseName("ux_offers_captain_pending");
            e.HasIndex(x => new { x.Status, x.ExpiresAt });
        });
        b.Entity<LocationPoint>(e =>
        {
            e.ToTable("location_points");
            e.HasIndex(x => new { x.RideId, x.At });
            e.HasIndex(x => new { x.CaptainId, x.At });
        });
        b.Entity<CommissionRule>(e => e.ToTable("commission_rules"));
        b.Entity<Settlement>(e =>
        {
            e.ToTable("settlements");
            e.HasIndex(x => new { x.CaptainId, x.PeriodStart }).IsUnique();
        });
        b.Entity<SosEvent>(e =>
        {
            e.ToTable("sos_events");
            e.HasIndex(x => new { x.Resolved, x.At });
        });
        b.Entity<AuditEntry>(e =>
        {
            e.ToTable("audit_log");
            e.HasIndex(x => x.At);
        });
        b.Entity<CompanySettings>(e =>
        {
            e.ToTable("company_settings");
            e.Property(x => x.Id).ValueGeneratedNever();
        });
        b.Entity<TermsVersion>(e =>
        {
            e.ToTable("terms_versions");
            e.HasIndex(x => x.Version).IsUnique();
        });
        b.Entity<MessageTemplate>(e =>
        {
            e.ToTable("message_templates");
            e.HasIndex(x => x.Key);
        });
    }
}
