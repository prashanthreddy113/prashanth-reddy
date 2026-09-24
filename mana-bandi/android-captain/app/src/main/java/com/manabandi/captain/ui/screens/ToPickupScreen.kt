package com.manabandi.captain.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.manabandi.captain.CaptainViewModel
import com.manabandi.captain.R
import com.manabandi.captain.data.Service
import com.manabandi.captain.data.api.Place
import com.manabandi.captain.data.displayName
import com.manabandi.captain.location.TrackingRepository
import com.manabandi.captain.ui.components.BigButton
import com.manabandi.captain.ui.components.CallButton
import com.manabandi.captain.ui.components.MapMarker
import com.manabandi.captain.ui.components.NavigateButton
import com.manabandi.captain.ui.components.OsmMap
import com.manabandi.captain.ui.components.SpeakTopBar
import com.manabandi.captain.ui.components.appLanguage
import com.manabandi.captain.ui.theme.GreenLight

/**
 * Go to the rider: OpenStreetMap with 🏍️ you + 🧍 pickup, rider card, 📞 call rider,
 * 🧭 "Show the way" (Google Maps to the real coordinates), ✅ I have arrived
 * (POST /api/captain/trip/arrived), and a small "cancel this ride" link.
 */
@Composable
fun ToPickupScreen(vm: CaptainViewModel, onCancelled: () -> Unit) {
    val tracking by TrackingRepository.state.collectAsState()
    val trip = tracking.trip ?: return
    val service = Service.fromApi(trip.service)
    val pickupName = trip.pickup.displayName(appLanguage(), stringResource(R.string.pin_rider))
    var confirmCancel by rememberSaveable { mutableStateOf(false) }

    Scaffold(
        topBar = {
            SpeakTopBar(
                title = stringResource(R.string.pickup_title),
                speechText = stringResource(R.string.pickup_speech)
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .padding(padding)
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            TripMap(target = trip.pickup, targetEmoji = "🧍", captainEmoji = service.emoji)
            Text(
                text = "📍 $pickupName",
                fontSize = 30.sp,
                lineHeight = 38.sp,
                style = MaterialTheme.typography.headlineMedium
            )

            // Rider card
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(24.dp),
                colors = CardDefaults.cardColors(containerColor = GreenLight)
            ) {
                Row(
                    modifier = Modifier.padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(
                        modifier = Modifier
                            .size(80.dp)
                            .background(Color.White, CircleShape)
                            .border(3.dp, MaterialTheme.colorScheme.primary, CircleShape),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(text = "🧑", fontSize = 44.sp)
                    }
                    Spacer(modifier = Modifier.width(16.dp))
                    Column {
                        Text(
                            text = "${service.emoji} " + stringResource(R.string.rider),
                            style = MaterialTheme.typography.bodyLarge,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Text(text = trip.rider.name, style = MaterialTheme.typography.headlineMedium)
                        Text(text = trip.rider.phone, style = MaterialTheme.typography.bodyLarge)
                    }
                }
            }

            if (trip.rider.phone.isNotBlank()) {
                CallButton(
                    label = stringResource(R.string.call_rider),
                    phoneNumber = trip.rider.phone
                )
            }
            NavigateButton(
                lat = trip.pickup.lat,
                lng = trip.pickup.lng,
                label = pickupName
            )

            TripErrorText(vm.tripError)
            Spacer(modifier = Modifier.height(8.dp))
            BigButton(
                text = stringResource(if (vm.tripBusy) R.string.please_wait else R.string.arrived),
                emoji = if (vm.tripBusy) "⏳" else "✅",
                enabled = !vm.tripBusy,
                onClick = { vm.arrived() }
            )
            TextButton(
                onClick = { confirmCancel = true },
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(
                    text = "❌ " + stringResource(R.string.trip_cancel),
                    fontSize = 20.sp,
                    color = MaterialTheme.colorScheme.error
                )
            }
        }
    }

    if (confirmCancel) {
        AlertDialog(
            onDismissRequest = { confirmCancel = false },
            title = { Text(text = stringResource(R.string.trip_cancel_confirm)) },
            confirmButton = {
                TextButton(onClick = {
                    confirmCancel = false
                    vm.cancelTrip(onDone = onCancelled)
                }) {
                    Text(text = "❌ " + stringResource(R.string.trip_cancel_yes), fontSize = 20.sp)
                }
            },
            dismissButton = {
                TextButton(onClick = { confirmCancel = false }) {
                    Text(text = "✅ " + stringResource(R.string.trip_cancel_no), fontSize = 20.sp)
                }
            }
        )
    }
}

/** OpenStreetMap with the captain's live position and one target pin. Shared by the trip screens. */
@Composable
fun TripMap(target: Place, targetEmoji: String, captainEmoji: String) {
    val me by TrackingRepository.location.collectAsState()
    val here = me
    val markers = listOfNotNull(
        MapMarker(id = "target", lat = target.lat, lng = target.lng, emoji = targetEmoji),
        here?.let { MapMarker(id = "captain", lat = it.lat, lng = it.lng, emoji = captainEmoji) }
    )
    OsmMap(
        markers = markers,
        modifier = Modifier
            .fillMaxWidth()
            .height(240.dp)
    )
}

@Composable
fun TripErrorText(message: Int?) {
    if (message == null) return
    Text(
        text = stringResource(message),
        style = MaterialTheme.typography.titleMedium,
        color = MaterialTheme.colorScheme.error,
        modifier = Modifier.fillMaxWidth(),
        textAlign = TextAlign.Center
    )
}
