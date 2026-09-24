package com.manabandi.rider.location

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.ContextWrapper
import android.content.Intent
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationManager
import android.net.Uri
import android.os.Build
import android.os.Looper
import android.provider.Settings
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.ui.platform.LocalContext
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.core.location.LocationManagerCompat
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.android.gms.tasks.CancellationTokenSource
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withTimeoutOrNull
import kotlin.coroutines.resume
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.sin
import kotlin.math.sqrt

/**
 * Real GPS through Google Play services' fused location provider.
 *
 * - [current]: one fresh high-accuracy fix with a timeout, falling back to the last known fix.
 * - [updates]: a cold Flow of fixes (callbackFlow around requestLocationUpdates); collecting
 *   starts the updates, cancelling the collector stops them.
 *
 * Every call checks the runtime permission first and returns null / an empty-then-closed flow
 * when it is missing, so callers never crash with a SecurityException.
 */
class LocationProvider(context: Context) {

    private val appContext = context.applicationContext
    private val client: FusedLocationProviderClient =
        LocationServices.getFusedLocationProviderClient(appContext)

    /** One fresh fix (GPS, high accuracy) within [timeoutMs]; else the last known fix; else null. */
    @SuppressLint("MissingPermission")
    suspend fun current(timeoutMs: Long = 10_000L): Location? {
        if (!hasLocationPermission(appContext)) return null
        val cancel = CancellationTokenSource()
        val fresh = withTimeoutOrNull(timeoutMs) {
            suspendCancellableCoroutine<Location?> { cont ->
                cont.invokeOnCancellation { cancel.cancel() }
                try {
                    client.getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, cancel.token)
                        .addOnSuccessListener { location -> if (cont.isActive) cont.resume(location) }
                        .addOnFailureListener { if (cont.isActive) cont.resume(null) }
                        .addOnCanceledListener { if (cont.isActive) cont.resume(null) }
                } catch (e: SecurityException) {
                    if (cont.isActive) cont.resume(null)
                }
            }
        }
        if (fresh == null) cancel.cancel()
        return fresh ?: lastKnown()
    }

    /** The fused provider's cached fix (may be old or null). */
    @SuppressLint("MissingPermission")
    suspend fun lastKnown(): Location? {
        if (!hasLocationPermission(appContext)) return null
        return withTimeoutOrNull(3_000L) {
            suspendCancellableCoroutine<Location?> { cont ->
                try {
                    client.lastLocation
                        .addOnSuccessListener { location -> if (cont.isActive) cont.resume(location) }
                        .addOnFailureListener { if (cont.isActive) cont.resume(null) }
                        .addOnCanceledListener { if (cont.isActive) cont.resume(null) }
                } catch (e: SecurityException) {
                    if (cont.isActive) cont.resume(null)
                }
            }
        }
    }

    /**
     * Continuous high-accuracy updates every [intervalMs], only when moved at least
     * [minDistanceMeters]. The flow closes with a SecurityException when the permission is
     * missing; collectors should `catch` it.
     */
    @SuppressLint("MissingPermission")
    fun updates(intervalMs: Long, minDistanceMeters: Float = 5f): Flow<Location> = callbackFlow {
        val request = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, intervalMs)
            .setMinUpdateIntervalMillis(intervalMs / 2)
            .setMinUpdateDistanceMeters(minDistanceMeters)
            .setWaitForAccurateLocation(false)
            .build()
        val callback = object : LocationCallback() {
            override fun onLocationResult(result: LocationResult) {
                for (location in result.locations) {
                    trySend(location)
                }
            }
        }
        if (!hasLocationPermission(appContext)) {
            close(SecurityException("Location permission not granted"))
        } else {
            try {
                client.requestLocationUpdates(request, callback, Looper.getMainLooper())
                    .addOnFailureListener { e -> close(e) }
            } catch (e: SecurityException) {
                close(e)
            }
        }
        awaitClose { client.removeLocationUpdates(callback) }
    }

    companion object {
        /** Straight-line distance in metres (haversine). */
        fun distanceMeters(lat1: Double, lng1: Double, lat2: Double, lng2: Double): Double {
            val r = 6_371_000.0
            val dLat = Math.toRadians(lat2 - lat1)
            val dLng = Math.toRadians(lng2 - lng1)
            val a = sin(dLat / 2) * sin(dLat / 2) +
                cos(Math.toRadians(lat1)) * cos(Math.toRadians(lat2)) * sin(dLng / 2) * sin(dLng / 2)
            return 2 * r * atan2(sqrt(a), sqrt(1 - a))
        }
    }
}

