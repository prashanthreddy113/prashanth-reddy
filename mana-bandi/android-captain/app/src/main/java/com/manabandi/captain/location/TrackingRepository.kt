package com.manabandi.captain.location

import android.os.SystemClock
import com.manabandi.captain.data.api.HeartbeatResponse
import com.manabandi.captain.data.api.LatLng
import com.manabandi.captain.data.api.Offer
import com.manabandi.captain.data.api.RideStatus
import com.manabandi.captain.data.api.Trip
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import java.util.Collections

/**
 * Process-wide state shared by [TrackingService] (which writes the heartbeat results) and the
 * UI (which reads them): is tracking running, the pending ride offer, the current trip and the
 * captain's last GPS position.
 *
 * Race protection: a heartbeat that was SENT before the captain accepted / rejected / finished
 * something locally is not allowed to overwrite the offer or trip (its answer is older than
 * what we already know). Trip status never goes backwards for the same ride.
 */
object TrackingRepository {

    data class State(
        /** The foreground service is running (the captain is online in the app). */
        val running: Boolean = false,
        /** What the server said in the last heartbeat. */
        val serverOnline: Boolean = false,
        val offer: Offer? = null,
        /** SystemClock.elapsedRealtime() when the current offer expires (from `secondsLeft`). */
        val offerDeadline: Long = 0L,
        val trip: Trip? = null,
        /** False while heartbeats fail (no network); points are buffered meanwhile. */
        val connected: Boolean = true,
        /** Set when the trip disappeared without us finishing it (rider cancelled). */
        val tripEndedByOther: Boolean = false
    )

    private val _state = MutableStateFlow(State())
    val state: StateFlow<State> = _state.asStateFlow()

    private val _location = MutableStateFlow<LatLng?>(null)

    /** The captain's last GPS fix (for the maps). */
    val location: StateFlow<LatLng?> = _location.asStateFlow()

    private val _appVisible = MutableStateFlow(false)

    /** True while MainActivity is started (visible). Offers get a notification only when false. */
    val appVisible: StateFlow<Boolean> = _appVisible.asStateFlow()

    private val dismissedOfferIds: MutableSet<String> = Collections.synchronizedSet(mutableSetOf())
    private val closedRideIds: MutableSet<String> = Collections.synchronizedSet(mutableSetOf())

    @Volatile
    private var lastLocalChange = 0L

    fun setRunning(running: Boolean) {
        _state.update {
            if (running) it.copy(running = true) else it.copy(running = false, offer = null, offerDeadline = 0L)
        }
    }

    fun setAppVisible(visible: Boolean) {
        _appVisible.value = visible
    }

    fun updateLocation(lat: Double, lng: Double) {
        _location.value = LatLng(lat, lng)
    }

    /** Applies a heartbeat answer. [sentAt] = elapsedRealtime() just before the request. */
    fun onHeartbeat(response: HeartbeatResponse, sentAt: Long) {
        val stale = sentAt < lastLocalChange
        val now = SystemClock.elapsedRealtime()
        _state.update { current ->
            if (stale) {
                current.copy(serverOnline = response.online, connected = true)
            } else {
                val incomingOffer = response.offer
                val offer = if (incomingOffer == null || incomingOffer.id in dismissedOfferIds) null else incomingOffer
                val deadline = when {
                    offer == null -> 0L
                    offer.id == current.offer?.id -> current.offerDeadline
                    else -> now + offer.secondsLeft.coerceAtLeast(1) * 1000L
                }
                val trip = mergeTrip(current.trip, response.trip)
                val endedByOther = current.trip != null &&
                    current.trip.status != RideStatus.FINISHED &&
                    trip == null
                current.copy(
                    serverOnline = response.online,
                    offer = offer,
                    offerDeadline = deadline,
                    trip = trip,
                    connected = true,
                    tripEndedByOther = current.tripEndedByOther || endedByOther
                )
            }
        }
    }

    fun onHeartbeatFailed() {
        _state.update { it.copy(connected = false) }
    }

    /** The trip returned by accept / arrived / start / deliver / finish, or the resumed trip. */
    fun setTrip(trip: Trip) {
        lastLocalChange = SystemClock.elapsedRealtime()
        closedRideIds.remove(trip.rideId)
        _state.update { it.copy(trip = trip, offer = null, offerDeadline = 0L, tripEndedByOther = false) }
    }

    /** Collected or cancelled by us: forget the trip (a late heartbeat must not bring it back). */
    fun closeTrip(rideId: String) {
        lastLocalChange = SystemClock.elapsedRealtime()
        closedRideIds.add(rideId)
        _state.update { if (it.trip?.rideId == rideId) it.copy(trip = null) else it }
    }

    /** Rejected, timed out, expired or taken: hide this offer for good. */
    fun dismissOffer(offerId: String) {
        lastLocalChange = SystemClock.elapsedRealtime()
        dismissedOfferIds.add(offerId)
        _state.update { if (it.offer?.id == offerId) it.copy(offer = null, offerDeadline = 0L) else it }
    }

    fun consumeTripEndedNotice() {
        _state.update { it.copy(tripEndedByOther = false) }
    }

    /** Logout. */
    fun reset() {
        lastLocalChange = SystemClock.elapsedRealtime()
        dismissedOfferIds.clear()
        closedRideIds.clear()
        _state.value = State()
        _location.value = null
    }

    private fun rank(status: String): Int = when (status) {
        RideStatus.ACCEPTED -> 1
        RideStatus.ARRIVED -> 2
        RideStatus.STARTED -> 3
        RideStatus.FINISHED -> 4
        else -> 0
    }

    private fun mergeTrip(current: Trip?, incoming: Trip?): Trip? {
        if (incoming == null) {
            // A finished trip stays on screen until the captain taps "collected".
            return if (current != null && current.status == RideStatus.FINISHED &&
                current.rideId !in closedRideIds
            ) current else null
        }
        if (incoming.rideId in closedRideIds) return null
        if (current != null && current.rideId == incoming.rideId && rank(incoming.status) < rank(current.status)) {
            return current
        }
        return incoming
    }
}
