using System.Globalization;
using System.Text.RegularExpressions;
using ManaBandi.Api.Infrastructure;
using ManaBandi.Api.Models;

namespace ManaBandi.Api.Services;

// ---------------------------------------------------------------- docs shape (same as owner-web mock captain.docs)

public class AadhaarDoc { public bool? Uploaded { get; set; } public string? Number { get; set; } public string? Name { get; set; } public string? Dob { get; set; } public string? VerifiedVia { get; set; } }
public class DlDoc { public bool? Uploaded { get; set; } public string? Number { get; set; } public string? Name { get; set; } public string? ValidTill { get; set; } public string? VehicleClass { get; set; } public int? NameMatchScore { get; set; } }
public class RcDoc { public bool? Uploaded { get; set; } public string? Number { get; set; } public string? OwnerName { get; set; } public string? ValidTill { get; set; } public string? InsuranceTill { get; set; } public string? VehicleClass { get; set; } public bool? OwnerIsCaptain { get; set; } public bool? ConsentLetter { get; set; } public string? OwnerPhone { get; set; } }
public class SelfieDoc { public bool? Uploaded { get; set; } public int? FaceMatchScore { get; set; } public bool? Liveness { get; set; } }
public class BankDoc { public bool? Uploaded { get; set; } public string? Upi { get; set; } public string? Ifsc { get; set; } public string? AccountLast4 { get; set; } }
public class PoliceDoc { public string? Status { get; set; } }

public class CaptainDocs
{
    public AadhaarDoc? Aadhaar { get; set; }
    public DlDoc? Dl { get; set; }
    public RcDoc? Rc { get; set; }
    public SelfieDoc? Selfie { get; set; }
    public BankDoc? Bank { get; set; }
    public PoliceDoc? Police { get; set; }
}

public record Check(string Id, string Label, string State, string Note);

public record KycResult(List<Check> Checks, CaptainDocs Docs);

/// <summary>
/// Pluggable KYC provider. <see cref="ManualKycProvider"/> computes the chips from the extracted fields typed by the office
/// (or uploaded by the captain) using the docs/05 rules. A real provider (DigiLocker via an aggregator such as Setu,
/// Cashfree Verification, Signzy, IDfy, HyperVerge…) implements the same interface: it fetches the signed e-Aadhaar,
/// DL (Sarathi) and RC (Vahan) records and a face-match/liveness score, fills <see cref="CaptainDocs"/> with the
/// returned values (masking Aadhaar to last 4), and then calls <see cref="KycRules.BuildChecks"/> so the chips are the same.
/// Register it in Program.cs instead of ManualKycProvider (e.g. when Kyc:Provider=setu).
/// </summary>
public interface IKycProvider
{
    string Name { get; }
    Task<KycResult> VerifyAsync(CaptainDocs docs, KycContext ctx, CancellationToken ct = default);
}

public record KycContext(string? CaptainId, string? VehicleType, DateOnly Today, bool DlNumberUsedByOther);

public class ManualKycProvider : IKycProvider
{
    public string Name => "manual";

