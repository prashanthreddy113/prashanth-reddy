package com.manabandi.captain

import android.app.Application
import android.graphics.Bitmap
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.manabandi.captain.data.CommissionConfig
import com.manabandi.captain.data.KycDoc
import com.manabandi.captain.data.LocalePrefs
import com.manabandi.captain.data.VehicleType
import com.manabandi.captain.data.api.ApiError
import com.manabandi.captain.data.api.CaptainMe
import com.manabandi.captain.data.api.Earnings
import com.manabandi.captain.data.api.Jpeg
import com.manabandi.captain.data.api.KycState
import com.manabandi.captain.data.api.LatLng
import com.manabandi.captain.data.api.Offer
import com.manabandi.captain.data.api.Trip
import com.manabandi.captain.data.api.VehicleBody
import com.manabandi.captain.location.TrackingRepository
import com.manabandi.captain.location.TrackingService
import com.manabandi.captain.location.hasLocationPermission
import com.manabandi.captain.location.isLocationEnabled
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * Captain-side screen state: login, KYC uploads, the profile (`CaptainMe`), going online /
 * offline, offer accept / reject, every trip step, and earnings. Live data (offer, trip, GPS)
 * comes from [TrackingRepository], which the foreground [TrackingService] keeps up to date.
 * Scoped to the Activity, so it survives the locale-change recreation.
 */
class CaptainViewModel(app: Application) : AndroidViewModel(app) {

    private val mb = app as ManaBandiCaptainApplication
    private val prefs: LocalePrefs = mb.prefs
    private val api = mb.api
    private val locations = mb.locations

    val language: String
        get() = LocalePrefs.currentLocale(mb).language

    // ---------------------------------------------------------------------------------------
    // Login
    // ---------------------------------------------------------------------------------------

    var phone by mutableStateOf("")
    var devCode by mutableStateOf<String?>(null)
        private set
    var authBusy by mutableStateOf(false)
        private set
    var authError by mutableStateOf<Int?>(null)
        private set

    fun requestOtp(channel: String, onSent: () -> Unit) {
        if (authBusy) return
        viewModelScope.launch {
            authBusy = true
            authError = null
            try {
                devCode = api.requestOtp(phone, channel, language).devCode
                onSent()
            } catch (e: ApiError) {
                authError = errorText(e)
            } finally {
                authBusy = false
            }
        }
    }

    /** [onVerified] gets (terms already accepted, KYC screen still needed). */
    fun verifyOtp(code: String, onVerified: (termsAccepted: Boolean, needsKyc: Boolean) -> Unit) {
        if (authBusy) return
        viewModelScope.launch {
            authBusy = true
            authError = null
            try {
                val res = api.verifyOtp(phone, code, language)
                mb.session.save(res.token, res.user)
                // The server decides which terms version is current (owner portal → Settings → Terms).
                val accepted = res.user.termsRequired?.not()
                    ?: (res.user.termsVersionAccepted == LocalePrefs.TERMS_VERSION)
                prefs.setTermsAccepted(accepted)
                val captain = res.captain
                if (captain != null) applyMe(captain)
                val needsKyc = captain == null || kycIncomplete(captain)
                if (captain != null && !needsKyc) {
                    prefs.setKycDone(captain.vehicleType ?: "", captain.vehicleNo ?: "")
                }
                devCode = null
                onVerified(accepted, needsKyc)
            } catch (e: ApiError) {
                authError = errorText(e)
            } finally {
                authBusy = false
            }
        }
    }

    fun clearAuthError() {
        authError = null
    }

    var termsBusy by mutableStateOf(false)
        private set
    var termsError by mutableStateOf<Int?>(null)
        private set

    /** Terms version to show on the terms screen: the server's current one when known. */
    val termsVersionToShow: String
        get() = mb.session.session.value?.user?.termsCurrentVersion ?: LocalePrefs.TERMS_VERSION

