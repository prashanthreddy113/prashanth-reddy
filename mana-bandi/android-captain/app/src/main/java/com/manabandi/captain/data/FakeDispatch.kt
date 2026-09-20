package com.manabandi.captain.data

import androidx.annotation.StringRes
import com.manabandi.captain.R

enum class Service(val emoji: String) {
    BIKE("🏍️"),
    AUTO("🛺"),
    PARCEL("📦")
}

enum class Payment(val emoji: String) {
    CASH("💵"),
    UPI("📱")
}

/** What the captain drives. Chosen once on the KYC screen. */
enum class VehicleType(val emoji: String, @StringRes val labelRes: Int) {
    BIKE("🏍️", R.string.vehicle_bike),
    AUTO("🛺", R.string.vehicle_auto)
}

/** KYC checklist rows. Each one needs a photo (demo: kept in memory only). */
enum class KycDoc(val emoji: String, @StringRes val labelRes: Int) {
    AADHAAR("🪪", R.string.kyc_aadhaar),
    LICENCE("🚗", R.string.kyc_licence),
    RC("📄", R.string.kyc_rc),
    PHOTO("📷", R.string.kyc_photo),
    BANK("🏦", R.string.kyc_bank)
}

/**
 * One incoming ride request. Place names are string resources so the request
 * is shown (and spoken) in the captain's language.
 */
data class RideRequest(
    val id: Int,
    val service: Service,
    @StringRes val pickupNameRes: Int,
    @StringRes val dropNameRes: Int,
    val distanceToPickupKm: Int,
    val tripKm: Int,
    val fare: Int,
    val payment: Payment,
    val riderName: String,
    val riderPhone: String,
    val pickupLat: Double,
    val pickupLng: Double,
    val dropLat: Double,
    val dropLng: Double
)

/** A finished trip, shown on the Earnings screen. */
data class TripLogEntry(
    val service: Service,
    val time: String,
    @StringRes val dropNameRes: Int,
    val fare: Int,
    val payment: Payment
)

/** Fake dispatcher: rotates through three fixed requests around Narayanakhed. */
object FakeDispatch {

    /** First request arrives 4 s after going online, later ones 8 s after each trip. */
    const val FIRST_REQUEST_DELAY_MS = 4000L
    const val NEXT_REQUEST_DELAY_MS = 8000L

    /** Seconds the captain has to accept a request. */
    const val ACCEPT_SECONDS = 15

    /** Earnings before today, so the "this week" number is not zero in the demo. */
    const val WEEK_BEFORE_TODAY = 1840

    private val requests = listOf(
        RideRequest(
            id = 1,
            service = Service.BIKE,
            pickupNameRes = R.string.place_bus,
            dropNameRes = R.string.place_college,
            distanceToPickupKm = 2,
            tripKm = 3,
            fare = 45,
            payment = Payment.CASH,
            riderName = "Ramesh",
            riderPhone = "+919000000011",
            pickupLat = 18.0332, pickupLng = 77.7481,
            dropLat = 18.0421, dropLng = 77.7612
        ),
        RideRequest(
            id = 2,
            service = Service.AUTO,
            pickupNameRes = R.string.place_hospital,
            dropNameRes = R.string.place_temple,
            distanceToPickupKm = 1,
            tripKm = 5,
            fare = 90,
            payment = Payment.UPI,
            riderName = "Lakshmi",
            riderPhone = "+919000000012",
            pickupLat = 18.0298, pickupLng = 77.7525,
            dropLat = 18.0510, dropLng = 77.7390
        ),
        RideRequest(
            id = 3,
            service = Service.PARCEL,
            pickupNameRes = R.string.place_market,
            dropNameRes = R.string.place_bus,
            distanceToPickupKm = 3,
            tripKm = 4,
            fare = 65,
            payment = Payment.CASH,
            riderName = "Abdul",
            riderPhone = "+919000000013",
            pickupLat = 18.0350, pickupLng = 77.7440,
            dropLat = 18.0332, dropLng = 77.7481
        )
    )

    private var nextIndex = 0

    /** Returns the next fake request (bike from bus stand, auto from hospital, parcel from market, …). */
    fun next(): RideRequest {
        val request = requests[nextIndex % requests.size]
        nextIndex++
        return request
    }

    fun otp(): String = (1000..9999).random().toString()
}
