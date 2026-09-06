using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using Yukktha.Api.Data;
using Yukktha.Api.Data.Entities;

namespace Yukktha.Api.Services;

/// <summary>
/// Meta WhatsApp Cloud API implementation. Swap Provider in config for a BSP (Interakt/Gupshup)
/// by implementing IWhatsAppService again; the rest of the code does not change.
/// </summary>
public class WhatsAppService(IHttpClientFactory http, IConfiguration cfg, AppDbContext db, ILogger<WhatsAppService> log) : IWhatsAppService
{
    public string BuildOrderLink(Store store, Product product, ProductVariant? variant, string productUrl)
    {
        var number = (store.WhatsAppNumber ?? store.OwnerPhone).TrimStart('+');
        var sb = new StringBuilder();
        sb.Append(store.DefaultLanguage == Language.Te ? "నమస్తే! ఈ ప్రొడక్ట్ ఆర్డర్ చేయాలనుకుంటున్నాను:\n" : "Hi! I'd like to order:\n");
        sb.Append(product.Name);
        if (variant is { IsDefault: false })
            sb.Append(" (").Append(string.Join(" / ", new[] { variant.Color, variant.Size }.Where(x => !string.IsNullOrEmpty(x)))).Append(')');
        sb.Append("\n₹").Append((variant?.PriceOverride ?? product.Price).ToString("0"));
        sb.Append('\n').Append(productUrl);
        return $"https://wa.me/{number}?text={Uri.EscapeDataString(sb.ToString())}";
    }

    public Task SendOtpAsync(string phone, string code) =>
        SendTemplateAsync(null, phone, "login_otp", [code]);

    public Task NotifyOwnerNewOrderAsync(Store store, Order order) =>
        SendTemplateAsync(store, store.OwnerPhone, cfg["WhatsApp:OwnerTemplateNewOrder"]!,
            [order.Number.ToString(), order.Customer.Name, order.Total.ToString("0"), order.Items.Count.ToString()], order.Id);

    public Task SendCustomerOrderConfirmedAsync(Store store, Order order) =>
        SendTemplateAsync(store, order.Customer.Phone, cfg["WhatsApp:CustomerTemplateOrderConfirmed"]!,
            [store.Name, order.Number.ToString(), order.Total.ToString("0")], order.Id);

    public Task SendCustomerStatusAsync(Store store, Order order) =>
        SendTemplateAsync(store, order.Customer.Phone, "order_status",
            [store.Name, order.Number.ToString(), order.Status.ToString(), order.TrackingUrl ?? "-"], order.Id);

    private async Task SendTemplateAsync(Store? store, string toPhone, string template, string[] parameters, Guid? orderId = null)
    {
        var token = cfg["WhatsApp:AccessToken"];
        var phoneId = cfg["WhatsApp:PhoneNumberId"];
        var entry = new MessageLog { StoreId = store?.Id ?? Guid.Empty, ToPhone = toPhone, Template = template, OrderId = orderId };
        if (string.IsNullOrEmpty(token) || string.IsNullOrEmpty(phoneId))
        {
            log.LogWarning("WhatsApp not configured. Would send {Template} to {Phone}: {Params}", template, toPhone, string.Join(",", parameters));
            entry.Status = "skipped";
            if (store is not null) { db.MessageLogs.Add(entry); await db.SaveChangesAsync(); }
            return;
        }

        var client = http.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        var payload = new
        {
            messaging_product = "whatsapp",
            to = toPhone.TrimStart('+'),
            type = "template",
            template = new
            {
                name = template,
                language = new { code = "en" },
                components = new[] { new { type = "body", parameters = parameters.Select(p => new { type = "text", text = p }) } }
            }
        };
        try
        {
            var res = await client.PostAsJsonAsync($"https://graph.facebook.com/v20.0/{phoneId}/messages", payload);
            entry.Status = res.IsSuccessStatusCode ? "sent" : "failed";
            if (res.IsSuccessStatusCode)
            {
                var body = await res.Content.ReadFromJsonAsync<Dictionary<string, object>>();
                entry.ProviderMessageId = body?.GetValueOrDefault("messages")?.ToString();
            }
            else log.LogError("WhatsApp send failed: {Body}", await res.Content.ReadAsStringAsync());
        }
        catch (Exception ex) { entry.Status = "failed"; log.LogError(ex, "WhatsApp send error"); }
        if (store is not null) { db.MessageLogs.Add(entry); await db.SaveChangesAsync(); }
    }
}
