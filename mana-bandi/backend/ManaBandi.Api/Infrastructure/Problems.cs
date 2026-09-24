using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ManaBandi.Api.Infrastructure;

public static class Problems
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public static object Body(int status, string code, string title, HttpContext? ctx = null) => new Dictionary<string, object?>
    {
        ["type"] = $"https://api.manabandi.in/errors/{code}",
        ["title"] = title,
        ["status"] = status,
        ["code"] = code,
        ["traceId"] = ctx?.TraceIdentifier,
    };

    public static async Task WriteAsync(HttpContext ctx, int status, string code, string title)
    {
        if (ctx.Response.HasStarted) return;
        ctx.Response.StatusCode = status;
        ctx.Response.ContentType = "application/problem+json";
        await ctx.Response.WriteAsync(JsonSerializer.Serialize(Body(status, code, title, ctx), Json));
    }

    public static string CodeForStatus(int status) => status switch
    {
        401 => "unauthorized",
        403 => "forbidden",
        404 => "not_found",
        409 => "invalid_state",
        413 => "validation",
        415 => "validation",
        429 => "rate_limited",
        _ => status >= 500 ? "server_error" : "validation",
    };

    /// <summary>Model-binding / DataAnnotations failures → 400 `validation`.</summary>
    public static IActionResult InvalidModel(ActionContext ctx)
    {
        var first = ctx.ModelState.Where(kv => kv.Value?.Errors.Count > 0)
            .Select(kv => $"{kv.Key}: {kv.Value!.Errors[0].ErrorMessage}".Trim(' ', ':'))
            .FirstOrDefault() ?? "Invalid request";
        return new ObjectResult(Body(400, "validation", first, ctx.HttpContext)) { StatusCode = 400, ContentTypes = { "application/problem+json" } };
    }
}

/// <summary>Converts exceptions to RFC 7807 problem JSON with the contract's `code`.</summary>
public class ErrorHandlingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ErrorHandlingMiddleware> _log;

    public ErrorHandlingMiddleware(RequestDelegate next, ILogger<ErrorHandlingMiddleware> log)
    {
        _next = next;
        _log = log;
    }

    public async Task Invoke(HttpContext ctx)
    {
        try
        {
            await _next(ctx);
        }
        catch (ApiException ex)
        {
            await Problems.WriteAsync(ctx, ex.Status, ex.Code, ex.Message);
        }
        catch (DbUpdateConcurrencyException)
        {
            await Problems.WriteAsync(ctx, 409, "invalid_state", "The record was changed by someone else. Reload and try again.");
        }
        catch (BadHttpRequestException ex)
        {
            await Problems.WriteAsync(ctx, ex.StatusCode, Problems.CodeForStatus(ex.StatusCode), ex.StatusCode == 413 ? "Request too large" : "Bad request");
        }
        catch (OperationCanceledException) when (ctx.RequestAborted.IsCancellationRequested)
        {
            // client went away; nothing to write
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "Unhandled error on {Method} {Path}", ctx.Request.Method, RequestLogging.SafePath(ctx.Request.Path));
            await Problems.WriteAsync(ctx, 500, "server_error", "Something went wrong. Please try again.");
        }
    }
}
