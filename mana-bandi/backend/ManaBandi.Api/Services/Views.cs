using ManaBandi.Api.Infrastructure;
using ManaBandi.Api.Models;

namespace ManaBandi.Api.Services;

public static class Views
{
    public static PlaceDto Pickup(Ride r) => new() { Lat = r.PickupLat, Lng = r.PickupLng, Name = r.PickupName, NameTe = r.PickupNameTe, LandmarkId = r.PickupLandmarkId };
    public static PlaceDto Drop(Ride r) => new() { Lat = r.DropLat, Lng = r.DropLng, Name = r.DropName, NameTe = r.DropNameTe, LandmarkId = r.DropLandmarkId };

    public static readonly HashSet<string> RiderEventTypes = new() { "requested", "accepted", "arrived", "started", "delivered", "finished", "cancelled", "no_captain", "reassigning" };

    public static bool IsActive(Ride r) => r.Status is RideStatus.Accepted or RideStatus.Arrived or RideStatus.Started;

    public static object? CaptainLocation(Captain? c) =>
        c?.LastLat is null ? null : new { lat = c.LastLat, lng = c.LastLng, heading = c.LastHeading, at = c.LastPointAt ?? c.LastSeenAt };

    public static int? EtaMin(Ride r, Captain? c, double speedKmh)
    {
        if (c?.LastLat is null || !IsActive(r)) return null;
        var (lat, lng) = r.Status == RideStatus.Started ? (r.DropLat, r.DropLng) : (r.PickupLat, r.PickupLng);
        if (r.Status == RideStatus.Arrived) return 0;
        var km = Geo.HaversineKm(c.LastLat.Value, c.LastLng!.Value, lat, lng) * AreaService.RoadFactor;
        return Math.Max(1, (int)Math.Ceiling(km / speedKmh * 60));
    }

    /// <summary>Ride as the RIDER sees it (contract "Ride").</summary>
    public static object ForRider(Ride r, string publicBaseUrl, double speedKmh)
    {
        var c = r.Captain;
        var active = IsActive(r);
        return new
        {
            id = r.Id,
            clientId = r.ClientId,
            service = r.Service,
            status = r.Status,
            townId = r.TownId,
            pickup = Pickup(r),
            drop = Drop(r),
            distanceKm = r.DistanceKm,
            fareQuoted = r.FareQuoted,
            fareFinal = r.FareFinal,
            night = r.Night,
            payment = r.Payment,
            otp = r.Status == RideStatus.Searching ? null : r.Otp,
            captain = c is null ? null : new
            {
                name = c.User?.Name ?? "",
                phone = active ? c.User?.Phone : null,
                vehicleNo = c.VehicleNo,
                vehicleModel = c.VehicleModel,
                rating = c.Rating,
                photoUrl = (string?)null,
                location = active ? CaptainLocation(c) : null,
                etaMin = EtaMin(r, c, speedKmh),
            },
            trackUrl = $"{publicBaseUrl.TrimEnd('/')}/t/{r.TrackToken}",
            parcel = !r.IsParcel ? null : new
            {
                receiverName = r.ReceiverName,
                receiverPhone = r.ReceiverPhone,
                size = r.ParcelSize,
                payer = r.ParcelPayer,
                deliveryOtp = r.DeliveryOtp,
                photoUrl = r.ParcelPhotoFileId is null ? null : FileStorage.Url(r.ParcelPhotoFileId),
                codAmount = r.CodAmount,
                delivered = r.DeliveryOtpVerified,
            },
            bookedFor = r.BookedForName is null && r.BookedForPhone is null ? null : new { name = r.BookedForName, phone = r.BookedForPhone },
            events = r.Events.Where(e => RiderEventTypes.Contains(e.Type)).OrderBy(e => e.At).ThenBy(e => e.Id)
                .Select(e => new { type = e.Type, at = e.At, fee = e.Fee }).ToList(),
            rating = r.Rating,
            cancelFee = r.CancelFee,
            createdAt = r.CreatedAt,
        };
    }

