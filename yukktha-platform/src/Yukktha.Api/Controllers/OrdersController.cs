using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Yukktha.Api.Auth;
using Yukktha.Api.Data;
using Yukktha.Api.Data.Entities;
using Yukktha.Api.Dtos;
using Yukktha.Api.Services;
using Yukktha.Api.Tenancy;

namespace Yukktha.Api.Controllers;

[Route("api/admin/orders")]
public class OrdersController(AppDbContext db, TenantContext tenant, IWhatsAppService wa) : TenantControllerBase(tenant)
{
    [HttpGet]
    public async Task<IActionResult> List([FromQuery] OrderStatus? status, [FromQuery] int page = 1, [FromQuery] int pageSize = 50)
    {
        var q = db.Orders.Include(o => o.Customer).Include(o => o.Items).AsNoTracking();
        if (status is not null) q = q.Where(o => o.Status == status);
        var total = await q.CountAsync();
        var items = await q.OrderByDescending(o => o.CreatedAt).Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();
        return Ok(new { total, items = items.Select(ToDto) });
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id)
    {
        var o = await db.Orders.Include(x => x.Customer).Include(x => x.Items).FirstOrDefaultAsync(x => x.Id == id);
        return o is null ? NotFound() : Ok(ToDto(o));
    }

    /// <summary>OR-3/WA-4: status change; sends the customer a WhatsApp update.</summary>
    [HttpPatch("{id:guid}/status")]
    public async Task<IActionResult> UpdateStatus(Guid id, OrderStatusUpdate req)
    {
        var o = await db.Orders.Include(x => x.Customer).Include(x => x.Items).FirstOrDefaultAsync(x => x.Id == id);
        if (o is null) return NotFound();
        o.Status = req.Status;
        if (req.TrackingNumber is not null) o.TrackingNumber = req.TrackingNumber;
        if (req.TrackingUrl is not null) o.TrackingUrl = req.TrackingUrl;
        if (req.Status == OrderStatus.Delivered && o.PaymentMethod == PaymentMethod.Cod) o.PaymentStatus = PaymentStatus.Paid;
        if (req.Status == OrderStatus.Cancelled) await OrderBuilder.RestockAsync(db, o);
        await db.SaveChangesAsync();
        var store = await db.Stores.FindAsync(StoreId);
        await wa.SendCustomerStatusAsync(store!, o);
        return Ok(ToDto(o));
    }

    /// <summary>WA-5: an order taken on WhatsApp/in person, entered by the owner so it is still tracked.</summary>
    [HttpPost("manual")]
    public async Task<IActionResult> Manual(ManualOrderRequest req)
    {
        var store = await db.Stores.FindAsync(StoreId);
        var result = await OrderBuilder.CreateAsync(db, store!, new CheckoutRequest(req.Name, req.Phone, req.Address, req.DeliveryMode,
            req.PaymentMethod, req.Items, req.Notes, false), source: "manual");
        if (result.Error is not null) return BadRequest(new { error = result.Error });
        return Ok(ToDto(result.Order!));
    }

    [HttpGet("/api/admin/customers")]
    public async Task<IActionResult> Customers([FromQuery] string? q)
    {
        var query = db.Customers.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(q)) query = query.Where(c => c.Name.Contains(q) || c.Phone.Contains(q));
        return Ok(await query.OrderByDescending(c => c.LastOrderAt).Take(500).ToListAsync());
    }

    /// <summary>MK-6 / OR-7: numbers for the weekly card and evening summary.</summary>
    [HttpGet("/api/admin/summary")]
    public async Task<IActionResult> Summary([FromQuery] int days = 7)
    {
        var since = DateTime.UtcNow.Date.AddDays(-days);
        var orders = await db.Orders.Where(o => o.CreatedAt >= since && o.Status != OrderStatus.Cancelled).ToListAsync();
        var top = await db.OrderItems.Where(i => db.Orders.Any(o => o.Id == i.OrderId && o.CreatedAt >= since))
            .GroupBy(i => i.ProductName).Select(g => new { name = g.Key, qty = g.Sum(x => x.Quantity) })
            .OrderByDescending(x => x.qty).Take(5).ToListAsync();
        return Ok(new
        {
            days, orders = orders.Count, revenue = orders.Sum(o => o.Total),
            pending = orders.Count(o => o.Status is OrderStatus.New or OrderStatus.Confirmed),
            newCustomers = await db.Customers.CountAsync(c => c.CreatedAt >= since),
            topProducts = top
        });
    }

    public static object ToDto(Order o) => new
    {
        o.Id, o.Number, o.Status, o.PaymentMethod, o.PaymentStatus, o.DeliveryMode, o.DeliveryAddress,
        o.Subtotal, o.DeliveryCharge, o.Discount, o.Total, o.TrackingNumber, o.TrackingUrl, o.Notes, o.Source, o.CreatedAt,
        customer = new { o.Customer.Id, o.Customer.Name, o.Customer.Phone },
        items = o.Items.Select(i => new { i.ProductId, i.VariantId, i.ProductName, i.VariantLabel, i.UnitPrice, i.Quantity })
    };
}

