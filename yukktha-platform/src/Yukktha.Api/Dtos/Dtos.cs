using Yukktha.Api.Data.Entities;

namespace Yukktha.Api.Dtos;

public record SendOtpRequest(string Phone);
public record VerifyOtpRequest(string Phone, string Code, string? StoreSlug);
public record SignupRequest(string Phone, string Code, string StoreName, string? ReferralCode, Language Language = Language.Te);
public record AuthResponse(string Token, Guid StoreId, string StoreSlug, string StoreName, string Role, bool OnboardingCompleted);

public record VariantDto(Guid? Id, string? Color, string? Size, decimal? PriceOverride, int Stock, string? Sku);
public record ProductUpsert(string Name, string? Description, decimal Price, decimal? CompareAtPrice, Guid? CategoryId,
    bool IsActive, List<string> ImageUrls, List<VariantDto> Variants);

public record StoreSettingsUpdate(string Name, string? WhatsAppNumber, string? Address, string? Gstin, string? LogoUrl, string ThemeColor,
    Language DefaultLanguage, bool CodEnabled, bool LocalDeliveryEnabled, decimal LocalDeliveryCharge,
    bool CourierEnabled, decimal CourierCharge, string? InstagramHandle, bool GoogleReviewPromptEnabled, string? GoogleReviewUrl);

public record CheckoutItem(Guid VariantId, int Quantity);
public record CheckoutRequest(string Name, string Phone, string? Address, DeliveryMode DeliveryMode, PaymentMethod PaymentMethod,
    List<CheckoutItem> Items, string? Notes, bool MarketingOptIn);
public record OrderStatusUpdate(OrderStatus Status, string? TrackingNumber, string? TrackingUrl);
public record ManualOrderRequest(string Name, string Phone, string? Address, DeliveryMode DeliveryMode, PaymentMethod PaymentMethod,
    List<CheckoutItem> Items, string? Notes);

public record SuperAdminStoreConfig(string? GoogleReviewUrl, bool? GoogleReviewPromptEnabled, PlanTier? Plan, StoreStatus? Status, string? CustomDomain);
