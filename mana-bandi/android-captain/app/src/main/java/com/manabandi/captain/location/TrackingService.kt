package com.manabandi.captain.location

import android.annotation.SuppressLint
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.location.Location
import android.media.RingtoneManager
import android.os.IBinder
import android.os.SystemClock
import androidx.core.app.NotificationManagerCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import com.manabandi.captain.ManaBandiCaptainApplication
import com.manabandi.captain.R
import com.manabandi.captain.data.LocalePrefs
import com.manabandi.captain.data.api.ApiError
import com.manabandi.captain.data.api.LocationPoint
import com.manabandi.captain.data.api.Offer
import com.manabandi.captain.data.api.RideStatus
import com.manabandi.captain.data.displayName
import com.manabandi.captain.data.formatKm
import com.manabandi.captain.data.isoUtc
import com.manabandi.captain.ui.components.vibrateNewRequest
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch
import kotlin.math.min

/**
 * The captain's "I am online" foreground service (type `location`).
 *
 * - Shows a persistent notification "🟢 Online — looking for rides" with a "Go offline" action.
 * - Requests fused GPS updates: every 5 s on a trip, every 10 s when idle, min 5 m movement.
 * - Buffers the points in memory (max 200) and POSTs them to /api/captain/location on every
 *   tick (1–20 points, oldest first). Offline → exponential backoff; the buffer is flushed
 *   when the network is back. A stationary captain re-sends the last fix with the current time
 *   so the server keeps them "online" (last point < 60 s).
 * - Publishes each heartbeat answer (`offer`, `trip`) through [TrackingRepository]. A NEW offer
 *   buzzes, rings, is spoken aloud, and when the app is in the background also shows a
 *   high-priority full-screen notification that opens the request screen.
 * - Keeps running for the whole trip even if the UI is closed; stops on "go offline", logout,
 *   a 401, or when the server says the captain is offline (and no trip is running).
 *
 * Start it only from a visible screen after the location permission was granted
 * ([start]); Android 14 refuses a location foreground service otherwise.
 */
class TrackingService : Service() {

    private class Pending(val seq: Long, val point: LocationPoint)

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private lateinit var app: ManaBandiCaptainApplication

