namespace Yukktha.Api.Tenancy;

public class TenantResolutionMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext ctx, TenantContext tenant, ITenantResolver resolver)
    {
        var resolved = await resolver.ResolveAsync(ctx);
        if (resolved is { } r) { tenant.StoreId = r.storeId; tenant.Slug = r.slug; }
        await next(ctx);
    }
}
