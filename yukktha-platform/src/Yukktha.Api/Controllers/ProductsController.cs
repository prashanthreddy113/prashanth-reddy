using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Yukktha.Api.Data;
using Yukktha.Api.Data.Entities;
using Yukktha.Api.Dtos;
using Yukktha.Api.Services;
using Yukktha.Api.Tenancy;

namespace Yukktha.Api.Controllers;

[Route("api/admin/products")]
public class ProductsController(AppDbContext db, TenantContext tenant, MediaService media) : TenantControllerBase(tenant)
{
    [HttpGet]
    public async Task<IActionResult> List([FromQuery] string? q, [FromQuery] Guid? categoryId, [FromQuery] int page = 1, [FromQuery] int pageSize = 50)
    {
        var query = db.Products.Include(p => p.Images).Include(p => p.Variants).AsNoTracking();
        if (!string.IsNullOrWhiteSpace(q)) query = query.Where(p => p.Name.Contains(q));
        if (categoryId is not null) query = query.Where(p => p.CategoryId == categoryId);
        var total = await query.CountAsync();
        var items = await query.OrderByDescending(p => p.CreatedAt).Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();
        return Ok(new { total, items = items.Select(ToDto) });
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id)
    {
        var p = await db.Products.Include(x => x.Images).Include(x => x.Variants).FirstOrDefaultAsync(x => x.Id == id);
        return p is null ? NotFound() : Ok(ToDto(p));
    }

    /// <summary>CT-1: create with images already uploaded via /images. Variants optional; a default one is created.</summary>
    [HttpPost]
    public async Task<IActionResult> Create(ProductUpsert req)
    {
        var product = new Product { Slug = await UniqueSlugAsync(req.Name) };
        Apply(product, req);
        db.Products.Add(product);
        await db.SaveChangesAsync();
        return Ok(ToDto(product));
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, ProductUpsert req)
    {
        var product = await db.Products.Include(x => x.Images).Include(x => x.Variants).FirstOrDefaultAsync(x => x.Id == id);
        if (product is null) return NotFound();
        db.ProductImages.RemoveRange(product.Images);
        // Keep variant IDs that still exist so order history stays linked.
        var keep = req.Variants.Where(v => v.Id != null).Select(v => v.Id!.Value).ToHashSet();
        db.ProductVariants.RemoveRange(product.Variants.Where(v => !keep.Contains(v.Id)));
        product.Images.Clear();
        Apply(product, req);
        await db.SaveChangesAsync();
        return Ok(ToDto(product));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var p = await db.Products.FindAsync(id);
        if (p is null) return NotFound();
        p.IsActive = false; // soft delete: orders reference products
        await db.SaveChangesAsync();
        return NoContent();
    }

    /// <summary>CT-4: bulk sold-out / price changes for festival stock.</summary>
    [HttpPost("bulk")]
    public async Task<IActionResult> Bulk([FromBody] BulkRequest req)
    {
        var products = await db.Products.Include(p => p.Variants).Where(p => req.ProductIds.Contains(p.Id)).ToListAsync();
        foreach (var p in products)
        {
            if (req.MarkSoldOut == true) foreach (var v in p.Variants) v.Stock = 0;
            if (req.PricePercentChange is { } pct) p.Price = Math.Round(p.Price * (1 + pct / 100m), 0);
            if (req.IsActive is { } a) p.IsActive = a;
        }
        await db.SaveChangesAsync();
        return Ok(new { updated = products.Count });
    }

    [HttpPost("images"), RequestSizeLimit(10 * 1024 * 1024)]
    public async Task<IActionResult> UploadImage(IFormFile file)
    {
        try { return Ok(new { url = await media.UploadAsync(StoreId, file) }); }
        catch (ArgumentException ex) { return BadRequest(new { error = ex.Message }); }
    }

    [HttpGet("/api/admin/categories")]
    public async Task<IActionResult> Categories() => Ok(await db.Categories.OrderBy(c => c.SortOrder).ToListAsync());

    private static void Apply(Product p, ProductUpsert r)
    {
        p.Name = r.Name.Trim(); p.Description = r.Description; p.Price = r.Price; p.CompareAtPrice = r.CompareAtPrice;
        p.CategoryId = r.CategoryId; p.IsActive = r.IsActive;
        p.Images.AddRange(r.ImageUrls.Select((u, i) => new ProductImage { StoreId = p.StoreId, ProductId = p.Id, Url = u, SortOrder = i }));
        if (r.Variants.Count == 0)
        {
            var def = p.Variants.FirstOrDefault(v => v.IsDefault);
            if (def is null) p.Variants.Add(new ProductVariant { StoreId = p.StoreId, ProductId = p.Id, IsDefault = true, Stock = 1 });
        }
        else foreach (var v in r.Variants)
        {
            var existing = v.Id is null ? null : p.Variants.FirstOrDefault(x => x.Id == v.Id);
            if (existing is null) p.Variants.Add(new ProductVariant { StoreId = p.StoreId, ProductId = p.Id, Color = v.Color, Size = v.Size, PriceOverride = v.PriceOverride, Stock = v.Stock, Sku = v.Sku });
            else { existing.Color = v.Color; existing.Size = v.Size; existing.PriceOverride = v.PriceOverride; existing.Stock = v.Stock; existing.Sku = v.Sku; }
        }
    }

    private async Task<string> UniqueSlugAsync(string name)
    {
        var basis = new string(name.ToLowerInvariant().Select(c => char.IsLetterOrDigit(c) ? c : '-').ToArray()).Trim('-');
        if (string.IsNullOrEmpty(basis) || !basis.Any(c => c is >= 'a' and <= 'z' or >= '0' and <= '9')) basis = "item";
        var slug = basis; var i = 2;
        while (await db.Products.AnyAsync(p => p.Slug == slug)) slug = $"{basis}-{i++}";
        return slug;
    }

    public static object ToDto(Product p) => new
    {
        p.Id, p.Slug, p.Name, p.Description, p.Price, p.CompareAtPrice, p.CategoryId, p.IsActive, p.CreatedAt,
        images = p.Images.OrderBy(i => i.SortOrder).Select(i => i.Url),
        variants = p.Variants.Select(v => new { v.Id, v.Color, v.Size, v.PriceOverride, v.Stock, v.Sku, v.IsDefault }),
        inStock = p.Variants.Any(v => v.Stock > 0)
    };

    public record BulkRequest(List<Guid> ProductIds, bool? MarkSoldOut, decimal? PricePercentChange, bool? IsActive);
}
