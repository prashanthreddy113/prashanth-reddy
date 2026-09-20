package com.manabandi.rider

import android.app.Application
import android.graphics.Bitmap
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.manabandi.rider.data.Captain
import com.manabandi.rider.data.FakeRides
import com.manabandi.rider.data.LocalePrefs
import com.manabandi.rider.data.ParcelSize
import com.manabandi.rider.data.Payer
import com.manabandi.rider.data.Payment
import com.manabandi.rider.data.Service
import kotlinx.coroutines.launch

/**
 * Holds the in-progress booking so all screens share one state.
 * Scoped to the Activity, so it survives the locale-change recreation.
 */
class RideViewModel(app: Application) : AndroidViewModel(app) {

    private val prefs: LocalePrefs = (app as ManaBandiApplication).prefs

    // --- login ---
    var phone by mutableStateOf("")

    // --- booking ---
    var service by mutableStateOf(Service.BIKE)
    var drop by mutableStateOf("")
    var payment by mutableStateOf(Payment.CASH)

    // --- parcel extras ---
    var receiverPhone by mutableStateOf("")
    var parcelSize by mutableStateOf(ParcelSize.MEDIUM)
    var parcelPhoto by mutableStateOf<Bitmap?>(null)
    var parcelPayer by mutableStateOf(Payer.ME)

    // --- assigned captain ---
    var captain by mutableStateOf<Captain?>(null)
    var otp by mutableStateOf("")

    val distanceKm: Int
        get() = FakeRides.distanceKm(drop)

    val fare: Int
        get() = FakeRides.fare(service, distanceKm)

    fun startBooking(newService: Service, presetDrop: String = "") {
        service = newService
        drop = presetDrop
        payment = Payment.CASH
        receiverPhone = ""
        parcelSize = ParcelSize.MEDIUM
        parcelPhoto = null
        parcelPayer = Payer.ME
        captain = null
        otp = ""
    }

    fun assignCaptain() {
        if (captain == null) captain = FakeRides.randomCaptain()
        if (otp.isEmpty()) otp = FakeRides.otp()
    }

    fun clearRide() {
        captain = null
        otp = ""
        drop = ""
        parcelPhoto = null
    }

    /** Saves the language, then applies it (activities recreate on API < 33). */
    fun chooseLanguage(tag: String) {
        viewModelScope.launch {
            prefs.setLanguage(tag)
            LocalePrefs.applyLocale(tag)
        }
    }

    fun login(phoneNumber: String) {
        phone = phoneNumber
        viewModelScope.launch { prefs.setLoggedIn(phoneNumber) }
    }
}