    private val buffer = ArrayDeque<Pending>()
    private var nextSeq = 0L
    private var lastFix: Location? = null
    private var onTrip = false
    private var loopsStarted = false
    private var locationJob: Job? = null
    private var lastAlertedOfferId: String? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        app = application as ManaBandiCaptainApplication
        CaptainNotifications.createChannels(this)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_GO_OFFLINE) {
            goOfflineFromNotification()
            return START_NOT_STICKY
        }
        // Only logged-in captains with the location permission (checked by the caller too).
        val allowed = app.session.isLoggedIn && hasLocationPermission(this)
        if (!allowed || !enterForeground()) {
            stopTracking()
            return START_NOT_STICKY
        }
        if (!loopsStarted) {
            loopsStarted = true
            TrackingRepository.setRunning(true)
            startLoops()
        }
        return START_STICKY
    }

    override fun onDestroy() {
        scope.cancel()
        TrackingRepository.setRunning(false)
        CaptainNotifications.cancelOffer(this)
        super.onDestroy()
    }

    /** startForeground with type `location`. False if Android refuses (e.g. started from the background). */
    private fun enterForeground(): Boolean = try {
        ServiceCompat.startForeground(
            this,
            CaptainNotifications.TRACKING_ID,
            CaptainNotifications.tracking(this, onTrip),
            ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION
        )
        true
    } catch (e: SecurityException) {
        false
    } catch (e: IllegalStateException) {
        // ForegroundServiceStartNotAllowedException (Android 12+) is an IllegalStateException.
        false
    }

    private fun startLoops() {
        // On a trip: faster GPS + a notification without the "go offline" action.
        scope.launch {
            TrackingRepository.state
                .map { state -> state.trip?.let { it.status != RideStatus.FINISHED } ?: false }
                .distinctUntilChanged()
                .collect { tripRunning ->
                    onTrip = tripRunning
                    restartLocationUpdates()
                    updateNotification()
                }
        }
        // New offers: buzz, ring, speak, and notify when the app is not visible.
        scope.launch {
            TrackingRepository.state
                .map { it.offer }
                .distinctUntilChanged { old, new -> old?.id == new?.id }
                .collect { offer ->
                    if (offer == null) {
                        CaptainNotifications.cancelOffer(this@TrackingService)
                    } else if (offer.id != lastAlertedOfferId) {
                        lastAlertedOfferId = offer.id
                        alert(offer)
                    }
                }
        }
        scope.launch { heartbeatLoop() }
    }

    private fun restartLocationUpdates() {
        locationJob?.cancel()
        val interval = if (onTrip) TRIP_INTERVAL_MS else IDLE_INTERVAL_MS
        locationJob = scope.launch {
            app.locations.updates(interval, MIN_DISTANCE_M)
                .catch { e -> if (e is SecurityException) stopTracking() }
                .collect { location -> onFix(location) }
        }
    }

    private fun onFix(location: Location) {
        lastFix = location
        TrackingRepository.updateLocation(location.latitude, location.longitude)
        add(location.toPoint(location.time))
    }

    private fun add(point: LocationPoint) {
        buffer.addLast(Pending(nextSeq++, point))
        while (buffer.size > MAX_BUFFER) buffer.removeFirst()
    }

    private suspend fun heartbeatLoop() {
        var failures = 0
        while (true) {
            val ok = sendBeat()
            val interval = if (onTrip) TRIP_INTERVAL_MS else IDLE_INTERVAL_MS
            if (ok) {
                failures = 0
                // Still a backlog from an offline stretch: flush the next batch right away.
                if (buffer.size < MAX_BATCH) delay(interval) else delay(500L)
            } else {
                failures++
                delay(min(interval shl min(failures, 4), MAX_BACKOFF_MS))
            }
        }
    }

    /** One POST /api/captain/location. Returns false when it should be retried with backoff. */
    private suspend fun sendBeat(): Boolean {
        if (buffer.isEmpty()) {
            // Not moving (no new fix): re-send the last position with the current time.
            val fix = lastFix ?: app.locations.lastKnown()?.also { lastFix = it } ?: return true
            add(fix.toPoint(System.currentTimeMillis()))
        }
        val batch = buffer.take(MAX_BATCH)
        val lastSeq = batch.last().seq
        val sentAt = SystemClock.elapsedRealtime()
        return try {
            val response = app.api.heartbeat(batch.map { it.point })
            buffer.removeAll { it.seq <= lastSeq }
            TrackingRepository.onHeartbeat(response, sentAt)
            if (!response.online && TrackingRepository.state.value.trip == null) stopTracking()
            true
        } catch (e: ApiError) {
            TrackingRepository.onHeartbeatFailed()
            when (e) {
                is ApiError.Unauthorized, is ApiError.Forbidden -> {
                    stopTracking()
                    true
                }
                is ApiError.NotOnline -> {
                    if (TrackingRepository.state.value.trip == null) stopTracking()
                    true
                }
                is ApiError.Validation -> {
                    // The server will never accept these points: drop them instead of looping.
                    buffer.removeAll { it.seq <= lastSeq }
                    true
                }
                else -> false
            }
        }
    }

    private fun alert(offer: Offer) {
        vibrateNewRequest(this)
        playRingtone()
        val text = LocalePrefs.localizedContext(this)
        val language = LocalePrefs.currentLocale(this).language
        val pickup = offer.pickup.displayName(language, text.getString(R.string.pin_rider))
        val spoken = text.getString(R.string.request_speech, pickup, formatKm(offer.distanceToPickupKm), offer.fare)
        app.speech.speak(spoken, LocalePrefs.currentLocale(this))
        if (!TrackingRepository.appVisible.value) {
            CaptainNotifications.showOffer(this, offer, spoken)
        }
    }

    private fun playRingtone() {
        try {
            val uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION) ?: return
            RingtoneManager.getRingtone(applicationContext, uri)?.play()
        } catch (e: Exception) {
            // sound is a convenience only
        }
    }

    @SuppressLint("MissingPermission")
    private fun updateNotification() {
        try {
            val manager = NotificationManagerCompat.from(this)
            if (manager.areNotificationsEnabled()) {
                manager.notify(CaptainNotifications.TRACKING_ID, CaptainNotifications.tracking(this, onTrip))
            }
        } catch (e: SecurityException) {
            // ignore
        }
    }

    private fun goOfflineFromNotification() {
        if (!loopsStarted) {
            stopTracking()
            return
        }
        if (onTrip) return
        scope.launch {
            val fix = lastFix
            try {
                app.api.setOnline(false, fix?.latitude, fix?.longitude)
            } catch (e: ApiError) {
                // the server marks us offline after 60 s without a heartbeat anyway
            }
            stopTracking()
        }
    }

    private fun stopTracking() {
        TrackingRepository.setRunning(false)
        ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    private fun Location.toPoint(millis: Long) = LocationPoint(
        lat = latitude,
        lng = longitude,
        accuracy = if (hasAccuracy()) accuracy.toDouble() else null,
        speed = if (hasSpeed()) speed.toDouble() else null,
        heading = if (hasBearing()) bearing.toDouble() else null,
        at = isoUtc(millis)
    )

    companion object {
        const val ACTION_GO_OFFLINE = "com.manabandi.captain.GO_OFFLINE"

        private const val TRIP_INTERVAL_MS = 5_000L
        private const val IDLE_INTERVAL_MS = 10_000L
        private const val MIN_DISTANCE_M = 5f
        private const val MAX_BUFFER = 200
        private const val MAX_BATCH = 20
        private const val MAX_BACKOFF_MS = 60_000L

        /** Call only from a visible screen, after the location permission was granted. */
        fun start(context: Context) {
            ContextCompat.startForegroundService(context, Intent(context, TrackingService::class.java))
        }

        fun stop(context: Context) {
            context.stopService(Intent(context, TrackingService::class.java))
        }
    }
}