    fun acceptTerms(onDone: () -> Unit) {
        if (termsBusy) return
        viewModelScope.launch {
            termsBusy = true
            termsError = null
            try {
                // Accept exactly the version the server has published now (it may have changed
                // since login); fall back to the bundled version only if the server did not say.
                val version = runCatching { api.account().termsCurrentVersion }.getOrNull()
                    ?: mb.session.session.value?.user?.termsCurrentVersion
                    ?: LocalePrefs.TERMS_VERSION
                api.acceptTerms(version)
                prefs.acceptTerms()
                val user = mb.session.session.value?.user
                if (user != null) mb.session.updateUser(user.copy(termsVersionAccepted = version, termsCurrentVersion = version, termsRequired = false))
                onDone()
            } catch (e: ApiError) {
                termsError = errorText(e)
            } finally {
                termsBusy = false
            }
        }
    }

    /** Saves the language, then applies it (activities recreate on API < 33). */
    fun chooseLanguage(tag: String) {
        viewModelScope.launch {
            prefs.setLanguage(tag)
            LocalePrefs.applyLocale(tag)
        }
    }

    /** Stops tracking, tells the server we are offline, forgets the login. */
    fun logout(onDone: () -> Unit) {
        viewModelScope.launch {
            TrackingService.stop(mb)
            try {
                val here = TrackingRepository.location.value
                api.setOnline(false, here?.lat, here?.lng)
            } catch (e: ApiError) {
                // best effort
            }
            prefs.resetKyc()
            mb.signOutLocally()
            me = null
            earnings = null
            onDone()
        }
    }

    // ---------------------------------------------------------------------------------------
    // Profile (GET /api/captain/me) and KYC
    // ---------------------------------------------------------------------------------------

    var me by mutableStateOf<CaptainMe?>(null)
        private set

    private fun applyMe(value: CaptainMe) {
        me = value
        CommissionConfig.update(value.commission)
        val type = VehicleType.fromApi(value.vehicleType)
        val number = value.vehicleNo
        if (vehicleNumber.isBlank() && !number.isNullOrBlank()) {
            vehicleNumber = number
            if (type != null) vehicleType = type
        }
    }

    fun refreshMe() {
        viewModelScope.launch {
            try {
                applyMe(api.me())
            } catch (e: ApiError) {
                // keep what we have
            }
        }
    }

    /** True while a document the server needs is still missing (or the vehicle is unknown). */
    fun kycIncomplete(captain: CaptainMe): Boolean {
        val k = captain.kyc
        val needed = listOf(k.aadhaar, k.dl, k.rc, k.selfie, k.bank) +
            (if (k.ownerConsent == KycState.NOT_NEEDED) emptyList() else listOf(k.ownerConsent))
        return captain.vehicleNo.isNullOrBlank() || needed.any { it == KycState.MISSING }
    }

    /** Server state of one document: missing / uploaded / verified / not_needed. */
    fun kycState(doc: KycDoc): String {
        val k = me?.kyc ?: return KycState.MISSING
        return when (doc) {
            KycDoc.AADHAAR -> k.aadhaar
            KycDoc.LICENCE -> k.dl
            KycDoc.RC -> k.rc
            KycDoc.PHOTO -> k.selfie
            KycDoc.BANK -> k.bank
            KycDoc.OWNER_CONSENT -> k.ownerConsent
        }
    }

    val kycPhotos = mutableStateMapOf<KycDoc, Bitmap>()
    val kycUploading = mutableStateMapOf<KycDoc, Boolean>()
    val kycFailed = mutableStateMapOf<KycDoc, Boolean>()
    var kycError by mutableStateOf<Int?>(null)
        private set

    var vehicleType by mutableStateOf(VehicleType.BIKE)
    var vehicleNumber by mutableStateOf("")
    var vehicleModel by mutableStateOf("")

    // bank details sent with the bank document photo
    var bankUpi by mutableStateOf("")
    var bankIfsc by mutableStateOf("")
    var bankLast4 by mutableStateOf("")

