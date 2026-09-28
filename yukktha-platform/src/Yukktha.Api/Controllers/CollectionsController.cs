using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Yukktha.Api.Data;
using Yukktha.Api.Data.Entities;
using Yukktha.Api.Dtos;
using Yukktha.Api.Tenancy;

namespace Yukktha.Api.Controllers;

/// <summary>Curated collections ("Yanai Motif Sarees", "Wedding silks"): each gets a storefront page at /collections/{slug}.</summary>
[Route("api/admin/collections")]
public class CollectionsController(AppDbContext db, TenantContext tenant) : TenantControllerBase(tenant)
{
    [HttpGet]
    public async Task<IActionResult> List()
    {
        var cols = await db.Collections.AsNoTracking().OrderBy(c => c.SortOrder).ThenBy(c => c.Title).ToListAsync();
        var counts = await db.CollectionProducts.GroupBy(x => x.CollectionId).Select(g => new { g.Key, n = g.Count() }).ToDictionaryAsync(x => x.Key, x => x.n);
        return Ok(cols.Select(c => new { c.Id, c.Slug, c.Title, c.TitleTe, c.BannerUrl, c.SortOrder, c.IsActive, productCount = counts.GetValueOrDefault(c.Id) }));
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id)
    {
        var c = await db.Collections.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id);
        if (c is null) return NotFound();
        var productIds = await db.CollectionProducts.Where(x => x.CollectionId == id).OrderBy(x => x.SortOrder).Select(x => x.ProductId).ToListAsync();
        return Ok(new { c.Id, c.Slug, c.Title, c.TitleTe, c.Description, c.BannerUrl, c.SortOrder, c.IsActive, productIds });
    }

    [HttpPost]
    public async Task<IActionResult> Create(CollectionUpsert req)
    {
        if (string.IsNullOrWhiteSpace(req.Title)) return BadRequest(new { error = "Title is required" });
        var c = new Collection { Slug = await UniqueSlugAsync(req.Title) };
        db.Collections.Add(c);
        await ApplyAsync(c, req);
        await db.SaveChangesAsync();
        return Ok(new { c.Id, c.Slug });
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, CollectionUpsert req)
    {
        if (string.IsNullOrWhiteSpace(req.Title)) return BadRequest(new { error = "Title is required" });
        var c = await db.Collections.FirstOrDefaultAsync(x => x.Id == id);
        if (c is null) return NotFound();
        db.CollectionProducts.RemoveRange(await db.CollectionProducts.Where(x => x.CollectionId == id).ToListAsync());
        await ApplyAsync(c, req);
        await db.SaveChangesAsync();
        return Ok(new { c.Id, c.Slug });
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var c = await db.Collections.FirstOrDefaultAsync(x => x.Id == id);
        if (c is null) return NotFound();
        db.CollectionProducts.RemoveRange(await db.CollectionProducts.Where(x => x.CollectionId == id).ToListAsync());
        db.Collections.Remove(c);
        await db.SaveChangesAsync();
        return NoContent();
    }

    /// <summary>ProductIds order becomes the collection's "Featured" order. Ids of other stores' products are dropped by the tenant filter.</summary>
    private async Task ApplyAsync(Collection c, CollectionUpsert r)
    {
        c.Title = r.Title.Trim(); c.TitleTe = string.IsNullOrWhiteSpace(r.TitleTe) ? null : r.TitleTe.Trim();
        c.Description = r.Description; c.BannerUrl = string.IsNullOrWhiteSpace(r.BannerUrl) ? null : r.BannerUrl; c.SortOrder = r.SortOrder; c.IsActive = r.IsActive;
        var wanted = r.ProductIds.Distinct().ToList();
        var valid = (await db.Products.Where(p => wanted.Contains(p.Id)).Select(p => p.Id).ToListAsync()).ToHashSet();
        db.CollectionProducts.AddRange(wanted.Where(valid.Contains).Select((pid, i) => new CollectionProduct { CollectionId = c.Id, ProductId = pid, SortOrder = i }));
    }

    private async Task<string> UniqueSlugAsync(string title)
    {
        var basis = ProductsController.SlugBasis(title, "collection");
        if (basis == "all") basis = "all-collection";   // "all" is the storefront's every-product page
        var slug = basis; var i = 2;
        while (await db.Collections.AnyAsync(c => c.Slug == slug)) slug = $"{basis}-{i++}";
        return slug;
    }
}
