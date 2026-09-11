using System.ComponentModel.DataAnnotations;
using Anthropic.Exceptions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudyRoom.Api.Services;

namespace StudyRoom.Api.Controllers;

public class AiChatRequest
{
    [Required, MinLength(1)] public List<AiChatMessage> Messages { get; set; } = new();
}

public class AiDraftRequest
{
    /// <summary>reminder | overdue | welcome | thanks | custom</summary>
    [StringLength(20)] public string? Purpose { get; set; }
    [StringLength(30)] public string? Language { get; set; }
    [StringLength(500)] public string? Instructions { get; set; }
}

/// <summary>Claude-powered assistant: answers questions about the room and drafts WhatsApp messages.</summary>
[ApiController]
[Route("api/ai")]
[Authorize]
public class AiController : ControllerBase
{
    private const int MaxTotalChars = 24_000;

    private readonly AiService _ai;
    private readonly ILogger<AiController> _logger;

    public AiController(AiService ai, ILogger<AiController> logger)
    {
        _ai = ai;
        _logger = logger;
    }

    [HttpGet("status")]
    public ActionResult Status() => Ok(new { configured = _ai.IsConfigured, model = _ai.Model });

    [HttpPost("chat")]
    public async Task<ActionResult> Chat(AiChatRequest request, CancellationToken ct)
    {
        if (!_ai.IsConfigured) return NotConfigured();
        if (request.Messages.Sum(m => m.Content?.Length ?? 0) > MaxTotalChars)
            return BadRequest(new { message = "The conversation is too long. Start a new chat." });
        if (request.Messages.Any(m => string.IsNullOrWhiteSpace(m.Content)))
            return BadRequest(new { message = "Empty message." });

        try
        {
            var result = await _ai.ChatAsync(request.Messages, ct);
            return Ok(new { reply = result.Reply, model = result.Model, inputTokens = result.InputTokens, outputTokens = result.OutputTokens });
        }
        catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
        catch (AnthropicUnauthorizedException) { return StatusCode(503, new { message = "Anthropic rejected the API key. Check Anthropic__ApiKey on the API host." }); }
        catch (AnthropicRateLimitException) { return StatusCode(503, new { message = "The AI service is busy right now. Try again in a few seconds." }); }
        catch (AnthropicException ex)
        {
            _logger.LogWarning(ex, "AI chat failed");
            return StatusCode(502, new { message = "AI request failed: " + ex.Message });
        }
    }

    [HttpPost("draft/{studentId:int}")]
    public async Task<ActionResult> Draft(int studentId, AiDraftRequest request, CancellationToken ct)
    {
        if (!_ai.IsConfigured) return NotConfigured();
        try
        {
            var text = await _ai.DraftAsync(studentId, request.Purpose, request.Language, request.Instructions, ct);
            if (text is null) return NotFound();
            if (text.Length == 0) return BadRequest(new { message = "Could not write a message for this request. Try different instructions." });
            return Ok(new { text });
        }
        catch (AnthropicUnauthorizedException) { return StatusCode(503, new { message = "Anthropic rejected the API key. Check Anthropic__ApiKey on the API host." }); }
        catch (AnthropicRateLimitException) { return StatusCode(503, new { message = "The AI service is busy right now. Try again in a few seconds." }); }
        catch (AnthropicException ex)
        {
            _logger.LogWarning(ex, "AI draft failed");
            return StatusCode(502, new { message = "AI request failed: " + ex.Message });
        }
    }

    private ObjectResult NotConfigured() =>
        StatusCode(503, new { message = "The AI assistant is not configured. Set the Anthropic__ApiKey environment variable on the API host and restart it." });
}
