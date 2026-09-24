using System.Net.Http.Json;
using System.Text.Json;
using ManaBandi.Api.Infrastructure;
using Microsoft.Extensions.Options;

namespace ManaBandi.Api.Sms;

public interface ISmsSender
{
    /// <summary>Delivers a login OTP. `channel` is "sms" or "call" (voice OTP).</summary>
    Task SendOtpAsync(string phone, string code, string lang, string channel, CancellationToken ct = default);

    /// <summary>Sends a transactional message (e.g. SOS to trusted contact) using a DLT template key.</summary>
    Task SendMessageAsync(string phone, string templateKey, IDictionary<string, string> vars, string text, CancellationToken ct = default);
}

/// <summary>Logs messages instead of sending. OTP codes are only written to the log in Otp:DevMode.</summary>
public class ConsoleSmsSender : ISmsSender
{
    private readonly ILogger<ConsoleSmsSender> _log;
    private readonly OtpOptions _otp;

    public ConsoleSmsSender(ILogger<ConsoleSmsSender> log, IOptions<OtpOptions> otp)
    {
        _log = log;
        _otp = otp.Value;
    }

    public Task SendOtpAsync(string phone, string code, string lang, string channel, CancellationToken ct = default)
    {
        if (_otp.DevMode)
            _log.LogInformation("[DEV OTP] {Channel} to {Phone}: code {Code}", channel, phone, code);
        else
            _log.LogWarning("OTP for {Phone} was NOT delivered: Otp:Provider=console. Configure MSG91 for production.", Phone.Mask(phone));
        return Task.CompletedTask;
    }

    public Task SendMessageAsync(string phone, string templateKey, IDictionary<string, string> vars, string text, CancellationToken ct = default)
    {
        _log.LogInformation("[SMS console] {Template} to {Phone}: {Text}", templateKey, Phone.Mask(phone), text);
        return Task.CompletedTask;
    }
}

/// <summary>
/// MSG91 (https://docs.msg91.com). OTP: POST {base}/api/v5/otp?template_id=&amp;mobile=91XXXXXXXXXX&amp;otp=1234&amp;otp_expiry=5
/// with header `authkey`; voice OTP: POST {base}/api/v5/otp/retry?retrytype=voice&amp;mobile=… (re-reads the same code).
/// Transactional SMS: POST {base}/api/v5/flow with { template_id, short_url, recipients:[{ mobiles, ...vars }] }.
/// Every template must be DLT-registered (TRAI) against the sender id before it delivers in India.
/// </summary>
public class Msg91SmsSender : ISmsSender
{
    private readonly HttpClient _http;
    private readonly Msg91Options _opt;
    private readonly OtpOptions _otp;
    private readonly ILogger<Msg91SmsSender> _log;

    public Msg91SmsSender(HttpClient http, IOptions<Msg91Options> opt, IOptions<OtpOptions> otp, ILogger<Msg91SmsSender> log)
    {
        _http = http;
        _opt = opt.Value;
        _otp = otp.Value;
        _log = log;
    }

    private static string Msisdn(string phone) => phone.TrimStart('+'); // +919876543210 → 919876543210

    public async Task SendOtpAsync(string phone, string code, string lang, string channel, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(_opt.AuthKey) || string.IsNullOrWhiteSpace(_opt.TemplateId))
            throw new InvalidOperationException("Msg91:AuthKey and Msg91:TemplateId must be configured when Otp:Provider=msg91");

        var expiryMin = Math.Max(1, _otp.ExpirySeconds / 60);
        var url = $"{_opt.BaseUrl.TrimEnd('/')}/api/v5/otp?template_id={Uri.EscapeDataString(_opt.TemplateId)}" +
                  $"&mobile={Msisdn(phone)}&otp={Uri.EscapeDataString(code)}&otp_expiry={expiryMin}&otp_length={code.Length}";
        // Template variables (##OTP## is filled by MSG91 from `otp`); lang lets a flow pick the Telugu text.
        using var req = new HttpRequestMessage(HttpMethod.Post, url) { Content = JsonContent.Create(new { lang }) };
        req.Headers.Add("authkey", _opt.AuthKey);
        await SendAndCheck(req, "otp", phone, ct);

        if (channel == "call")
        {
            using var retry = new HttpRequestMessage(HttpMethod.Post,
                $"{_opt.BaseUrl.TrimEnd('/')}/api/v5/otp/retry?retrytype=voice&mobile={Msisdn(phone)}");
            retry.Headers.Add("authkey", _opt.AuthKey);
            await SendAndCheck(retry, "otp-voice", phone, ct);
        }
    }

    public async Task SendMessageAsync(string phone, string templateKey, IDictionary<string, string> vars, string text, CancellationToken ct = default)
    {
        if (!_opt.FlowTemplates.TryGetValue(templateKey, out var flowId) || string.IsNullOrWhiteSpace(flowId))
        {
            _log.LogWarning("No Msg91:FlowTemplates:{Key} configured; SMS to {Phone} not sent", templateKey, Phone.Mask(phone));
            return;
        }
        var recipient = new Dictionary<string, string>(vars) { ["mobiles"] = Msisdn(phone) };
        var body = new { template_id = flowId, short_url = "0", recipients = new[] { recipient } };
        using var req = new HttpRequestMessage(HttpMethod.Post, $"{_opt.BaseUrl.TrimEnd('/')}/api/v5/flow") { Content = JsonContent.Create(body) };
        req.Headers.Add("authkey", _opt.AuthKey);
        await SendAndCheck(req, "flow:" + templateKey, phone, ct);
    }

    private async Task SendAndCheck(HttpRequestMessage req, string what, string phone, CancellationToken ct)
    {
        req.Headers.Accept.ParseAdd("application/json");
        using var res = await _http.SendAsync(req, ct);
        var text = await res.Content.ReadAsStringAsync(ct);
        string? type = null, message = null;
        try
        {
            using var doc = JsonDocument.Parse(text);
            if (doc.RootElement.TryGetProperty("type", out var t)) type = t.GetString();
            if (doc.RootElement.TryGetProperty("message", out var m)) message = m.ToString();
        }
        catch (JsonException) { /* non-json body */ }

        if (!res.IsSuccessStatusCode || string.Equals(type, "error", StringComparison.OrdinalIgnoreCase))
        {
            _log.LogError("MSG91 {What} to {Phone} failed: HTTP {Status} {Message}", what, Phone.Mask(phone), (int)res.StatusCode, message ?? "(no message)");
            throw new ApiException(502, "sms_failed", "Could not send the SMS right now. Please try again.");
        }
        _log.LogInformation("MSG91 {What} accepted for {Phone}", what, Phone.Mask(phone));
    }
}
