using Microsoft.EntityFrameworkCore;
using Yukktha.Api.Data.Entities;
using Yukktha.Api.Tenancy;

namespace Yukktha.Api.Data;

/// <summary>
/// Shared-schema multi-tenancy. Every ITenantEntity gets a global query filter on StoreId,
/// and SaveChanges stamps StoreId on new rows. No query can read another store's data
/// unless IgnoreQueryFilters() is called explicitly (super-admin only).
/// </summary>
public class AppDbContext(DbContextOptions<AppDbContext> options, TenantContext tenant) : DbContext(options)
{
    public DbSet<Store> Stores => Set<Store>();
    public DbSet<User> Users => Set<User>();
    public DbSet<OtpCode> OtpCodes => Set<OtpCode>();
    public DbSet<Category> Categories => Set<Category>();
    public DbSet<Product> Products => Set<Product>();
    public DbSet<ProductImage> ProductImages => Set<ProductImage>();
    public DbSet<ProductVariant> ProductVariants => Set<ProductVariant>();
    public DbSet<Customer> Customers => Set<Customer>();
    public DbSet<Order> Orders => Set<Order>();
    public DbSet<OrderItem> OrderItems => Set<OrderItem>();
    public DbSet<MessageLog> MessageLogs => Set<MessageLog>();

    protected override void OnModelCreating(ModelBuilder mb)
    {
        mb.Entity<Store>().HasIndex(s => s.Slug).IsUnique();
        mb.Entity<Store>().HasIndex(s => s.CustomDomain).IsUnique().HasFilter("[CustomDomain] IS NOT NULL");
        mb.Entity<Store>().HasIndex(s => s.OwnerPhone);
        mb.Entity<User>().HasIndex(u => new { u.StoreId, u.Phone }).IsUnique();
        mb.Entity<Product>().HasIndex(p => new { p.StoreId, p.Slug }).IsUnique();
        mb.Entity<Customer>().HasIndex(c => new { c.StoreId, c.Phone }).IsUnique();
        mb.Entity<Order>().HasIndex(o => new { o.StoreId, o.Number }).IsUnique();
        mb.Entity<OtpCode>().HasIndex(o => o.Phone);

        foreach (var p in new[] { "Price", "CompareAtPrice" }) mb.Entity<Product>().Property(p).HasPrecision(12, 2);
        mb.Entity<ProductVariant>().Property(v => v.PriceOverride).HasPrecision(12, 2);
        mb.Entity<Customer>().Property(c => c.TotalSpend).HasPrecision(14, 2);
        foreach (var p in new[] { "Subtotal", "DeliveryCharge", "Discount", "Total" }) mb.Entity<Order>().Property(p).HasPrecision(12, 2);
        mb.Entity<OrderItem>().Property(i => i.UnitPrice).HasPrecision(12, 2);
        mb.Entity<Store>().Property(s => s.LocalDeliveryCharge).HasPrecision(10, 2);
        mb.Entity<Store>().Property(s => s.CourierCharge).HasPrecision(10, 2);

        // Global tenant filters
        mb.Entity<User>().HasQueryFilter(e => e.StoreId == tenant.StoreId);
        mb.Entity<Category>().HasQueryFilter(e => e.StoreId == tenant.StoreId);
        mb.Entity<Product>().HasQueryFilter(e => e.StoreId == tenant.StoreId);
        mb.Entity<ProductImage>().HasQueryFilter(e => e.StoreId == tenant.StoreId);
        mb.Entity<ProductVariant>().HasQueryFilter(e => e.StoreId == tenant.StoreId);
        mb.Entity<Customer>().HasQueryFilter(e => e.StoreId == tenant.StoreId);
        mb.Entity<Order>().HasQueryFilter(e => e.StoreId == tenant.StoreId);
        mb.Entity<OrderItem>().HasQueryFilter(e => e.StoreId == tenant.StoreId);
        mb.Entity<MessageLog>().HasQueryFilter(e => e.StoreId == tenant.StoreId);
    }

    public override Task<int> SaveChangesAsync(CancellationToken ct = default)
    {
        if (tenant.StoreId is { } sid)
        {
            foreach (var entry in ChangeTracker.Entries<ITenantEntity>())
            {
                if (entry.State == EntityState.Added && entry.Entity.StoreId == Guid.Empty)
                    entry.Entity.StoreId = sid;
                else if (entry.State is EntityState.Modified or EntityState.Deleted && entry.Entity.StoreId != sid)
                    throw new InvalidOperationException("Cross-tenant write blocked.");
            }
        }
        return base.SaveChangesAsync(ct);
    }
}
