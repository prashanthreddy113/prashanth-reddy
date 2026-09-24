package com.manabandi.rider

import android.app.Application
import android.graphics.Bitmap
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.manabandi.rider.data.LocalePrefs
import com.manabandi.rider.data.ParcelSize
import com.manabandi.rider.data.Payer
import com.manabandi.rider.data.Payment
import com.manabandi.rider.data.PinNames
import com.manabandi.rider.data.Service
import com.manabandi.rider.data.displayName
import com.manabandi.rider.data.toPlace
import com.manabandi.rider.data.api.ApiError
import com.manabandi.rider.data.api.CreateRideBody
import com.manabandi.rider.data.api.Jpeg
import com.manabandi.rider.data.api.Landmark
import com.manabandi.rider.data.api.LatLng
import com.manabandi.rider.data.api.ParcelBody
import com.manabandi.rider.data.api.Payments
import com.manabandi.rider.data.api.Place
import com.manabandi.rider.data.api.QuoteBody
import com.manabandi.rider.data.api.QuoteResponse
import com.manabandi.rider.data.api.Ride
import com.manabandi.rider.data.api.RideStatus
import com.manabandi.rider.data.api.Town
import com.manabandi.rider.location.LocationProvider
import com.manabandi.rider.location.hasLocationPermission
import com.manabandi.rider.location.isLocationEnabled
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.util.UUID

/** Where the GPS pickup step is. */
enum class LocateState { IDLE, LOCATING, NO_GPS, READY, OUTSIDE, ERROR }

/**
 * Holds login, the in-progress booking and the active ride so all screens share one state.
 * Scoped to the Activity, so it survives the locale-change recreation. Every server call goes
 * through [ManaBandiApplication.api] (API contract v1).
 */
class RideViewModel(app: Application) : AndroidViewModel(app) {

    private val mb = app as ManaBandiApplication
    private val prefs: LocalePrefs = mb.prefs
    private val api = mb.api
    private val locations = mb.locations

    /** Current app language ("te", "en", …) for place names and the OTP request. */
    val language: String
        get() = LocalePrefs.currentLocale(mb).language

    // ---------------------------------------------------------------------------------------
    // Login
    // ---------------------------------------------------------------------------------------

    var phone by mutableStateOf("")

    /** Shown as a small grey hint only when the server is in OTP dev mode. */
    var devCode by mutableStateOf<String?>(null)
        private set
    var authBusy by mutableStateOf(false)
        private set

    /** String resource of the last login error, or null. */
    var authError by mutableStateOf<Int?>(null)
        private set

    fun requestOtp(channel: String, onSent: () -> Unit) {
        if (authBusy) return
        viewModelScope.launch {
            authBusy = true
            authError = null
            try {
                val res = api.requestOtp(phone, channel, language)
                devCode = res.devCode
                onSent()
            } catch (e: ApiError) {
                authError = errorText(e)
            } finally {
                authBusy = false
            }
        }
    }

