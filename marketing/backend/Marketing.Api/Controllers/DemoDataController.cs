using Marketing.Api.Data;
using Marketing.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Marketing.Api.Controllers;

/// <summary>One-click sample data so the tool can be explored before real executives start. Admin only.</summary>
[ApiController]
[Route("api/demo")]
[Authorize(Roles = "Admin")]
public class DemoDataController : ControllerBase
{
    public const string DemoPassword = "demo123";
    private readonly AppDbContext _db;
    private readonly IPasswordHasher<User> _hasher;

    public DemoDataController(AppDbContext db, IPasswordHasher<User> hasher)
    {
        _db = db;
        _hasher = hasher;
    }

    [HttpGet]
    public async Task<ActionResult> Status() => Ok(new
    {
        loaded = await _db.Leads.AnyAsync(l => l.IsDemo),
        leads = await _db.Leads.CountAsync(l => l.IsDemo),
        users = await _db.Users.Where(u => u.IsDemo).Select(u => u.Username).ToListAsync(),
        password = DemoPassword,
    });

    [HttpPost("seed")]
    public async Task<ActionResult> Seed()
    {
        if (await _db.Leads.AnyAsync(l => l.IsDemo)) return BadRequest(new { message = "Sample data is already loaded. Remove it first." });
        var adminId = Services.CurrentUser.Id(User);
        var rng = new Random(42);

        var projects = new[]
        {
            new Project { Name = "Solar Water Heater", Description = "Rooftop solar heaters for homes and hotels", Color = "#f97316", TargetLeads = 120, IsDemo = true },
            new Project { Name = "Herbal Tea Range", Description = "Retail placement of the new tea range", Color = "#16a34a", TargetLeads = 200, IsDemo = true },
            new Project { Name = "POS Billing App", Description = "Subscription billing software for shops", Color = "#4f46e5", TargetLeads = 80, IsDemo = true },
        };
        _db.Projects.AddRange(projects);

        var execs = new[]
        {
            new User { Username = "ravi.demo", DisplayName = "Ravi Kumar", Mobile = "9876543210", IsDemo = true },
            new User { Username = "priya.demo", DisplayName = "Priya Sharma", Mobile = "9876501234", IsDemo = true },
            new User { Username = "arjun.demo", DisplayName = "Arjun Reddy", Mobile = "9988776655", IsDemo = true },
        };
        foreach (var u in execs) u.PasswordHash = _hasher.HashPassword(u, DemoPassword);
        _db.Users.AddRange(execs);
        await _db.SaveChangesAsync();

        _db.UserProjects.AddRange(
            new UserProject { UserId = execs[0].Id, ProjectId = projects[0].Id },
            new UserProject { UserId = execs[0].Id, ProjectId = projects[1].Id },
            new UserProject { UserId = execs[1].Id, ProjectId = projects[1].Id },
            new UserProject { UserId = execs[1].Id, ProjectId = projects[2].Id },
            new UserProject { UserId = execs[2].Id, ProjectId = projects[0].Id },
            new UserProject { UserId = execs[2].Id, ProjectId = projects[2].Id });

        var shops = new (string shop, string contact, string type, string area, string city, double lat, double lng)[]
        {
            ("Sri Lakshmi General Stores", "Venkatesh", "Retail shop", "Ameerpet", "Hyderabad", 17.4375, 78.4483),
            ("Balaji Super Market", "Suresh Babu", "Supermarket", "Kukatpally", "Hyderabad", 17.4849, 78.4138),
            ("Om Sai Hardware", "Mahesh", "Hardware", "Dilsukhnagar", "Hyderabad", 17.3688, 78.5247),
            ("Green Leaf Organics", "Anitha", "Retail shop", "Banjara Hills", "Hyderabad", 17.4156, 78.4347),
            ("Hotel Sitara Grand", "Rajesh Goud", "Restaurant / Hotel", "Gachibowli", "Hyderabad", 17.4401, 78.3489),
            ("Medplus Pharmacy", "Dr. Kavitha", "Pharmacy", "Madhapur", "Hyderabad", 17.4483, 78.3915),
            ("City Electronics", "Imran", "Electronics", "Secunderabad", "Hyderabad", 17.4399, 78.4983),
            ("Annapurna Wholesale", "Ramesh", "Wholesale", "Begum Bazar", "Hyderabad", 17.3776, 78.4700),
            ("Sunrise Distributors", "Naveen", "Distributor", "LB Nagar", "Hyderabad", 17.3457, 78.5522),
            ("Vijaya Traders", "Lakshmi", "Retail shop", "Miyapur", "Hyderabad", 17.4969, 78.3715),
            ("Royal Bakery", "Farhan", "Restaurant / Hotel", "Tolichowki", "Hyderabad", 17.4009, 78.4093),
            ("Srinivasa Kirana", "Srinivas", "Retail shop", "Uppal", "Hyderabad", 17.4056, 78.5591),
            ("Nandini Dairy Parlour", "Manjula", "Retail shop", "Jubilee Hills", "Hyderabad", 17.4325, 78.4073),
            ("Star Mobile World", "Kiran", "Electronics", "Kothapet", "Hyderabad", 17.3671, 78.5385),
            ("Sai Ram Hotel", "Prasad", "Restaurant / Hotel", "Warangal", "Warangal", 17.9689, 79.5941),
            ("Kakatiya Stores", "Sudhakar", "Retail shop", "Hanamkonda", "Warangal", 18.0063, 79.5580),
            ("Sri Sai Medicals", "Bhavani", "Pharmacy", "Karimnagar", "Karimnagar", 18.4386, 79.1288),
            ("Sangam Sweets", "Gopal", "Restaurant / Hotel", "Nizamabad", "Nizamabad", 18.6725, 78.0941),
            ("Metro Super Bazar", "Sunil", "Supermarket", "Vijayawada", "Vijayawada", 16.5062, 80.6480),
            ("Ganesh Agencies", "Ganesh", "Distributor", "Guntur", "Guntur", 16.3067, 80.4365),
            ("Bright Future School", "Principal Rao", "School / Institute", "Kompally", "Hyderabad", 17.5384, 78.4869),
            ("Techno Solutions", "Deepak", "Office", "HITEC City", "Hyderabad", 17.4435, 78.3772),
            ("Padma Fancy Stores", "Padma", "Retail shop", "Chandanagar", "Hyderabad", 17.4926, 78.3313),
            ("New Krishna Hardware", "Krishna", "Hardware", "Malkajgiri", "Hyderabad", 17.4478, 78.5308),
            ("Lucky Provision Store", "Abdul", "Retail shop", "Mehdipatnam", "Hyderabad", 17.3951, 78.4373),
            ("Apollo Clinic", "Dr. Reddy", "Clinic", "Nallagandla", "Hyderabad", 17.4700, 78.3100),
            ("Sapthagiri Wholesale", "Murali", "Wholesale", "Kurnool", "Kurnool", 15.8281, 78.0373),
            ("Modern Electricals", "Vinod", "Electronics", "Tirupati", "Tirupati", 13.6288, 79.4192),
            ("Sri Venkateswara Kirana", "Chandra", "Retail shop", "Nellore", "Nellore", 14.4426, 79.9865),
            ("Coastal Traders", "Satish", "Distributor", "Visakhapatnam", "Visakhapatnam", 17.6868, 83.2185),
        };
        var statuses = new[] { LeadStatus.New, LeadStatus.New, LeadStatus.FollowUp, LeadStatus.FollowUp, LeadStatus.FollowUp, LeadStatus.Negotiation, LeadStatus.Converted, LeadStatus.Converted, LeadStatus.Lost };
        var now = DateTime.UtcNow;
        var today = DateOnly.FromDateTime(now);
        var n = 0;
        foreach (var (shop, contact, type, area, city, lat, lng) in shops)
        {
            var assignments = new[] { (execs[0], projects[0]), (execs[0], projects[1]), (execs[1], projects[1]), (execs[1], projects[2]), (execs[2], projects[0]), (execs[2], projects[2]) };
            var (exec, project) = assignments[n % assignments.Length];
            var status = statuses[rng.Next(statuses.Length)];
            var interest = status switch
            {
                LeadStatus.Converted => 5,
                LeadStatus.Negotiation => rng.Next(4, 6),
                LeadStatus.Lost => rng.Next(1, 3),
                _ => rng.Next(2, 6),
            };
            var createdDaysAgo = rng.Next(0, 40);
            var created = now.AddDays(-createdDaysAgo).AddHours(-rng.Next(0, 9));
            var open = status != LeadStatus.Converted && status != LeadStatus.Lost;
            DateOnly? follow = open ? today.AddDays(rng.Next(-4, 8)) : null;
            var lead = new Lead
            {
                ProjectId = project.Id, CreatedByUserId = exec.Id, AssignedToUserId = exec.Id,
                ShopName = shop, ContactName = contact, Mobile = $"9{rng.Next(100000000, 999999999)}",
                ShopType = type, Area = area, City = city, Address = $"{rng.Next(1, 99)}-{rng.Next(1, 999)}, {area} main road",
                Pincode = $"5{rng.Next(10000, 99999)}", Latitude = lat + (rng.NextDouble() - 0.5) * 0.01, Longitude = lng + (rng.NextDouble() - 0.5) * 0.01,
                Interest = interest, Status = status, ExpectedValue = rng.Next(5, 80) * 1000,
                Notes = interest >= 4 ? "Owner keen; asked for price list and a demo." : interest == 1 ? "Not the right fit for this shop." : "Spoke to the owner, will revisit with samples.",
                NextFollowUpAt = follow, IsDemo = true,
                CreatedAt = created, UpdatedAt = created, LastActivityAt = created,
                ConvertedAt = status == LeadStatus.Converted ? created.AddDays(rng.Next(1, 5)) : null,
                LostReason = status == LeadStatus.Lost ? "Already using a competitor" : null,
            };
            lead.Activities.Add(new Activity { UserId = exec.Id, Type = ActivityType.Visit, Note = "First visit – lead captured", Interest = Math.Max(2, interest - 1), ToStatus = LeadStatus.New, Latitude = lead.Latitude, Longitude = lead.Longitude, CreatedAt = created });
            if (status != LeadStatus.New)
            {
                var second = created.AddDays(Math.Min(createdDaysAgo, rng.Next(1, 4)));
                lead.Activities.Add(new Activity { UserId = exec.Id, Type = rng.Next(2) == 0 ? ActivityType.Call : ActivityType.Visit, Note = "Follow-up: discussed pricing and delivery", Interest = interest, CreatedAt = second });
                lead.Activities.Add(new Activity { UserId = exec.Id, Type = ActivityType.StatusChange, FromStatus = LeadStatus.New, ToStatus = status, CreatedAt = second.AddMinutes(1), Note = status == LeadStatus.Lost ? lead.LostReason : null });
                lead.LastActivityAt = second.AddMinutes(1);
            }
            _db.Leads.Add(lead);
            n++;
        }
        await _db.SaveChangesAsync();
        return Ok(new { message = $"Loaded {n} sample leads, 3 projects and 3 executives (password '{DemoPassword}').", executives = execs.Select(e => e.Username) });
    }

    [HttpDelete]
    public async Task<ActionResult> Remove()
    {
        var leads = await _db.Leads.Where(l => l.IsDemo).ToListAsync();
        _db.Leads.RemoveRange(leads);
        await _db.SaveChangesAsync();
        var users = await _db.Users.Where(u => u.IsDemo).ToListAsync();
        var userIds = users.Select(u => u.Id).ToList();
        var busy = await _db.Leads.AnyAsync(l => userIds.Contains(l.AssignedToUserId) || userIds.Contains(l.CreatedByUserId));
        if (!busy) _db.Users.RemoveRange(users);
        var projects = await _db.Projects.Where(p => p.IsDemo && !p.Leads.Any()).ToListAsync();
        _db.Projects.RemoveRange(projects);
        await _db.SaveChangesAsync();
        return Ok(new { message = $"Removed {leads.Count} sample leads." + (busy ? " Demo users kept because real leads reference them." : "") });
    }
}
