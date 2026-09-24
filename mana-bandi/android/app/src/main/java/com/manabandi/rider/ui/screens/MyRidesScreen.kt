package com.manabandi.rider.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.manabandi.rider.R
import com.manabandi.rider.RideViewModel
import com.manabandi.rider.data.Service
import com.manabandi.rider.data.displayName
import com.manabandi.rider.data.formatIsoTime
import com.manabandi.rider.data.api.Ride
import com.manabandi.rider.data.api.RideStatus
import com.manabandi.rider.ui.components.BottomTab
import com.manabandi.rider.ui.components.ManaBandiBottomBar
import com.manabandi.rider.ui.components.SecondaryButton
import com.manabandi.rider.ui.components.SpeakTopBar
import com.manabandi.rider.ui.components.appLanguage
import com.manabandi.rider.ui.theme.GreenLight
import com.manabandi.rider.ui.theme.ParcelOrangeLight
import com.manabandi.rider.ui.theme.TurmericLight

/** Past rides from GET /api/rides?mine=1&limit=20. */
@Composable
fun MyRidesScreen(vm: RideViewModel, onHome: () -> Unit, onHelp: () -> Unit) {
    LaunchedEffect(Unit) { vm.loadHistory() }
    val history = vm.history

    Scaffold(
        topBar = {
            SpeakTopBar(
                title = stringResource(R.string.rides_title),
                speechText = stringResource(R.string.rides_speech)
            )
        },
        bottomBar = {
            ManaBandiBottomBar(
                current = BottomTab.RIDES,
                onHome = onHome,
                onRides = {},
                onHelp = onHelp
            )
        }
    ) { padding ->
        LazyColumn(
            modifier = Modifier
                .padding(padding)
                .fillMaxSize(),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            if (vm.historyBusy && history == null) {
                item {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.Center
                    ) {
                        CircularProgressIndicator(modifier = Modifier.size(48.dp))
                    }
                }
            }
            val error = vm.historyError
            if (error != null) {
                item {
                    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        ErrorText(error)
                        SecondaryButton(
                            text = stringResource(R.string.retry),
                            emoji = "🔁",
                            onClick = { vm.loadHistory() }
                        )
                    }
                }
            }
            if (history != null && history.isEmpty()) {
                item {
                    Text(
                        text = "🛺 " + stringResource(R.string.rides_empty),
                        style = MaterialTheme.typography.titleLarge,
                        modifier = Modifier.fillMaxWidth(),
                        textAlign = TextAlign.Center
                    )
                }
            }
            items(history ?: emptyList()) { ride -> RideRow(ride) }
        }
    }
}

@Composable
private fun RideRow(ride: Ride) {
    val service = Service.fromApi(ride.service)
    val tint = when (service) {
        Service.BIKE -> TurmericLight
        Service.AUTO -> GreenLight
        Service.PARCEL -> ParcelOrangeLight
    }
    val language = appLanguage()
    val pin = stringResource(R.string.pickup_gps_pin)
    val mapPin = stringResource(R.string.drop_map_pin)
    val statusNote = when (ride.status) {
        RideStatus.CANCELLED -> stringResource(R.string.ride_status_cancelled)
        RideStatus.NO_CAPTAIN -> stringResource(R.string.ride_status_no_captain)
        else -> null
    }
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = tint)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(text = service.emoji, fontSize = 44.sp)
            Spacer(modifier = Modifier.width(16.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = "${ride.pickup.displayName(language, pin)} → ${ride.drop.displayName(language, mapPin)}",
                    style = MaterialTheme.typography.titleLarge
                )
                Text(
                    text = "🕒 ${formatIsoTime(ride.createdAt)}",
                    style = MaterialTheme.typography.bodyLarge,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                if (statusNote != null) {
                    Text(
                        text = "❌ $statusNote",
                        style = MaterialTheme.typography.bodyLarge,
                        color = MaterialTheme.colorScheme.error
                    )
                }
            }
            Text(
                text = "₹ ${ride.fareFinal ?: ride.fareQuoted}",
                style = MaterialTheme.typography.headlineMedium,
                color = MaterialTheme.colorScheme.primary
            )
        }
    }
}
