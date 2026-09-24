using ManaBandi.Api.Models;

namespace ManaBandi.Api.Data;

/// <summary>Launch configuration (from owner-web/src/mock: towns.js, commission.js, settings.js). No fake rides or captains.</summary>
public static class SeedData
{
    public static Dictionary<string, Fare> DefaultFares() => new()
    {
        ["bike"] = new Fare { Base = 20, PerKm = 8, Min = 20, NightPct = 20 },
        ["auto"] = new Fare { Base = 30, PerKm = 12, Min = 30, NightPct = 20 },
        ["parcel"] = new Fare { Base = 30, PerKm = 8, Min = 30, NightPct = 20 },
    };

    private static Landmark Lm(string town, string id, string kind, string te, string en, double lat, double lng, int order) =>
        new() { Id = id, TownId = town, Kind = kind, NameTe = te, NameEn = en, Lat = lat, Lng = lng, SortOrder = order };

    public static List<Town> Towns(DateTime now) => new()
    {
        new Town
        {
            Id = "nkd", NameEn = "Narayanakhed", NameTe = "నారాయణఖేడ్", District = "Sangareddy", State = "Telangana", Enabled = true,
            CenterLat = 18.033, CenterLng = 77.755, RadiusKm = 12, ExtendedRadiusKm = 25, EnforceRadius = true,
            NightStart = "22:00", NightEnd = "05:00", SupportPhone = "+91 94940 11001", MissedCallNo = "+91 92470 00011",
            LaunchedAt = new DateOnly(2026, 7, 1), Fares = DefaultFares(), CreatedAt = now,
            Landmarks = new()
            {
                Lm("nkd", "nkd_l1", "bus", "బస్టాండ్", "RTC Bus stand", 18.0338, 77.7562, 0),
                Lm("nkd", "nkd_l2", "hospital", "ప్రభుత్వ ఆసుపత్రి", "Government hospital (CHC)", 18.0361, 77.7519, 1),
                Lm("nkd", "nkd_l3", "market", "సంత", "Tuesday santha / market", 18.0312, 77.7588, 2),
                Lm("nkd", "nkd_l4", "office", "మండల ఆఫీస్", "Mandal office (MRO)", 18.0349, 77.7605, 3),
                Lm("nkd", "nkd_l5", "temple", "సాయిబాబా గుడి", "Saibaba temple", 18.0298, 77.7531, 4),
                Lm("nkd", "nkd_l6", "school", "జూనియర్ కాలేజ్", "Govt Junior College", 18.0375, 77.7591, 5),
                Lm("nkd", "nkd_l7", "other", "పాత పోలీస్ స్టేషన్", "Old police station", 18.0322, 77.7549, 6),
            },
        },
        new Town
        {
            Id = "zhb", NameEn = "Zaheerabad", NameTe = "జహీరాబాద్", District = "Sangareddy", State = "Telangana", Enabled = true,
            CenterLat = 17.681, CenterLng = 77.608, RadiusKm = 15, ExtendedRadiusKm = 35, EnforceRadius = true,
            NightStart = "22:00", NightEnd = "05:00", SupportPhone = "+91 94940 11002", MissedCallNo = "+91 92470 00012",
            LaunchedAt = new DateOnly(2026, 8, 15), Fares = DefaultFares(), CreatedAt = now.AddSeconds(1),
            Landmarks = new()
            {
                Lm("zhb", "zhb_l1", "bus", "బస్టాండ్", "RTC Bus stand", 17.6822, 77.6094, 0),
                Lm("zhb", "zhb_l2", "hospital", "ఏరియా ఆసుపత్రి", "Area hospital", 17.6795, 77.6045, 1),
                Lm("zhb", "zhb_l3", "market", "గంజ్ మార్కెట్", "Ganj market", 17.6838, 77.6112, 2),
                Lm("zhb", "zhb_l4", "temple", "హనుమాన్ గుడి", "Hanuman temple", 17.6781, 77.6130, 3),
                Lm("zhb", "zhb_l5", "other", "బీదర్ రోడ్ చౌరస్తా", "Bidar road junction", 17.6860, 77.6001, 4),
                Lm("zhb", "zhb_l6", "school", "డిగ్రీ కాలేజ్", "Govt Degree College", 17.6749, 77.6068, 5),
            },
        },
    };