    public Task<KycResult> VerifyAsync(CaptainDocs docs, KycContext ctx, CancellationToken ct = default)
    {
        var a = docs.Aadhaar ?? new AadhaarDoc();
        var dl = docs.Dl ?? new DlDoc();
        var rc = docs.Rc ?? new RcDoc();
        var selfie = docs.Selfie ?? new SelfieDoc();

        // Manual mode: Aadhaar counts as checked when the last 4 digits were typed from the card (office saw the original).
        var aadhaarOk = !string.IsNullOrWhiteSpace(KycRules.AadhaarLast4(a.Number));
        var verifiedVia = aadhaarOk ? (string.IsNullOrWhiteSpace(a.VerifiedVia) ? "Manual check at office" : a.VerifiedVia) : null;
        var nameScore = dl.NameMatchScore ?? (!string.IsNullOrWhiteSpace(a.Name) && !string.IsNullOrWhiteSpace(dl.Name) ? KycRules.Fuzzy(a.Name, dl.Name) : 0);
        var ownerIsCaptain = rc.OwnerIsCaptain ?? (!string.IsNullOrWhiteSpace(rc.OwnerName) && !string.IsNullOrWhiteSpace(a.Name) && KycRules.Fuzzy(rc.OwnerName, a.Name) >= 85);
        // Without a face-match API the office compares the selfie by eye: an uploaded selfie lands in the review band.
        var faceScore = selfie.FaceMatchScore ?? (selfie.Uploaded == true ? 65 : 0);
        var liveness = selfie.Liveness ?? (selfie.Uploaded == true);

        var outDocs = new CaptainDocs
        {
            Aadhaar = new AadhaarDoc { Uploaded = a.Uploaded, Number = KycRules.MaskAadhaar(a.Number), Name = a.Name, Dob = a.Dob, VerifiedVia = verifiedVia },
            Dl = new DlDoc { Uploaded = dl.Uploaded, Number = dl.Number, Name = dl.Name, ValidTill = dl.ValidTill, VehicleClass = dl.VehicleClass, NameMatchScore = nameScore },
            Rc = new RcDoc { Uploaded = rc.Uploaded, Number = rc.Number, OwnerName = rc.OwnerName, ValidTill = rc.ValidTill, InsuranceTill = rc.InsuranceTill, VehicleClass = rc.VehicleClass, OwnerIsCaptain = ownerIsCaptain, ConsentLetter = rc.ConsentLetter ?? false, OwnerPhone = rc.OwnerPhone },
            Selfie = new SelfieDoc { Uploaded = selfie.Uploaded, FaceMatchScore = faceScore, Liveness = liveness },
            Bank = docs.Bank ?? new BankDoc(),
            Police = new PoliceDoc { Status = docs.Police?.Status ?? "not_started" },
        };
        return Task.FromResult(new KycResult(KycRules.BuildChecks(outDocs, ctx), outDocs));
    }
}

public static partial class KycRules
{
    public static DateOnly? ParseDate(string? s) =>
        DateOnly.TryParseExact((s ?? "").Trim(), "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var d) ? d : null;

    public static string? Fmt(DateOnly? d) => d?.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);

    /// <summary>Only the last 4 digits of an Aadhaar number are ever kept.</summary>
    public static string? AadhaarLast4(string? raw)
    {
        var digits = new string((raw ?? "").Where(char.IsDigit).ToArray());
        return digits.Length >= 4 ? digits[^4..] : null;
    }

    public static string MaskAadhaar(string? raw) => AadhaarLast4(raw) is { } l4 ? $"XXXX XXXX {l4}" : "";

