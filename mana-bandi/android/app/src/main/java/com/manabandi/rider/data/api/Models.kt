package com.manabandi.rider.data.api

import kotlinx.serialization.Serializable

/*
 * Wire models for API contract v1 (mana-bandi/docs/07-API.md). Property names ARE the JSON
 * field names (camelCase). Enum-like values (service, status, payment, …) are kept as plain
 * strings so a new value from the server never crashes an old app; see the constants below.
 * This file is identical in the rider and the captain app (only the package differs).
 */

// ---------------------------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------------------------

/** RFC 7807 problem JSON: `{ "title": "…", "status": 422, "code": "outside_area" }`. */
@Serializable
data class Problem(
    val title: String? = null,
    val status: Int? = null,
    val code: String? = null
)

@Serializable
data class OkResponse(val ok: Boolean = false)

// ---------------------------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------------------------

object Roles {
    const val RIDER = "rider"
    const val CAPTAIN = "captain"
}

/** POST /api/auth/otp/request */
@Serializable
data class OtpRequestBody(
    val phone: String,
    val role: String,
    val channel: String = "sms",   // "sms" | "call"
    val lang: String = "te"
)

@Serializable
data class OtpRequestResponse(
    val sent: Boolean = false,
    val expiresInSec: Int = 300,
    /** Only when the server runs with Otp:DevMode=true (testing). Never in production. */
    val devCode: String? = null
)

/** POST /api/auth/otp/verify */
@Serializable
data class OtpVerifyBody(
    val phone: String,
    val role: String,
    val code: String,
    val name: String? = null,
    val lang: String? = null
)

@Serializable
data class User(
    val id: String = "",
    val role: String = "",
    val phone: String = "",
    val name: String? = null,
    val lang: String? = null,
    val termsVersionAccepted: String? = null,
    /** Latest terms version published by the owner; the app must accept exactly this one. */
    val termsCurrentVersion: String? = null,
    val termsRequired: Boolean? = null,
    val townId: String? = null
)

@Serializable
data class AuthResponse(
    val token: String,
    val user: User,
    val captain: CaptainMe? = null
)

/** POST /api/me/terms */
@Serializable
data class TermsBody(val version: String)

/** PUT /api/me */
@Serializable
data class UpdateMeBody(
    val name: String? = null,
    val lang: String? = null,
    val trustedContactPhone: String? = null
)

// ---------------------------------------------------------------------------------------------
// Shared objects
// ---------------------------------------------------------------------------------------------

@Serializable
data class LatLng(val lat: Double, val lng: Double)

@Serializable
data class Landmark(
    val id: String = "",
    val kind: String = "",          // "bus", "hospital", "market", "temple", "school", …
    val nameTe: String = "",
    val nameEn: String = "",
    val lat: Double,
    val lng: Double
)

/** Public subset of a town used by the apps. */
@Serializable
data class Town(
    val id: String = "",
    val nameEn: String = "",
    val nameTe: String = "",
    val center: LatLng? = null,
    val radiusKm: Double = 0.0,
    val extendedRadiusKm: Double = 0.0,
    val supportPhone: String? = null,
    val landmarks: List<Landmark> = emptyList()
)

/** A pickup or drop point. [landmarkId] is set when the point is a town landmark. */
@Serializable
data class Place(
    val lat: Double,
    val lng: Double,
    val name: String = "",
    val nameTe: String? = null,
    val landmarkId: String? = null
)

object Services {
    const val BIKE = "bike"
    const val AUTO = "auto"
    const val PARCEL = "parcel"
}

object Payments {
    const val CASH = "cash"
    const val UPI = "upi"
}

object RideStatus {
    const val SEARCHING = "searching"
    const val ACCEPTED = "accepted"
    const val ARRIVED = "arrived"
    const val STARTED = "started"
    const val FINISHED = "finished"
    const val CANCELLED = "cancelled"
    const val NO_CAPTAIN = "no_captain"

    /** Statuses after which the ride will not change any more. */
    val TERMINAL = setOf(FINISHED, CANCELLED, NO_CAPTAIN)
}

@Serializable
data class CaptainLocation(
    val lat: Double,
    val lng: Double,
    val heading: Double? = null,
    val at: String? = null
)

/** The captain as the RIDER sees them. */
@Serializable
data class RideCaptain(
    val name: String = "",
    val phone: String = "",
    val vehicleNo: String = "",
    val vehicleModel: String? = null,
    val rating: Double? = null,
    val photoUrl: String? = null,
    val location: CaptainLocation? = null,
    val etaMin: Int? = null
)

