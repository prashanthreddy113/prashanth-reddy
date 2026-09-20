package com.manabandi.rider.data

import androidx.annotation.StringRes
import com.manabandi.rider.R
import kotlin.math.abs

enum class Service(val emoji: String) {
    BIKE("🏍️"),
    AUTO("🛺"),
    PARCEL("📦")
}

enum class Payment { CASH, UPI }

enum class ParcelSize(val emoji: String, @StringRes val labelRes: Int) {
    SMALL("🍱", R.string.size_small),
    MEDIUM("📦", R.string.size_medium),
    BIG("🧳", R.string.size_big)
}

enum class Payer { ME, RECEIVER }

data class SavedPlace(val emoji: String, @StringRes val labelRes: Int)

data class Captain(
    val name: String,
    val vehicleNumber: String,
    val phone: String,
    val rating: String
)

data class PastRide(
    val service: Service,
    val from: String,
    val to: String,
    val date: String,
    val fare: Int
)

/** Demo data and a fake fare model. Replace with a backend later. */
object FakeRides {

    val savedPlaces = listOf(
        SavedPlace("🏠", R.string.place_home),
        SavedPlace("🚌", R.string.place_bus),
        SavedPlace("🏥", R.string.place_hospital),
        SavedPlace("🛒", R.string.place_market)
    )

    val pastRides = listOf(
        PastRide(Service.AUTO, "Narayanakhed", "Zaheerabad", "12 Sep", 210),
        PastRide(Service.BIKE, "Bus stand", "Hospital", "9 Sep", 44),
        PastRide(Service.PARCEL, "Market", "Kangti", "3 Sep", 85)
    )

    private val captains = listOf(
        Captain("Srinivas", "TS 32 A 1234", "+919000000001", "4.8"),
        Captain("Mahesh", "TS 32 B 5678", "+919000000002", "4.9"),
        Captain("Abdul", "TS 32 C 9012", "+919000000003", "4.7")
    )

    fun randomCaptain(): Captain = captains.random()

    fun otp(): String = (1000..9999).random().toString()

    /** Fake distance derived from the drop text so the same place always costs the same. */
    fun distanceKm(drop: String): Int {
        if (drop.isBlank()) return 0
        return 2 + (abs(drop.trim().lowercase().hashCode()) % 9)   // 2..10 km
    }

    /** Base ₹20 + ₹8/km bike, ₹30 + ₹12/km auto, ₹25 + ₹10/km parcel. */
    fun fare(service: Service, km: Int): Int = when (service) {
        Service.BIKE -> 20 + 8 * km
        Service.AUTO -> 30 + 12 * km
        Service.PARCEL -> 25 + 10 * km
    }
}
