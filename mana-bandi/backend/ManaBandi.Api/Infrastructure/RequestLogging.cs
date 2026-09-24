using System.Diagnostics;
using System.Security.Claims;

namespace ManaBandi.Api.Infrastructure;

/// <summary>One structured log line per request: method, path (secrets masked), status, duration, user, role.</summary>
public class RequestLogging
{
    private readonly RequestDelegate _next;
    private readonly ILogger<RequestLogging> _log;

    public RequestLogging(RequestDelegate next, ILogger<RequestLogging> log)
    {
        _next = next;
        _log = log;
    }

    public async Task Invoke(HttpContext ctx)
    {
        var sw = Stopwatch.StartNew();
        try
        {
            await _next(ctx);
        }
        finally
        {
            sw.Stop();
            var path = SafePath(ctx.Request.Path);
            if (path != "/healthz")
            {
                var level = ctx.Response.StatusCode >= 500 ? LogLevel.Error : LogLevel.Information;
                _log.Log(level, "HTTP {Method} {Path} -> {Status} in {ElapsedMs} ms user={UserId} role={Role} app={AppVersion}",
                    ctx.Request.Method, path, ctx.Response.StatusCode, sw.ElapsedMilliseconds,
                    ctx.User.FindFirstValue("sub") ?? "-", ctx.User.FindFirstValue("role") ?? "-",
                    ctx.Request.Headers["X-App-Version"].FirstOrDefault() ?? "-");
            }
        }
    }

    /// <summary>Masks share tokens so they never land in logs.</summary>
    public static string SafePath(PathString p)
    {
        var s = p.Value ?? "/";
        if (s.StartsWith("/t/")) return "/t/***";
        if (s.StartsWith("/api/public/track/")) return "/api/public/track/***";
        return s;
    }
}
