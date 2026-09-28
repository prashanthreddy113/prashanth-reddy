using Yukktha.Api.Data.Entities;

namespace Yukktha.Api.Services;

/// <summary>
/// Collection page filters, facets and sort (the Shopify-style "filter by availability / price / colour / fabric,
/// sort by featured / best selling / price" page). A boutique has hundreds of products, not millions, so the
/// collection is loaded once and filtered in memory; that keeps facet counts exact and the code simple.
/// </summary>
public static class CatalogQuery
{
    public const int DefaultPageSize = 24, MaxPageSize = 48;
    public static readonly string[] Sorts = ["featured", "best-selling", "title-asc", "title-desc", "price-asc", "price-desc", "created-desc", "created-asc"];

    public record Filter(bool? InStock, decimal? MinPrice, decimal? MaxPrice, HashSet<string> Colors, HashSet<string> Fabrics, HashSet<string> Occasions, string? Search)
    {
        public static Filter Parse(bool? inStock, decimal? minPrice, decimal? maxPrice, string? color, string? fabric, string? occasion, string? q) =>
            new(inStock, minPrice, maxPrice, Set(color), Set(fabric), Set(occasion), string.IsNullOrWhiteSpace(q) ? null : q.Trim());

        private static HashSet<string> Set(string? csv) =>
            (csv ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).Select(Key).ToHashSet();
    }

    public record FacetValue(string Value, string Label, int Count);
    public record Facets(List<FacetValue> Colors, List<FacetValue> Fabrics, List<FacetValue> Occasions, int InStock, int OutOfStock, decimal PriceMin, decimal PriceMax);

    /// <summary>Filter values are compared case- and space-insensitively ("Red", " red " and "RED" are one colour).</summary>
    public static string Key(string s) => string.Join(' ', s.Trim().ToLowerInvariant().Split(' ', StringSplitOptions.RemoveEmptyEntries));

    public static bool InStock(Product p) => p.Variants.Any(v => v.Stock > 0);

    public static IEnumerable<string> ColorsOf(Product p) =>
        p.Variants.Select(v => v.Color).Append(p.Color).Where(c => !string.IsNullOrWhiteSpace(c)).Select(c => c!.Trim());

    private enum Group { Availability, Price, Color, Fabric, Occasion }

    private static bool Matches(Product p, Filter f, Group? skip)
    {
        if (skip != Group.Availability && f.InStock is { } s && InStock(p) != s) return false;
        if (skip != Group.Price && f.MinPrice is { } min && p.Price < min) return false;
        if (skip != Group.Price && f.MaxPrice is { } max && p.Price > max) return false;
        if (skip != Group.Color && f.Colors.Count > 0 && !ColorsOf(p).Any(c => f.Colors.Contains(Key(c)))) return false;
        if (skip != Group.Fabric && f.Fabrics.Count > 0 && (p.Fabric is null || !f.Fabrics.Contains(Key(p.Fabric)))) return false;
        if (skip != Group.Occasion && f.Occasions.Count > 0 && (p.Occasion is null || !f.Occasions.Contains(Key(p.Occasion)))) return false;
        if (f.Search is { } q && !(p.Name.Contains(q, StringComparison.OrdinalIgnoreCase) || (p.Description?.Contains(q, StringComparison.OrdinalIgnoreCase) ?? false))) return false;
        return true;
    }

    public static List<Product> Apply(IEnumerable<Product> products, Filter f) => products.Where(p => Matches(p, f, null)).ToList();

    /// <summary>
    /// Each group's counts are computed with every other group's filter applied but not its own, so ticking "Red"
    /// still shows how many "Green" there are (the usual storefront behaviour). The price range is the whole
    /// collection's, so the slider does not shrink as filters are added.
    /// </summary>
    public static Facets BuildFacets(IReadOnlyCollection<Product> products, Filter f)
    {
        List<FacetValue> Count(Group g, Func<Product, IEnumerable<string>> values) => products
            .Where(p => Matches(p, f, g))
            .SelectMany(p => values(p).Select(v => (key: Key(v), label: v)).DistinctBy(x => x.key))
            .GroupBy(x => x.key)
            .Select(g => new FacetValue(g.Key, g.First().label, g.Count()))
            .OrderByDescending(x => x.Count).ThenBy(x => x.Label)
            .ToList();

        var avail = products.Where(p => Matches(p, f, Group.Availability)).ToList();
        return new Facets(
            Count(Group.Color, ColorsOf),
            Count(Group.Fabric, p => p.Fabric is null ? [] : [p.Fabric]),
            Count(Group.Occasion, p => p.Occasion is null ? [] : [p.Occasion]),
            avail.Count(InStock), avail.Count(p => !InStock(p)),
            products.Count == 0 ? 0 : products.Min(p => p.Price), products.Count == 0 ? 0 : products.Max(p => p.Price));
    }

    /// <param name="featuredOrder">The owner's order within the collection; products not in it follow, newest first.</param>
    /// <param name="unitsSold">Units sold per product (cancelled orders excluded), for "best selling".</param>
    public static IEnumerable<Product> Sort(IEnumerable<Product> products, string? sort, IReadOnlyDictionary<Guid, int> featuredOrder, IReadOnlyDictionary<Guid, int> unitsSold) => sort switch
    {
        "best-selling" => products.OrderByDescending(p => unitsSold.GetValueOrDefault(p.Id)).ThenByDescending(p => p.CreatedAt),
        "title-asc" => products.OrderBy(p => p.Name, StringComparer.OrdinalIgnoreCase),
        "title-desc" => products.OrderByDescending(p => p.Name, StringComparer.OrdinalIgnoreCase),
        "price-asc" => products.OrderBy(p => p.Price).ThenByDescending(p => p.CreatedAt),
        "price-desc" => products.OrderByDescending(p => p.Price).ThenByDescending(p => p.CreatedAt),
        "created-asc" => products.OrderBy(p => p.CreatedAt),
        "created-desc" => products.OrderByDescending(p => p.CreatedAt),
        // featured: sold-out items sink to the end so the first screen is always buyable
        _ => products.OrderBy(p => InStock(p) ? 0 : 1).ThenBy(p => featuredOrder.GetValueOrDefault(p.Id, int.MaxValue)).ThenByDescending(p => p.CreatedAt),
    };
}
