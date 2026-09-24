package com.manabandi.captain.ui.components

import android.content.Context
import android.content.ContextWrapper
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.drawable.BitmapDrawable
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.LifecycleOwner
import com.manabandi.captain.BuildConfig
import com.manabandi.captain.location.LocationProvider
import org.osmdroid.config.Configuration
import org.osmdroid.events.MapEventsReceiver
import org.osmdroid.tileprovider.tilesource.TileSourceFactory
import org.osmdroid.util.GeoPoint
import org.osmdroid.views.CustomZoomButtonsController
import org.osmdroid.views.MapView
import org.osmdroid.views.overlay.MapEventsOverlay
import org.osmdroid.views.overlay.Marker
import java.io.File
import kotlin.math.max
import kotlin.math.roundToInt

/** One pin on the map. [id] keeps the same osmdroid Marker across recompositions (it just moves). */
data class MapMarker(
    val id: String,
    val lat: Double,
    val lng: Double,
    val emoji: String,
    val title: String? = null
)

private var osmConfigured = false

/**
 * osmdroid needs a user agent (OpenStreetMap tile policy) and a writable tile cache.
 * Called from the Application and again (no-op) before the first MapView is created.
 */
fun ensureOsmConfigured(context: Context) {
    if (osmConfigured) return
    val app = context.applicationContext
    val config = Configuration.getInstance()
    config.load(app, app.getSharedPreferences("osmdroid", Context.MODE_PRIVATE))
    config.userAgentValue = BuildConfig.APPLICATION_ID
    val base = File(app.cacheDir, "osmdroid")
    config.osmdroidBasePath = base
    config.osmdroidTileCache = File(base, "tiles")
    osmConfigured = true
}

/**
 * OpenStreetMap (osmdroid [MapView]) inside Compose.
 *
 * - [markers] are synced on every recomposition: new ids are added, missing ids removed,
 *   existing ones moved (so the captain pin glides instead of blinking).
 * - The camera fits all markers the first time, whenever the set of ids changes, and whenever
 *   a marker leaves the visible area. Otherwise the user can pan / zoom freely.
 * - [onTap] (optional) receives the tapped point, e.g. to choose a drop on the map.
 * - The MapView follows the Activity lifecycle (onResume / onPause) and is detached when this
 *   composable leaves the screen.
 */
@Composable
fun OsmMap(
    markers: List<MapMarker>,
    modifier: Modifier = Modifier,
    onTap: ((lat: Double, lng: Double) -> Unit)? = null
) {
    val context = LocalContext.current
    val currentOnTap by rememberUpdatedState(onTap)

    val state = remember { MapState() }
    val mapView = remember {
        ensureOsmConfigured(context)
        MapView(context).apply {
            setTileSource(TileSourceFactory.MAPNIK)
            setMultiTouchControls(true)
            isTilesScaledToDpi = true
            zoomController.setVisibility(CustomZoomButtonsController.Visibility.NEVER)
            setMinZoomLevel(5.0)
            setMaxZoomLevel(19.0)
            controller.setZoom(15.0)
            val receiver = object : MapEventsReceiver {
                override fun singleTapConfirmedHelper(p: GeoPoint?): Boolean {
                    val callback = currentOnTap ?: return false
                    if (p != null) callback(p.latitude, p.longitude)
                    return true
                }

                override fun longPressHelper(p: GeoPoint?): Boolean = false
            }
            overlays.add(0, MapEventsOverlay(receiver))
        }
    }

    // Follow the Activity lifecycle; detach the view when leaving the screen.
    val lifecycleOwner = remember(context) { context.findLifecycleOwner() }
    DisposableEffect(lifecycleOwner, mapView) {
        val observer = LifecycleEventObserver { _, event ->
            when (event) {
                Lifecycle.Event.ON_RESUME -> mapView.onResume()
                Lifecycle.Event.ON_PAUSE -> mapView.onPause()
                else -> Unit
            }
        }
        val lifecycle = lifecycleOwner?.lifecycle
        if (lifecycle != null) {
            lifecycle.addObserver(observer)
        } else {
            mapView.onResume()
        }
        onDispose {
            lifecycle?.removeObserver(observer)
            mapView.onPause()
            mapView.onDetach()
        }
    }

    Box(
        modifier = modifier
            .clip(RoundedCornerShape(24.dp))
            .border(2.dp, Color(0xFFB8B4A8), RoundedCornerShape(24.dp))
    ) {
        AndroidView(
            factory = { mapView },
            modifier = Modifier.fillMaxSize(),
            update = { map -> syncMarkers(map, markers, state) }
        )
        // Attribution required by the OpenStreetMap licence.
        Text(
            text = "© OpenStreetMap",
            fontSize = 11.sp,
            color = Color(0xFF333333),
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .padding(6.dp)
                .background(Color(0xCCFFFFFF), RoundedCornerShape(6.dp))
                .padding(horizontal = 4.dp)
        )
    }
}