@Serializable
data class RideParcel(
    val receiverName: String = "",
    val receiverPhone: String = "",
    val size: String = "m",          // "s" | "m" | "l"
    val payer: String = "sender",    // "sender" | "receiver"
    val deliveryOtp: String? = null,
    val photoUrl: String? = null
)

@Serializable
data class RideEvent(
    val type: String = "",
    val at: String? = null
)

/** A ride as the RIDER sees it. */
@Serializable
data class Ride(
    val id: String,
    val clientId: String? = null,
    val service: String = Services.BIKE,
    val status: String = RideStatus.SEARCHING,
    val townId: String? = null,
    val pickup: Place,
    val drop: Place,
    val distanceKm: Double = 0.0,
    val fareQuoted: Int = 0,
    val fareFinal: Int? = null,
    val night: Boolean = false,
    val payment: String = Payments.CASH,
    /** Ride OTP the rider tells the captain (for parcels: the pickup OTP). Shown once accepted. */
    val otp: String? = null,
    val captain: RideCaptain? = null,
    val trackUrl: String? = null,
    val parcel: RideParcel? = null,
    val events: List<RideEvent> = emptyList(),
    val createdAt: String? = null
)

// ---------------------------------------------------------------------------------------------
// Rider endpoints
// ---------------------------------------------------------------------------------------------

/** GET /api/rider/towns/nearest?lat=&lng= */
@Serializable
data class NearestTownResponse(
    val town: Town? = null,
    val inside: Boolean = false,
    val distanceKm: Double = 0.0
)

/** POST /api/rider/quote */
@Serializable
data class QuoteBody(
    val service: String,
    val pickup: Place,
    val drop: Place,
    val parcelSize: String? = null
)

@Serializable
data class QuoteResponse(
    val townId: String? = null,
    val distanceKm: Double = 0.0,
    val fare: Int = 0,
    val night: Boolean = false,
    val etaPickupMin: Int? = null
)

@Serializable
data class BookedFor(val name: String, val phone: String)

@Serializable
data class ParcelBody(
    val receiverName: String,
    val receiverPhone: String,
    val size: String,
    val payer: String
)

/** POST /api/rides — idempotent on [clientId]. */
@Serializable
data class CreateRideBody(
    val clientId: String,
    val service: String,
    val pickup: Place,
    val drop: Place,
    val payment: String,
    val bookedFor: BookedFor? = null,
    val parcel: ParcelBody? = null
)

/** POST /api/rides/{id}/cancel and POST /api/captain/trip/cancel */
@Serializable
data class CancelBody(val reason: String)

/** POST /api/rides/{id}/rate */
@Serializable
data class RateBody(val stars: Int, val tip: Int? = null)

/** POST /api/rides/{id}/sos */
@Serializable
data class SosBody(val lat: Double, val lng: Double)

/** Response of the photo uploads (parcel photo, trip photo). */
@Serializable
data class PhotoUrlResponse(val photoUrl: String? = null)

// ---------------------------------------------------------------------------------------------
// Captain objects and endpoints
// ---------------------------------------------------------------------------------------------

object CaptainStatus {
    const val PENDING = "pending"
    const val VERIFIED = "verified"
    const val REJECTED = "rejected"
    const val BLOCKED = "blocked"
}

object KycState {
    const val MISSING = "missing"
    const val UPLOADED = "uploaded"
    const val VERIFIED = "verified"
    const val NOT_NEEDED = "not_needed"
}

@Serializable
data class Kyc(
    val aadhaar: String = KycState.MISSING,
    val dl: String = KycState.MISSING,
    val rc: String = KycState.MISSING,
    val selfie: String = KycState.MISSING,
    val bank: String = KycState.MISSING,
    val ownerConsent: String = KycState.NOT_NEEDED
)

/** CaptainMe.commission — the owner-configured rule that applies to this captain. */
@Serializable
data class CommissionInfo(
    val pct: Double = 0.0,
    val freeMonths: Int = 0,
    val freePct: Double = 0.0,
    val currentPct: Double = 0.0
)

