using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;

namespace ManaBandi.Api.Tests;

public class AuthTests
{
    [Fact]
    public async Task Rider_otp_login_wrong_then_right_code_creates_user()
    {
        await using var app = TestApp.Create();
        var anon = app.Anonymous();

        var req = await anon.PostJson("/api/auth/otp/request", new { phone = "98480 12345", role = "rider", channel = "sms", lang = "te" }).Ok();
        Assert.True(req.GetProperty("sent").GetBoolean());
        Assert.Equal(300, req.GetProperty("expiresInSec").GetInt32());
        var code = req.Str("devCode");
        Assert.Matches("^[0-9]{4}$", code);
        var wrong = code == "0000" ? "1111" : "0000";

        await anon.PostJson("/api/auth/otp/verify", new { phone = "9848012345", role = "rider", code = wrong }).Problem(422, "invalid_otp");
        var ok = await anon.PostJson("/api/auth/otp/verify", new { phone = "+919848012345", role = "rider", code, name = "Lakshmi", lang = "te" }).Ok();
        var user = ok.GetProperty("user");
        Assert.Equal("rider", user.Str("role"));
        Assert.Equal("+919848012345", user.Str("phone"));
        Assert.Equal("Lakshmi", user.Str("name"));
        Assert.Equal("te", user.Str("lang"));
        Assert.True(user.GetProperty("termsRequired").GetBoolean());
        Assert.False(ok.TryGetProperty("captain", out _));

        // a used code cannot be reused
        await anon.PostJson("/api/auth/otp/verify", new { phone = "9848012345", role = "rider", code }).Problem(422, "invalid_otp");

        var me = app.Authed(ok.Str("token"));
        var meBody = await me.GetAsync("/api/me").Ok();
        Assert.Equal(user.Str("id"), meBody.Str("id"));

        // codes are stored hashed only
        var stored = await app.WithDb(db => db.OtpCodes.Select(o => o.CodeHash).ToListAsync());
        Assert.DoesNotContain(code, stored);
        Assert.All(stored, h => Assert.Equal(64, h.Length));

        // a rider token cannot use captain or admin endpoints
        await me.GetAsync("/api/captain/me").Problem(403, "forbidden");
        await me.GetAsync("/api/admin/dashboard").Problem(403, "forbidden");
        await app.Anonymous().GetAsync("/api/me").Problem(401, "unauthorized");
    }

    [Fact]
    public async Task Captain_otp_login_returns_pending_captain_and_cannot_go_online()
    {
        await using var app = TestApp.Create();
        var (captain, body) = await app.LoginPhone("9000011111", "captain", "Srinivas");
        var c = body.GetProperty("captain");
        Assert.Equal("pending", c.Str("status"));
        Assert.Equal("missing", c.GetProperty("kyc").Str("aadhaar"));
        Assert.Equal(10, c.GetProperty("commission").GetProperty("pct").GetDouble());
        Assert.Equal("captain", body.GetProperty("user").Str("role"));

        await captain.PostJson("/api/captain/online", new { online = true, lat = 18.0338, lng = 77.7562 }).Problem(403, "kyc_required");
        var me = await captain.GetAsync("/api/me").Ok();
        Assert.Equal("pending", me.GetProperty("captain").Str("status"));
        await captain.PostJson("/api/rider/quote", new { service = "bike" }).Problem(403, "forbidden");
    }

    [Fact]
    public async Task Otp_attempts_and_rate_limits()
    {
        await using var app = TestApp.Create();
        var anon = app.Anonymous();
        var code = (await anon.PostJson("/api/auth/otp/request", new { phone = "9123456789", role = "rider" }).Ok()).Str("devCode");
        var wrong = code == "0000" ? "1111" : "0000";
        for (var i = 0; i < 5; i++)
            await anon.PostJson("/api/auth/otp/verify", new { phone = "9123456789", role = "rider", code = wrong }).Problem(422, "invalid_otp");
        // 5 wrong attempts burn the code even if the right one comes next
        await anon.PostJson("/api/auth/otp/verify", new { phone = "9123456789", role = "rider", code }).Problem(422, "invalid_otp");

        await anon.PostJson("/api/auth/otp/request", new { phone = "9123456789", role = "rider" }).Ok();
        await anon.PostJson("/api/auth/otp/request", new { phone = "9123456789", role = "rider" }).Ok();
        await anon.PostJson("/api/auth/otp/request", new { phone = "9123456789", role = "rider" }).Problem(429, "otp_rate_limited");
        await anon.PostJson("/api/auth/otp/request", new { phone = "12345", role = "rider" }).Problem(422, "validation");
        await anon.PostJson("/api/auth/otp/request", new { phone = "9123456780", role = "owner" }).Problem(422, "validation");
    }

    [Fact]
    public async Task Booking_requires_current_terms()
    {
        await using var app = TestApp.Create();
        var (rider, _) = await app.LoginPhone("9848000001", "rider", acceptTerms: false);
        var ride = new { clientId = Guid.NewGuid().ToString(), service = "bike", pickup = Nkd.Place(Nkd.BusStand), drop = Nkd.Place(Nkd.FarDrop), payment = "cash" };
        await rider.PostJson("/api/rides", ride).Problem(403, "terms_required");
        await rider.PostJson("/api/me/terms", new { version = "9.9" }).Problem(422, "validation");
        await rider.PostJson("/api/me/terms", new { version = "1.2" }).Ok();
        var created = await rider.PostJson("/api/rides", ride).Ok(HttpStatusCode.Created);
        Assert.Equal("searching", created.Str("status"));

        var consent = await app.WithDb(db => db.Consents.SingleAsync());
        Assert.Equal("terms_rider", consent.Kind);
        Assert.Equal("1.2", consent.Version);
        Assert.Equal("0.2.0-test", consent.AppVersion);

        // idempotent on clientId
        var again = await rider.PostJson("/api/rides", ride).Ok();
        Assert.Equal(created.Str("id"), again.Str("id"));

        var me = await rider.GetAsync("/api/me").Ok();
        Assert.Equal("1.2", me.Str("termsVersionAccepted"));
        Assert.False(me.GetProperty("termsRequired").GetBoolean());
    }
}
