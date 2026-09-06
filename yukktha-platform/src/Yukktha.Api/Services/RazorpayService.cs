using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Yukktha.Api.Data.Entities;

namespace Yukktha.Api.Services;

/// <summary>
/// BL-2: Razorpay Subscriptions. Plan IDs are created once in the Razorpay dashboard and configured under
/// Razorpay:PlanIds. When KeyId/KeySecret are empty the service reports Configured = false and the
/// BillingController falls back to a dev-mode subscription so the flow can be exercised locally.
/// </summary>
public class RazorpayService(IHttpClientFactory http, IConfiguration cfg, ILogger<RazorpayService> log)
{
    public string? KeyId => cfg["Razorpay:KeyId"];
    public bool Configured => !string.IsNullOrWhiteSpace(KeyId) && !string.IsNullOrWhiteSpace(cfg["Razorpay:KeySecret"]);

    public string? PlanIdFor(PlanTier tier) => cfg[$"Razorpay:PlanIds:{tier}"];

    public record Subscription(string Id, string Status, string? ShortUrl);

    /// <summary>Creates a monthly subscription. When startAt is in the future the customer authorises the mandate now and is first charged then.</summary>
    public async Task<Subscription> CreateSubscriptionAsync(string planId, DateTime? startAt, Guid storeId, string storeSlug)
    {
        var body = new Dictionary<string, object?>
        {
            ["plan_id"] = planId,
            ["total_count"] = 120,          // 10 years of monthly cycles; cancelled explicitly before then
            ["customer_notify"] = 1,
            ["notes"] = new { store_id = storeId.ToString(), store_slug = storeSlug }
        };
        if (startAt is { } s && s > DateTime.UtcNow.AddMinutes(5))
            body["start_at"] = new DateTimeOffset(s, TimeSpan.Zero).ToUnixTimeSeconds();

        using var doc = await PostAsync("subscriptions", body);
        var root = doc.RootElement;
        return new Subscription(root.GetProperty("id").GetString()!, root.GetProperty("status").GetString() ?? "created",
            root.TryGetProperty("short_url", out var u) ? u.GetString() : null);
    }

    /// <summary>Cancels at the end of the current billing cycle so the store keeps what it paid for.</summary>
    public async Task CancelAtCycleEndAsync(string subscriptionId)
    {
        using var _ = await PostAsync($"subscriptions/{subscriptionId}/cancel", new { cancel_at_cycle_end = 1 });
    }

    /// <summary>Checkout returns payment_id, subscription_id and a signature = HMAC-SHA256(key_secret, payment_id|subscription_id).</summary>
    public bool VerifyCheckoutSignature(string paymentId, string subscriptionId, string signature)
    {
        var secret = cfg["Razorpay:KeySecret"] ?? "";
        var expected = Convert.ToHexString(HMACSHA256.HashData(Encoding.UTF8.GetBytes(secret), Encoding.UTF8.GetBytes($"{paymentId}|{subscriptionId}"))).ToLowerInvariant();
        return CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(expected), Encoding.UTF8.GetBytes(signature.ToLowerInvariant()));
    }

    private async Task<JsonDocument> PostAsync(string path, object body)
    {
        var client = http.CreateClient();
        client.BaseAddress = new Uri("https://api.razorpay.com/v1/");
        var creds = Convert.ToBase64String(Encoding.UTF8.GetBytes($"{cfg["Razorpay:KeyId"]}:{cfg["Razorpay:KeySecret"]}"));
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Basic", creds);
        var res = await client.PostAsync(path, new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json"));
        var text = await res.Content.ReadAsStringAsync();
        if (!res.IsSuccessStatusCode)
        {
            log.LogError("Razorpay {Path} failed {Status}: {Body}", path, (int)res.StatusCode, text);
            throw new InvalidOperationException("Razorpay request failed. Try again or contact support.");
        }
        return JsonDocument.Parse(text);
    }
}
