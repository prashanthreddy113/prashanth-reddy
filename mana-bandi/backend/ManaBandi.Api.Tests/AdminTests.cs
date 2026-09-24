using System.Net;
using System.Net.Http.Headers;
using System.Text.Json;

namespace ManaBandi.Api.Tests;

public class AdminTests
{
    private static readonly byte[] Png = Convert.FromBase64String("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==");

    private static MultipartFormDataContent Photo(byte[] bytes, string name = "photo.png")
    {
        var form = new MultipartFormDataContent();
        var file = new ByteArrayContent(bytes);
        file.Headers.ContentType = new MediaTypeHeaderValue("image/png");
        form.Add(file, "photo", name);
        return form;
    }

    private static object Docs(string name, bool good = true, string dlNo = "TS15 20190012345") => new
    {
        aadhaar = new { name, dob = "1992-04-12", number = "5678 1234 9012", verifiedVia = (string?)null },
        dl = new { name, number = dlNo, validTill = good ? "2031-05-20" : "2024-01-01", vehicleClass = "MCWG" },
        rc = new { number = "TS 15 AB 1234", ownerName = name, validTill = "2034-01-01", insuranceTill = "2027-06-30", vehicleClass = "M-Cycle/Scooter", consentLetter = false },
        selfie = new { faceMatchScore = 91, liveness = true },
        bank = new { upi = "9876543210@ybl", ifsc = "SBIN0004321", accountLast4 = "4321" },
        police = new { status = "requested" },
    };