    /// <summary>Port of owner-web buildChecks + the extra docs/05 rules (DL class, age, expiring soon, duplicate DL).</summary>
    public static List<Check> BuildChecks(CaptainDocs d, KycContext ctx)
    {
        var today = ctx.Today;
        var a = d.Aadhaar ?? new AadhaarDoc();
        var dl = d.Dl ?? new DlDoc();
        var rc = d.Rc ?? new RcDoc();
        var s = d.Selfie ?? new SelfieDoc();
        var police = d.Police?.Status ?? "not_started";

        var aadhaarOk = !string.IsNullOrWhiteSpace(a.VerifiedVia);
        var dlTill = ParseDate(dl.ValidTill);
        var rcTill = ParseDate(rc.ValidTill);
        var insTill = ParseDate(rc.InsuranceTill);
        var dlValid = dlTill >= today;
        var rcValid = rcTill >= today;
        var insuranceValid = insTill >= today;
        var nameScore = dl.NameMatchScore ?? 0;
        var ownerIsCaptain = rc.OwnerIsCaptain ?? false;
        var consent = rc.ConsentLetter ?? false;
        var face = s.FaceMatchScore ?? 0;
        var liveness = s.Liveness ?? false;

        var c = new List<Check>
        {
            new("aadhaar", "Aadhaar verified", aadhaarOk ? "pass" : "pending", aadhaarOk ? $"via {a.VerifiedVia}" : "OTP / DigiLocker not completed"),
            new("dl_valid", "DL valid till", dlValid ? (dlTill < today.AddDays(60) ? "review" : "pass") : "fail",
                dlTill is null ? "unknown" : dlValid && dlTill < today.AddDays(60) ? $"{Fmt(dlTill)} (expires within 60 days)" : Fmt(dlTill)!),
            new("dl_name", "DL name matches Aadhaar", nameScore >= 85 ? "pass" : nameScore >= 65 ? "review" : "fail", $"fuzzy score {nameScore}/100"),
            new("rc_valid", "RC valid / not expired", rcValid ? "pass" : "fail", Fmt(rcTill) ?? "unknown"),
            new("insurance", "Insurance valid", insuranceValid ? (insTill < today.AddDays(30) ? "review" : "pass") : "fail",
                insTill is null ? "unknown" : insuranceValid && insTill < today.AddDays(30) ? $"{Fmt(insTill)} (expires within 30 days)" : Fmt(insTill)!),
            new("rc_owner", "RC owner = captain", ownerIsCaptain || consent ? "pass" : "review",
                ownerIsCaptain ? "same person" : consent ? "consent letter on file" : "Vehicle belongs to someone else — needs owner consent letter"),
            new("face", "Selfie matches Aadhaar/DL photo", face >= 80 ? "pass" : face >= 65 ? "review" : "fail", $"face match {face}/100"),
            new("liveness", "Liveness passed", liveness ? "pass" : "fail", liveness ? "blink + turn detected" : "retake selfie"),
            new("police", "Police verification (manual)", police == "done" ? "pass" : police == "requested" ? "review" : "pending",
                police switch { "done" => "certificate received", "requested" => "applied at PS, awaiting", "not_started" => "not started", "adverse" => "adverse report", _ => "" }),
        };
        if (police == "adverse") c[^1] = c[^1] with { State = "fail" };

        // docs/05 §4: DL class must match the vehicle (MCWG/MCWOG for bike, LMV / 3W transport for auto).
        if (!string.IsNullOrWhiteSpace(dl.VehicleClass) && ctx.VehicleType != null)
        {
            var cls = dl.VehicleClass.ToUpperInvariant();
            var ok = ctx.VehicleType == "auto" ? cls.Contains("LMV") || cls.Contains("3W") || cls.Contains("TR") : cls.Contains("MCWG") || cls.Contains("MCWOG") || cls.Contains("MC");
            c.Add(new Check("dl_class", "DL class matches vehicle", ok ? "pass" : "fail", $"{dl.VehicleClass} for {ctx.VehicleType}"));
        }
        // Age 18–65 (bike ≥ 20, auto ≥ 21 by policy; 18–19 needs review).
        if (ParseDate(a.Dob) is { } dob)
        {
            var age = today.Year - dob.Year - (today < dob.AddYears(today.Year - dob.Year) ? 1 : 0);
            var min = ctx.VehicleType == "auto" ? 21 : 20;
            var state = age < 18 || age > 65 ? "fail" : age < min ? "review" : "pass";
            c.Add(new Check("age", "Age 18–65", state, $"{age} years"));
        }
        if (ctx.DlNumberUsedByOther)
            c.Add(new Check("duplicate", "DL not used by another captain", "fail", "Same DL number is on another captain account"));
        return c;
    }

    public static int Score(IEnumerable<Check> checks)
    {
        var list = checks.ToList();
        return list.Count == 0 ? 0 : (int)Math.Round(list.Count(x => x.State == "pass") * 100.0 / list.Count);
    }

    [GeneratedRegex("[^a-z ]")]
    private static partial Regex NonAlpha();

