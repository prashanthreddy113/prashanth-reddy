using Microsoft.AspNetCore.Identity;
using WaterTanker.Api.Models;
using WaterTanker.Api.Services;

namespace WaterTanker.Api.Data;

/// <summary>
/// Realistic pilot data for Manikonda, Hyderabad: one operator with three tankers (two fitted with devices),
/// three gated communities, an RWA login, bookings, two weeks of metered deliveries and one issued invoice.
/// </summary>
public static class DemoSeeder
{
    public const string DemoDeviceKey1 = "demo-device-key-0001";
    public const string DemoDeviceKey2 = "demo-device-key-0002";

    public static async Task SeedAsync(AppDbContext db, IPasswordHasher<User> hasher, QualityService quality)
    {
        var op = new Operator { Name = "Sri Balaji Water Suppliers", Phone = "9876500001", Gstin = "36ABCDE1234F1Z5", Address = "Puppalaguda Road, Manikonda", RatePerKl = 550 };
        db.Operators.Add(op);

        var tankers = new[]
        {
            new Tanker { Operator = op, RegistrationNumber = "TS09UB4521", CapacityLitres = 10000, DriverName = "Ramesh", DriverPhone = "9000000011" },
            new Tanker { Operator = op, RegistrationNumber = "TS09UC7788", CapacityLitres = 12000, DriverName = "Srinu", DriverPhone = "9000000012" },
            new Tanker { Operator = op, RegistrationNumber = "TS07EX3310", CapacityLitres = 6000, DriverName = "Anil", DriverPhone = "9000000013" },
        };
        db.Tankers.AddRange(tankers);

        var devices = new[]
        {
            new Device { DeviceCode = "AQ-DEMO-0001", ApiKeyHash = DeviceAuthService.Hash(DemoDeviceKey1), Operator = op, Tanker = tankers[0], PulsesPerLitre = 4.8, FirmwareVersion = "0.1.0", Status = DeviceStatus.Online, InstalledAt = DateTime.UtcNow.AddDays(-20), LastSeenAt = DateTime.UtcNow.AddMinutes(-12), LastLatitude = 17.4010, LastLongitude = 78.3790, LastBatteryVolts = 4.05, LastSignalCsq = 19 },
            new Device { DeviceCode = "AQ-DEMO-0002", ApiKeyHash = DeviceAuthService.Hash(DemoDeviceKey2), Operator = op, Tanker = tankers[1], PulsesPerLitre = 4.8, FirmwareVersion = "0.1.0", Status = DeviceStatus.Offline, InstalledAt = DateTime.UtcNow.AddDays(-18), LastSeenAt = DateTime.UtcNow.AddHours(-9), LastLatitude = 17.4062, LastLongitude = 78.3835, LastBatteryVolts = 3.92, LastSignalCsq = 14 },
        };
        db.Devices.AddRange(devices);

        var communities = new[]
        {
            new Community { Name = "Lanco Hills Residents Welfare", Area = "Manikonda", Address = "Lanco Hills, Manikonda", ContactName = "Mr. Rao", ContactPhone = "9000000021", Flats = 1800, Latitude = 17.4088, Longitude = 78.3775, GeofenceRadiusM = 250, RatePerKl = 520, PreferredOperator = op, SubscriptionPerMonth = 2000 },
            new Community { Name = "Aparna Cyberzon RWA", Area = "Manikonda", Address = "Puppalaguda, Manikonda", ContactName = "Ms. Lakshmi", ContactPhone = "9000000022", Flats = 540, Latitude = 17.3982, Longitude = 78.3812, GeofenceRadiusM = 180, RatePerKl = 550, PreferredOperator = op, SubscriptionPerMonth = 1500 },
            new Community { Name = "Rajapushpa Atria Owners Assn.", Area = "Gachibowli", Address = "Kokapet Road, Gachibowli", ContactName = "Mr. Iqbal", ContactPhone = "9000000023", Flats = 620, Latitude = 17.4139, Longitude = 78.3505, GeofenceRadiusM = 200, RatePerKl = null, PreferredOperator = op, SubscriptionPerMonth = 1500 },
        };
        db.Communities.AddRange(communities);

        var opUser = new User { Email = "operator@demo.local", DisplayName = "Balaji Ops Desk", Phone = "9876500001", Role = UserRole.Operator, Operator = op };
        opUser.PasswordHash = hasher.HashPassword(opUser, "demo123");
        var rwaUser = new User { Email = "rwa@demo.local", DisplayName = "Lanco Hills RWA", Phone = "9000000021", Role = UserRole.Rwa, Community = communities[0] };
        rwaUser.PasswordHash = hasher.HashPassword(rwaUser, "demo123");
        var rwaUser2 = new User { Email = "rwa2@demo.local", DisplayName = "Aparna Cyberzon RWA", Phone = "9000000022", Role = UserRole.Rwa, Community = communities[1] };
        rwaUser2.PasswordHash = hasher.HashPassword(rwaUser2, "demo123");
        db.Users.AddRange(opUser, rwaUser, rwaUser2);

        await db.SaveChangesAsync();

        // Two weeks of deliveries. Deterministic pseudo-random so the demo looks the same everywhere.
        var rng = new Random(20260907);
        var now = DateTime.UtcNow;
        var deliveries = new List<Delivery>();
        double counter1 = 184_320, counter2 = 96_400;

        for (var day = 14; day >= 0; day--)
        {
            var date = now.Date.AddDays(-day);
            var loads = day == 0 ? 2 : 3 + rng.Next(0, 3);
            for (var i = 0; i < loads; i++)
            {
                var useFirst = rng.NextDouble() < 0.6;
                var device = useFirst ? devices[0] : devices[1];
                var tanker = useFirst ? tankers[0] : tankers[1];
                var community = communities[rng.Next(0, 3)];
                var start = date.AddHours(6 + i * 3 + rng.NextDouble() * 1.5); // 06:00 - 18:00 IST-ish spread
                if (start > now.AddMinutes(-20)) continue;

                // Honest loads deliver 92-100% of capacity; a few short loads show the product's point.
                var shortLoad = rng.NextDouble() < 0.15;
                var fraction = shortLoad ? 0.62 + rng.NextDouble() * 0.15 : 0.92 + rng.NextDouble() * 0.08;
                var litres = Math.Round(tanker.CapacityLitres * fraction, 1);
                var minutes = 18 + rng.Next(0, 12);
                var tds = community.Area == "Gachibowli" ? 380 + rng.Next(0, 160) : 620 + rng.Next(0, 520);
                if (rng.NextDouble() < 0.08) tds = 1900 + rng.Next(0, 700); // occasional bad borewell load
                var ntu = Math.Round(0.4 + rng.NextDouble() * 1.4 + (tds > 1800 ? 3.5 : 0), 2);
                var startCounter = useFirst ? counter1 : counter2;
                if (useFirst) counter1 += litres; else counter2 += litres;

                var jitterLat = (rng.NextDouble() - 0.5) * 0.0012;
                var jitterLng = (rng.NextDouble() - 0.5) * 0.0012;
                var dist = GeoService.DistanceM(community.Latitude + jitterLat, community.Longitude + jitterLng, community.Latitude, community.Longitude);
                var rate = community.RatePerKl ?? op.RatePerKl;
                var grade = quality.Grade(tds, ntu);
                var verified = day >= 2 && rng.NextDouble() < 0.7;

                var d = new Delivery
                {
                    Device = device, Operator = op, Tanker = tanker, Community = community,
                    SessionKey = $"{device.DeviceCode}-{start:yyyyMMddHHmm}",
                    StartedAt = start, EndedAt = start.AddMinutes(minutes), LastReadingAt = start.AddMinutes(minutes),
                    StartCumulativeLitres = startCounter,
                    Status = verified ? DeliveryStatus.Verified : DeliveryStatus.Completed,
                    LitresDelivered = (decimal)litres,
                    AvgTdsPpm = tds, MaxTdsPpm = tds + rng.Next(5, 40),
                    AvgTurbidityNtu = ntu, MaxTurbidityNtu = Math.Round(ntu + rng.NextDouble() * 0.6, 2),
                    PeakFlowLpm = Math.Round(litres / minutes * 1.35, 1),
                    QualityGrade = grade,
                    Latitude = community.Latitude + jitterLat, Longitude = community.Longitude + jitterLng,
                    GeofenceMatched = true, DistanceToCommunityM = Math.Round(dist, 0),
                    ReadingCount = minutes * 6,
                    RatePerKl = rate, Amount = Math.Round((decimal)litres / 1000m * rate, 2),
                    VerifiedAt = verified ? start.AddHours(2 + rng.Next(0, 20)) : null,
                    VerifiedByUserId = verified ? (community == communities[0] ? rwaUser.Id : community == communities[1] ? rwaUser2.Id : null) : null,
                };
                deliveries.Add(d);

                // A handful of sample readings so the detail chart has a curve to draw.
                var steps = 12;
                for (var s = 0; s <= steps; s++)
                {
                    var frac = (double)s / steps;
                    var flow = s == 0 || s == steps ? 0 : d.PeakFlowLpm!.Value * (0.75 + 0.25 * Math.Sin(frac * Math.PI));
                    d.Readings.Add(new TelemetryReading
                    {
                        RecordedAt = start.AddMinutes(minutes * frac),
                        FlowLpm = Math.Round(flow, 1),
                        CumulativeLitres = Math.Round(startCounter + litres * frac, 1),
                        TdsPpm = tds + rng.Next(-15, 15), TurbidityNtu = Math.Round(ntu + (rng.NextDouble() - 0.5) * 0.2, 2),
                        WaterTempC = 27 + rng.NextDouble() * 3,
                        Latitude = d.Latitude, Longitude = d.Longitude, BatteryVolts = 4.0, SignalCsq = 15 + rng.Next(0, 8),
                    });
                }
            }
        }
        db.Deliveries.AddRange(deliveries);
        await db.SaveChangesAsync();
        foreach (var d in deliveries) foreach (var r in d.Readings) r.DeviceId = d.DeviceId;
        await db.SaveChangesAsync();

        // A dispute on one short load, an in-flight booking, and last month's invoice for Lanco Hills.
        var shortOne = deliveries.Where(d => d.Community == communities[0] && d.Status == DeliveryStatus.Completed && d.LitresDelivered < 8000).OrderByDescending(d => d.StartedAt).FirstOrDefault();
        if (shortOne is not null)
        {
            shortOne.Status = DeliveryStatus.Disputed;
            db.Disputes.Add(new Dispute { Delivery = shortOne, RaisedByUserId = rwaUser.Id, Reason = "Driver claimed a full 10,000 L load; the meter shows less. Please adjust the bill.", CreatedAt = shortOne.StartedAt.AddHours(3) });
        }

        db.Bookings.AddRange(
            new Booking { Community = communities[0], Operator = op, RequestedLitres = 10000, Loads = 2, ScheduledFor = now.Date.AddDays(1).AddHours(2), Status = BookingStatus.Accepted, RatePerKl = 520, Tanker = tankers[0], Notes = "Morning slot please, before 9 AM." },
            new Booking { Community = communities[1], Operator = op, RequestedLitres = 12000, Loads = 1, ScheduledFor = now.Date.AddDays(1).AddHours(5), Status = BookingStatus.Requested, RatePerKl = 550 },
            new Booking { Community = communities[2], Operator = op, RequestedLitres = 6000, Loads = 1, ScheduledFor = now.Date.AddDays(-1).AddHours(4), Status = BookingStatus.Delivered, RatePerKl = 550, Tanker = tankers[2] });

        var lastMonth = new DateOnly(now.Year, now.Month, 1).AddMonths(-1);
        var lm = deliveries.Where(d => d.Community == communities[0] && DateOnly.FromDateTime(d.StartedAt) >= lastMonth && DateOnly.FromDateTime(d.StartedAt) < lastMonth.AddMonths(1)).ToList();
        if (lm.Count > 0)
        {
            var inv = new Invoice
            {
                Number = $"AQ-{lastMonth:yyyyMM}-001-1", Community = communities[0], Operator = op,
                PeriodStart = lastMonth, PeriodEnd = lastMonth.AddMonths(1).AddDays(-1),
                DeliveryCount = lm.Count, TotalLitres = lm.Sum(d => d.LitresDelivered), Amount = lm.Sum(d => d.Amount),
                Status = InvoiceStatus.Issued, IssuedAt = lastMonth.AddMonths(1).ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc),
            };
            foreach (var d in lm) d.Invoice = inv;
            db.Invoices.Add(inv);
        }

        await db.SaveChangesAsync();
    }
}