    /** Verifies the code; [onVerified] gets whether the current terms are already accepted. */
    fun verifyOtp(code: String, onVerified: (termsAccepted: Boolean) -> Unit) {
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
                devCode = null
                onVerified(accepted)
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

    /** POST /api/me/terms, then remember locally. */
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

    // ---------------------------------------------------------------------------------------
    // GPS pickup + town
    // ---------------------------------------------------------------------------------------

    var locateState by mutableStateOf(LocateState.IDLE)
        private set
    var locateError by mutableStateOf<Int?>(null)
        private set
    var myLocation by mutableStateOf<LatLng?>(null)
        private set

    /** The town we are in (landmarks, support phone). Kept for the Home screen chips. */
    var town by mutableStateOf<Town?>(null)
        private set
    var pickup by mutableStateOf<Place?>(null)
        private set

    val landmarks: List<Landmark>
        get() = town?.landmarks ?: emptyList()

    /** Town support number when known, else the app's default. */
    val supportPhone: String
        get() = town?.supportPhone?.takeIf { it.isNotBlank() } ?: mb.getString(R.string.support_number)

    private var locateJob: Job? = null
    private var townJob: Job? = null

    /**
     * Fresh GPS fix → GET /api/rider/towns/nearest → pickup = nearest landmark within 300 m,
     * else "GPS pin". Sets [locateState] to OUTSIDE when we do not serve this place.
     */
    fun locate() {
        locateJob?.cancel()
        locateJob = viewModelScope.launch {
            locateState = LocateState.LOCATING
            locateError = null
            if (!hasLocationPermission(mb)) {
                locateState = LocateState.IDLE
                return@launch
            }
            if (!isLocationEnabled(mb)) {
                locateState = LocateState.NO_GPS
                return@launch
            }
            val fix = locations.current(12_000L)
            if (fix == null) {
                locateState = LocateState.NO_GPS
                return@launch
            }
            val here = LatLng(fix.latitude, fix.longitude)
            myLocation = here
            try {
                val res = api.nearestTown(here.lat, here.lng)
                val found = res.town
                if (found != null) town = found
                if (found == null || !res.inside) {
                    locateState = LocateState.OUTSIDE
                    return@launch
                }
                pickup = pickupPlace(here, found)
                locateState = LocateState.READY
                refreshQuote()
            } catch (e: ApiError) {
                if (e is ApiError.OutsideArea || e is ApiError.NoTown) {
                    locateState = LocateState.OUTSIDE
                } else {
                    locateError = errorText(e)
                    locateState = LocateState.ERROR
                }
            }
        }
    }

    /** Home screen: learn the town (for the landmark chips) without asking for anything. */
    fun refreshTownQuietly() {
        if (town != null || townJob?.isActive == true || !hasLocationPermission(mb)) return
        townJob = viewModelScope.launch {
            try {
                val fix = locations.current(8_000L) ?: return@launch
                myLocation = LatLng(fix.latitude, fix.longitude)
                val res = api.nearestTown(fix.latitude, fix.longitude)
                if (res.town != null) town = res.town
            } catch (e: ApiError) {
                // chips simply stay hidden
            }
        }
    }

    private fun nearestLandmark(lat: Double, lng: Double, inTown: Town, maxMeters: Double): Landmark? =
        inTown.landmarks
            .map { it to LocationProvider.distanceMeters(lat, lng, it.lat, it.lng) }
            .filter { it.second <= maxMeters }
            .minByOrNull { it.second }
            ?.first

    private fun pickupPlace(here: LatLng, inTown: Town): Place {
        val landmark = nearestLandmark(here.lat, here.lng, inTown, 300.0)
        return if (landmark != null) {
            Place(
                lat = here.lat,
                lng = here.lng,
                name = landmark.nameEn.ifBlank { landmark.nameTe },
                nameTe = landmark.nameTe,
                landmarkId = landmark.id
            )
        } else {
            Place(lat = here.lat, lng = here.lng, name = PinNames.GPS, nameTe = PinNames.GPS_TE)
        }
    }

    // ---------------------------------------------------------------------------------------
    // Booking
    // ---------------------------------------------------------------------------------------

    var service by mutableStateOf(Service.BIKE)
        private set
    var drop by mutableStateOf<Place?>(null)
        private set

    /** What is in the drop text box (typed or spoken). */
    var dropText by mutableStateOf("")
        private set

    /** True after speech that did not match any landmark. */
    var dropNotFound by mutableStateOf(false)
        private set
    var payment by mutableStateOf(Payment.CASH)

    // parcel extras
    var receiverName by mutableStateOf("")
    var receiverPhone by mutableStateOf("")
    var parcelSize by mutableStateOf(ParcelSize.MEDIUM)
        private set
    var parcelPhoto by mutableStateOf<Bitmap?>(null)
    var parcelPayer by mutableStateOf(Payer.ME)

    var quote by mutableStateOf<QuoteResponse?>(null)
        private set
    var quoteBusy by mutableStateOf(false)
        private set
    var quoteError by mutableStateOf<Int?>(null)
        private set

    var bookBusy by mutableStateOf(false)
        private set
    var bookError by mutableStateOf<Int?>(null)
        private set

    /** Idempotency key for POST /api/rides: the same key is re-sent on every retry of one booking. */
    private var clientId: String = UUID.randomUUID().toString()
    private var quoteJob: Job? = null

    fun startBooking(newService: Service, presetDrop: Landmark? = null) {
        service = newService
        drop = presetDrop?.toPlace()
        dropText = presetDrop?.displayName(language) ?: ""
        dropNotFound = false
        payment = Payment.CASH
        receiverName = ""
        receiverPhone = ""
        parcelSize = ParcelSize.MEDIUM
        parcelPhoto = null
        parcelPayer = Payer.ME
        quote = null
        quoteError = null
        bookError = null
        pickup = null
        locateState = LocateState.IDLE
        clientId = UUID.randomUUID().toString()
    }

    fun selectService(newService: Service) {
        if (service == newService) return
        service = newService
        refreshQuote()
    }

    fun selectParcelSize(size: ParcelSize) {
        parcelSize = size
        refreshQuote()
    }

    fun chooseDropLandmark(landmark: Landmark) {
        drop = landmark.toPlace()
        dropText = landmark.displayName(language)
        dropNotFound = false
        refreshQuote()
    }

    /** Map tap: snap to a landmark within 150 m, else a plain map pin. */
    fun chooseDropOnMap(lat: Double, lng: Double) {
        val inTown = town
        val landmark = if (inTown != null) nearestLandmark(lat, lng, inTown, 150.0) else null
        if (landmark != null) {
            chooseDropLandmark(landmark)
        } else {
            drop = Place(lat = lat, lng = lng, name = PinNames.MAP, nameTe = PinNames.MAP_TE)
            dropText = ""
            dropNotFound = false
            refreshQuote()
        }
    }

    /** Typing: the drop is set only on an exact landmark name; otherwise suggestions show. */
    fun onDropTyped(text: String) {
        dropText = text
        dropNotFound = false
        val match = matchLandmark(text, exactOnly = true)
        if (match != null) {
            drop = match.toPlace()
            refreshQuote()
        } else if (drop != null) {
            drop = null
            refreshQuote()
        }
    }

    /** 🎤 result: best landmark whose name is in what was said ("బస్టాండ్ కి పోవాలి"). */
    fun onDropSpoken(text: String) {
        val match = matchLandmark(text, exactOnly = false)
        if (match != null) {
            chooseDropLandmark(match)
        } else {
            dropText = text
            drop = null
            dropNotFound = true
            refreshQuote()
        }
    }

    /** Landmarks whose name contains what is typed (shown as chips under the text box). */
    val dropSuggestions: List<Landmark>
        get() {
            val query = normalize(dropText)
            if (query.length < 2 || drop != null) return emptyList()
            return landmarks.filter { landmark ->
                listOf(landmark.nameTe, landmark.nameEn).any { name ->
                    val n = normalize(name)
                    n.length >= 2 && (n.contains(query) || query.contains(n))
                }
            }.take(6)
        }

    private fun matchLandmark(text: String, exactOnly: Boolean): Landmark? {
        val query = normalize(text)
        if (query.length < 2) return null
        var best: Landmark? = null
        var bestScore = 0
        for (landmark in landmarks) {
            for (name in listOf(landmark.nameTe, landmark.nameEn)) {
                val n = normalize(name)
                if (n.length < 2) continue
                val score = when {
                    n == query -> 1000
                    exactOnly -> 0
                    query.contains(n) -> n.length * 2
                    n.contains(query) -> query.length
                    else -> 0
                }
                if (score > bestScore) {
                    bestScore = score
                    best = landmark
                }
            }
        }
        return best
    }

    private fun normalize(text: String): String =
        text.lowercase().filterNot { it.isWhitespace() || it in PUNCTUATION }

    /** POST /api/rider/quote for the current pickup, drop, service (and parcel size). */
    fun refreshQuote() {
        quoteJob?.cancel()
        val from = pickup
        val to = drop
        if (from == null || to == null) {
            quote = null
            quoteError = null
            quoteBusy = false
            return
        }
        val body = QuoteBody(
            service = service.apiName,
            pickup = from,
            drop = to,
            parcelSize = if (service == Service.PARCEL) parcelSize.apiCode else null
        )
        quoteJob = viewModelScope.launch {
            quoteBusy = true
            quoteError = null
            try {
                quote = api.quote(body)
            } catch (e: ApiError) {
                quote = null
                quoteError = if (e is ApiError.OutsideArea) R.string.drop_outside_area else errorText(e)
            } finally {
                if (isActive) quoteBusy = false
            }
        }
    }

    /** POST /api/rides with the booking's clientId (idempotent on retries). */
    fun book(onBooked: () -> Unit, onTermsRequired: () -> Unit) {
        val from = pickup ?: return
        val to = drop ?: return
        val isParcel = service == Service.PARCEL
        val body = CreateRideBody(
            clientId = clientId,
            service = service.apiName,
            pickup = from,
            drop = to,
            // A parcel paid by the receiver is collected in cash at the door.
            payment = if (isParcel && parcelPayer == Payer.RECEIVER) Payments.CASH else payment.apiName,
            parcel = if (isParcel) {
                ParcelBody(
                    // The name is optional in the wizard; the number identifies the receiver.
                    receiverName = receiverName.trim().ifBlank { "+91 $receiverPhone" },
                    receiverPhone = receiverPhone,
                    size = parcelSize.apiCode,
                    payer = parcelPayer.apiName
                )
            } else {
                null
            }
        )
        submit(body, if (isParcel) parcelPhoto else null, onBooked, onTermsRequired)
    }

    private fun submit(body: CreateRideBody, photo: Bitmap?, onBooked: () -> Unit, onTermsRequired: () -> Unit) {
        if (bookBusy) return
        viewModelScope.launch {
            bookBusy = true
            bookError = null
            try {
                val created = api.createRide(body)
                ride = created
                if (photo != null) uploadParcelPhoto(created.id, photo)
                onBooked()
            } catch (e: ApiError) {
                when (e) {
                    is ApiError.TermsRequired -> {
                        prefs.setTermsAccepted(false)
                        onTermsRequired()
                    }
                    is ApiError.OutsideArea -> bookError = R.string.drop_outside_area
                    else -> bookError = errorText(e)
                }
            } finally {
                bookBusy = false
            }
        }
    }

    /** Uploads the parcel photo in the background (3 tries); the ride does not wait for it. */
    private fun uploadParcelPhoto(rideId: String, photo: Bitmap) {
        mb.appScope.launch {
            val jpeg = withContext(Dispatchers.Default) { Jpeg.compress(photo) }
            repeat(3) { attempt ->
                try {
                    api.uploadParcelPhoto(rideId, jpeg)
                    return@launch
                } catch (e: ApiError) {
                    delay(3_000L * (attempt + 1))
                }
            }
        }
    }

    // ---------------------------------------------------------------------------------------
    // Active ride
    // ---------------------------------------------------------------------------------------

    var ride by mutableStateOf<Ride?>(null)
        private set

    /** True while polling fails because the phone is offline (a small banner is shown). */
    var pollOffline by mutableStateOf(false)
        private set
    var actionBusy by mutableStateOf(false)
        private set
    var actionError by mutableStateOf<Int?>(null)
        private set

    /**
     * GET /api/rides/{id} every 3 s until the ride ends. Called from a LaunchedEffect on the
     * Finding / Ride screens, so it stops when those screens leave.
     */
    suspend fun pollRide() {
        while (true) {
            val current = ride ?: return
            try {
                val fresh = api.ride(current.id)
                if (ride?.id == fresh.id) ride = fresh
                pollOffline = false
            } catch (e: ApiError) {
                pollOffline = e is ApiError.Network
            }
            val status = ride?.status ?: return
            if (status in RideStatus.TERMINAL) return
            delay(POLL_MS)
        }
    }

    private var resumeChecked = false

    /** GET /api/rides/active once per app start: resume a ride after the app was closed. */
    fun resumeActiveRide(onFound: (Ride) -> Unit) {
        if (resumeChecked) return
        resumeChecked = true
        viewModelScope.launch {
            try {
                val active = api.activeRide() ?: return@launch
                ride = active
                service = Service.fromApi(active.service)
                onFound(active)
            } catch (e: ApiError) {
                resumeChecked = false   // try again next time Home shows
            }
        }
    }

    /** POST /api/rides/{id}/cancel. */
    fun cancelRide(onDone: () -> Unit) {
        val current = ride
        if (current == null) {
            onDone()
            return
        }
        if (actionBusy) return
        viewModelScope.launch {
            actionBusy = true
            actionError = null
            try {
                api.cancel(current.id, "rider_cancelled")
                clearRide()
                onDone()
            } catch (e: ApiError) {
                when (e) {
                    is ApiError.NotFound -> {
                        clearRide()
                        onDone()
                    }
                    is ApiError.InvalidState -> actionError = R.string.err_cannot_cancel
                    else -> actionError = errorText(e)
                }
            } finally {
                actionBusy = false
            }
        }
    }

    /** After `no_captain`: book the same trip again with a NEW clientId. */
    fun retryBooking(onTermsRequired: () -> Unit) {
        val old = ride ?: return
        clientId = UUID.randomUUID().toString()
        val body = CreateRideBody(
            clientId = clientId,
            service = old.service,
            pickup = old.pickup,
            drop = old.drop,
            payment = old.payment,
            parcel = old.parcel?.let {
                ParcelBody(receiverName = it.receiverName, receiverPhone = it.receiverPhone, size = it.size, payer = it.payer)
            }
        )
        submit(body, null, onBooked = {}, onTermsRequired = onTermsRequired)
    }

    /** POST /api/rides/{id}/sos with the phone's position (the screen dials 112 right away). */
    fun sendSos() {
        val current = ride ?: return
        mb.appScope.launch {
            val fix = locations.current(5_000L)
            val lat = fix?.latitude ?: current.captain?.location?.lat ?: myLocation?.lat ?: current.pickup.lat
            val lng = fix?.longitude ?: current.captain?.location?.lng ?: myLocation?.lng ?: current.pickup.lng
            repeat(3) {
                try {
                    api.sos(current.id, lat, lng)
                    return@launch
                } catch (e: ApiError) {
                    delay(2_000L)
                }
            }
        }
    }

    /** POST /api/rides/{id}/rate (optional; failures are ignored), then back to Home. */
    fun rate(stars: Int, tip: Int?, onDone: () -> Unit) {
        val current = ride
        if (current == null) {
            onDone()
            return
        }
        if (actionBusy) return
        viewModelScope.launch {
            actionBusy = true
            try {
                api.rate(current.id, stars, tip)
            } catch (e: ApiError) {
                // rating is optional
            } finally {
                actionBusy = false
            }
            clearRide()
            onDone()
        }
    }

    fun clearRide() {
        ride = null
        drop = null
        dropText = ""
        parcelPhoto = null
        quote = null
        actionError = null
        pollOffline = false
        clientId = UUID.randomUUID().toString()
    }

    // ---------------------------------------------------------------------------------------
    // History
    // ---------------------------------------------------------------------------------------

    var history by mutableStateOf<List<Ride>?>(null)
        private set
    var historyBusy by mutableStateOf(false)
        private set
    var historyError by mutableStateOf<Int?>(null)
        private set

    /** GET /api/rides?mine=1&limit=20 */
    fun loadHistory() {
        if (historyBusy) return
        viewModelScope.launch {
            historyBusy = true
            historyError = null
            try {
                history = api.myRides(20)
            } catch (e: ApiError) {
                historyError = errorText(e)
            } finally {
                historyBusy = false
            }
        }
    }

    companion object {
        private const val POLL_MS = 3_000L
        private const val PUNCTUATION = ".,!?-()'\"।"

        /** A short, friendly message (string resource) for any API failure. */
        fun errorText(e: ApiError): Int = when (e) {
            is ApiError.Network -> R.string.err_network
            is ApiError.InvalidOtp -> R.string.err_invalid_otp
            is ApiError.OtpRateLimited -> R.string.err_otp_rate
            is ApiError.OutsideArea, is ApiError.NoTown -> R.string.err_outside_area
            is ApiError.TermsRequired -> R.string.err_terms
            is ApiError.Unauthorized -> R.string.err_session
            else -> R.string.err_generic
        }
    }
}
