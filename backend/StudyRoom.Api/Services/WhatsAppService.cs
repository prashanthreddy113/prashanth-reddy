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

    public string? PhoneNumberId => Clean(_config["WhatsApp:PhoneNumberId"]);
    private string? AccessToken => Clean(_config["WhatsApp:AccessToken"], stripBearer: true);

    /// <summary>Removes the usual paste accidents: surrounding quotes, whitespace/newlines and a "Bearer " prefix.</summary>
    private static string? Clean(string? value, bool stripBearer = false)
    {
        if (value is null) return null;
        var v = value.Trim().Trim('"', '\'', '`').Trim();
        if (stripBearer && v.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase)) v = v[7..].Trim();
        return v.Length == 0 ? null : v;
    }

    /// <summary>Hints for the most common token problems, shown alongside Meta's error.</summary>
    public string? TokenDiagnostics()
    {
        var raw = _config["WhatsApp:AccessToken"];
        if (string.IsNullOrWhiteSpace(raw)) return "WhatsApp__AccessToken is empty.";
        var token = AccessToken ?? "";
        var hints = new List<string>();
        if (raw != token) hints.Add("the value had quotes, spaces or a 'Bearer ' prefix that were removed automatically");
        if (token.Length < 60) hints.Add($"the token is only {token.Length} characters long (Meta tokens are usually 150+); check it was not truncated or that the App Secret / Phone number ID was not pasted by mistake");
        if (token.Any(char.IsWhiteSpace)) hints.Add("the token contains a space or line break in the middle");
        if (!token.StartsWith("EAA", StringComparison.Ordinal)) hints.Add("Meta access tokens normally start with 'EAA'");
        var pid = PhoneNumberId ?? "";
        if (pid.Length > 0 && !pid.All(char.IsDigit)) hints.Add("WhatsApp__PhoneNumberId should be digits only (it is not the phone number itself)");
        return hints.Count == 0 ? null : string.Join("; ", hints) + ".";
    }

    /// <summary>Calls Meta for the phone number's details to prove the token and phone number id work.</summary>
    public async Task<(bool ok, string? detail, string? error)> TestConnectionAsync(CancellationToken ct = default)
    {
        if (!IsConfigured) return (false, null, "WhatsApp is not configured. Set WhatsApp__PhoneNumberId and WhatsApp__AccessToken.");
        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Get, $"{BaseUrl}/{ApiVersion}/{PhoneNumberId}?fields=display_phone_number,verified_name,quality_rating,code_verification_status");
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", AccessToken);
            using var response = await _http.SendAsync(request, ct);
            var body = await response.Content.ReadAsStringAsync(ct);
            if (!response.IsSuccessStatusCode) return (false, null, ExtractError(body) ?? $"HTTP {(int)response.StatusCode}");
            using var doc = JsonDocument.Parse(body);
            var r = doc.RootElement;
            string? Get(string k) => r.TryGetProperty(k, out var v) ? v.ToString() : null;
            return (true, $"{Get("verified_name")} · {Get("display_phone_number")} · quality {Get("quality_rating") ?? "n/a"}", null);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException)
        {
            return (false, null, ex.Message);
        }
    }
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