    /** Uploads one document photo: POST /api/captain/documents/{kind} (JPEG ≤ 1600 px, q85). */
    fun uploadDocument(doc: KycDoc, photo: Bitmap) {
        kycPhotos[doc] = photo
        kycFailed.remove(doc)
        kycUploading[doc] = true
        kycError = null
        val fields = if (doc == KycDoc.BANK) {
            buildMap<String, String> {
                if (bankUpi.isNotBlank()) put("upi", bankUpi.trim())
                if (bankIfsc.isNotBlank()) put("ifsc", bankIfsc.trim().uppercase())
                if (bankLast4.isNotBlank()) put("accountLast4", bankLast4.trim())
            }
        } else {
            emptyMap()
        }
        viewModelScope.launch {
            try {
                val jpeg = withContext(Dispatchers.Default) { Jpeg.compress(photo) }
                applyMe(api.uploadDocument(doc.apiKind, jpeg, fields))
            } catch (e: ApiError) {
                kycFailed[doc] = true
                kycError = errorText(e)
            } finally {
                kycUploading[doc] = false
            }
        }
    }

    var vehicleBusy by mutableStateOf(false)
        private set

    /** PUT /api/captain/vehicle, then remember that the KYC screen was completed. */
    fun saveVehicle(onDone: () -> Unit) {
        if (vehicleBusy) return
        viewModelScope.launch {
            vehicleBusy = true
            kycError = null
            try {
                val number = vehicleNumber.trim()
                applyMe(
                    api.setVehicle(
                        VehicleBody(
                            vehicleType = vehicleType.apiName,
                            vehicleNo = number,
                            vehicleModel = vehicleModel.trim().ifBlank { null }
                        )
                    )
                )
                prefs.setKycDone(vehicleType.apiName, number)
                onDone()
            } catch (e: ApiError) {
                kycError = when (e) {
                    is ApiError.Validation -> R.string.kyc_vehicle_invalid
                    is ApiError.InvalidState -> R.string.kyc_vehicle_locked
                    else -> errorText(e)
                }
            } finally {
                vehicleBusy = false
            }
        }
    }

    // ---------------------------------------------------------------------------------------
    // Online / offline
    // ---------------------------------------------------------------------------------------

    var onlineBusy by mutableStateOf(false)
        private set
    var onlineError by mutableStateOf<Int?>(null)
        private set

    /**
     * POST /api/captain/online {online:true, lat, lng}, then start [TrackingService].
     * Call only after the location permission was granted, from the visible Home screen.
     */
    fun goOnline() {
        if (onlineBusy) return
        viewModelScope.launch {
            onlineBusy = true
            onlineError = null
            try {
                if (!isLocationEnabled(mb)) {
                    onlineError = R.string.gps_off
                    return@launch
                }
                val fix = locations.current(10_000L)
                if (fix == null) {
                    onlineError = R.string.gps_off
                    return@launch
                }
                TrackingRepository.updateLocation(fix.latitude, fix.longitude)
                applyMe(api.setOnline(true, fix.latitude, fix.longitude))
                TrackingService.start(mb)
            } catch (e: ApiError) {
                onlineError = errorText(e)
                if (e is ApiError.KycRequired) refreshMe()
            } finally {
                onlineBusy = false
            }
        }
    }

    /** Stops tracking and POSTs online=false. Not allowed during a trip. */
    fun goOffline() {
        if (TrackingRepository.state.value.trip != null) {
            onlineError = R.string.offline_on_trip
            return
        }
        onlineError = null
        TrackingService.stop(mb)
        viewModelScope.launch {
            try {
                val here = TrackingRepository.location.value
                applyMe(api.setOnline(false, here?.lat, here?.lng))
            } catch (e: ApiError) {
                // the server marks us offline after 60 s without heartbeats anyway
            }
        }
    }

    fun clearOnlineError() {
        onlineError = null
    }

    private var resumeChecked = false

    /**
     * Once per app start: GET /api/captain/me and GET /api/captain/trip. A running trip (or an
     * "online" flag from before the app was closed) restarts tracking when we may.
     */
    fun resumeOnStart() {
        if (resumeChecked) return
        resumeChecked = true
        viewModelScope.launch {
            try {
                val captain = api.me()
                applyMe(captain)
                val trip = api.currentTrip()
                if (trip != null) TrackingRepository.setTrip(trip)
                if ((trip != null || captain.online) && !TrackingRepository.state.value.running) {
                    if (hasLocationPermission(mb)) {
                        TrackingService.start(mb)
                    } else if (trip == null) {
                        applyMe(api.setOnline(false, null, null))
                    }
                }
            } catch (e: ApiError) {
                resumeChecked = false
            }
        }
    }