private class MapState {
    val markers = mutableMapOf<String, Pair<Marker, String>>()
    var fittedIds: Set<String> = emptySet()
}

private fun syncMarkers(map: MapView, wanted: List<MapMarker>, state: MapState) {
    val wantedIds = wanted.map { it.id }.toSet()

    // Remove markers that are gone.
    val iterator = state.markers.entries.iterator()
    while (iterator.hasNext()) {
        val entry = iterator.next()
        if (entry.key !in wantedIds) {
            map.overlays.remove(entry.value.first)
            iterator.remove()
        }
    }

    // Add new markers, move existing ones.
    for (item in wanted) {
        val existing = state.markers[item.id]
        val marker: Marker
        if (existing == null) {
            marker = Marker(map)
            marker.setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_CENTER)
            marker.icon = emojiDrawable(map.context, item.emoji)
            marker.setOnMarkerClickListener { _, _ -> true }   // no info bubbles
            map.overlays.add(marker)
            state.markers[item.id] = marker to item.emoji
        } else {
            marker = existing.first
            if (existing.second != item.emoji) {
                marker.icon = emojiDrawable(map.context, item.emoji)
                state.markers[item.id] = marker to item.emoji
            }
        }
        marker.position = GeoPoint(item.lat, item.lng)
        marker.title = item.title
    }

    // Camera: fit when the set of pins changed, or when a pin left the visible area.
    if (wanted.isNotEmpty()) {
        val box = map.boundingBox
        val offScreen = map.width > 0 && wanted.any { !box.contains(it.lat, it.lng) }
        if (wantedIds != state.fittedIds || offScreen) {
            fitCamera(map, wanted)
            state.fittedIds = wantedIds
        }
    }
    map.invalidate()
}

/** Centres on the markers and picks a zoom from their spread (no layout size needed). */
private fun fitCamera(map: MapView, markers: List<MapMarker>) {
    val minLat = markers.minOf { it.lat }
    val maxLat = markers.maxOf { it.lat }
    val minLng = markers.minOf { it.lng }
    val maxLng = markers.maxOf { it.lng }
    val center = GeoPoint((minLat + maxLat) / 2, (minLng + maxLng) / 2)
    val span = max(
        LocationProvider.distanceMeters(minLat, minLng, maxLat, minLng),
        LocationProvider.distanceMeters(minLat, minLng, minLat, maxLng)
    )
    val zoom = when {
        span < 250 -> 17.0
        span < 600 -> 16.0
        span < 1_300 -> 15.0
        span < 2_800 -> 14.0
        span < 5_500 -> 13.0
        span < 11_000 -> 12.0
        span < 22_000 -> 11.0
        else -> 10.0
    }
    map.controller.setZoom(zoom)
    map.controller.setCenter(center)
}

/** Draws [emoji] on a white disc with a green ring, so pins read well on any map tile. */
private fun emojiDrawable(context: Context, emoji: String, sizeDp: Int = 44): BitmapDrawable {
    val density = context.resources.displayMetrics.density
    val size = (sizeDp * density).roundToInt().coerceAtLeast(24)
    val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bitmap)
    val radius = size / 2f
    val fill = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = android.graphics.Color.WHITE
        style = Paint.Style.FILL
    }
    val ring = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = android.graphics.Color.parseColor("#128A46")
        style = Paint.Style.STROKE
        strokeWidth = 3f * density
    }
    canvas.drawCircle(radius, radius, radius - ring.strokeWidth, fill)
    canvas.drawCircle(radius, radius, radius - ring.strokeWidth, ring)
    val text = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        textSize = size * 0.55f
        textAlign = Paint.Align.CENTER
    }
    val baseline = radius - (text.descent() + text.ascent()) / 2f
    canvas.drawText(emoji, radius, baseline, text)
    return BitmapDrawable(context.resources, bitmap)
}

/** The Activity (a LifecycleOwner) behind a Compose context; null in previews. */
private tailrec fun Context.findLifecycleOwner(): LifecycleOwner? = when (this) {
    is LifecycleOwner -> this
    is ContextWrapper -> baseContext.findLifecycleOwner()
    else -> null
}
