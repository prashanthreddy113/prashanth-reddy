using Yukktha.Api.Data.Entities;

namespace Yukktha.Api.Services;

public interface IWhatsAppService
{
    /// <summary>WA-1/WA-2: wa.me deep link with a pre-filled order message.</summary>
    string BuildOrderLink(Store store, Product product, ProductVariant? variant, string productUrl);
    Task SendOtpAsync(string phone, string code);
    Task NotifyOwnerNewOrderAsync(Store store, Order order);          // WA-3
    Task SendCustomerOrderConfirmedAsync(Store store, Order order);   // WA-3
    Task SendCustomerStatusAsync(Store store, Order order);           // WA-4
}
