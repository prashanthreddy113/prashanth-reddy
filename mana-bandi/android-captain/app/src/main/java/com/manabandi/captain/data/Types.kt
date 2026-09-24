package com.manabandi.captain.data

import androidx.annotation.StringRes
import com.manabandi.captain.R
import com.manabandi.captain.data.api.Place
import java.text.ParseException
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone
import kotlin.math.roundToInt

/** Ride type. [apiName] is the contract value (`bike` / `auto` / `parcel`). */
enum class Service(val emoji: String, val apiName: String) {
    BIKE("🏍️", "bike"),
    AUTO("🛺", "auto"),
    PARCEL("📦", "parcel");

    companion object {
        fun fromApi(name: String?): Service = entries.firstOrNull { it.apiName == name } ?: BIKE
    }
}

enum class Payment(val emoji: String, val apiName: String) {
    CASH("💵", "cash"),
    UPI("📱", "upi");

    companion object {
        fun fromApi(name: String?): Payment = entries.firstOrNull { it.apiName == name } ?: CASH
    }
}

/** What the captain drives. Chosen on the KYC screen and sent with PUT /api/captain/vehicle. */
enum class VehicleType(val emoji: String, @StringRes val labelRes: Int, val apiName: String) {
    BIKE("🏍️", R.string.vehicle_bike, "bike"),
    AUTO("🛺", R.string.vehicle_auto, "auto");

    companion object {
        fun fromApi(name: String?): VehicleType? = entries.firstOrNull { it.apiName == name }
    }
}

/**
 * KYC checklist rows. [apiKind] is the `{kind}` of POST /api/captain/documents/{kind}.
 * OWNER_CONSENT is only shown when the server says the vehicle belongs to someone else.
 */
enum class KycDoc(val emoji: String, @StringRes val labelRes: Int, val apiKind: String) {
    AADHAAR("🪪", R.string.kyc_aadhaar, "aadhaar"),
    LICENCE("🚗", R.string.kyc_licence, "dl"),
    RC("📄", R.string.kyc_rc, "rc"),
    PHOTO("📷", R.string.kyc_photo, "selfie"),
    BANK("🏦", R.string.kyc_bank, "bank"),
    OWNER_CONSENT("✍️", R.string.kyc_owner_consent, "owner_consent")
}

/** Names the rider app sends for points that are not a town landmark. */
object PinNames {
    const val GPS = "GPS pin"
    const val MAP = "Map pin"
}

/** Name of a place in the app language ([pinLabel] for a rider's GPS / map pin). */
fun Place.displayName(language: String, pinLabel: String): String {
    val telugu: String = nameTe ?: ""
    val isPin = landmarkId == null && (name == PinNames.GPS || name == PinNames.MAP)
    return when {
        isPin -> pinLabel   // the rider's own words ("where I am") would be wrong for the captain
        language == "te" && telugu.isNotBlank() -> telugu
        name.isNotBlank() -> name
        telugu.isNotBlank() -> telugu
        else -> pinLabel
    }
}

/** "4.2" below 10 km, "12" above. */
fun formatKm(km: Double): String =
    if (km >= 10) km.roundToInt().toString() else String.format(Locale.US, "%.1f", km)

/** "10" for 10.0, "7.5" for 7.5 (commission percentages). */
fun formatPct(pct: Double): String =
    if (pct == pct.roundToInt().toDouble()) pct.roundToInt().toString() else String.format(Locale.US, "%.1f", pct)

/** Current time as ISO-8601 UTC ("2026-09-24T10:22:33Z"), for heartbeat points. */
fun isoUtc(millis: Long): String {
    val format = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US)
    format.timeZone = TimeZone.getTimeZone("UTC")
    return format.format(java.util.Date(millis))
}

/** ISO-8601 UTC time from the server as local "HH:mm". */
fun formatIsoClock(iso: String?): String {
    if (iso.isNullOrBlank() || iso.length < 19) return ""
    return try {
        val parser = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US)
        parser.timeZone = TimeZone.getTimeZone("UTC")
        val date = parser.parse(iso.substring(0, 19)) ?: return ""
        SimpleDateFormat("dd/MM HH:mm", Locale.US).format(date)
    } catch (e: ParseException) {
        ""
    }
}
