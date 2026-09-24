package com.manabandi.rider.data

import androidx.annotation.StringRes
import com.manabandi.rider.R
import com.manabandi.rider.data.api.Landmark
import com.manabandi.rider.data.api.Place
import java.text.ParseException
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone
import kotlin.math.roundToInt

/** What the rider books. [apiName] is the contract value (`bike` / `auto` / `parcel`). */
enum class Service(val emoji: String, val apiName: String) {
    BIKE("🏍️", "bike"),
    AUTO("🛺", "auto"),
    PARCEL("📦", "parcel");

    companion object {
        fun fromApi(name: String?): Service = entries.firstOrNull { it.apiName == name } ?: BIKE
    }
}

enum class Payment(val apiName: String) {
    CASH("cash"),
    UPI("upi")
}

/** Parcel size; [apiCode] is the contract value `s` / `m` / `l`. */
enum class ParcelSize(val emoji: String, @StringRes val labelRes: Int, val apiCode: String) {
    SMALL("🍱", R.string.size_small, "s"),
    MEDIUM("📦", R.string.size_medium, "m"),
    BIG("🧳", R.string.size_big, "l")
}

/** Who pays for a parcel; [apiName] is the contract value `sender` / `receiver`. */
enum class Payer(val apiName: String) {
    ME("sender"),
    RECEIVER("receiver")
}

/** Names we send for points that are not a town landmark (contract: "GPS pin"). */
object PinNames {
    const val GPS = "GPS pin"
    const val GPS_TE = "మీరున్న చోటు"
    const val MAP = "Map pin"
    const val MAP_TE = "మ్యాప్‌లో చోటు"
}

/** Picture for a landmark chip, from the town's landmark `kind`. */
fun landmarkEmoji(kind: String): String = when (kind.lowercase()) {
    "bus", "bus_stand", "busstand", "bus stand" -> "🚌"
    "hospital", "clinic", "phc" -> "🏥"
    "market", "shop", "shops" -> "🛒"
    "temple", "mosque", "church", "dargah" -> "🛕"
    "school", "college" -> "🏫"
    "rail", "railway", "station", "train" -> "🚉"
    "office", "govt", "mro", "police" -> "🏛️"
    "bank", "atm" -> "🏦"
    "home" -> "🏠"
    else -> "📍"
}

/** Telugu name in Telugu, English name otherwise (the backend has only these two). */
fun Landmark.displayName(language: String): String =
    if (language == "te" && nameTe.isNotBlank()) nameTe else nameEn.ifBlank { nameTe }

/** True for a GPS / map-tap point (no landmark); the UI shows a translated label instead. */
fun Place.isPin(): Boolean = landmarkId == null && (name == PinNames.GPS || name == PinNames.MAP)

/** Name of a place in the app language ([pinLabel] is used for GPS / map pins). */
fun Place.displayName(language: String, pinLabel: String): String {
    val telugu: String = nameTe ?: ""
    return when {
        isPin() -> pinLabel
        language == "te" && telugu.isNotBlank() -> telugu
        name.isNotBlank() -> name
        telugu.isNotBlank() -> telugu
        else -> pinLabel
    }
}

/** Place for a landmark (the landmark's own coordinates). */
fun Landmark.toPlace(): Place = Place(lat = lat, lng = lng, name = nameEn.ifBlank { nameTe }, nameTe = nameTe, landmarkId = id)

/** "4.2" below 10 km, "12" above (distances come from the server in km). */
fun formatKm(km: Double): String =
    if (km >= 10) km.roundToInt().toString() else String.format(Locale.US, "%.1f", km)

/** ISO-8601 UTC time from the server ("2026-09-12T10:22:33Z") as local "12/09  10:22". */
fun formatIsoTime(iso: String?): String {
    if (iso.isNullOrBlank() || iso.length < 19) return ""
    return try {
        val parser = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US)
        parser.timeZone = TimeZone.getTimeZone("UTC")
        val date = parser.parse(iso.substring(0, 19)) ?: return ""
        SimpleDateFormat("dd/MM  HH:mm", Locale.US).format(date)
    } catch (e: ParseException) {
        ""
    }
}