    /// <summary>Port of owner-web fuzzy(): token overlap + Levenshtein, 0–100.</summary>
    public static int Fuzzy(string? a, string? b)
    {
        static string Norm(string? s) => NonAlpha().Replace((s ?? "").ToLowerInvariant(), "").Trim();
        var x = Norm(a);
        var y = Norm(b);
        if (x.Length == 0 || y.Length == 0) return 0;
        if (x == y) return 100;
        var tx = x.Split(' ', StringSplitOptions.RemoveEmptyEntries).ToHashSet();
        var ty = y.Split(' ', StringSplitOptions.RemoveEmptyEntries).ToHashSet();
        var overlap = (double)tx.Count(t => ty.Contains(t)) / Math.Max(tx.Count, ty.Count);
        var xs = x.Replace(" ", "");
        var ys = y.Replace(" ", "");
        var sim = 1 - (double)Levenshtein(xs, ys) / Math.Max(x.Length, y.Length);
        return Money.Round((overlap * 0.5 + sim * 0.5) * 100);
    }

    private static int Levenshtein(string a, string b)
    {
        var dp = new int[a.Length + 1, b.Length + 1];
        for (var i = 0; i <= a.Length; i++) dp[i, 0] = i;
        for (var j = 0; j <= b.Length; j++) dp[0, j] = j;
        for (var i = 1; i <= a.Length; i++)
            for (var j = 1; j <= b.Length; j++)
                dp[i, j] = Math.Min(Math.Min(dp[i - 1, j] + 1, dp[i, j - 1] + 1), dp[i - 1, j - 1] + (a[i - 1] == b[j - 1] ? 0 : 1));
        return dp[a.Length, b.Length];
    }

    // ---------------------------------------------------------------- entity <-> docs

    /// <summary>
    /// Stored KYC → docs shape. forView=true fills display defaults (0 scores, false flags);
    /// forView=false keeps unknowns null so a provider can derive them (name match, owner match, face score).
    /// </summary>
    public static CaptainDocs ToDocs(Captain c, IReadOnlyCollection<CaptainDocument> uploaded, bool forView = true)
    {
        var k = c.Kyc ?? new CaptainKyc();
        bool Up(string kind) => uploaded.Any(d => d.Kind == kind);
        return new CaptainDocs
        {
            Aadhaar = new AadhaarDoc { Uploaded = Up("aadhaar") || k.AadhaarLast4 != null, Number = k.AadhaarLast4 is null ? "" : $"XXXX XXXX {k.AadhaarLast4}", Name = k.AadhaarName ?? "", Dob = Fmt(k.AadhaarDob), VerifiedVia = k.AadhaarVerifiedVia },
            Dl = new DlDoc { Uploaded = Up("dl") || k.DlNumber != null, Number = k.DlNumber ?? "", Name = k.DlName ?? "", ValidTill = Fmt(k.DlValidTill), VehicleClass = k.DlClass ?? "", NameMatchScore = forView ? k.NameMatchScore ?? 0 : k.NameMatchScore },
            Rc = new RcDoc { Uploaded = Up("rc") || k.RcNumber != null, Number = k.RcNumber ?? c.VehicleNo, OwnerName = k.RcOwnerName ?? "", ValidTill = Fmt(k.RcValidTill), InsuranceTill = Fmt(k.RcInsuranceTill), VehicleClass = k.RcVehicleClass ?? "", OwnerIsCaptain = forView ? k.RcOwnerIsCaptain ?? false : k.RcOwnerIsCaptain, ConsentLetter = k.ConsentLetter || Up("owner_consent"), OwnerPhone = k.OwnerPhone },
            Selfie = new SelfieDoc { Uploaded = Up("selfie"), FaceMatchScore = forView ? k.FaceMatchScore ?? 0 : k.FaceMatchScore, Liveness = forView ? k.Liveness ?? false : k.Liveness },
            Bank = new BankDoc { Uploaded = Up("bank") || k.BankUpi != null || k.BankAccountLast4 != null, Upi = k.BankUpi ?? "", Ifsc = k.BankIfsc ?? "", AccountLast4 = k.BankAccountLast4 ?? "" },
            Police = new PoliceDoc { Status = c.PoliceStatus },
        };
    }

