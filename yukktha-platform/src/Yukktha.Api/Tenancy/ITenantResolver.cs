namespace Yukktha.Api.Tenancy;

public interface ITenantResolver
{
    Task<(Guid storeId, string slug)?> ResolveAsync(HttpContext ctx);
}
