using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Yukktha.Api.Data;

namespace Yukktha.Api.Tenancy;

/// <summary>
/// Resolves the store from, in order: X-Store-Slug header (admin PWA and local dev),
/// custom domain, then subdomain of the root platform domain.
/// </summary>
public class SubdomainTenantResolver(AppDbContext db, IMemoryCache cache, IConfiguration cfg) : ITenantResolver
{
    public async Task<(Guid storeId, string slug)?> ResolveAsync(HttpContext ctx)
    {
        var root = cfg["Platform:RootDomain"]!;
        string? slug = null;
        var host = ctx.Request.Host.Host.ToLowerInvariant();

        if (ctx.Request.Headers.TryGetValue("X-Store-Slug", out var h) && !string.IsNullOrWhiteSpace(h))
            slug = h.ToString().ToLowerInvariant();
        else if (host.EndsWith("." + root))
            slug = host[..^(root.Length + 1)];

        var key = slug is not null ? $"tenant:slug:{slug}" : $"tenant:host:{host}";
        return await cache.GetOrCreateAsync(key, async e =>
        {
            e.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(5);
            var q = db.Stores.IgnoreQueryFilters().AsNoTracking();
            var store = slug is not null
                ? await q.FirstOrDefaultAsync(s => s.Slug == slug)
                : await q.FirstOrDefaultAsync(s => s.CustomDomain == host);
            return store is null ? null : ((Guid, string)?)(store.Id, store.Slug);
        });
    }
}
