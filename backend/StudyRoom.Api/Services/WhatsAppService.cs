using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;

namespace StudyRoom.Api.Services;

public record WhatsAppSendResult(bool Ok, string? MessageId, string? Error);

/// <summary>
/// Sends approved template messages through the WhatsApp Business (Cloud) API.
/// Configure with environment variables:
///   WhatsApp__PhoneNumberId, WhatsApp__AccessToken, optional WhatsApp__ApiVersion (v20.0), WhatsApp__DefaultCountryCode (91).
/// </summary>
public class WhatsAppService
{
    private readonly HttpClient _http;
    private readonly IConfiguration _config;
    private readonly ILogger<WhatsAppService> _logger;

    public WhatsAppService(HttpClient http, IConfiguration config, ILogger<WhatsAppService> logger)
    {
        _http = http;
        _config = config;
        _logger = logger;
    }

    public string? PhoneNumberId => _config["WhatsApp:PhoneNumberId"];
    private string? AccessToken => _config["WhatsApp:AccessToken"];
    private string ApiVersion => _config["WhatsApp:ApiVersion"] ?? "v20.0";
    private string BaseUrl => (_config["WhatsApp:BaseUrl"] ?? "https://graph.facebook.com").TrimEnd('/');
    private string DefaultCountryCode => _config["WhatsApp:DefaultCountryCode"] ?? "91";

    public bool IsConfigured => !string.IsNullOrWhiteSpace(PhoneNumberId) && !string.IsNullOrWhiteSpace(AccessToken);

    /// <summary>Normalises "9876543210" / "+91 98765 43210" to "919876543210" (E.164 without the plus).</summary>
    public string NormaliseNumber(string mobile)
    {
        var digits = new string(mobile.Where(char.IsDigit).ToArray());
        if (mobile.TrimStart().StartsWith('+')) return digits;
        return digits.Length <= 10 ? DefaultCountryCode + digits : digits;
    }

    public async Task<WhatsAppSendResult> SendTemplateAsync(string mobile, string templateName, string languageCode, IEnumerable<string> bodyParameters, CancellationToken ct = default)
    {
        if (!IsConfigured)
            return new WhatsAppSendResult(false, null, "WhatsApp is not configured. Set WhatsApp__PhoneNumberId and WhatsApp__AccessToken.");

        var payload = new
        {
            messaging_product = "whatsapp",
            to = NormaliseNumber(mobile),
            type = "template",
            template = new
            {
                name = templateName,
                language = new { code = languageCode },
                components = new[]
                {
                    new { type = "body", parameters = bodyParameters.Select(p => new { type = "text", text = p }).ToArray() }
                }
            }
        };

        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Post, $"{BaseUrl}/{ApiVersion}/{PhoneNumberId}/messages");
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", AccessToken);
            request.Content = JsonContent.Create(payload);

            using var response = await _http.SendAsync(request, ct);
            var body = await response.Content.ReadAsStringAsync(ct);

            if (!response.IsSuccessStatusCode)
            {
                var error = ExtractError(body) ?? $"HTTP {(int)response.StatusCode}";
                _logger.LogWarning("WhatsApp send failed for {To}: {Error}", payload.to, error);
                return new WhatsAppSendResult(false, null, error);
            }

            using var doc = JsonDocument.Parse(body);
            var id = doc.RootElement.TryGetProperty("messages", out var messages) && messages.GetArrayLength() > 0
                ? messages[0].GetProperty("id").GetString()
                : null;
            return new WhatsAppSendResult(true, id, null);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException)
        {
            _logger.LogWarning(ex, "WhatsApp send error for {Mobile}", mobile);
            return new WhatsAppSendResult(false, null, ex.Message);
        }
    }

    private static string? ExtractError(string body)
    {
        try
        {
            using var doc = JsonDocument.Parse(body);
            if (doc.RootElement.TryGetProperty("error", out var err))
            {
                var msg = err.TryGetProperty("message", out var m) ? m.GetString() : null;
                var code = err.TryGetProperty("code", out var c) ? c.GetRawText() : null;
                return code is null ? msg : $"{msg} (code {code})";
            }
        }
        catch (JsonException) { }
        return body.Length > 300 ? body[..300] : body;
    }
}
