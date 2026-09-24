using System.ComponentModel.DataAnnotations;

namespace ManaBandi.Api.Models;

public static class Roles
{
    public const string Rider = "rider";
    public const string Captain = "captain";
    public const string Owner = "owner";
    public const string TownManager = "town_manager";
    public static bool IsAdmin(string? role) => role is Owner or TownManager;
}

public static class RideStatus
{
    public const string Searching = "searching";
    public const string Accepted = "accepted";
    public const string Arrived = "arrived";
    public const string Started = "started";
    public const string Finished = "finished";
    public const string Cancelled = "cancelled";
    public const string NoCaptain = "no_captain";
    public static readonly string[] Active = { Accepted, Arrived, Started };
    public static readonly string[] NonTerminal = { Searching, Accepted, Arrived, Started };
    public static bool IsTerminal(string s) => s is Finished or Cancelled or NoCaptain;
}

public static class CaptainStatus
{
    public const string Pending = "pending";
    public const string Verified = "verified";
    public const string Rejected = "rejected";
    public const string Blocked = "blocked";
}

/// <summary>Riders, captains (phone login) and portal users (email + password).</summary>
public class User
{
    [MaxLength(40)] public string Id { get; set; } = "";
    [MaxLength(16)] public string? Phone { get; set; }
    [MaxLength(200)] public string? Email { get; set; }
    [MaxLength(20)] public string Role { get; set; } = Roles.Rider;
    [MaxLength(100)] public string Name { get; set; } = "";
    [MaxLength(8)] public string Lang { get; set; } = "te";
    [MaxLength(16)] public string? TrustedContactPhone { get; set; }
    [MaxLength(400)] public string? PasswordHash { get; set; }
    [MaxLength(40)] public string? TownId { get; set; }
    public bool Disabled { get; set; }
    public bool IsDemo { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? LastLoginAt { get; set; }
}

public class OtpCode
{
    public long Id { get; set; }
    [MaxLength(16)] public string Phone { get; set; } = "";
    [MaxLength(20)] public string Role { get; set; } = "";
    [MaxLength(128)] public string CodeHash { get; set; } = "";
    public int Attempts { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime ExpiresAt { get; set; }
    public DateTime? ConsumedAt { get; set; }
    [MaxLength(64)] public string? Ip { get; set; }
    [MaxLength(8)] public string Channel { get; set; } = "sms";
}

public class Consent
{
    public long Id { get; set; }
    [MaxLength(40)] public string UserId { get; set; } = "";
    [MaxLength(40)] public string Kind { get; set; } = "";
    [MaxLength(20)] public string Version { get; set; } = "";
    public DateTime At { get; set; }
    [MaxLength(64)] public string? Ip { get; set; }
    [MaxLength(40)] public string? AppVersion { get; set; }
}

public class Fare
{
    public int Base { get; set; }
    public double PerKm { get; set; }
    public int Min { get; set; }
    public int NightPct { get; set; }
}

public class Town
{
    [MaxLength(40)] public string Id { get; set; } = "";
    [MaxLength(100)] public string NameEn { get; set; } = "";
    [MaxLength(100)] public string NameTe { get; set; } = "";
    [MaxLength(100)] public string District { get; set; } = "";
    [MaxLength(100)] public string State { get; set; } = "Telangana";
    public bool Enabled { get; set; }
    public double CenterLat { get; set; }
    public double CenterLng { get; set; }
    public double RadiusKm { get; set; }
    public double ExtendedRadiusKm { get; set; }
    public bool EnforceRadius { get; set; } = true;
    [MaxLength(5)] public string NightStart { get; set; } = "22:00";
    [MaxLength(5)] public string NightEnd { get; set; } = "05:00";
    [MaxLength(30)] public string SupportPhone { get; set; } = "";
    [MaxLength(30)] public string MissedCallNo { get; set; } = "";
    public DateOnly? LaunchedAt { get; set; }
    /// <summary>Fares per service ("bike", "auto", "parcel"), stored as jsonb.</summary>
    public Dictionary<string, Fare> Fares { get; set; } = new();
    public List<Landmark> Landmarks { get; set; } = new();
    public DateTime CreatedAt { get; set; }
    public uint Version { get; set; }
}

public class Landmark
{
    [MaxLength(40)] public string Id { get; set; } = "";
    [MaxLength(40)] public string TownId { get; set; } = "";
    [MaxLength(20)] public string Kind { get; set; } = "other";
    [MaxLength(120)] public string NameTe { get; set; } = "";
    [MaxLength(120)] public string NameEn { get; set; } = "";
    public double Lat { get; set; }
    public double Lng { get; set; }
    public int SortOrder { get; set; }
}

public class Captain
{
    [MaxLength(40)] public string Id { get; set; } = "";
    [MaxLength(40)] public string UserId { get; set; } = "";
    public User? User { get; set; }
    [MaxLength(100)] public string NameTe { get; set; } = "";
    [MaxLength(20)] public string Status { get; set; } = CaptainStatus.Pending;
    [MaxLength(10)] public string VehicleType { get; set; } = "bike";
    [MaxLength(20)] public string VehicleNo { get; set; } = "";
    [MaxLength(60)] public string VehicleModel { get; set; } = "";
    [MaxLength(40)] public string? TownId { get; set; }
    public bool Online { get; set; }
    public double? LastLat { get; set; }
    public double? LastLng { get; set; }
    public double? LastHeading { get; set; }
    public DateTime? LastSeenAt { get; set; }
    public DateTime? LastPointAt { get; set; }
    public double? Rating { get; set; }
    public int RatingCount { get; set; }
    public DateOnly JoinedAt { get; set; }
    public DateTime? ApprovedAt { get; set; }
    [MaxLength(20)] public string PoliceStatus { get; set; } = "not_started";
    public int VerificationScore { get; set; }
    [MaxLength(300)] public string? RejectReason { get; set; }
    [MaxLength(300)] public string? BlockReason { get; set; }
    public bool IsDemo { get; set; }
    public DateTime CreatedAt { get; set; }
    public CaptainKyc? Kyc { get; set; }
    public List<CaptainDocument> Documents { get; set; } = new();
    public uint Version { get; set; }
}

/// <summary>Extracted KYC fields (typed by the office or returned by a KYC provider). Never a full Aadhaar number.</summary>
public class CaptainKyc
{
    [MaxLength(40)] public string CaptainId { get; set; } = "";
    [MaxLength(40)] public string Provider { get; set; } = "manual";
    [MaxLength(4)] public string? AadhaarLast4 { get; set; }
    [MaxLength(100)] public string? AadhaarName { get; set; }
    public DateOnly? AadhaarDob { get; set; }
    [MaxLength(60)] public string? AadhaarVerifiedVia { get; set; }
    [MaxLength(40)] public string? DlNumber { get; set; }
    [MaxLength(100)] public string? DlName { get; set; }
    public DateOnly? DlValidTill { get; set; }
    [MaxLength(40)] public string? DlClass { get; set; }
    public int? NameMatchScore { get; set; }
    [MaxLength(20)] public string? RcNumber { get; set; }
    [MaxLength(100)] public string? RcOwnerName { get; set; }
    [MaxLength(40)] public string? RcVehicleClass { get; set; }
    public DateOnly? RcValidTill { get; set; }
    public DateOnly? RcInsuranceTill { get; set; }
    public bool? RcOwnerIsCaptain { get; set; }
    public bool ConsentLetter { get; set; }
    [MaxLength(16)] public string? OwnerPhone { get; set; }
    public int? FaceMatchScore { get; set; }
    public bool? Liveness { get; set; }
    [MaxLength(100)] public string? BankUpi { get; set; }
    [MaxLength(11)] public string? BankIfsc { get; set; }
    [MaxLength(4)] public string? BankAccountLast4 { get; set; }
    /// <summary>Last computed check chips (json).</summary>
    public string? ChecksJson { get; set; }
    public DateTime? CheckedAt { get; set; }
    [MaxLength(40)] public string? DecidedBy { get; set; }
    public DateTime? DecidedAt { get; set; }
}

public class CaptainDocument
{
    public long Id { get; set; }
    [MaxLength(40)] public string CaptainId { get; set; } = "";
    [MaxLength(20)] public string Kind { get; set; } = "";
    [MaxLength(40)] public string FileId { get; set; } = "";
    [MaxLength(20)] public string Status { get; set; } = "uploaded";
    public DateTime UploadedAt { get; set; }
    [MaxLength(40)] public string? UploadedBy { get; set; }
}

public class StoredFile
{
    [MaxLength(40)] public string Id { get; set; } = "";
    [MaxLength(300)] public string Path { get; set; } = "";
    [MaxLength(40)] public string ContentType { get; set; } = "";
    public long Size { get; set; }
    [MaxLength(64)] public string Sha256 { get; set; } = "";
    [MaxLength(30)] public string Kind { get; set; } = "";
    [MaxLength(40)] public string? CaptainId { get; set; }
    [MaxLength(40)] public string? RideId { get; set; }
    [MaxLength(40)] public string? UploadedBy { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class Ride
{
    [MaxLength(40)] public string Id { get; set; } = "";
    [MaxLength(64)] public string ClientId { get; set; } = "";
    [MaxLength(40)] public string RiderId { get; set; } = "";
    public User? Rider { get; set; }
    [MaxLength(40)] public string TownId { get; set; } = "";
    [MaxLength(10)] public string Service { get; set; } = "bike";
    [MaxLength(20)] public string Status { get; set; } = RideStatus.Searching;
    public double PickupLat { get; set; }
    public double PickupLng { get; set; }
    [MaxLength(120)] public string PickupName { get; set; } = "";
    [MaxLength(120)] public string? PickupNameTe { get; set; }
    [MaxLength(40)] public string? PickupLandmarkId { get; set; }
    public double DropLat { get; set; }
    public double DropLng { get; set; }
    [MaxLength(120)] public string DropName { get; set; } = "";
    [MaxLength(120)] public string? DropNameTe { get; set; }
    [MaxLength(40)] public string? DropLandmarkId { get; set; }
    public double DistanceKm { get; set; }
    public int FareQuoted { get; set; }
    public int? FareFinal { get; set; }
    public double? TripKmGps { get; set; }
    public bool Night { get; set; }
    [MaxLength(10)] public string Payment { get; set; } = "cash";
    [MaxLength(10)] public string? PaidMethod { get; set; }
    public bool Paid { get; set; }
    [MaxLength(6)] public string Otp { get; set; } = "";
    [MaxLength(100)] public string? BookedForName { get; set; }
    [MaxLength(16)] public string? BookedForPhone { get; set; }
    [MaxLength(20)] public string BookedVia { get; set; } = "app";
    // parcel
    [MaxLength(2)] public string? ParcelSize { get; set; }
    [MaxLength(10)] public string? ParcelPayer { get; set; }
    [MaxLength(100)] public string? ReceiverName { get; set; }
    [MaxLength(16)] public string? ReceiverPhone { get; set; }
    [MaxLength(6)] public string? DeliveryOtp { get; set; }
    public bool PickupOtpVerified { get; set; }
    public bool DeliveryOtpVerified { get; set; }
    public int CodAmount { get; set; }
    public bool CodCollected { get; set; }
    [MaxLength(40)] public string? ParcelPhotoFileId { get; set; }
    [MaxLength(40)] public string? PickupPhotoFileId { get; set; }
    [MaxLength(40)] public string? DeliveryPhotoFileId { get; set; }
    // tracking / dispatch
    [MaxLength(16)] public string TrackToken { get; set; } = "";
    [MaxLength(40)] public string? CaptainId { get; set; }
    public Captain? Captain { get; set; }
    public DateTime SearchStartedAt { get; set; }
    // commission (frozen at finish)
    public double? CommissionPct { get; set; }
    public int? CommissionAmount { get; set; }
    [MaxLength(200)] public string? CommissionRule { get; set; }
    // rating
    public int? Rating { get; set; }
    public int Tip { get; set; }
    // cancellation
    [MaxLength(10)] public string? CancelledBy { get; set; }
    [MaxLength(200)] public string? CancelReason { get; set; }
    public int CancelFee { get; set; }
    // timestamps
    public DateTime CreatedAt { get; set; }
    public DateTime? AcceptedAt { get; set; }
    public DateTime? ArrivedAt { get; set; }
    public DateTime? StartedAt { get; set; }
    public DateTime? DeliveredAt { get; set; }
    public DateTime? FinishedAt { get; set; }
    public DateTime? CollectedAt { get; set; }
    public DateTime? CancelledAt { get; set; }
    public DateTime? EndedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public List<RideEvent> Events { get; set; } = new();
    public uint Version { get; set; }
    public bool IsParcel => Service == "parcel";
}

public class RideEvent
{
    public long Id { get; set; }
    [MaxLength(40)] public string RideId { get; set; } = "";
    [MaxLength(30)] public string Type { get; set; } = "";
    public DateTime At { get; set; }
    public double? Lat { get; set; }
    public double? Lng { get; set; }
    [MaxLength(20)] public string? By { get; set; }
    [MaxLength(200)] public string? Reason { get; set; }
    [MaxLength(40)] public string? CaptainId { get; set; }
    public int? Fee { get; set; }
}

public static class OfferStatus
{
    public const string Pending = "pending";
    public const string Accepted = "accepted";
    public const string Rejected = "rejected";
    public const string Expired = "expired";
    public const string Taken = "taken";
    public const string Cancelled = "cancelled";
}

public class Offer
{
    [MaxLength(40)] public string Id { get; set; } = "";
    [MaxLength(40)] public string RideId { get; set; } = "";
    public Ride? Ride { get; set; }
    [MaxLength(40)] public string CaptainId { get; set; } = "";
    public DateTime CreatedAt { get; set; }
    public DateTime ExpiresAt { get; set; }
    [MaxLength(20)] public string Status { get; set; } = OfferStatus.Pending;
    public double DistanceToPickupKm { get; set; }
    public int Round { get; set; }
    public DateTime? RespondedAt { get; set; }
}

public class LocationPoint
{
    public long Id { get; set; }
    [MaxLength(40)] public string CaptainId { get; set; } = "";
    [MaxLength(40)] public string? RideId { get; set; }
    public double Lat { get; set; }
    public double Lng { get; set; }
    public double? Accuracy { get; set; }
    public double? Speed { get; set; }
    public double? Heading { get; set; }
    public DateTime At { get; set; }
    public DateTime ReceivedAt { get; set; }
}

public class CommissionRule
{
    [MaxLength(40)] public string Id { get; set; } = "";
    /// <summary>default | service | town | town_service</summary>
    [MaxLength(20)] public string Scope { get; set; } = "default";
    [MaxLength(40)] public string? TownId { get; set; }
    /// <summary>bike | auto | parcel | all (town scope)</summary>
    [MaxLength(10)] public string? Service { get; set; }
    public double Pct { get; set; }
    public int FreeMonths { get; set; }
    public double FreePct { get; set; }
    public DateOnly? EffectiveFrom { get; set; }
    [MaxLength(20)] public string Status { get; set; } = "active";
    [MaxLength(200)] public string? Note { get; set; }
    [MaxLength(200)] public string? CreatedBy { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public int SortOrder { get; set; }
}

public class Settlement
{
    [MaxLength(80)] public string Id { get; set; } = "";
    [MaxLength(40)] public string CaptainId { get; set; } = "";
    public DateOnly PeriodStart { get; set; }
    public DateOnly PeriodEnd { get; set; }
    public int CashCollected { get; set; }
    public int UpiEarned { get; set; }
    public int Commission { get; set; }
    public int CodHeld { get; set; }
    public int Incentive { get; set; }
    public int Payout { get; set; }
    [MaxLength(20)] public string Status { get; set; } = "due";
    public DateTime? PaidAt { get; set; }
    [MaxLength(60)] public string? Utr { get; set; }
    [MaxLength(100)] public string? PaidBy { get; set; }
}

public class SosEvent
{
    [MaxLength(40)] public string Id { get; set; } = "";
    [MaxLength(40)] public string RideId { get; set; } = "";
    [MaxLength(40)] public string TownId { get; set; } = "";
    [MaxLength(10)] public string By { get; set; } = "rider";
    [MaxLength(40)] public string UserId { get; set; } = "";
    public double? Lat { get; set; }
    public double? Lng { get; set; }
    public DateTime At { get; set; }
    public bool Resolved { get; set; }
    public DateTime? ResolvedAt { get; set; }
    [MaxLength(100)] public string? ResolvedBy { get; set; }
    public bool ContactNotified { get; set; }
}

public class AuditEntry
{
    public long Id { get; set; }
    public DateTime At { get; set; }
    [MaxLength(100)] public string By { get; set; } = "";
    [MaxLength(40)] public string? ByUserId { get; set; }
    [MaxLength(60)] public string Action { get; set; } = "";
    [MaxLength(100)] public string Target { get; set; } = "";
    [MaxLength(500)] public string Detail { get; set; } = "";
    [MaxLength(40)] public string? TownId { get; set; }
    [MaxLength(64)] public string? Ip { get; set; }
}

public class CompanySettings
{
    public int Id { get; set; } = 1;
    [MaxLength(200)] public string LegalName { get; set; } = "";
    [MaxLength(200)] public string Brand { get; set; } = "";
    [MaxLength(20)] public string Gstin { get; set; } = "";
    [MaxLength(400)] public string Address { get; set; } = "";
    [MaxLength(200)] public string SupportEmail { get; set; } = "";
    [MaxLength(30)] public string SupportPhone { get; set; } = "";
    [MaxLength(30)] public string WhatsappNumber { get; set; } = "";
    public double CommissionPct { get; set; }
    public int FreeMonths { get; set; }
    public int IncentiveTripsPerDay { get; set; }
    public int IncentiveAmount { get; set; }
    public int OfferWindowSec { get; set; }
    public int DispatchRounds { get; set; }
    public double DispatchRadiusKm { get; set; }
}

public class TermsVersion
{
    public int Id { get; set; }
    [MaxLength(20)] public string Version { get; set; } = "";
    public DateOnly PublishedAt { get; set; }
    [MaxLength(100)] public string By { get; set; } = "";
    public string Te { get; set; } = "";
    public string En { get; set; } = "";
}

public class MessageTemplate
{
    [MaxLength(40)] public string Id { get; set; } = "";
    [MaxLength(20)] public string Channel { get; set; } = "sms";
    [MaxLength(60)] public string Key { get; set; } = "";
    public List<string> Langs { get; set; } = new();
    [MaxLength(20)] public string Status { get; set; } = "pending_review";
    [MaxLength(1000)] public string Te { get; set; } = "";
    [MaxLength(1000)] public string En { get; set; } = "";
}
