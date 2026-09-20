package com.manabandi.rider.ui.screens

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
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.manabandi.rider.R
import com.manabandi.rider.RideViewModel
import com.manabandi.rider.data.Service
import com.manabandi.rider.ui.components.BigButton
import com.manabandi.rider.ui.components.CallButton
import com.manabandi.rider.ui.components.SecondaryButton
import com.manabandi.rider.ui.components.SpeakTopBar
import com.manabandi.rider.ui.components.dialNumber
import com.manabandi.rider.ui.components.shareTripText
import com.manabandi.rider.ui.theme.GreenLight
import com.manabandi.rider.ui.theme.TextDark
import com.manabandi.rider.ui.theme.Turmeric
import com.manabandi.rider.ui.theme.TurmericLight

@Composable
fun RideScreen(vm: RideViewModel, onDone: () -> Unit) {
    // Safety net: if the screen is restored without a captain, assign one.
    LaunchedEffect(Unit) { vm.assignCaptain() }
    val captain = vm.captain ?: return

    val context = LocalContext.current
    val isParcel = vm.service == Service.PARCEL
    val serviceName = stringResource(
        when (vm.service) {
            Service.BIKE -> R.string.service_bike
            Service.AUTO -> R.string.service_auto
            Service.PARCEL -> R.string.service_parcel
        }
    )
    val emergency = stringResource(R.string.emergency_number)

    // "Share trip with family": captain name, vehicle number, drop and a tracking link.
    // The link is a placeholder until the backend issues real per-trip tracking pages.
    val trackingLink = stringResource(R.string.track_url_base) + vm.otp
    val shareMessage = stringResource(
        R.string.share_trip_text,
        captain.name,
        captain.vehicleNumber,
        vm.drop.ifBlank { "—" },
        trackingLink
    )
    val shareChooser = stringResource(R.string.share_chooser)

    Scaffold(
        topBar = {
            SpeakTopBar(
                title = stringResource(R.string.ride_captain_coming),
                speechText = stringResource(R.string.ride_speech)
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .padding(padding)
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Captain card
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
                            .size(96.dp)
                            .background(Color.White, CircleShape)
                            .border(3.dp, MaterialTheme.colorScheme.primary, CircleShape),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(text = "👨", fontSize = 52.sp)   // photo placeholder
                    }
                    Spacer(modifier = Modifier.width(16.dp))
                    Column {
                        Text(
                            text = stringResource(R.string.captain),
                            style = MaterialTheme.typography.bodyLarge,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Text(text = captain.name, style = MaterialTheme.typography.headlineMedium)
                        Text(
                            text = "⭐ ${captain.rating}   ${vm.service.emoji} $serviceName",
                            style = MaterialTheme.typography.bodyLarge
                        )
                    }
                }
            }

            // Vehicle number — huge, like a number plate
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(20.dp),
                colors = CardDefaults.cardColors(containerColor = Turmeric, contentColor = TextDark)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(
                        text = "🔢 " + stringResource(R.string.ride_vehicle),
                        style = MaterialTheme.typography.bodyLarge
                    )
                    Text(
                        text = captain.vehicleNumber,
                        style = MaterialTheme.typography.displayLarge,
                        letterSpacing = 4.sp,
                        textAlign = TextAlign.Center
                    )
                }
            }

            // OTP for the captain (or the receiver, for a parcel)
            Text(
                text = stringResource(if (isParcel) R.string.ride_delivery_otp else R.string.ride_otp),
                style = MaterialTheme.typography.titleLarge,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth()
            )
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp, Alignment.CenterHorizontally)
            ) {
                vm.otp.forEach { digit ->
                    Box(
                        modifier = Modifier
                            .size(width = 68.dp, height = 84.dp)
                            .background(TurmericLight, RoundedCornerShape(16.dp))
                            .border(3.dp, MaterialTheme.colorScheme.primary, RoundedCornerShape(16.dp)),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(text = digit.toString(), fontSize = 44.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            CallButton(
                label = stringResource(R.string.call_captain),
                phoneNumber = captain.phone
            )

            SecondaryButton(
                text = stringResource(R.string.share_trip),
                emoji = "👨‍👩‍👧",
                onClick = { shareTripText(context, shareMessage, shareChooser) }
            )

            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                SecondaryButton(
                    text = stringResource(R.string.cancel),
                    emoji = "❌",
                    color = MaterialTheme.colorScheme.error,
                    onClick = onDone,
                    modifier = Modifier.weight(1f)
                )
                BigButton(
                    text = stringResource(R.string.sos),
                    emoji = "🆘",
                    containerColor = MaterialTheme.colorScheme.error,
                    onClick = { dialNumber(context, emergency) },
                    modifier = Modifier.weight(1f)
                )
            }
        }
    }
}