    public static object ForOffer(Offer o, Ride r, DateTime now) => new
    {
        id = o.Id,
        rideId = r.Id,
        service = r.Service,
        pickup = Pickup(r),
        drop = Drop(r),
        distanceToPickupKm = Geo.Round1(o.DistanceToPickupKm),
        tripKm = r.DistanceKm,
        fare = r.FareQuoted,
        payment = r.Payment,
        parcel = r.IsParcel ? new { size = r.ParcelSize, payer = r.ParcelPayer } : null,
        expiresAt = o.ExpiresAt,
        secondsLeft = Math.Max(0, (int)Math.Ceiling((o.ExpiresAt - now).TotalSeconds)),
    };

    /// <summary>Trip as the CAPTAIN sees it after accepting.</summary>
    public static object ForCaptain(Ride r, CommissionResult commission)
    {
        var active = IsActive(r);
        var riderName = r.BookedForName ?? r.Rider?.Name ?? "";
        var riderPhone = r.BookedForPhone ?? r.Rider?.Phone;
        var fare = r.FareFinal ?? r.FareQuoted;
        return new
        {
            rideId = r.Id,
            status = r.Status,
            service = r.Service,
            pickup = Pickup(r),
            drop = Drop(r),
            rider = new { name = riderName, phone = active ? riderPhone : null },
            fare,
            fareQuoted = r.FareQuoted,
            fareFinal = r.FareFinal,
            payment = r.Payment,
            tripKm = r.TripKmGps ?? r.DistanceKm,
            commission = new { pct = commission.Pct, amount = commission.Commission, captainGets = commission.CaptainGets, rule = commission.Reason },
            parcel = !r.IsParcel ? null : new
            {
                size = r.ParcelSize,
                receiverName = r.ReceiverName,
                receiverPhone = active ? r.ReceiverPhone : null,
                payer = r.ParcelPayer,
                codAmount = r.CodAmount,
                delivered = r.DeliveryOtpVerified,
            },
            collected = r.CollectedAt != null,
        };
    }

    /// <summary>Owner-portal status vocabulary (mock/rides.js).</summary>
    public static string AdminStatus(string s) => s switch
    {
        RideStatus.Accepted or RideStatus.Arrived => "assigned",
        RideStatus.Started => "on_trip",
        RideStatus.NoCaptain => "unfulfilled",
        _ => s,
    };

    public static double? PickupMinutes(Ride r) =>
        r.ArrivedAt is { } a && r.Status is RideStatus.Started or RideStatus.Finished ? Math.Round((a - r.CreatedAt).TotalMinutes, 1) : null;

    /// <summary>Ride/parcel as the owner portal sees it (same fields as mock/rides.js).</summary>
    public static Dictionary<string, object?> ForAdmin(Ride r)
    {
        var d = new Dictionary<string, object?>
        {
            ["id"] = r.Id,
            ["kind"] = r.IsParcel ? "parcel" : "ride",
            ["service"] = r.Service,
            ["townId"] = r.TownId,
            ["riderName"] = r.Rider?.Name ?? "",
            ["riderPhone"] = r.Rider?.Phone ?? "",
            ["bookedFor"] = r.BookedForName is null && r.BookedForPhone is null ? null : new { name = r.BookedForName, phone = r.BookedForPhone },
            ["bookedVia"] = r.BookedVia,
            ["captainId"] = r.CaptainId,
            ["pickup"] = Pickup(r),
            ["drop"] = Drop(r),
            ["distanceKm"] = r.DistanceKm,
            ["fareQuoted"] = r.FareQuoted,
            ["fareFinal"] = r.FareFinal,
            ["night"] = r.Night,
            ["payment"] = r.PaidMethod ?? r.Payment,
            ["paid"] = r.Paid,
            ["status"] = AdminStatus(r.Status),
            ["rideStatus"] = r.Status,
            ["requestedAt"] = r.CreatedAt,
            ["finishedAt"] = r.FinishedAt,
            ["pickupMinutes"] = PickupMinutes(r),
            ["rating"] = r.Rating,
            ["tip"] = r.Tip,
            ["otp"] = r.Otp,
            ["tripKmGps"] = r.TripKmGps,
            ["commissionPct"] = r.CommissionPct,
            ["commission"] = r.CommissionAmount,
            ["commissionRule"] = r.CommissionRule,
            ["cancelFee"] = r.CancelFee,
            ["events"] = r.Events.OrderBy(e => e.At).ThenBy(e => e.Id).Select(e => new { type = e.Type, at = e.At, by = e.By, reason = e.Reason, fee = e.Fee }).ToList(),
        };
        if (r.IsParcel)
        {
            d["sender"] = new { name = r.Rider?.Name ?? "", phone = r.Rider?.Phone ?? "" };
            d["receiver"] = new { name = r.ReceiverName, phone = r.ReceiverPhone };
            d["size"] = r.ParcelSize;
            d["payer"] = r.ParcelPayer;
            d["photos"] = new { pickup = r.PickupPhotoFileId != null || r.ParcelPhotoFileId != null, delivery = r.DeliveryPhotoFileId != null };
            d["photoUrls"] = new { parcel = r.ParcelPhotoFileId is null ? null : FileStorage.Url(r.ParcelPhotoFileId), pickup = r.PickupPhotoFileId is null ? null : FileStorage.Url(r.PickupPhotoFileId), delivery = r.DeliveryPhotoFileId is null ? null : FileStorage.Url(r.DeliveryPhotoFileId) };
            d["codAmount"] = r.CodAmount;
            d["codCollected"] = r.CodCollected;
            d["pickupOtpVerified"] = r.PickupOtpVerified;
            d["deliveryOtpVerified"] = r.DeliveryOtpVerified;
        }
        return d;
    }