    public static List<CommissionRule> Commission(DateTime now) => new()
    {
        new CommissionRule { Id = "co_default", Scope = "default", Pct = 10, FreeMonths = 3, FreePct = 0, EffectiveFrom = new DateOnly(2026, 7, 1), Status = "active", CreatedAt = now, UpdatedAt = now, CreatedBy = "seed", SortOrder = 0 },
        new CommissionRule { Id = "co_svc_parcel", Scope = "service", Service = "parcel", Pct = 8, FreeMonths = 0, FreePct = 0, Status = "active", CreatedAt = now, UpdatedAt = now, CreatedBy = "seed", SortOrder = 1 },
        new CommissionRule { Id = "co_1", Scope = "town", TownId = "zhb", Service = "all", Pct = 10, FreeMonths = 3, FreePct = 0, EffectiveFrom = new DateOnly(2026, 8, 15), Status = "active", Note = "Launch offer", CreatedAt = now, UpdatedAt = now, CreatedBy = "seed", SortOrder = 2 },
        new CommissionRule { Id = "co_2", Scope = "town_service", TownId = "nkd", Service = "parcel", Pct = 6, FreeMonths = 0, FreePct = 0, EffectiveFrom = new DateOnly(2026, 10, 1), Status = "scheduled", Note = "Shop subscription pilot", CreatedAt = now, UpdatedAt = now, CreatedBy = "seed", SortOrder = 3 },
    };

    public static CompanySettings Company() => new()
    {
        Id = 1,
        LegalName = "Mana Bandi Mobility Private Limited",
        Brand = "Mana Bandi · మన బండి",
        Gstin = "36ABCDE1234F1Z5",
        Address = "Shop 4, Bus stand road, Narayanakhed, Sangareddy 502286, Telangana",
        SupportEmail = "help@manabandi.in",
        SupportPhone = "+91 94940 11000",
        WhatsappNumber = "+91 94940 11000",
        CommissionPct = 10,
        FreeMonths = 3,
        IncentiveTripsPerDay = 8,
        IncentiveAmount = 100,
        OfferWindowSec = 15,
        DispatchRounds = 3,
        DispatchRadiusKm = 3,
    };

    public const string TermsTe = "మన బండి సేవలను ఉపయోగించే ముందు ఈ నియమాలను చదవండి. ప్రయాణ ఛార్జీ బుకింగ్‌కు ముందు చూపబడుతుంది. రాత్రి 10 నుండి ఉదయం 5 వరకు 20% రాత్రి ఛార్జి వర్తిస్తుంది. నగదు లేదా UPI ద్వారా చెల్లించవచ్చు. పార్సెల్ డెలివరీకి OTP తప్పనిసరి.";
    public const string TermsEn = "Read these terms before using Mana Bandi. The fare is shown before booking. A 20% night charge applies between 10 pm and 5 am. Pay by cash or UPI. Parcel delivery requires the receiver OTP. Captains are independent partners; Mana Bandi provides the platform and a support desk in each town.";

    public static List<TermsVersion> Terms() => new()
    {
        // A fresh installation starts at v1.0 (matches the apps' bundled version); the owner
        // publishes later versions from the portal, and the apps then ask everyone again.
        new TermsVersion { Version = "1.0", PublishedAt = new DateOnly(2026, 9, 1), By = "setup", Te = TermsTe, En = TermsEn },
    };

    public static List<MessageTemplate> Templates() => new()
    {
        new() { Id = "tpl_1", Channel = "sms", Key = "captain_assigned", Langs = new() { "te", "en", "hi" }, Status = "approved", Te = "మీ బండి వస్తోంది: {captain} · {vehicle_no} · 📞 {phone}. OTP {otp}", En = "Your bandi is coming: {captain} · {vehicle_no} · call {phone}. OTP {otp}" },
        new() { Id = "tpl_2", Channel = "whatsapp", Key = "ride_receipt", Langs = new() { "te", "en" }, Status = "approved", Te = "ప్రయాణం పూర్తయింది. ఛార్జీ ₹{fare}. ధన్యవాదాలు 🙏", En = "Trip finished. Fare ₹{fare}. Thank you for riding with Mana Bandi." },
        new() { Id = "tpl_3", Channel = "whatsapp", Key = "parcel_tracking", Langs = new() { "te", "en", "kn" }, Status = "approved", Te = "{sender} మీకు పార్సెల్ పంపారు. ట్రాక్ చేయండి: {link} · OTP {otp}", En = "{sender} sent you a parcel. Track: {link} · delivery OTP {otp}" },
        new() { Id = "tpl_4", Channel = "sms", Key = "otp_login", Langs = new() { "te", "en", "hi", "kn", "mr", "ur" }, Status = "approved", Te = "మన బండి OTP: {otp}", En = "Mana Bandi OTP: {otp}" },
        new() { Id = "tpl_5", Channel = "whatsapp", Key = "captain_settlement", Langs = new() { "te" }, Status = "pending_review", Te = "ఈ వారం సెటిల్మెంట్: UPI ₹{upi}, నగదు ₹{cash}, చెల్లింపు ₹{payout}", En = "This week: UPI ₹{upi}, cash ₹{cash}, payout ₹{payout}" },
        new() { Id = "tpl_6", Channel = "sms", Key = "sos_trusted_contact", Langs = new() { "te", "en" }, Status = "approved", Te = "{name} SOS నొక్కారు. లొకేషన్: {link}", En = "{name} pressed SOS in Mana Bandi. Location: {link}" },
    };