    [GeneratedRegex(@"^[A-Za-z0-9.\-_]{2,256}@[A-Za-z]{2,64}$")] private static partial Regex UpiRx();
    [GeneratedRegex(@"^[A-Z]{4}0[A-Z0-9]{6}$")] private static partial Regex IfscRx();
    [GeneratedRegex(@"^[0-9]{4}$")] private static partial Regex Last4Rx();

    public static string? CleanUpi(string? v)
    {
        if (string.IsNullOrWhiteSpace(v)) return null;
        v = v.Trim();
        return UpiRx().IsMatch(v) ? v : throw ApiException.Validation("UPI id looks wrong (example: 9876543210@ybl)");
    }

    public static string? CleanIfsc(string? v)
    {
        if (string.IsNullOrWhiteSpace(v)) return null;
        v = v.Trim().ToUpperInvariant();
        return IfscRx().IsMatch(v) ? v : throw ApiException.Validation("IFSC looks wrong (example: SBIN0004321)");
    }

    public static string? CleanLast4(string? v)
    {
        if (string.IsNullOrWhiteSpace(v)) return null;
        v = v.Trim();
        return Last4Rx().IsMatch(v) ? v : throw ApiException.Validation("Account last 4 must be 4 digits");
    }

    private static string? Str(string? s, int max) => string.IsNullOrWhiteSpace(s) ? null : s.Trim().Length > max ? s.Trim()[..max] : s.Trim();

    /// <summary>Copies typed/provider fields into the KYC row. Only the last 4 Aadhaar digits are kept.</summary>
    public static void Apply(CaptainKyc k, CaptainDocs d)
    {
        if (d.Aadhaar is { } a)
        {
            if (a.Number != null) k.AadhaarLast4 = AadhaarLast4(a.Number);
            if (a.Name != null) k.AadhaarName = Str(a.Name, 100);
            if (a.Dob != null) k.AadhaarDob = ParseDate(a.Dob);
            if (a.VerifiedVia != null) k.AadhaarVerifiedVia = Str(a.VerifiedVia, 60);
        }
        if (d.Dl is { } dl)
        {
            if (dl.Number != null) k.DlNumber = Str(dl.Number, 40)?.ToUpperInvariant();
            if (dl.Name != null) k.DlName = Str(dl.Name, 100);
            if (dl.ValidTill != null) k.DlValidTill = ParseDate(dl.ValidTill);
            if (dl.VehicleClass != null) k.DlClass = Str(dl.VehicleClass, 40);
            if (dl.NameMatchScore != null) k.NameMatchScore = Math.Clamp(dl.NameMatchScore.Value, 0, 100);
        }
        if (d.Rc is { } rc)
        {
            if (rc.Number != null) k.RcNumber = Str(rc.Number, 20)?.ToUpperInvariant();
            if (rc.OwnerName != null) k.RcOwnerName = Str(rc.OwnerName, 100);
            if (rc.ValidTill != null) k.RcValidTill = ParseDate(rc.ValidTill);
            if (rc.InsuranceTill != null) k.RcInsuranceTill = ParseDate(rc.InsuranceTill);
            if (rc.VehicleClass != null) k.RcVehicleClass = Str(rc.VehicleClass, 40);
            if (rc.OwnerIsCaptain != null) k.RcOwnerIsCaptain = rc.OwnerIsCaptain;
            if (rc.ConsentLetter != null) k.ConsentLetter = rc.ConsentLetter.Value;
            if (rc.OwnerPhone != null) k.OwnerPhone = Phone.Normalize(rc.OwnerPhone);
        }
        if (d.Selfie is { } s)
        {
            if (s.FaceMatchScore != null) k.FaceMatchScore = Math.Clamp(s.FaceMatchScore.Value, 0, 100);
            if (s.Liveness != null) k.Liveness = s.Liveness;
        }
        if (d.Bank is { } b)
        {
            if (b.Upi != null) k.BankUpi = CleanUpi(b.Upi);
            if (b.Ifsc != null) k.BankIfsc = CleanIfsc(b.Ifsc);
            if (b.AccountLast4 != null) k.BankAccountLast4 = CleanLast4(b.AccountLast4);
        }
    }
}
