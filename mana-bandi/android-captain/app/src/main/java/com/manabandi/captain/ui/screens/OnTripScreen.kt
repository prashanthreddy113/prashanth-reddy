package com.manabandi.captain.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
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
import com.manabandi.captain.ui.components.BigButton
import com.manabandi.captain.ui.components.NavigateButton
import com.manabandi.captain.ui.components.SlideToFinish
import com.manabandi.captain.ui.components.SpeakTopBar
import com.manabandi.captain.ui.components.dialNumber
import com.manabandi.captain.ui.theme.Green
import com.manabandi.captain.ui.theme.ParcelOrange
import com.manabandi.captain.ui.theme.TextDark
import com.manabandi.captain.ui.theme.Turmeric

/** Ride in progress: big drop name, 🧭 navigate, slide-to-finish, 🆘 SOS (dials 112). */
@Composable
fun OnTripScreen(vm: CaptainViewModel, onFinish: () -> Unit) {
    val request = vm.request ?: return
    val context = LocalContext.current
    val emergency = stringResource(R.string.emergency_number)
    val dropName = stringResource(request.dropNameRes)

    val strong = when (request.service) {
        Service.BIKE -> Turmeric
        Service.AUTO -> Green
        Service.PARCEL -> ParcelOrange
    }
    val onStrong = if (request.service == Service.BIKE) TextDark else Color.White

    Scaffold(
        topBar = {
            SpeakTopBar(
                title = stringResource(R.string.trip_title),
                speechText = stringResource(R.string.trip_speech)
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .padding(padding)
                .fillMaxSize()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
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
                        text = "${request.service.emoji} " + stringResource(R.string.trip_drop_label),
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
                        text = "🛣️ " + stringResource(R.string.km, request.tripKm),
                        fontSize = 28.sp,
                        lineHeight = 36.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                }
            }

            NavigateButton(
                lat = request.dropLat,
                lng = request.dropLng,
                label = dropName
            )

            Spacer(modifier = Modifier.weight(1f))

            SlideToFinish(
                text = stringResource(R.string.slide_finish),
                onFinish = onFinish,
                color = MaterialTheme.colorScheme.primary
            )

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
