namespace Yukktha.Api.Tenancy;

/// <summary>Per-request tenant. Null StoreId means a platform-level request (signup, super-admin).</summary>
public class TenantContext
{
    public Guid? StoreId { get; set; }
    public string? Slug { get; set; }
    public bool IsResolved => StoreId.HasValue;
}