    [Fact]
    public async Task Admin_login_captain_approval_commission_and_dashboard()
    {
        await using var app = TestApp.Create();
        var anon = app.Anonymous();
        await anon.PostJson("/api/auth/login", new { email = TestApp.OwnerEmail, password = "wrong-password" }).Problem(401, "unauthorized");
        var login = await anon.PostJson("/api/auth/login", new { email = TestApp.OwnerEmail.ToUpperInvariant(), password = TestApp.OwnerPassword }).Ok();
        Assert.Equal("owner", login.GetProperty("user").Str("role"));
        Assert.Equal(TestApp.OwnerEmail, login.GetProperty("user").Str("email"));
        var owner = app.Authed(login.Str("token"));

        // towns seeded from owner-web mock
        var towns = await owner.GetAsync("/api/towns").Ok();
        Assert.Equal(new[] { "nkd", "zhb" }, towns.EnumerateArray().Select(t => t.Str("id")).ToArray());
        var nkd = towns[0];
        Assert.Equal(12, nkd.GetProperty("radiusKm").GetDouble());
        Assert.Equal(20, nkd.GetProperty("fares").GetProperty("bike").GetProperty("base").GetInt32());
        Assert.Equal(7, nkd.GetProperty("landmarks").GetArrayLength());

        // verify before the captain exists (Add captain page)
        var draft = await owner.PostJson("/api/captains/verify", Docs("Ramesh Yadav")).Ok();
        var checks = draft.GetProperty("checks").EnumerateArray().ToDictionary(c => c.Str("id"), c => c.Str("state"));
        Assert.Equal("pass", checks["aadhaar"]);
        Assert.Equal("pass", checks["dl_valid"]);
        Assert.Equal("pass", checks["dl_name"]);
        Assert.Equal("pass", checks["rc_owner"]);
        Assert.Equal("review", checks["police"]);
        Assert.Equal("XXXX XXXX 9012", draft.GetProperty("docs").GetProperty("aadhaar").Str("number"));

        var bad = await owner.PostJson("/api/captains", new { name = "Suresh Goud", phone = "9000000701", vehicleType = "bike", vehicleModel = "Honda Shine", vehicleNo = "TS15 AB 1234", townId = "nkd", docs = Docs("Suresh Goud", good: false, dlNo: "TS15 20180099999") }).Ok(HttpStatusCode.Created);
        Assert.Equal("pending", bad.Str("status"));
        await owner.PostJson($"/api/captains/{bad.Str("id")}/approve").Problem(422, "validation"); // expired DL

        var cap = await owner.PostJson("/api/captains", new { name = "Ramesh Yadav", nameTe = "రమేష్", phone = "9000000702", vehicleType = "bike", vehicleModel = "Hero Splendor+", vehicleNo = "ts 15 ab 9999", townId = "nkd", docs = Docs("Ramesh Yadav") }).Ok(HttpStatusCode.Created);
        var capId = cap.Str("id");
        Assert.Equal("TS 15 AB 9999", cap.Str("vehicleNo"));
        Assert.Equal("XXXX XXXX 9012", cap.GetProperty("docs").GetProperty("aadhaar").Str("number"));
        var list = await owner.GetAsync("/api/captains?town=all&status=pending").Ok();
        Assert.Equal(2, list.GetArrayLength());
        Assert.Equal(1, (await owner.GetAsync("/api/captains?q=ramesh").Ok()).GetArrayLength());

        // document photo: magic bytes are checked; files are admin-only
        var notImage = new MultipartFormDataContent { { new ByteArrayContent("hello, not an image"u8.ToArray()), "photo", "x.png" } };
        await owner.PostAsync($"/api/captains/{capId}/documents/selfie", notImage).Problem(415, "validation");
        var withPhoto = await owner.PostAsync($"/api/captains/{capId}/documents/selfie", Photo(Png)).Ok();
        var fileUrl = withPhoto.GetProperty("files").Str("selfie");
        var img = await owner.GetAsync(fileUrl);
        Assert.Equal(HttpStatusCode.OK, img.StatusCode);
        Assert.Equal("image/png", img.Content.Headers.ContentType?.MediaType);
        var riderClient = await app.Rider("9848000700");
        await riderClient.GetAsync(fileUrl).Problem(404, "not_found");
        await anon.GetAsync(fileUrl).Problem(401, "unauthorized");

        var verified = await owner.PostJson($"/api/captains/{capId}/verify").Ok();
        Assert.True(verified.GetProperty("checks").GetArrayLength() >= 9);
        var approved = await owner.PostJson($"/api/captains/{capId}/approve").Ok();
        Assert.Equal("verified", approved.Str("status"));
        await owner.PostJson($"/api/captains/{capId}/block", new { reason = "" }).Problem(422, "validation");
        Assert.Equal("blocked", (await owner.PostJson($"/api/captains/{capId}/block", new { reason = "Overcharging" }).Ok()).Str("status"));
        Assert.Equal("verified", (await owner.PostJson($"/api/captains/{capId}/unblock").Ok()).Str("status"));
        Assert.Equal("done", (await owner.PatchAsync($"/api/captains/{capId}/police-verification", JsonContent(new { status = "done" })).Ok()).GetProperty("docs").GetProperty("police").Str("status"));
        var consent = await owner.PostAsync($"/api/captains/{bad.Str("id")}/documents/consent-letter", null).Ok();
        Assert.True(consent.GetProperty("docs").GetProperty("rc").GetProperty("consentLetter").GetBoolean());
        await owner.PostJson($"/api/captains/{capId}/request-reupload", new { documents = new[] { "rc" }, note = "blurry" }).Ok();

        // the approved captain can log in and go online
        var (capClient, capBody) = await app.LoginPhone("9000000702", "captain");
        Assert.Equal(capId, capBody.GetProperty("captain").Str("id"));
        Assert.Equal("verified", capBody.GetProperty("captain").Str("status"));
        await capClient.PostJson("/api/captain/online", new { online = true, lat = 18.034, lng = 77.757 }).Ok();
        var live = await owner.GetAsync("/api/live/captains?town=nkd").Ok();
        Assert.Equal(capId, live[0].Str("id"));
        Assert.Equal(18.034, live[0].GetProperty("pos").GetProperty("lat").GetDouble(), 4);

        // commission config + resolver (ported resolveCommission)
        var cfg = await owner.GetAsync("/api/config/commission").Ok();
        Assert.Equal(10, cfg.GetProperty("defaultRule").GetProperty("pct").GetDouble());
        Assert.Equal(8, cfg.GetProperty("serviceOverrides").GetProperty("parcel").GetDouble());
        Assert.Equal(JsonValueKind.Null, cfg.GetProperty("serviceOverrides").GetProperty("bike").ValueKind);
        Assert.Equal(2, cfg.GetProperty("townOverrides").GetArrayLength());
        var r1 = await owner.GetAsync("/api/config/commission?town=nkd&service=bike&fare=100&joinedAt=2026-01-01&on=2026-09-20").Ok();
        Assert.Equal(10, r1.GetProperty("pct").GetDouble());
        Assert.Equal(10, r1.GetProperty("commission").GetInt32());
        Assert.Equal("Default rule", r1.Str("rule"));
        var r2 = await owner.GetAsync("/api/config/commission?town=nkd&service=bike&fare=100&joinedAt=2026-08-01&on=2026-09-20").Ok();
        Assert.Equal(0, r2.GetProperty("pct").GetDouble()); // inside 3 free months
        var r3 = await owner.GetAsync("/api/config/commission?town=nkd&service=parcel&fare=200&joinedAt=2026-01-01&on=2026-09-20").Ok();
        Assert.Equal("Service override · parcel", r3.Str("rule"));
        Assert.Equal(16, r3.GetProperty("commission").GetInt32());
        var r4 = await owner.GetAsync("/api/config/commission?town=nkd&service=parcel&fare=200&joinedAt=2026-01-01&on=2026-10-02").Ok();
        Assert.Equal("Town override · nkd / parcel", r4.Str("rule")); // scheduled override kicks in
        Assert.Equal(12, r4.GetProperty("commission").GetInt32());
        var r5 = await owner.GetAsync("/api/config/commission?town=zhb&service=auto&fare=150&joinedAt=2026-01-01&on=2026-09-20").Ok();
        Assert.Equal("Town override · zhb / all services", r5.Str("rule"));
        var r6 = await owner.GetAsync("/api/config/commission?town=nkd&service=bike&fare=100&joinedAt=2026-01-01&on=2026-06-01").Ok();
        Assert.Equal(0, r6.GetProperty("commission").GetInt32()); // default not yet effective

        var saved = await owner.PutJson("/api/config/commission", new { defaultRule = new { pct = 12, freeMonths = 3, freePct = 0, effectiveFrom = "2026-07-01" }, serviceOverrides = new { bike = (double?)null, auto = 11.0, parcel = 8.0 } }).Ok();
        Assert.Equal(12, saved.GetProperty("defaultRule").GetProperty("pct").GetDouble());
        Assert.Equal(11, saved.GetProperty("serviceOverrides").GetProperty("auto").GetDouble());
        var added = await owner.PostJson("/api/config/commission/towns", new { townId = "nkd", service = "bike", pct = 5, freeMonths = 0, freePct = 0, effectiveFrom = "2026-01-01", status = "active", note = "Test" }).Ok();
        var r7 = await owner.GetAsync("/api/config/commission?town=nkd&service=bike&fare=100&joinedAt=2026-01-01&on=2026-09-20").Ok();
        Assert.Equal(5, r7.GetProperty("commission").GetInt32());
        await owner.DeleteAsync($"/api/config/commission/towns/{added.Str("id")}").Ok();

        // captains resolve only their own line
        var mine = await capClient.GetAsync("/api/config/commission?service=bike&fare=100").Ok();
        Assert.Equal(0, mine.GetProperty("pct").GetDouble()); // joined today
        await capClient.GetAsync("/api/config/commission").Problem(403, "forbidden");

        // dashboard + analytics shapes match the owner-web mock
        var dash = await owner.GetAsync("/api/admin/dashboard?town=all").Ok();
        foreach (var k in new[] { "ridesToday", "parcelsToday", "grossToday", "revenueToday", "captainsOnline", "captainsTotal", "fulfilment", "medianPickup", "cancellations", "avgRating" })
            Assert.True(dash.GetProperty("kpis").TryGetProperty(k, out _), k);
        Assert.Equal(1, dash.GetProperty("kpis").GetProperty("captainsOnline").GetInt32());
        Assert.Equal(14, dash.GetProperty("series14d").GetArrayLength());
        Assert.Equal(24, dash.GetProperty("byHourToday").GetArrayLength());
        foreach (var k in new[] { "pendingCaptains", "sos", "unfulfilled", "lowRated", "searchingLong" })
            Assert.Equal(JsonValueKind.Array, dash.GetProperty("attention").GetProperty(k).ValueKind);
        Assert.Equal(1, dash.GetProperty("attention").GetProperty("pendingCaptains").GetArrayLength());
        var an = await owner.GetAsync("/api/admin/analytics?town=all&days=30").Ok();
        Assert.Equal(30, an.GetProperty("perDay").GetArrayLength());
        Assert.Equal(7, an.GetProperty("heatmap").GetArrayLength());
        Assert.Equal(24, an.GetProperty("heatmap")[0].GetArrayLength());
        foreach (var k in new[] { "byService", "byTown", "leaderboard", "topLandmarks", "retention", "codSummary" }) Assert.True(an.TryGetProperty(k, out _), k);

        // settings, terms, templates, users, audit
        var company = await owner.GetAsync("/api/admin/settings/company").Ok();
        Assert.Equal("Mana Bandi Mobility Private Limited", company.Str("legalName"));
        var terms = await owner.GetAsync("/api/admin/terms").Ok();
        Assert.Equal("1.2", terms.Str("currentVersion"));
        Assert.Equal(3, terms.GetProperty("versions").GetArrayLength());
        Assert.Equal(6, (await owner.GetAsync("/api/admin/templates").Ok()).GetArrayLength());
        var manager = await owner.PostJson("/api/admin/users", new { name = "Swapna", email = "nkd@test.manabandi.in", role = "town_manager", townId = "nkd" }).Ok();
        var tempPassword = manager.Str("tempPassword");
        var audit = await owner.GetAsync("/api/admin/audit?limit=100").Ok();
        var actions = audit.EnumerateArray().Select(a => a.Str("action")).ToList();
        foreach (var a in new[] { "captain.create", "captain.approve", "captain.block", "captain.unblock", "captain.police", "captain.consent", "captain.reupload", "commission.default", "commission.service", "commission.town", "user.add" })
            Assert.Contains(a, actions);

        // town manager: read-only commission, scoped to own town
        var mLogin = await anon.PostJson("/api/auth/login", new { email = "nkd@test.manabandi.in", password = tempPassword }).Ok();
        Assert.Equal("town_manager", mLogin.GetProperty("user").Str("role"));
        Assert.Equal("nkd", mLogin.GetProperty("user").Str("townId"));
        var mgr = app.Authed(mLogin.Str("token"));
        await mgr.GetAsync("/api/config/commission").Ok();
        await mgr.PutJson("/api/config/commission", new { defaultRule = new { pct = 1, freeMonths = 0, freePct = 0 } }).Problem(403, "forbidden");
        await mgr.PostJson("/api/config/commission/towns", new { townId = "nkd", service = "bike", pct = 1, freeMonths = 0 }).Problem(403, "forbidden");
        await mgr.PutJson("/api/admin/settings/company", new { legalName = "x" }).Problem(403, "forbidden");
        await mgr.GetAsync("/api/admin/users").Problem(403, "forbidden");
        await mgr.PutJson("/api/towns/zhb", new { supportPhone = "1" }).Problem(403, "forbidden");
        Assert.Equal(2, (await mgr.GetAsync("/api/captains?town=zhb").Ok()).GetArrayLength()); // pinned to nkd whatever the query says
        var zhbCap = await owner.PostJson("/api/captains", new { name = "Arif", phone = "9000000703", vehicleType = "auto", vehicleNo = "TS15 AC 1111", townId = "zhb" }).Ok(HttpStatusCode.Created);
        await mgr.GetAsync($"/api/captains/{zhbCap.Str("id")}").Problem(404, "not_found");
        await mgr.PostJson($"/api/captains/{zhbCap.Str("id")}/approve").Problem(404, "not_found");

        // removing the manager revokes the token immediately
        await owner.DeleteAsync($"/api/admin/users/{manager.Str("id")}").Ok();
        await mgr.GetAsync("/api/captains").Problem(401, "unauthorized");
    }

