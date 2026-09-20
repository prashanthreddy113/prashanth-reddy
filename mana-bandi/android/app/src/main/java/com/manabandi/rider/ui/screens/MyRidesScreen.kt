package com.manabandi.rider.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.manabandi.rider.R
import com.manabandi.rider.data.FakeRides
import com.manabandi.rider.data.PastRide
import com.manabandi.rider.data.Service
import com.manabandi.rider.ui.components.BottomTab
import com.manabandi.rider.ui.components.ManaBandiBottomBar
import com.manabandi.rider.ui.components.SpeakTopBar
import com.manabandi.rider.ui.theme.GreenLight
import com.manabandi.rider.ui.theme.ParcelOrangeLight
import com.manabandi.rider.ui.theme.TurmericLight

@Composable
fun MyRidesScreen(onHome: () -> Unit, onHelp: () -> Unit) {
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
            items(FakeRides.pastRides) { ride -> RideRow(ride) }
        }
    }
}

@Composable
private fun RideRow(ride: PastRide) {
    val tint = when (ride.service) {
        Service.BIKE -> TurmericLight
        Service.AUTO -> GreenLight
        Service.PARCEL -> ParcelOrangeLight
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
            Text(text = ride.service.emoji, fontSize = 44.sp)
            Spacer(modifier = Modifier.width(16.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = "${ride.from} → ${ride.to}",
                    style = MaterialTheme.typography.titleLarge
                )
                Text(
                    text = "🕒 ${ride.date}",
                    style = MaterialTheme.typography.bodyLarge,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            Text(
                text = "₹ ${ride.fare}",
                style = MaterialTheme.typography.headlineMedium,
                color = MaterialTheme.colorScheme.primary
            )
        }
    }
}