    /// <summary>Demo captains for testing (Seed:DemoData=true). Phones +91900000000X, verified, spread around Narayanakhed.</summary>
    public static IEnumerable<(User user, Captain captain)> DemoCaptains(DateTime now, DateOnly today)
    {
        var names = new[] { ("Srinivas Goud", "శ్రీనివాస్ గౌడ్"), ("Ramesh Yadav", "రమేష్ యాదవ్"), ("Mahesh Reddy", "మహేష్ రెడ్డి"), ("Naveen Kumar", "నవీన్ కుమార్"),
            ("Raju Naik", "రాజు నాయక్"), ("Venkatesh Rao", "వెంకటేష్ రావు"), ("Shiva Mudiraj", "శివ ముదిరాజ్"), ("Imran Khan", "ఇమ్రాన్ ఖాన్"),
            ("Prakash Chary", "ప్రకాష్ చారి"), ("Kiran Swamy", "కిరణ్ స్వామి") };
        var offsets = new[] { (0.0008, 0.0006), (-0.004, 0.003), (0.006, -0.005), (-0.008, -0.002), (0.002, 0.009), (0.011, 0.004), (-0.012, 0.008), (0.004, -0.011), (-0.002, -0.014), (0.015, -0.009) };
        for (var i = 0; i < 10; i++)
        {
            var isAuto = i is 7 or 8 or 9;
            var (name, te) = names[i];
            var u = new User { Id = $"u_demo_{i + 1:00}", Phone = $"+9190000000{i:00}", Role = Roles.Captain, Name = name, Lang = "te", IsDemo = true, CreatedAt = now };
            var id = $"c_demo_{i + 1:00}";
            var c = new Captain
            {
                Id = id, UserId = u.Id, NameTe = te, Status = CaptainStatus.Verified, VehicleType = isAuto ? "auto" : "bike",
                VehicleNo = $"TS 15 D{(char)('A' + i)} {1001 + i * 37}", VehicleModel = isAuto ? "Bajaj RE" : "Hero Splendor+", TownId = "nkd",
                Online = false, LastLat = Math.Round(18.0338 + offsets[i].Item1, 6), LastLng = Math.Round(77.7562 + offsets[i].Item2, 6), LastSeenAt = now,
                Rating = 4.6, JoinedAt = today.AddDays(-10), ApprovedAt = now, PoliceStatus = "done", VerificationScore = 100, IsDemo = true, CreatedAt = now,
                Kyc = new CaptainKyc
                {
                    CaptainId = id, Provider = "demo", AadhaarLast4 = $"{4100 + i}", AadhaarName = name, AadhaarDob = new DateOnly(1990, 1 + i, 10), AadhaarVerifiedVia = "Demo data",
                    DlNumber = $"TS15 2019{1000000 + i}", DlName = name, DlValidTill = today.AddYears(5), DlClass = isAuto ? "LMV, 3W-T" : "MCWG", NameMatchScore = 100,
                    RcNumber = $"TS 15 D{(char)('A' + i)} {1001 + i * 37}", RcOwnerName = name, RcVehicleClass = isAuto ? "3WT (Passenger)" : "M-Cycle/Scooter",
                    RcValidTill = today.AddYears(8), RcInsuranceTill = today.AddYears(1), RcOwnerIsCaptain = true, FaceMatchScore = 95, Liveness = true,
                    BankUpi = $"90000000{i:00}@ybl", BankIfsc = "SBIN0004321", BankAccountLast4 = $"{2200 + i}",
                },
            };
            yield return (u, c);
        }
    }
}
