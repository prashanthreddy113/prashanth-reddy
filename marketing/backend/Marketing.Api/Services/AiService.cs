using System.Diagnostics;
using System.Text.Json;
using Anthropic;
using Anthropic.Exceptions;
using Anthropic.Models.Beta.Messages;
using Marketing.Api.Data;
using Marketing.Api.Dtos;
using Marketing.Api.Models;
using Microsoft.Extensions.Caching.Memory;

namespace Marketing.Api.Services;

/// <summary>Thrown when an AI feature cannot run; carries the HTTP status the API should answer with.</summary>
public class AiException : Exception
{
    public int Status { get; }
    public AiException(int status, string message) : base(message) => Status = status;
}

/// <summary>
/// Claude-powered helpers: fill the capture form from a dictated note and shop photos, summarise a lead and
/// suggest the next step, draft WhatsApp messages, and write a daily briefing for the admin or the executive.
/// </summary>
public class AiService
{
    public static readonly string[] AllowedModels = { "claude-opus-5", "claude-sonnet-5", "claude-haiku-4-5" };
    private const string DefaultModel = "claude-opus-5";

    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web) { PropertyNameCaseInsensitive = true };

    private readonly AppDbContext _db;
    private readonly IConfiguration _config;
    private readonly IMemoryCache _cache;
    private readonly ILogger<AiService> _log;

    public AiService(AppDbContext db, IConfiguration config, IMemoryCache cache, ILogger<AiService> log)
    {
        _db = db;
        _config = config;
        _cache = cache;
        _log = log;
    }

    // ----- configuration -----

    private string? EnvKey => FirstNonEmpty(_config["Anthropic:ApiKey"], Environment.GetEnvironmentVariable("ANTHROPIC_API_KEY"));

    public string? KeySource(CompanySettings s) => !string.IsNullOrWhiteSpace(EnvKey) ? "environment" : !string.IsNullOrWhiteSpace(s.AnthropicApiKey) ? "settings" : null;

    public bool IsConfigured(CompanySettings s) => ResolveKey(s) is not null;

    private string? ResolveKey(CompanySettings s) => FirstNonEmpty(EnvKey, s.AnthropicApiKey);

    public string ModelFor(CompanySettings s)
    {
        var m = FirstNonEmpty(_config["Anthropic:Model"], s.AiModel) ?? DefaultModel;
        return AllowedModels.Contains(m) ? m : DefaultModel;
    }

    private static string? FirstNonEmpty(params string?[] values) => values.FirstOrDefault(v => !string.IsNullOrWhiteSpace(v))?.Trim();

    private AnthropicClient CreateClient(CompanySettings s)
    {
        var key = ResolveKey(s) ?? throw new AiException(503, "AI is not set up yet. An admin can add the Anthropic API key under Settings → AI assistant.");
        var baseUrl = _config["Anthropic:BaseUrl"];
        return string.IsNullOrWhiteSpace(baseUrl) ? new AnthropicClient { ApiKey = key } : new AnthropicClient { ApiKey = key, BaseUrl = baseUrl };
    }

    public IMemoryCache Cache => _cache;

    // ----- core call -----

    /// <summary>One structured-output call. The schema guarantees parseable JSON for <typeparamref name="T"/>.</summary>
    private async Task<T> CompleteJsonAsync<T>(string feature, int userId, CompanySettings s, string system, List<BetaContentBlockParam> userContent,
        object schema, string effort, int maxTokens, CancellationToken ct)
    {
        var client = CreateClient(s);
        var model = ModelFor(s);
        var sw = Stopwatch.StartNew();
        var usage = new AiUsage { UserId = userId, Feature = feature, Model = model };
        try
        {
            var response = await client.Beta.Messages.Create(new MessageCreateParams
            {
                Model = model,
                MaxTokens = maxTokens,
                System = system,
                Messages = [new BetaMessageParam { Role = Role.User, Content = userContent }],
                OutputConfig = new BetaOutputConfig
                {
                    Format = new BetaJsonOutputFormat { Schema = ToSchema(schema) },
                    Effort = effort,
                },
                // A policy refusal is re-served by Anthropic's default fallback model inside the same call.
                Betas = ["server-side-fallback-2026-07-01"],
                Fallbacks = new BetaFallbacksParam(new Default()),
            }, cancellationToken: ct);

            usage.InputTokens = response.Usage.InputTokens;
            usage.OutputTokens = response.Usage.OutputTokens;
            if (response.StopReason == "refusal")
                throw new AiException(422, "The AI declined this request." + (response.StopDetails?.Explanation is { } ex ? " " + ex : ""));

            var text = string.Concat(response.Content.Select(b => b.TryPickText(out var t) ? t.Text : ""));
            if (string.IsNullOrWhiteSpace(text)) throw new AiException(502, "The AI returned an empty answer. Please try again.");
            var parsed = JsonSerializer.Deserialize<T>(text, JsonOpts);
            if (parsed is null) throw new AiException(502, "Could not read the AI answer. Please try again.");
            return parsed;
        }
        catch (AnthropicUnauthorizedException)
        {
            usage.Success = false;
            throw new AiException(400, "The Anthropic API key was rejected. Check it under Settings → AI assistant.");
        }
        catch (AnthropicRateLimitException)
        {
            usage.Success = false;
            throw new AiException(429, "The AI service is busy right now. Try again in a moment.");
        }
        catch (AnthropicBadRequestException e)
        {
            usage.Success = false;
            _log.LogWarning(e, "Anthropic rejected the request for {Feature}", feature);
            throw new AiException(400, "The AI service rejected the request: " + Short(e.Message));
        }
        catch (Anthropic5xxException e)
        {
            usage.Success = false;
            _log.LogWarning(e, "Anthropic server error for {Feature}", feature);
            throw new AiException(502, "The AI service is temporarily unavailable. Try again shortly.");
        }
        catch (AnthropicIOException e)
        {
            usage.Success = false;
            _log.LogWarning(e, "Could not reach Anthropic for {Feature}", feature);
            throw new AiException(502, "Could not reach the AI service. Check the server's internet connection.");
        }
        catch (AnthropicApiException e)
        {
            usage.Success = false;
            _log.LogWarning(e, "Anthropic API error for {Feature}", feature);
            throw new AiException(502, "AI request failed: " + Short(e.Message));
        }
        catch (JsonException e)
        {
            usage.Success = false;
            _log.LogWarning(e, "Unparseable AI answer for {Feature}", feature);
            throw new AiException(502, "Could not read the AI answer. Please try again.");
        }
        finally
        {
            usage.DurationMs = (int)sw.ElapsedMilliseconds;
            _db.AiUsages.Add(usage);
            try { await _db.SaveChangesAsync(CancellationToken.None); } catch (Exception e) { _log.LogWarning(e, "Could not record AI usage"); }
        }
    }

    private static string Short(string m) => m.Length > 200 ? m[..200] + "…" : m;

    private static Dictionary<string, JsonElement> ToSchema(object schema)
    {
        var el = JsonSerializer.SerializeToElement(schema);
        return el.EnumerateObject().ToDictionary(p => p.Name, p => p.Value.Clone());
    }

    // JSON-schema helpers (structured outputs need additionalProperties:false and every property listed in required).
    private static object Str(string desc) => new { type = "string", description = desc };
    private static object NStr(string desc) => new { anyOf = new object[] { new { type = "string" }, new { type = "null" } }, description = desc };
    private static object NInt(string desc) => new { anyOf = new object[] { new { type = "integer" }, new { type = "null" } }, description = desc };
    private static object NNum(string desc) => new { anyOf = new object[] { new { type = "number" }, new { type = "null" } }, description = desc };
    private static object StrList(string desc) => new { type = "array", items = new { type = "string" }, description = desc };
    private static object Enum(string desc, params string[] values) => new { type = "string", @enum = values, description = desc };
    private static object Obj(Dictionary<string, object> props) => new { type = "object", properties = props, required = props.Keys.ToArray(), additionalProperties = false };

    private static BetaContentBlockParam Image(string base64, string contentType) => new BetaImageBlockParam
    {
        Source = new BetaBase64ImageSource { Data = base64, MediaType = contentType },
    };

    private static string TodayLine(CompanySettings s)
    {
        var tz = SettingsService.ResolveTimeZone(s.TimeZoneId);
        var now = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, tz);
        return $"Today is {now:dddd, d MMMM yyyy} ({s.TimeZoneId}).";
    }

    private static string LanguageName(string? code) => (code ?? "en").ToLowerInvariant() switch
    {
        "hi" => "Hindi (Devanagari script)",
        "te" => "Telugu (Telugu script)",
        "ta" => "Tamil (Tamil script)",
        "kn" => "Kannada (Kannada script)",
        "mr" => "Marathi (Devanagari script)",
        "hinglish" => "Hinglish (Hindi written in Latin letters)",
        _ => "English",
    };

    // ----- 1. Capture assist -----

    public async Task<CaptureSuggestion> CaptureAssistAsync(int userId, CompanySettings s, CaptureAssistRequest req, string? projectName, CancellationToken ct)
    {
        var photos = (req.Photos ?? new()).Take(3).ToList();
        if (string.IsNullOrWhiteSpace(req.Text) && photos.Count == 0)
            throw new AiException(400, "Describe the visit or add a shop photo first.");

        var content = new List<BetaContentBlockParam>();
        foreach (var p in photos)
        {
            var decoded = ImageUpload.Decode(p.DataBase64, p.ContentType, ImageUpload.MaxPhotoBytes, out var err);
            if (decoded is null) throw new AiException(400, err ?? "Bad photo.");
            content.Add(Image(Convert.ToBase64String(decoded.Value.bytes), decoded.Value.contentType));
        }
        var current = req.Current?.Where(kv => !string.IsNullOrWhiteSpace(kv.Value)).ToDictionary(kv => kv.Key, kv => kv.Value) ?? new();
        var userText = $"""
            Executive's note about the visit (may be empty):
            <note>{(req.Text ?? "").Trim()}</note>

            Fields the executive already filled (JSON; do not contradict these, you may repeat them):
            {JsonSerializer.Serialize(current)}

            {(photos.Count > 0 ? $"{photos.Count} shop photo(s) are attached above." : "No photos attached.")}
            Fill the form fields now.
            """;
        content.Add(new BetaTextBlockParam { Text = userText });

        var system = $"""
            You help a field marketing executive in India fill a lead-capture form right after visiting a shop or business.
            The company is "{s.CompanyName}". The product/project being marketed: {projectName ?? "not specified"}.
            {TodayLine(s)} Currency: {s.Currency}.

            The note may be in English, Hindi, Telugu or a mix, often dictated with speech-to-text mistakes. Read it generously.
            Rules:
            - Only fill a field when you are reasonably confident; otherwise return null. Never invent a mobile number or name.
            - shopName: from the note, or read it from the signboard in the photos. Write it in English letters; put the exact signboard wording (any script) in signboardText.
            - mobile / altMobile: digits only, Indian 10-digit if possible.
            - shopType: short category such as Retail shop, Wholesale, Distributor, Supermarket, Pharmacy, Hardware, Electronics, Restaurant / Hotel, Clinic, School / Institute, Office.
            - address / area / city / pincode: only what the note or photos actually say.
            - interest: 1 = not interested, 2 = low, 3 = medium, 4 = high, 5 = ready to buy. Infer from the tone and facts in the note; null if nothing indicates it.
            - status: New unless the note clearly says a deal was closed (Converted), the owner refused (Lost), price/quantity is being discussed (Negotiation) or a revisit was agreed (FollowUp).
            - expectedValue: numeric order value in {s.Currency} if quantities or prices were mentioned; else null.
            - nextFollowUpDays: days from today until the follow-up the note implies (e.g. "call on Monday", "next week", "after Diwali" → your best estimate); null if none.
            - notes: a clean 1–3 sentence English summary a colleague would find useful (keep quantities, prices, objections, best time to visit).
            - observations: up to 4 short marketing observations from the photos (shop size, footfall, display space, competitor products visible, condition). Empty list if no photos.
            - summary: one short line telling the executive what you filled, e.g. "Filled shop name from signboard, interest 4, follow-up in 3 days."
            """;

        var schema = Obj(new()
        {
            ["shopName"] = NStr("Shop / business name in English letters"),
            ["contactName"] = NStr("Owner or contact person"),
            ["mobile"] = NStr("Primary mobile, digits only"),
            ["altMobile"] = NStr("Alternate mobile, digits only"),
            ["shopType"] = NStr("Shop category"),
            ["address"] = NStr("Street address / landmark"),
            ["area"] = NStr("Area or locality"),
            ["city"] = NStr("City"),
            ["pincode"] = NStr("Postal code"),
            ["interest"] = NInt("1-5 interest score"),
            ["status"] = Enum("Pipeline status", "New", "FollowUp", "Negotiation", "Converted", "Lost"),
            ["expectedValue"] = NNum("Expected order value"),
            ["nextFollowUpDays"] = NInt("Days until next follow-up"),
            ["notes"] = NStr("Clean English summary of the visit"),
            ["signboardText"] = NStr("Exact signboard text if visible"),
            ["observations"] = StrList("Short observations from the photos"),
            ["summary"] = Str("One line describing what was filled"),
        });

        return await CompleteJsonAsync<CaptureSuggestion>("capture-assist", userId, s, system, content, schema, "low", 2000, ct);
    }

    // ----- 2. Lead insight -----

    public async Task<LeadInsight> LeadInsightAsync(int userId, CompanySettings s, LeadDetailDto lead, string language, string executiveName, CancellationToken ct)
    {
        var history = lead.Activities.OrderBy(a => a.CreatedAt).Select(a => new
        {
            when = a.CreatedAt.ToString("yyyy-MM-dd"), a.Type, a.Note, a.Interest, a.FromStatus, a.ToStatus, a.NextFollowUpAt, by = a.UserName,
        });
        var facts = new
        {
            lead.ShopName, lead.ContactName, lead.ShopType, lead.Area, lead.City, project = lead.ProjectName, executive = lead.AssignedToName,
            lead.Interest, lead.Status, lead.ExpectedValue, lead.Notes, lead.NextFollowUpAt, lead.FollowUpState, lead.LostReason,
            captured = lead.CreatedAt.ToString("yyyy-MM-dd"), lastActivity = lead.LastActivityAt.ToString("yyyy-MM-dd"), photos = lead.Photos.Count,
            history,
        };
        var system = $"""
            You are a sales coach for field marketing executives at "{s.CompanyName}" in India. {TodayLine(s)} Currency: {s.Currency}.
            Given one lead (a shop visited by an executive) and its history, write practical, specific advice. Be concrete: refer to the actual
            notes, dates, prices and objections in the data. Avoid generic sales talk.
            - priority: High if the lead is hot or a follow-up is due/overdue or a deal is close; Low if lost/cold or converted with nothing to do; else Medium.
            - summary: 2–3 plain sentences on where this lead stands.
            - nextBestAction: one specific action for the executive (what, when, with what offer or material).
            - talkingPoints: 3 short points to raise in the next conversation.
            - risks: 0–3 short risks (e.g. gone quiet for 12 days, competitor mentioned).
            - whatsappMessage: a short, warm WhatsApp message (under 80 words) from executive "{executiveName}" to the shop owner, written in {LanguageName(language)}.
              Address the owner by name if known. Mention the product and the concrete next step. No placeholders in square brackets, no subject line. Sign off with the executive's first name and the company name.
            """;
        var content = new List<BetaContentBlockParam> { new BetaTextBlockParam { Text = "Lead data:\n" + JsonSerializer.Serialize(facts, new JsonSerializerOptions { WriteIndented = true }) } };
        var schema = Obj(new()
        {
            ["priority"] = Enum("Priority", "High", "Medium", "Low"),
            ["summary"] = Str("Where the lead stands"),
            ["nextBestAction"] = Str("One specific next action"),
            ["talkingPoints"] = StrList("Points for the next conversation"),
            ["risks"] = StrList("Risks"),
            ["whatsappMessage"] = Str("Ready-to-send WhatsApp message"),
        });
        var insight = await CompleteJsonAsync<LeadInsight>("lead-insight", userId, s, system, content, schema, "medium", 3000, ct);
        insight.Language = language;
        insight.GeneratedAt = DateTime.UtcNow;
        return insight;
    }

    // ----- 3. WhatsApp message -----

    public async Task<DraftMessageResponse> DraftMessageAsync(int userId, CompanySettings s, LeadDetailDto lead, DraftMessageRequest req, string executiveName, CancellationToken ct)
    {
        var language = string.IsNullOrWhiteSpace(req.Language) ? "en" : req.Language;
        var purpose = (req.Purpose ?? "followup").ToLowerInvariant() switch
        {
            "thanks" => "thank the owner for their time after today's visit and confirm the next step",
            "offer" => "share a short offer / price highlight and invite them to order",
            "reminder" => "gently remind them about the pending decision and offer to visit or call",
            "reconnect" => "reconnect after a long gap without sounding pushy",
            "custom" => "do what the extra instruction says",
            _ => "follow up on the last conversation and propose the next step",
        };
        var lastNotes = string.Join(" | ", lead.Activities.OrderByDescending(a => a.CreatedAt).Take(3).Select(a => $"{a.CreatedAt:dd MMM} {a.Type}: {a.Note}"));
        var system = $"""
            You write WhatsApp messages for field marketing executives at "{s.CompanyName}" in India. {TodayLine(s)}
            Write ONE message (under 90 words) in {LanguageName(language)}, tone: {(string.IsNullOrWhiteSpace(req.Tone) ? "friendly and respectful" : req.Tone)}.
            Purpose: {purpose}. From executive "{executiveName}" to the owner of "{lead.ShopName}"{(lead.ContactName is null ? "" : $" ({lead.ContactName})")}
            about the product "{lead.ProjectName}". Use the facts below; never invent prices or dates. No placeholders, no subject line.
            Sign off with the executive's first name and the company name. Emojis: at most one.
            """;
        var facts = $"""
            Lead status: {lead.Status}, interest {lead.Interest}/5, expected value {lead.ExpectedValue?.ToString() ?? "unknown"} {s.Currency}.
            Notes: {lead.Notes}
            Recent history: {lastNotes}
            Next follow-up date: {lead.NextFollowUpAt?.ToString("d MMM yyyy") ?? "none"}
            Extra instruction from the executive: {req.Extra}
            """;
        var content = new List<BetaContentBlockParam> { new BetaTextBlockParam { Text = facts } };
        var schema = Obj(new() { ["message"] = Str("The WhatsApp message text") });
        var result = await CompleteJsonAsync<Dictionary<string, string>>("draft-message", userId, s, system, content, schema, "low", 800, ct);
        return new DraftMessageResponse(result.GetValueOrDefault("message") ?? "", language);
    }

    // ----- 4. Daily briefing -----

    public async Task<Briefing> BriefingAsync(int userId, CompanySettings s, bool isAdmin, string userName, DashboardDto d, List<LeadSummaryDto> hotOpen, CancellationToken ct)
    {
        var t = d.Totals;
        var data = new
        {
            totals = t,
            byStatus = d.ByStatus, byProject = d.ByProject,
            executives = isAdmin ? d.ByExecutive : null,
            topCities = d.TopCities,
            last14Days = d.Daily.TakeLast(14),
            dueFollowUps = d.DueFollowUps.Select(l => new { l.Id, l.ShopName, l.ContactName, l.ProjectName, l.Interest, l.Status, l.NextFollowUpAt, l.FollowUpState, l.ExpectedValue, l.City, executive = l.AssignedToName }),
            hotOpenLeads = hotOpen.Select(l => new { l.Id, l.ShopName, l.ProjectName, l.Interest, l.Status, l.ExpectedValue, l.NextFollowUpAt, lastActivity = l.LastActivityAt.ToString("yyyy-MM-dd"), executive = l.AssignedToName }),
            recentActivity = d.RecentActivities.Take(8),
        };
        var system = isAdmin
            ? $"""
              You are the marketing operations analyst for "{s.CompanyName}" in India. {TodayLine(s)} Currency: {s.Currency}.
              From the dashboard data, write today's briefing for the admin who runs the field marketing team. Be specific with numbers and names.
              - headline: one sentence on how marketing is going right now.
              - highlights: 3–5 wins or notable facts (best executive, best project, conversion trend, big deals in pipeline).
              - concerns: 0–4 problems (overdue follow-ups, executives with no visits, stale leads, projects behind target).
              - actions: 3–6 concrete actions for today. Where an action is about one lead, set leadId to that lead's id; otherwise null. title = short imperative, detail = why / how.
              """
            : $"""
              You are a friendly sales coach for "{userName}", a field marketing executive at "{s.CompanyName}" in India. {TodayLine(s)} Currency: {s.Currency}.
              From their personal dashboard data, plan their day. Address them directly ("you"). Be specific: name shops, reasons and what to say.
              - headline: one motivating sentence with their key number for today.
              - highlights: 2–4 things going well (streaks, hot leads, conversions).
              - concerns: 0–3 things slipping (overdue follow-ups, quiet leads).
              - actions: 4–8 visits or calls to make today in priority order — overdue and hot leads first. Set leadId for each lead-specific action. title = "Visit <shop>" / "Call <shop>", detail = why and the goal of the conversation.
              """;
        var content = new List<BetaContentBlockParam> { new BetaTextBlockParam { Text = "Dashboard data:\n" + JsonSerializer.Serialize(data, new JsonSerializerOptions { WriteIndented = false }) } };
        var schema = Obj(new()
        {
            ["headline"] = Str("One-sentence headline"),
            ["highlights"] = StrList("Wins and notable facts"),
            ["concerns"] = StrList("Problems to watch"),
            ["actions"] = new
            {
                type = "array",
                description = "Concrete actions in priority order",
                items = Obj(new()
                {
                    ["leadId"] = NInt("Lead id when the action is about one lead"),
                    ["title"] = Str("Short imperative title"),
                    ["detail"] = Str("Why and how"),
                }),
            },
        });
        var briefing = await CompleteJsonAsync<Briefing>("briefing", userId, s, system, content, schema, "medium", 3500, ct);
        briefing.Scope = isAdmin ? "team" : "me";
        briefing.GeneratedAt = DateTime.UtcNow;
        return briefing;
    }
}