    public record CaptainStats(int Trips, int TripsToday);

    /// <summary>Captain as the owner portal sees it (same fields as mock/captains.js + checks/files).</summary>
    public static Dictionary<string, object?> ForAdmin(Captain c, CaptainStats stats, List<Check>? checks = null)
    {
        var docs = KycRules.ToDocs(c, c.Documents);
        var files = c.Documents.GroupBy(d => d.Kind)
            .ToDictionary(g => g.Key, g => FileStorage.Url(g.OrderByDescending(d => d.UploadedAt).First().FileId));
        return new Dictionary<string, object?>
        {
            ["id"] = c.Id,
            ["userId"] = c.UserId,
            ["name"] = c.User?.Name ?? "",
            ["nameTe"] = c.NameTe,
            ["phone"] = c.User?.Phone ?? "",
            ["vehicleType"] = c.VehicleType,
            ["vehicleModel"] = c.VehicleModel,
            ["vehicleNo"] = c.VehicleNo,
            ["townId"] = c.TownId,
            ["status"] = c.Status,
            ["online"] = c.Online,
            ["joinedAt"] = c.JoinedAt.ToString("yyyy-MM-dd"),
            ["rating"] = c.Rating,
            ["trips"] = stats.Trips,
            ["tripsToday"] = stats.TripsToday,
            ["verificationScore"] = c.VerificationScore,
            ["lang"] = c.User?.Lang ?? "te",
            ["docs"] = docs,
            ["files"] = files,
            ["checks"] = checks,
            ["rejectReason"] = c.RejectReason,
            ["blockReason"] = c.BlockReason,
            ["pos"] = c.LastLat is null ? null : new { lat = c.LastLat, lng = c.LastLng },
            ["heading"] = c.LastHeading,
            ["lastSeenAt"] = c.LastSeenAt,
            ["isDemo"] = c.IsDemo,
        };
    }

    /// <summary>KYC status per document for the captain app.</summary>
    public static object KycSummary(Captain c)
    {
        var k = c.Kyc ?? new CaptainKyc();
        bool Up(string kind) => c.Documents.Any(d => d.Kind == kind);
        var verified = c.Status == CaptainStatus.Verified;
        string S(string kind) => !Up(kind) ? "missing" : verified ? "verified" : "uploaded";
        var needsConsent = k.RcOwnerIsCaptain == false;
        return new
        {
            aadhaar = S("aadhaar"),
            dl = S("dl"),
            rc = S("rc"),
            selfie = S("selfie"),
            bank = !Up("bank") && k.BankUpi is null && k.BankAccountLast4 is null ? "missing" : verified ? "verified" : "uploaded",
            ownerConsent = !needsConsent ? "not_needed" : Up("owner_consent") || k.ConsentLetter ? "uploaded" : "missing",
        };
    }
}
