package com.manabandi.captain.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.manabandi.captain.CaptainViewModel
import com.manabandi.captain.R
import com.manabandi.captain.data.Service
import com.manabandi.captain.data.displayName
import com.manabandi.captain.data.formatKm
import com.manabandi.captain.location.TrackingRepository
import com.manabandi.captain.ui.components.BigButton
import com.manabandi.captain.ui.components.NavigateButton
import com.manabandi.captain.ui.components.SlideToFinish
import com.manabandi.captain.ui.components.SpeakTopBar
import com.manabandi.captain.ui.components.appLanguage
import com.manabandi.captain.ui.components.dialNumber
import com.manabandi.captain.ui.theme.Green
import com.manabandi.captain.ui.theme.ParcelOrange
import com.manabandi.captain.ui.theme.TextDark
import com.manabandi.captain.ui.theme.Turmeric

/**
 * Ride in progress: map with you + 🏁 drop, big drop name, 🧭 navigate, slide-to-finish
 * (POST /api/captain/trip/finish with the current position; for a parcel it opens the
 * delivery-proof step first), 🆘 SOS (dials 112).
 */
@Composable
fun OnTripScreen(vm: CaptainViewModel, onDeliver: () -> Unit) {
    val tracking by TrackingRepository.state.collectAsState()
    val trip = tracking.trip ?: return
    val context = LocalContext.current
    val emergency = stringResource(R.string.emergency_number)
    val service = Service.fromApi(trip.service)
    val isParcel = service == Service.PARCEL
    val dropName = trip.drop.displayName(appLanguage(), stringResource(R.string.pin_drop))

    val strong = when (service) {
        Service.BIKE -> Turmeric
        Service.AUTO -> Green
        Service.PARCEL -> ParcelOrange
    }
    val onStrong = if (service == Service.BIKE) TextDark else Color.White

    Scaffold(
        topBar = {
            SpeakTopBar(
                title = stringResource(R.string.trip_title),
                speechText = stringResource(if (isParcel) R.string.trip_speech_parcel else R.string.trip_speech)
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
            TripMap(target = trip.drop, targetEmoji = "🏁", captainEmoji = service.emoji)

            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(24.dp),
                colors = CardDefaults.cardColors(containerColor = strong, contentColor = onStrong)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(20.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(
                        text = "${service.emoji} " + stringResource(R.string.trip_drop_label),
                        style = MaterialTheme.typography.titleLarge
                    )
                    Text(
                        text = "🏁 $dropName",
                        fontSize = 40.sp,
                        lineHeight = 50.sp,
                        fontWeight = FontWeight.Bold,
                        textAlign = TextAlign.Center
                    )
                    Text(
                        text = "🛣️ " + stringResource(R.string.km, formatKm(trip.tripKm)),
                        fontSize = 28.sp,
                        lineHeight = 36.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                }
            }

            NavigateButton(
                lat = trip.drop.lat,
                lng = trip.drop.lng,
                label = dropName
            )

            TripErrorText(vm.tripError)
            Spacer(modifier = Modifier.height(8.dp))

            if (vm.tripBusy) {
                BigButton(
                    text = stringResource(R.string.please_wait),
                    emoji = "⏳",
                    enabled = false,
                    onClick = {}
                )
            } else {
                SlideToFinish(
                    text = stringResource(if (isParcel) R.string.slide_deliver else R.string.slide_finish),
                    onFinish = { if (isParcel) onDeliver() else vm.finishTrip() },
                    color = MaterialTheme.colorScheme.primary
                )
            }

            BigButton(
                text = stringResource(R.string.sos),
                emoji = "🆘",
                containerColor = MaterialTheme.colorScheme.error,
                onClick = { dialNumber(context, emergency) }
            )
            Spacer(modifier = Modifier.height(4.dp))
        }
    }
}