// -------------------------------------------------------------------------------------------------
// Permission helpers
// -------------------------------------------------------------------------------------------------

/** True when FINE or COARSE location is granted. */
fun hasLocationPermission(context: Context): Boolean =
    isGranted(context, Manifest.permission.ACCESS_FINE_LOCATION) ||
        isGranted(context, Manifest.permission.ACCESS_COARSE_LOCATION)

/** True when precise (GPS) location is granted. */
fun hasFineLocationPermission(context: Context): Boolean =
    isGranted(context, Manifest.permission.ACCESS_FINE_LOCATION)

private fun isGranted(context: Context, permission: String): Boolean =
    ContextCompat.checkSelfPermission(context, permission) == PackageManager.PERMISSION_GRANTED

/** FINE + COARSE, plus POST_NOTIFICATIONS on Android 13+ when [includeNotifications]. */
fun locationPermissionsToRequest(includeNotifications: Boolean): Array<String> {
    val list = mutableListOf(
        Manifest.permission.ACCESS_FINE_LOCATION,
        Manifest.permission.ACCESS_COARSE_LOCATION
    )
    if (includeNotifications && Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        list.add(Manifest.permission.POST_NOTIFICATIONS)
    }
    return list.toTypedArray()
}

/** Is the phone's location (GPS) switch on? */
fun isLocationEnabled(context: Context): Boolean {
    val manager = context.getSystemService(Context.LOCATION_SERVICE) as? LocationManager ?: return false
    return LocationManagerCompat.isLocationEnabled(manager)
}

/** Opens this app's page in system settings (to grant a permission that was denied for good). */
fun openAppSettings(context: Context) {
    try {
        val intent = Intent(
            Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
            Uri.fromParts("package", context.packageName, null)
        ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(intent)
    } catch (e: ActivityNotFoundException) {
        // nothing else we can do
    }
}

/** Opens the system "Location" switch screen. */
fun openLocationSettings(context: Context) {
    try {
        context.startActivity(
            Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        )
    } catch (e: ActivityNotFoundException) {
        openAppSettings(context)
    }
}

/** Walks the ContextWrapper chain to the hosting Activity (null in previews). */
tailrec fun Context.findActivity(): Activity? = when (this) {
    is Activity -> this
    is ContextWrapper -> baseContext.findActivity()
    else -> null
}

/** What happened after the system permission dialog. */
enum class PermissionOutcome {
    GRANTED,

    /** Denied, but we may ask again. */
    DENIED,

    /** Denied with "don't ask again" (or denied twice): only system settings can fix it now. */
    DENIED_FOREVER
}

/**
 * Compose helper around [ActivityResultContracts.RequestMultiplePermissions] for
 * FINE + COARSE location (and POST_NOTIFICATIONS on Android 13+ when [includeNotifications]).
 * Returns a function that shows the system dialog; [onResult] gets the outcome.
 * Show a rationale screen first (see ui/components/PermissionRationale.kt).
 */
@Composable
fun rememberLocationPermissionLauncher(
    includeNotifications: Boolean,
    onResult: (PermissionOutcome) -> Unit
): () -> Unit {
    val context = LocalContext.current
    val currentOnResult by rememberUpdatedState(onResult)
    val launcher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { results ->
        val granted = results[Manifest.permission.ACCESS_FINE_LOCATION] == true ||
            results[Manifest.permission.ACCESS_COARSE_LOCATION] == true ||
            hasLocationPermission(context)
        val outcome = when {
            granted -> PermissionOutcome.GRANTED
            else -> {
                val activity = context.findActivity()
                val canAskAgain = activity != null && ActivityCompat.shouldShowRequestPermissionRationale(
                    activity, Manifest.permission.ACCESS_FINE_LOCATION
                )
                if (canAskAgain) PermissionOutcome.DENIED else PermissionOutcome.DENIED_FOREVER
            }
        }
        currentOnResult(outcome)
    }
    return remember(launcher, includeNotifications) {
        { launcher.launch(locationPermissionsToRequest(includeNotifications)) }
    }
}
