package com.manabandi.captain.ui.components

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.Toast
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import com.manabandi.captain.R

/** 🧭 "Show the way": opens turn-by-turn navigation to [lat],[lng]. */
@Composable
fun NavigateButton(
    lat: Double,
    lng: Double,
    label: String,
    modifier: Modifier = Modifier,
    color: Color = MaterialTheme.colorScheme.primary
) {
    val context = LocalContext.current
    val noMaps = stringResource(R.string.maps_unavailable)
    SecondaryButton(
        text = stringResource(R.string.navigate),
        emoji = "🧭",
        onClick = { openNavigation(context, lat, lng, label, noMaps) },
        modifier = modifier,
        color = color
    )
}

/**
 * Google Maps navigation intent first; then any app that handles a geo: URI;
 * then a Toast. No permission needed.
 */
fun openNavigation(context: Context, lat: Double, lng: Double, label: String, unavailableMessage: String) {
    val gmaps = Intent(Intent.ACTION_VIEW, Uri.parse("google.navigation:q=$lat,$lng")).apply {
        setPackage("com.google.android.apps.maps")
    }
    try {
        context.startActivity(gmaps)
        return
    } catch (e: ActivityNotFoundException) {
        // fall through to the generic geo: intent
    }
    val geo = Intent(
        Intent.ACTION_VIEW,
        Uri.parse("geo:$lat,$lng?q=$lat,$lng(" + Uri.encode(label) + ")")
    )
    try {
        context.startActivity(geo)
    } catch (e: ActivityNotFoundException) {
        Toast.makeText(context, unavailableMessage, Toast.LENGTH_LONG).show()
    }
}