    // ---------------------------------------------------------------------------------------
    // Offers
    // ---------------------------------------------------------------------------------------

    var offerBusy by mutableStateOf(false)
        private set

    /** One-shot message for the screen (offer expired / taken …). */
    var message by mutableStateOf<Int?>(null)
        private set

    fun consumeMessage() {
        message = null
    }

    /** POST /api/captain/offers/{id}/accept → the trip; 409 offer_expired / offer_taken → message. */
    fun acceptOffer(offer: Offer) {
        if (offerBusy) return
        viewModelScope.launch {
            offerBusy = true
            try {
                TrackingRepository.setTrip(api.acceptOffer(offer.id))
                resetTripExtras()
            } catch (e: ApiError) {
                TrackingRepository.dismissOffer(offer.id)
                message = when (e) {
                    is ApiError.OfferExpired -> R.string.offer_expired
                    is ApiError.OfferTaken -> R.string.offer_taken
                    else -> errorText(e)
                }
            } finally {
                offerBusy = false
            }
        }
    }

    fun rejectOffer(offer: Offer) {
        TrackingRepository.dismissOffer(offer.id)
        viewModelScope.launch {
            try {
                api.rejectOffer(offer.id)
            } catch (e: ApiError) {
                // it expires on the server anyway
            }
        }
    }

    /** Countdown reached zero: the server expires it; we just hide it. */
    fun offerTimedOut(offer: Offer) {
        TrackingRepository.dismissOffer(offer.id)
    }

    // ---------------------------------------------------------------------------------------
    // Trip steps
    // ---------------------------------------------------------------------------------------

    var tripBusy by mutableStateOf(false)
        private set
    var tripError by mutableStateOf<Int?>(null)
        private set

    /** Pickup / delivery photos of the current parcel (stage → photo) and their upload state. */
    val tripPhotos = mutableStateMapOf<String, Bitmap>()
    val tripPhotoUploaded = mutableStateMapOf<String, Boolean>()
    private var deliveredRideId: String? = null

    private fun resetTripExtras() {
        tripPhotos.clear()
        tripPhotoUploaded.clear()
        tripError = null
        deliveredRideId = null
    }

    fun clearTripError() {
        tripError = null
    }

    private fun tripAction(block: suspend () -> Trip) {
        if (tripBusy) return
        viewModelScope.launch {
            tripBusy = true
            tripError = null
            try {
                TrackingRepository.setTrip(block())
            } catch (e: ApiError) {
                tripError = when (e) {
                    is ApiError.WrongRideOtp -> R.string.wrong_otp
                    is ApiError.InvalidState -> {
                        refreshTrip()
                        R.string.err_trip_state
                    }
                    else -> errorText(e)
                }
            } finally {
                tripBusy = false
            }
        }
    }

    /** POST /api/captain/trip/arrived */
    fun arrived() = tripAction { api.arrived() }

    /** POST /api/captain/trip/start {otp} (for parcels: the pickup OTP). 422 wrong_ride_otp → error. */
    fun startTrip(otp: String) = tripAction { api.startTrip(otp) }

    /** POST /api/captain/trip/finish {lat, lng} with the current position. */
    fun finishTrip() = tripAction {
        val here = currentPosition()
        api.finishTrip(here.lat, here.lng)
    }

    /** Parcels: POST /api/captain/trip/deliver {deliveryOtp}, then finish. */
    fun deliverAndFinish(deliveryOtp: String) = tripAction {
        val trip = TrackingRepository.state.value.trip
        if (trip != null && deliveredRideId != trip.rideId) {
            try {
                api.deliver(deliveryOtp)
            } catch (e: ApiError.InvalidState) {
                // already delivered (e.g. the app restarted between deliver and finish)
            }
            deliveredRideId = trip.rideId
        }
        val here = currentPosition()
        api.finishTrip(here.lat, here.lng)
    }

    /** POST /api/captain/trip/photo (stage = pickup | delivery), 3 tries in the background. */
    fun uploadTripPhoto(stage: String, photo: Bitmap) {
        tripPhotos[stage] = photo
        tripPhotoUploaded[stage] = false
        viewModelScope.launch {
            val jpeg = withContext(Dispatchers.Default) { Jpeg.compress(photo) }
            repeat(3) { attempt ->
                try {
                    api.tripPhoto(stage, jpeg)
                    tripPhotoUploaded[stage] = true
                    return@launch
                } catch (e: ApiError) {
                    delay(3_000L * (attempt + 1))
                }
            }
        }
    }