    [Fact]
    public async Task Settlements_list_and_pay()
    {
        await using var app = TestApp.Create();
        var rider = await app.Rider("9848000800");
        var (captain, capId) = await app.VerifiedCaptain("9000000801", joinedAt: DateOnly.FromDateTime(DateTime.UtcNow.AddYears(-1)));
        await captain.PostJson("/api/captain/online", new { online = true, lat = 18.034, lng = 77.757 }).Ok();
        var ride = await rider.PostJson("/api/rides", new { clientId = Guid.NewGuid().ToString(), service = "bike", payment = "upi", pickup = Nkd.Place(Nkd.BusStand), drop = Nkd.Place(Nkd.FarDrop) }).Ok(HttpStatusCode.Created);
        var offer = await RideLifecycleTests.WaitForOffer(captain, (18.034, 77.757));
        await captain.PostJson($"/api/captain/offers/{offer.Str("id")}/accept").Ok();
        await captain.PostJson("/api/captain/trip/arrived").Ok();
        await captain.PostJson("/api/captain/trip/start", new { otp = (await rider.GetAsync($"/api/rides/{ride.Str("id")}").Ok()).Str("otp") }).Ok();
        var fin = await captain.PostJson("/api/captain/trip/finish", new { lat = Nkd.FarDrop.lat, lng = Nkd.FarDrop.lng }).Ok();
        await captain.PostJson("/api/captain/trip/collected", new { method = "upi" }).Ok();
        var fare = fin.GetProperty("fareFinal").GetInt32();
        var com = fin.GetProperty("commission").GetProperty("amount").GetInt32();

        var owner = await app.Owner();
        var rows = await owner.GetAsync("/api/settlements?town=all").Ok();
        Assert.Equal(1, rows.GetArrayLength());
        var s = rows[0];
        Assert.Equal(capId, s.Str("captainId"));
        Assert.Equal(fare, s.GetProperty("upiEarned").GetInt32());
        Assert.Equal(0, s.GetProperty("cashCollected").GetInt32());
        Assert.Equal(com, s.GetProperty("commission").GetInt32());
        Assert.Equal(fare - com, s.GetProperty("payout").GetInt32());
        Assert.Equal("due", s.Str("status"));
        Assert.Equal(capId, s.GetProperty("captain").Str("id"));
        Assert.Equal("bike", s.GetProperty("lines")[0].Str("service"));
        var paid = await owner.PostJson($"/api/settlements/{s.Str("id")}/pay", new { utr = "UTR123456" }).Ok();
        Assert.Equal("paid", paid.Str("status"));
        Assert.Equal("UTR123456", paid.Str("utr"));
        await owner.PostJson($"/api/settlements/{s.Str("id")}/pay", new { utr = "again" }).Problem(422, "invalid_state");
        Assert.Equal("paid", (await owner.GetAsync("/api/settlements").Ok())[0].Str("status"));
        Assert.Equal(0, (await captain.GetAsync("/api/captain/earnings").Ok()).GetProperty("settlementDue").GetInt32());

        var rideAdmin = await owner.GetAsync($"/api/rides/{ride.Str("id")}").Ok();
        Assert.Equal("finished", rideAdmin.Str("status"));
        Assert.Equal("ride", rideAdmin.Str("kind"));
        Assert.Equal(com, rideAdmin.GetProperty("commission").GetInt32());
    }

    private static StringContent JsonContent(object o) => new(JsonSerializer.Serialize(o), System.Text.Encoding.UTF8, "application/json");
}
