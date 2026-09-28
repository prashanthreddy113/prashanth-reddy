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
        var s = await db.Stores.AsNoTracking().FirstOrDefaultAsync(x => x.Id == tenant.StoreId);
        if (s is null) return (null, NotFound(new { error = "Store not found" }));   // resolver cache can outlive a deleted store
        if (!subs.IsStorefrontOpen(s)) return (null, StatusCode(503, new { error = "temporarily_closed", name = s.Name }));
        return (s, null);
    }

    [HttpGet]
    public async Task<IActionResult> Info()
    {
        var (s, err) = await LoadAsync(); if (err is not null) return err;
        var cats = await db.Categories.OrderBy(c => c.SortOrder).ToListAsync();
        var collections = await CollectionCardsAsync();
        return Ok(new { s!.Name, s.Slug, s.LogoUrl, s.ThemeColor, s.City, s.Address, s.DefaultLanguage, s.InstagramHandle,
            whatsApp = s.WhatsAppNumber ?? s.OwnerPhone, s.CodEnabled, s.OnlinePaymentEnabled, s.LocalDeliveryEnabled, s.LocalDeliveryCharge, s.CourierEnabled, s.CourierCharge,
            categories = cats.Select(c => new { c.Id, c.NameEn, c.NameTe }), collections });
    }

    [HttpGet("collections")]
    public async Task<IActionResult> Collections()
    {
        var (_, err) = await LoadAsync(); if (err is not null) return err;
        return Ok(await CollectionCardsAsync());
    }

    /// <summary>
    /// Collection page: filters (availability, price, colour, fabric, occasion, search), facet counts, sort and paging.
    /// "all" is every active product. Multi-value filters are comma-separated: ?color=red,green&amp;fabric=kanchi%20silk
    /// </summary>
    [HttpGet("collections/{slug}")]
    public async Task<IActionResult> Collection(string slug, [FromQuery] string? sort, [FromQuery] bool? inStock, [FromQuery] decimal? minPrice, [FromQuery] decimal? maxPrice,
        [FromQuery] string? color, [FromQuery] string? fabric, [FromQuery] string? occasion, [FromQuery] string? q, [FromQuery] int page = 1, [FromQuery] int pageSize = CatalogQuery.DefaultPageSize)
    {
        var (s, err) = await LoadAsync(); if (err is not null) return err;
        var products = db.Products.Include(p => p.Images).Include(p => p.Variants).Where(p => p.IsActive).AsNoTracking();
        Dictionary<Guid, int> featured = [];
        object info;
        if (slug == "all")
            info = new { slug, title = "All products", titleTe = "అన్ని ఉత్పత్తులు", description = (string?)null, bannerUrl = (string?)null };
        else
        {
            var c = await db.Collections.AsNoTracking().FirstOrDefaultAsync(x => x.Slug == slug && x.IsActive);
            if (c is null) return NotFound(new { error = "Collection not found" });
            featured = await db.CollectionProducts.Where(x => x.CollectionId == c.Id).ToDictionaryAsync(x => x.ProductId, x => x.SortOrder);
            var ids = featured.Keys.ToList();
            products = products.Where(p => ids.Contains(p.Id));
            info = new { c.Slug, c.Title, c.TitleTe, c.Description, c.BannerUrl };
        }

        var all = await products.ToListAsync();
        var filter = CatalogQuery.Filter.Parse(inStock, minPrice, maxPrice, color, fabric, occasion, q);
        var matched = CatalogQuery.Apply(all, filter);
        sort = CatalogQuery.Sorts.Contains(sort) ? sort : "featured";
        Dictionary<Guid, int> sold = [];
        if (sort == "best-selling")
        {
            var ids = matched.Select(p => p.Id).ToList();
            sold = await db.OrderItems.Where(i => ids.Contains(i.ProductId))
                .Join(db.Orders.Where(o => o.Status != OrderStatus.Cancelled), i => i.OrderId, o => o.Id, (i, o) => i)
                .GroupBy(i => i.ProductId).Select(g => new { g.Key, units = g.Sum(i => i.Quantity) })
                .ToDictionaryAsync(x => x.Key, x => x.units);
        }
        pageSize = Math.Clamp(pageSize, 1, CatalogQuery.MaxPageSize);
        page = Math.Max(1, page);
        var items = CatalogQuery.Sort(matched, sort, featured, sold).Skip((page - 1) * pageSize).Take(pageSize).Select(p => PublicDto(s!, p));
        return Ok(new { collection = info, sort, page, pageSize, total = matched.Count, items, facets = CatalogQuery.BuildFacets(all, filter) });
    }

    private async Task<List<object>> CollectionCardsAsync()
    {
        var cols = await db.Collections.AsNoTracking().Where(c => c.IsActive).OrderBy(c => c.SortOrder).ThenBy(c => c.Title).ToListAsync();
        if (cols.Count == 0) return [];
        var colIds = cols.Select(c => c.Id).ToList();
        var members = await db.CollectionProducts.AsNoTracking().Where(x => colIds.Contains(x.CollectionId))
            .Join(db.Products.Where(p => p.IsActive), x => x.ProductId, p => p.Id, (x, p) => new { x.CollectionId, x.SortOrder, p.Id })
            .ToListAsync();
        var firstIds = members.GroupBy(m => m.CollectionId).Select(g => g.OrderBy(m => m.SortOrder).First().Id).ToList();
        var covers = await db.ProductImages.AsNoTracking().Where(i => firstIds.Contains(i.ProductId))
            .GroupBy(i => i.ProductId).Select(g => new { g.Key, url = g.OrderBy(i => i.SortOrder).Select(i => i.Url).First() })
            .ToDictionaryAsync(x => x.Key, x => x.url);
        return cols.Select(c =>
        {
            var m = members.Where(x => x.CollectionId == c.Id).OrderBy(x => x.SortOrder).ToList();
            var cover = c.BannerUrl ?? (m.Count > 0 ? covers.GetValueOrDefault(m[0].Id) : null);
            return (object)new { c.Id, c.Slug, c.Title, c.TitleTe, c.Description, imageUrl = cover, productCount = m.Count };
        }).ToList();
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
            p.Id, p.Slug, p.Name, p.Description, p.Price, p.CompareAtPrice, p.CategoryId, p.Color, p.Fabric, p.Occasion,
            images = p.Images.OrderBy(i => i.SortOrder).Select(i => i.Url),
            variants = p.Variants.Select(v => new { v.Id, v.Color, v.Size, price = v.PriceOverride ?? p.Price, inStock = v.Stock > 0, v.IsDefault,
                whatsAppLink = wa.BuildOrderLink(s, p, v, url) }),
            inStock = p.Variants.Any(v => v.Stock > 0),
            shareUrl = url,
            whatsAppLink = wa.BuildOrderLink(s, p, p.Variants.FirstOrDefault(v => v.IsDefault), url)
        };
    }
}
