using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Yukktha.Api.Data;
using Yukktha.Api.Data.Entities;
using Yukktha.Api.Dtos;
using Yukktha.Api.Services;
using Yukktha.Api.Tenancy;

namespace Yukktha.Api.Controllers;

/// <summary>Public, unauthenticated. Tenant comes from the subdomain / custom domain (or X-Store-Slug in dev).</summary>
[ApiController, Route("api/store")]
public class StorefrontController(AppDbContext db, TenantContext tenant, SubscriptionService subs, IWhatsAppService wa, IConfiguration cfg) : ControllerBase
{
    private async Task<(Store? store, IActionResult? error)> LoadAsync()
    {
        if (!tenant.IsResolved) return (null, NotFound(new { error = "Store not found" }));
        var s = await db.Stores.AsNoTracking().FirstAsync(x => x.Id == tenant.StoreId);
        if (!subs.IsStorefrontOpen(s)) return (null, StatusCode(503, new { error = "temporarily_closed", name = s.Name }));
        return (s, null);
    }

    [HttpGet]
    public async Task<IActionResult> Info()
    {
        var (s, err) = await LoadAsync(); if (err is not null) return err;
        var cats = await db.Categories.OrderBy(c => c.SortOrder).ToListAsync();
        return Ok(new { s!.Name, s.Slug, s.LogoUrl, s.ThemeColor, s.City, s.Address, s.DefaultLanguage, s.InstagramHandle,
            whatsApp = s.WhatsAppNumber ?? s.OwnerPhone, s.CodEnabled, s.OnlinePaymentEnabled, s.LocalDeliveryEnabled, s.LocalDeliveryCharge, s.CourierEnabled, s.CourierCharge,
            categories = cats.Select(c => new { c.Id, c.NameEn, c.NameTe }) });
    }

    [HttpGet("products")]
    public async Task<IActionResult> Products([FromQuery] Guid? categoryId)
    {
        var (s, err) = await LoadAsync(); if (err is not null) return err;
        var q = db.Products.Include(p => p.Images).Include(p => p.Variants).Where(p => p.IsActive);
        if (categoryId is not null) q = q.Where(p => p.CategoryId == categoryId);
        var items = await q.OrderByDescending(p => p.CreatedAt).AsNoTracking().ToListAsync();
        return Ok(items.Select(p => PublicDto(s!, p)));
    }

    [HttpGet("products/{slug}")]
    public async Task<IActionResult> Product(string slug)
    {
        var (s, err) = await LoadAsync(); if (err is not null) return err;
        var p = await db.Products.Include(x => x.Images).Include(x => x.Variants).AsNoTracking().FirstOrDefaultAsync(x => x.Slug == slug && x.IsActive);
        return p is null ? NotFound() : Ok(PublicDto(s!, p));
    }

    /// <summary>OR-1 + WA-3: create the order, notify owner and customer on WhatsApp.</summary>
    [HttpPost("checkout")]
    public async Task<IActionResult> Checkout(CheckoutRequest req)
    {
        var (s, err) = await LoadAsync(); if (err is not null) return err;
        if (req.PaymentMethod == PaymentMethod.Cod && !s!.CodEnabled) return BadRequest(new { error = "Cash on delivery not available" });
        if (req.PaymentMethod == PaymentMethod.Online && !s!.OnlinePaymentEnabled) return BadRequest(new { error = "Online payment not available" });

        var result = await OrderBuilder.CreateAsync(db, s!, req, source: "storefront");
        if (result.Error is not null) return BadRequest(new { error = result.Error });
        var order = result.Order!;

        await wa.NotifyOwnerNewOrderAsync(s!, order);
        await wa.SendCustomerOrderConfirmedAsync(s!, order);

        // Also give the customer a one-tap WhatsApp thread with the order details, in case templates are not yet approved.
        var msg = $"Order #{order.Number} at {s!.Name}\n" + string.Join("\n", order.Items.Select(i => $"{i.Quantity} x {i.ProductName}{(i.VariantLabel is null ? "" : $" ({i.VariantLabel})")}")) + $"\nTotal ₹{order.Total:0}";
        var waLink = $"https://wa.me/{(s.WhatsAppNumber ?? s.OwnerPhone).TrimStart('+')}?text={Uri.EscapeDataString(msg)}";

        return Ok(new { orderId = order.Id, number = order.Number, total = order.Total, whatsAppLink = waLink,
            razorpay = req.PaymentMethod == PaymentMethod.Online ? new { keyId = cfg["Razorpay:KeyId"], amountPaise = (long)(order.Total * 100), orderNumber = order.Number } : null });
    }

    private object PublicDto(Store s, Product p)
    {
        var url = $"https://{s.Slug}.{cfg["Platform:RootDomain"]}/p/{p.Slug}";
        return new
        {
            p.Id, p.Slug, p.Name, p.Description, p.Price, p.CompareAtPrice, p.CategoryId,
            images = p.Images.OrderBy(i => i.SortOrder).Select(i => i.Url),
            variants = p.Variants.Select(v => new { v.Id, v.Color, v.Size, price = v.PriceOverride ?? p.Price, inStock = v.Stock > 0, v.IsDefault,
                whatsAppLink = wa.BuildOrderLink(s, p, v, url) }),
            inStock = p.Variants.Any(v => v.Stock > 0),
            shareUrl = url,
            whatsAppLink = wa.BuildOrderLink(s, p, p.Variants.FirstOrDefault(v => v.IsDefault), url)
        };
    }
}