@Serializable
data class CaptainMe(
    val id: String = "",
    val status: String = CaptainStatus.PENDING,
    val vehicleType: String? = null,     // "bike" | "auto"
    val vehicleNo: String? = null,
    val townId: String? = null,
    val online: Boolean = false,
    val kyc: Kyc = Kyc(),
    val commission: CommissionInfo = CommissionInfo(),
    /*
     * Not in contract v1's CaptainMe: the owner portal stores these on the captain
     * (owner-web api.js, reject/block). Shown when the backend includes them, otherwise null.
     */
    val rejectReason: String? = null,
    val blockReason: String? = null
)

/** PUT /api/captain/vehicle */
@Serializable
data class VehicleBody(
    val vehicleType: String,
    val vehicleNo: String,
    val vehicleModel: String? = null
)

/** POST /api/captain/online */
@Serializable
data class OnlineBody(
    val online: Boolean,
    val lat: Double? = null,
    val lng: Double? = null
)

/** One GPS fix in the heartbeat. [at] is an ISO-8601 UTC time. */
@Serializable
data class LocationPoint(
    val lat: Double,
    val lng: Double,
    val accuracy: Double? = null,
    val speed: Double? = null,
    val heading: Double? = null,
    val at: String
)

/** POST /api/captain/location — 1–20 points, oldest first. */
@Serializable
data class HeartbeatBody(val points: List<LocationPoint>)

/** An offer as the CAPTAIN sees it. */
@Serializable
data class Offer(
    val id: String,
    val rideId: String = "",
    val service: String = Services.BIKE,
    val pickup: Place,
    val drop: Place,
    val distanceToPickupKm: Double = 0.0,
    val tripKm: Double = 0.0,
    val fare: Int = 0,
    val payment: String = Payments.CASH,
    val expiresAt: String? = null,
    val secondsLeft: Int = 15
)

@Serializable
data class TripRider(
    val name: String = "",
    val phone: String = ""
)

@Serializable
data class TripCommission(
    val pct: Double = 0.0,
    val amount: Int = 0,
    val captainGets: Int = 0,
    val rule: String? = null
)

@Serializable
data class TripParcel(
    val size: String = "m",
    val receiverName: String = "",
    val receiverPhone: String = "",
    val payer: String = "sender",
    val codAmount: Int = 0
)

/** The trip as the CAPTAIN sees it after accepting. */
@Serializable
data class Trip(
    val rideId: String,
    val status: String = RideStatus.ACCEPTED,
    val service: String = Services.BIKE,
    val pickup: Place,
    val drop: Place,
    val rider: TripRider = TripRider(),
    val fare: Int = 0,
    /** Set by POST /api/captain/trip/finish ("Trip with fareFinal and commission"). */
    val fareFinal: Int? = null,
    val payment: String = Payments.CASH,
    val tripKm: Double = 0.0,
    val commission: TripCommission? = null,
    val parcel: TripParcel? = null
)

/** Response of the heartbeat. */
@Serializable
data class HeartbeatResponse(
    val online: Boolean = false,
    val offer: Offer? = null,
    val trip: Trip? = null,
    val serverTime: String? = null
)

/** POST /api/captain/trip/start — for parcels this is the pickup OTP. */
@Serializable
data class StartTripBody(val otp: String)

/** POST /api/captain/trip/finish */
@Serializable
data class FinishTripBody(val lat: Double, val lng: Double)

/** POST /api/captain/trip/deliver (parcels, before finish) */
@Serializable
data class DeliverBody(val deliveryOtp: String)

/** POST /api/captain/trip/collected */
@Serializable
data class CollectedBody(val method: String)

@Serializable
data class CollectedResponse(
    val ok: Boolean = false,
    val earningsToday: Int = 0,
    val tripsToday: Int = 0
)

@Serializable
data class EarningsPeriod(
    val gross: Int = 0,
    val commission: Int = 0,
    val net: Int = 0,
    val trips: Int = 0
)

@Serializable
data class EarningsTrip(
    val rideId: String = "",
    val service: String = Services.BIKE,
    val dropName: String = "",
    val fare: Int = 0,
    val commission: Int = 0,
    val payment: String = Payments.CASH,
    val finishedAt: String? = null
)

/** GET /api/captain/earnings */
@Serializable
data class Earnings(
    val today: EarningsPeriod = EarningsPeriod(),
    val week: EarningsPeriod = EarningsPeriod(),
    val settlementDue: Int = 0,
    val commission: CommissionInfo = CommissionInfo(),
    val trips: List<EarningsTrip> = emptyList()
)
