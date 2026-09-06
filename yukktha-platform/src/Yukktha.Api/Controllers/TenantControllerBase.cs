using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Yukktha.Api.Auth;
using Yukktha.Api.Tenancy;

namespace Yukktha.Api.Controllers;

/// <summary>
/// Admin endpoints: the tenant is taken from the JWT, never from the host header,
/// so a token for store A can never act on store B even if the request is sent to B's subdomain.
/// </summary>
[ApiController, Authorize(Policy = "StoreStaff")]
public abstract class TenantControllerBase(TenantContext tenant) : ControllerBase
{
    public override void OnActionExecuting(ActionExecutingContext context)
    {
        tenant.StoreId = User.StoreId();
        tenant.Slug = User.FindFirst("store_slug")?.Value;
        base.OnActionExecuting(context);
    }
    protected Guid StoreId => tenant.StoreId!.Value;
}
