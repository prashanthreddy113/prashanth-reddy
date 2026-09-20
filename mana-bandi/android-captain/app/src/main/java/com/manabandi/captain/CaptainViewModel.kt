package com.manabandi.captain

import android.app.Application
import android.graphics.Bitmap
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.manabandi.captain.data.CommissionConfig
import com.manabandi.captain.data.FakeDispatch
import com.manabandi.captain.data.KycDoc
import com.manabandi.captain.data.LocalePrefs
import com.manabandi.captain.data.Payment
import com.manabandi.captain.data.RideRequest
import com.manabandi.captain.data.TripLogEntry
import com.manabandi.captain.data.VehicleType
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Holds the captain's day: online flag, the current request / trip, earnings and the
 * KYC form. Scoped to the Activity, so it survives the locale-change recreation.
 */
class CaptainViewModel(app: Application) : AndroidViewModel(app) {

    private val prefs: LocalePrefs = (app as ManaBandiCaptainApplication).prefs

    // --- login ---
    var phone by mutableStateOf("")

    // --- KYC (demo: photos stay in memory, nothing is uploaded) ---
    val kycPhotos = mutableStateMapOf<KycDoc, Bitmap>()
    var vehicleType by mutableStateOf(VehicleType.BIKE)
    var vehicleNumber by mutableStateOf("")

    // --- online / dispatch ---
    var online by mutableStateOf(false)

    /** The request being shown, or the trip in progress. Null when idle. */
    var request by mutableStateOf<RideRequest?>(null)
        private set

    /** How many fake requests have been offered since the app started (drives the demo delay). */
    var requestsOffered by mutableIntStateOf(0)
        private set

    // --- trip extras (parcel) ---
    var parcelPhoto by mutableStateOf<Bitmap?>(null)
    var deliveryPhoto by mutableStateOf<Bitmap?>(null)

    // --- earnings ---
    var earningsToday by mutableIntStateOf(0)
        private set
    var tripsToday by mutableIntStateOf(0)
        private set
    /** UPI fares the office still has to pay out (T+1). Cash stays with the captain. */
    var settlementDue by mutableIntStateOf(0)
        private set
    /** Commission owed to the office for today's trips, from the owner-configured rule. */
    var commissionToday by mutableIntStateOf(0)
        private set

    /** Demo: this captain joined last month, so the launch offer (free months) still applies. */
    val monthsSinceJoining: Int = 1

    /** Commission % that applies to this captain right now. */
    val commissionRate: Int
        get() = CommissionConfig.rateFor(monthsSinceJoining)

    /** Commission for the request being served, in rupees. */
    val currentCommission: Int
        get() = request?.let { CommissionConfig.commissionFor(it.fare, monthsSinceJoining) } ?: 0
    val tripLog = mutableStateListOf<TripLogEntry>()

    val earningsWeek: Int
        get() = FakeDispatch.WEEK_BEFORE_TODAY + earningsToday

    /** Delay before the next fake request: 4 s for the very first one, 8 s afterwards. */
    val nextRequestDelayMs: Long
        get() = if (requestsOffered == 0) FakeDispatch.FIRST_REQUEST_DELAY_MS else FakeDispatch.NEXT_REQUEST_DELAY_MS

    fun setOnlineState(value: Boolean) {
        online = value
        if (!value && !tripInProgress) request = null
    }

    private var tripInProgress = false

    /** Pulls the next fake request from the dispatcher and makes it current. */
    fun offerRequest(): RideRequest {
        val next = FakeDispatch.next()
        request = next
        requestsOffered++
        parcelPhoto = null
        deliveryPhoto = null
        return next
    }

    fun acceptRequest() {
        tripInProgress = request != null
    }

    fun rejectRequest() {
        request = null
        tripInProgress = false
    }

    /** Called from the Collect screen: adds the fare to today's numbers and clears the trip. */
    fun finishTrip() {
        val done = request ?: return
        val commission = CommissionConfig.commissionFor(done.fare, monthsSinceJoining)
        earningsToday += done.fare - commission
        commissionToday += commission
        tripsToday += 1
        if (done.payment == Payment.UPI) settlementDue += done.fare - commission
        tripLog.add(
            0,
            TripLogEntry(
                service = done.service,
                time = timeNow(),
                dropNameRes = done.dropNameRes,
                fare = done.fare,
                payment = done.payment
            )
        )
        request = null
        tripInProgress = false
        parcelPhoto = null
        deliveryPhoto = null
    }

    private fun timeNow(): String = try {
        SimpleDateFormat("HH:mm", Locale.US).format(Date())
    } catch (e: Exception) {
        ""
    }

    /** Saves the language, then applies it (activities recreate on API < 33). */
    fun chooseLanguage(tag: String) {
        viewModelScope.launch {
            prefs.setLanguage(tag)
            LocalePrefs.applyLocale(tag)
        }
    }

    fun acceptTerms() {
        viewModelScope.launch { prefs.acceptTerms() }
    }

    fun login(phoneNumber: String) {
        phone = phoneNumber
        viewModelScope.launch { prefs.setLoggedIn(phoneNumber) }
    }

    fun submitKyc() {
        viewModelScope.launch { prefs.setKycDone(vehicleType.name, vehicleNumber.trim()) }
    }
}