/// <summary>Shared by storefront checkout and manual orders: validates stock, snapshots prices, updates customer stats.</summary>
public static class OrderBuilder
{
    public record Result(Order? Order, string? Error);

    public static async Task<Result> CreateAsync(AppDbContext db, Store store, CheckoutRequest req, string source)
    {
        if (req.Items.Count == 0) return new(null, "Cart is empty");
        var phone = PhoneUtil.Normalize(req.Phone);
        var variantIds = req.Items.Select(i => i.VariantId).ToList();
        var variants = await db.ProductVariants.Where(v => variantIds.Contains(v.Id)).ToListAsync();
        var productIds = variants.Select(v => v.ProductId).Distinct().ToList();
        var products = await db.Products.Where(p => productIds.Contains(p.Id) && p.IsActive).ToDictionaryAsync(p => p.Id);

        var order = new Order { StoreId = store.Id, Source = source, DeliveryMode = req.DeliveryMode, PaymentMethod = req.PaymentMethod, DeliveryAddress = req.Address, Notes = req.Notes };
        foreach (var line in req.Items)
        {
            var v = variants.FirstOrDefault(x => x.Id == line.VariantId);
            if (v is null || !products.TryGetValue(v.ProductId, out var p)) return new(null, "A product in the cart is no longer available");
            if (v.Stock < line.Quantity) return new(null, $"{p.Name} has only {v.Stock} left");
            v.Stock -= line.Quantity;
            var label = string.Join(" / ", new[] { v.Color, v.Size }.Where(x => !string.IsNullOrEmpty(x)));
            order.Items.Add(new OrderItem { StoreId = store.Id, ProductId = p.Id, VariantId = v.Id, ProductName = p.Name, VariantLabel = label == "" ? null : label, UnitPrice = v.PriceOverride ?? p.Price, Quantity = line.Quantity });
        }
        order.Subtotal = order.Items.Sum(i => i.UnitPrice * i.Quantity);
        order.DeliveryCharge = req.DeliveryMode switch
        {
            DeliveryMode.LocalDelivery when store.LocalDeliveryEnabled => store.LocalDeliveryCharge,
            DeliveryMode.Courier when store.CourierEnabled => store.CourierCharge,
            DeliveryMode.Pickup => 0,
            _ => 0
        };
        order.Total = order.Subtotal + order.DeliveryCharge - order.Discount;
        order.PaymentStatus = req.PaymentMethod == PaymentMethod.Online ? PaymentStatus.Pending : PaymentStatus.Pending;

        var customer = await db.Customers.FirstOrDefaultAsync(c => c.Phone == phone)
            ?? new Customer { StoreId = store.Id, Phone = phone, Name = req.Name };
        if (customer.Id == Guid.Empty || db.Entry(customer).State == Microsoft.EntityFrameworkCore.EntityState.Detached) db.Customers.Add(customer);
        customer.Name = string.IsNullOrWhiteSpace(req.Name) ? customer.Name : req.Name;
        if (req.Address is not null) customer.Address = req.Address;
        if (req.MarketingOptIn) customer.MarketingOptIn = true;
        customer.OrderCount++; customer.TotalSpend += order.Total; customer.LastOrderAt = DateTime.UtcNow;
        order.Customer = customer;

        // Per-store order number: safe enough at this scale; move to a sequence table if two checkouts collide.
        order.Number = (await db.Orders.MaxAsync(o => (int?)o.Number) ?? 1000) + 1;
        db.Orders.Add(order);
        await db.SaveChangesAsync();
        return new(order, null);
    }

    public static async Task RestockAsync(AppDbContext db, Order o)
    {
        var ids = o.Items.Select(i => i.VariantId).ToList();
        var variants = await db.ProductVariants.Where(v => ids.Contains(v.Id)).ToListAsync();
        foreach (var i in o.Items) { var v = variants.FirstOrDefault(x => x.Id == i.VariantId); if (v is not null) v.Stock += i.Quantity; }
    }
}
