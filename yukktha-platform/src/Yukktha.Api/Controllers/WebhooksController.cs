using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Yukktha.Api.Data;
using Yukktha.Api.Data.Entities;
using Yukktha.Api.Services;

namespace Yukktha.Api.Controllers;

[ApiController, Route("api/webhooks")]
public class WebhooksController(AppDbContext db, IConfiguration cfg, SubscriptionService subs, ILogger<WebhooksController> log) : ControllerBase
{
    /// <summary>BL-2/BL-3 and OR-2: Razorpay subscription + payment events. Verifies signature, then applies status.</summary>
    [HttpPost("razorpay")]
    public async Task<IActionResult> Razorpay()
    {
        using var reader = new StreamReader(Request.Body);
        var body = await reader.ReadToEndAsync();
        var secret = cfg["Razorpay:WebhookSecret"] ?? "";
        var expected = Convert.ToHexString(HMACSHA256.HashData(Encoding.UTF8.GetBytes(secret), Encoding.UTF8.GetBytes(body))).ToLowerInvariant();
        if (!string.Equals(expected, Request.Headers["X-Razorpay-Signature"].ToString(), StringComparison.OrdinalIgnoreCase))
            return Unauthorized();

        using var doc = JsonDocument.Parse(body);
        var evt = doc.RootElement.GetProperty("event").GetString() ?? "";
        var payload = doc.RootElement.GetProperty("payload");

        if (evt.StartsWith("subscription."))
        {
            var sub = payload.GetProperty("subscription").GetProperty("entity");
            var subId = sub.GetProperty("id").GetString();
            var store = await db.Stores.IgnoreQueryFilters().FirstOrDefaultAsync(s => s.RazorpaySubscriptionId == subId);
            if (store is null) { log.LogWarning("Webhook for unknown subscription {Id}", subId); return Ok(); }
            DateTime? periodEnd = sub.TryGetProperty("current_end", out var ce) && ce.ValueKind == JsonValueKind.Number
                ? DateTimeOffset.FromUnixTimeSeconds(ce.GetInt64()).UtcDateTime : null;
            subs.ApplyWebhook(store, evt, periodEnd);
            await db.SaveChangesAsync();
        }
        else if (evt == "payment.captured")
        {
            var pay = payload.GetProperty("payment").GetProperty("entity");
            var notes = pay.TryGetProperty("notes", out var n) ? n : default;
            if (notes.ValueKind == JsonValueKind.Object && notes.TryGetProperty("order_id", out var oid) && Guid.TryParse(oid.GetString(), out var orderId))
            {
                var order = await db.Orders.IgnoreQueryFilters().FirstOrDefaultAsync(o => o.Id == orderId);
                if (order is not null) { order.PaymentStatus = PaymentStatus.Paid; order.RazorpayPaymentId = pay.GetProperty("id").GetString(); await db.SaveChangesAsync(); }
            }
        }
        return Ok();
    }

    /// <summary>Meta Cloud API verification handshake + delivery status updates.</summary>
    [HttpGet("whatsapp")]
    public IActionResult VerifyWhatsApp([FromQuery(Name = "hub.mode")] string mode, [FromQuery(Name = "hub.verify_token")] string token, [FromQuery(Name = "hub.challenge")] string challenge)
        => mode == "subscribe" && token == cfg["WhatsApp:VerifyToken"] ? Content(challenge) : Forbid();

    [HttpPost("whatsapp")]
    public async Task<IActionResult> WhatsAppStatus()
    {
        using var reader = new StreamReader(Request.Body);
        var body = await reader.ReadToEndAsync();
        log.LogInformation("WhatsApp webhook: {Body}", body);
        // Delivery statuses arrive here; update MessageLog.Status by ProviderMessageId when needed.
        return Ok();
    }
}