    /** POST /api/captain/trip/collected {method}; back to Home, still online. */
    fun collected(onDone: () -> Unit) {
        val trip = TrackingRepository.state.value.trip ?: return
        if (tripBusy) return
        viewModelScope.launch {
            tripBusy = true
            tripError = null
            try {
                val res = api.collected(trip.payment)
                earningsToday = res.earningsToday
                tripsToday = res.tripsToday
                TrackingRepository.closeTrip(trip.rideId)
                resetTripExtras()
                onDone()
                loadEarnings()
            } catch (e: ApiError) {
                if (e is ApiError.InvalidState || e is ApiError.NotFound) {
                    TrackingRepository.closeTrip(trip.rideId)
                    resetTripExtras()
                    onDone()
                } else {
                    tripError = errorText(e)
                }
            } finally {
                tripBusy = false
            }
        }
    }

    /** POST /api/captain/trip/cancel — the ride goes back to the other captains. */
    fun cancelTrip(onDone: () -> Unit) {
        val trip = TrackingRepository.state.value.trip ?: return
        if (tripBusy) return
        viewModelScope.launch {
            tripBusy = true
            try {
                api.cancelTrip("captain_cancelled")
                TrackingRepository.closeTrip(trip.rideId)
                resetTripExtras()
                onDone()
            } catch (e: ApiError) {
                tripError = errorText(e)
            } finally {
                tripBusy = false
            }
        }
    }

    private fun refreshTrip() {
        viewModelScope.launch {
            try {
                val trip = api.currentTrip()
                if (trip != null) TrackingRepository.setTrip(trip)
            } catch (e: ApiError) {
                // the next heartbeat will tell us
            }
        }
    }

    private suspend fun currentPosition(): LatLng {
        val known = TrackingRepository.location.value
        if (known != null) return known
        val fix = locations.current(5_000L)
        if (fix != null) return LatLng(fix.latitude, fix.longitude)
        val trip = TrackingRepository.state.value.trip
        return if (trip != null) LatLng(trip.drop.lat, trip.drop.lng) else LatLng(0.0, 0.0)
    }

    // ---------------------------------------------------------------------------------------
    // Earnings
    // ---------------------------------------------------------------------------------------

    var earnings by mutableStateOf<Earnings?>(null)
        private set
    var earningsBusy by mutableStateOf(false)
        private set
    var earningsError by mutableStateOf<Int?>(null)
        private set

    /** Today's numbers for Home (from earnings, or the last "collected" answer). */
    var earningsToday by mutableIntStateOf(0)
        private set
    var tripsToday by mutableIntStateOf(0)
        private set

    /** GET /api/captain/earnings */
    fun loadEarnings() {
        if (earningsBusy) return
        viewModelScope.launch {
            earningsBusy = true
            earningsError = null
            try {
                val result = api.earnings()
                earnings = result
                CommissionConfig.update(result.commission)
                earningsToday = result.today.net
                tripsToday = result.today.trips
            } catch (e: ApiError) {
                earningsError = errorText(e)
            } finally {
                earningsBusy = false
            }
        }
    }

    companion object {
        /** A short, friendly message (string resource) for any API failure. */
        fun errorText(e: ApiError): Int = when (e) {
            is ApiError.Network -> R.string.err_network
            is ApiError.InvalidOtp -> R.string.err_invalid_otp
            is ApiError.OtpRateLimited -> R.string.err_otp_rate
            is ApiError.TermsRequired -> R.string.err_terms
            is ApiError.KycRequired -> R.string.err_kyc_required
            is ApiError.NotOnline -> R.string.err_not_online
            is ApiError.OfferExpired -> R.string.offer_expired
            is ApiError.OfferTaken -> R.string.offer_taken
            is ApiError.WrongRideOtp -> R.string.wrong_otp
            is ApiError.InvalidState -> R.string.err_trip_state
            is ApiError.Unauthorized -> R.string.err_session
            else -> R.string.err_generic
        }
    }
}
