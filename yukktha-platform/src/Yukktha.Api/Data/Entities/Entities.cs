namespace Yukktha.Api.Data.Entities;

public interface ITenantEntity { Guid StoreId { get; set; } }

public enum PlanTier { Starter = 1, Growth = 2, MultiBranch = 3 }
public enum StoreStatus { Trial = 0, Active = 1, PastDue = 2, Suspended = 3, Closed = 4 }
public enum UserRole { Owner = 1, Staff = 2, SuperAdmin = 9 }
public enum OrderStatus { New = 0, Confirmed = 1, Packed = 2, Shipped = 3, Delivered = 4, Cancelled = 9 }
public enum PaymentStatus { Pending = 0, Paid = 1, Failed = 2, Refunded = 3 }
public enum PaymentMethod { Cod = 0, Online = 1, WhatsApp = 2 }
public enum DeliveryMode { Pickup = 0, LocalDelivery = 1, Courier = 2 }
public enum Language { En = 0, Te = 1 }

public class Store
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Slug { get; set; } = "";              // subdomain: {slug}.yukktha.in
    public string? CustomDomain { get; set; }
    public string Name { get; set; } = "";
    public string OwnerPhone { get; set; } = "";        // E.164, e.g. +9179xxxxxxxx
    public string? WhatsAppNumber { get; set; }         // number customers order on
    public string? LogoUrl { get; set; }
    public string ThemeColor { get; set; } = "#6C3FE0";
    public string City { get; set; } = "Hyderabad";
    public string? Address { get; set; }
    public string? Gstin { get; set; }
    public Language DefaultLanguage { get; set; } = Language.Te;
    public bool CodEnabled { get; set; } = true;
    public bool OnlinePaymentEnabled { get; set; }
    public bool LocalDeliveryEnabled { get; set; }
    public decimal LocalDeliveryCharge { get; set; }
    public bool CourierEnabled { get; set; }
    public decimal CourierCharge { get; set; }
    public string? GoogleReviewUrl { get; set; }        // PL-6: pre-configurable by super-admin
    public bool GoogleReviewPromptEnabled { get; set; }
    public string? InstagramHandle { get; set; }
    public PlanTier Plan { get; set; } = PlanTier.Starter;
    public StoreStatus Status { get; set; } = StoreStatus.Trial;
    public DateTime TrialEndsAt { get; set; }
    public DateTime? CurrentPeriodEndsAt { get; set; }
    public string? RazorpaySubscriptionId { get; set; }
    public string? RazorpayAccountId { get; set; }      // payouts to the store's bank
    public string? ReferralCode { get; set; }
    public Guid? ReferredByStoreId { get; set; }
    public bool OnboardingCompleted { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public List<User> Users { get; set; } = [];
}

public class User : ITenantEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid StoreId { get; set; }
    public string Phone { get; set; } = "";
    public string Name { get; set; } = "";
    public UserRole Role { get; set; } = UserRole.Staff;
    public Language Language { get; set; } = Language.Te;
    public DateTime? LastLoginAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class OtpCode
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Phone { get; set; } = "";
    public string CodeHash { get; set; } = "";
    public DateTime ExpiresAt { get; set; }
    public int Attempts { get; set; }
    public bool Used { get; set; }
}

public class Category : ITenantEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid StoreId { get; set; }
    public string NameEn { get; set; } = "";
    public string? NameTe { get; set; }
    public int SortOrder { get; set; }
}

public class Product : ITenantEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid StoreId { get; set; }
    public string Slug { get; set; } = "";
    public string Name { get; set; } = "";               // CT-2: entered in Telugu or English as-is
    public string? Description { get; set; }
    public Guid? CategoryId { get; set; }
    public decimal Price { get; set; }
    public decimal? CompareAtPrice { get; set; }
    public bool IsActive { get; set; } = true;
    public string? InstagramPostId { get; set; }         // CT-5
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public List<ProductImage> Images { get; set; } = [];
    public List<ProductVariant> Variants { get; set; } = [];
}

public class ProductImage : ITenantEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid StoreId { get; set; }
    public Guid ProductId { get; set; }
    public string Url { get; set; } = "";
    public int SortOrder { get; set; }
}

/// <summary>CT-3: every product has at least one variant (a "default" one when no colour/size).</summary>
public class ProductVariant : ITenantEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid StoreId { get; set; }
    public Guid ProductId { get; set; }
    public string? Color { get; set; }
    public string? Size { get; set; }
    public decimal? PriceOverride { get; set; }
    public int Stock { get; set; }
    public string? Sku { get; set; }
    public bool IsDefault { get; set; }
}

public class Customer : ITenantEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid StoreId { get; set; }
    public string Phone { get; set; } = "";
    public string Name { get; set; } = "";
    public string? Address { get; set; }
    public bool MarketingOptIn { get; set; }             // WhatsApp policy: required before broadcasts
    public int OrderCount { get; set; }
    public decimal TotalSpend { get; set; }
    public DateTime? LastOrderAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class Order : ITenantEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid StoreId { get; set; }
    public int Number { get; set; }                       // human-readable, per store
    public Guid CustomerId { get; set; }
    public Customer Customer { get; set; } = null!;
    public OrderStatus Status { get; set; } = OrderStatus.New;
    public PaymentMethod PaymentMethod { get; set; }
    public PaymentStatus PaymentStatus { get; set; }
    public DeliveryMode DeliveryMode { get; set; }
    public string? DeliveryAddress { get; set; }
    public decimal Subtotal { get; set; }
    public decimal DeliveryCharge { get; set; }
    public decimal Discount { get; set; }
    public decimal Total { get; set; }
    public string? RazorpayOrderId { get; set; }
    public string? RazorpayPaymentId { get; set; }
    public string? TrackingNumber { get; set; }
    public string? TrackingUrl { get; set; }
    public string? Notes { get; set; }
    public string Source { get; set; } = "storefront";    // storefront | whatsapp | manual
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public List<OrderItem> Items { get; set; } = [];
}

public class OrderItem : ITenantEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid StoreId { get; set; }
    public Guid OrderId { get; set; }
    public Guid ProductId { get; set; }
    public Guid VariantId { get; set; }
    public string ProductName { get; set; } = "";         // snapshot
    public string? VariantLabel { get; set; }
    public decimal UnitPrice { get; set; }
    public int Quantity { get; set; }
}

public class MessageLog : ITenantEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid StoreId { get; set; }
    public string ToPhone { get; set; } = "";
    public string Template { get; set; } = "";
    public string? ProviderMessageId { get; set; }
    public string Status { get; set; } = "queued";
    public Guid? OrderId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
