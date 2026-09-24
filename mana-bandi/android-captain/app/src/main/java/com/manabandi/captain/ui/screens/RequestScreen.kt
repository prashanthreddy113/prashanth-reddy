package com.manabandi.captain.ui.screens

import android.os.SystemClock
import androidx.activity.compose.BackHandler
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.manabandi.captain.CaptainViewModel
import com.manabandi.captain.R
import com.manabandi.captain.data.Payment
import com.manabandi.captain.data.Service
import com.manabandi.captain.data.displayName
import com.manabandi.captain.data.formatKm
import com.manabandi.captain.location.TrackingRepository
import com.manabandi.captain.ui.components.SpeakTopBar
import com.manabandi.captain.ui.components.appLanguage
import com.manabandi.captain.ui.theme.Green
import com.manabandi.captain.ui.theme.GreenLight
import com.manabandi.captain.ui.theme.ParcelOrange
import com.manabandi.captain.ui.theme.ParcelOrangeLight
import com.manabandi.captain.ui.theme.SurfaceMuted
import com.manabandi.captain.ui.theme.TextDark
import com.manabandi.captain.ui.theme.Turmeric
import com.manabandi.captain.ui.theme.TurmericLight
import kotlinx.coroutines.delay

/**
 * The real ride offer from the heartbeat. Whole screen tinted by service; the countdown uses
 * the server's `secondsLeft`. ✅ → POST /offers/{id}/accept (409 expired / taken → friendly
 * message, back Home); ❌ → /reject. Timeout → Home.
 */
@Composable
fun RequestScreen(vm: CaptainViewModel, onDismiss: () -> Unit) {
    val currentOnDismiss by rememberUpdatedState(onDismiss)
    val tracking by TrackingRepository.state.collectAsState()
    val offer = tracking.offer
    if (offer == null) {
        // Accepted (the trip screen opens), rejected, expired or taken: back to Home.
        LaunchedEffect(Unit) { if (TrackingRepository.state.value.trip == null) currentOnDismiss() }
        return
    }

    // Back = "no" (otherwise Home would open this offer again right away).
    BackHandler {
        vm.rejectOffer(offer)
        onDismiss()
    }

    val totalSeconds = remember(offer.id) { offer.secondsLeft.coerceAtLeast(1) }
    val deadline = tracking.offerDeadline
    var secondsLeft by remember(offer.id) { mutableIntStateOf(offer.secondsLeft.coerceAtLeast(0)) }
    LaunchedEffect(offer.id, deadline) {
        while (true) {
            val leftMs = deadline - SystemClock.elapsedRealtime()
            secondsLeft = ((leftMs + 999) / 1000).toInt().coerceAtLeast(0)
            if (leftMs <= 0) {
                vm.offerTimedOut(offer)
                break
            }
            delay(250)
        }
    }
    val progress by animateFloatAsState(
        targetValue = secondsLeft / totalSeconds.toFloat(),
        animationSpec = tween(durationMillis = 300, easing = LinearEasing),
        label = "countdown"
    )

    val service = Service.fromApi(offer.service)
    val payment = Payment.fromApi(offer.payment)
    val strong = when (service) {
        Service.BIKE -> Turmeric
        Service.AUTO -> Green
        Service.PARCEL -> ParcelOrange
    }
    val tint = when (service) {
        Service.BIKE -> TurmericLight
        Service.AUTO -> GreenLight
        Service.PARCEL -> ParcelOrangeLight
    }
    val onStrong = if (service == Service.BIKE) TextDark else Color.White
    val serviceName = stringResource(
        when (service) {
            Service.BIKE -> R.string.service_bike
            Service.AUTO -> R.string.service_auto
            Service.PARCEL -> R.string.service_parcel
        }
    )
    val language = appLanguage()
    val pinLabel = stringResource(R.string.pin_rider)
    val pickupName = offer.pickup.displayName(language, pinLabel)
    val dropName = offer.drop.displayName(language, stringResource(R.string.pin_drop))
    val paymentName = stringResource(if (payment == Payment.CASH) R.string.pay_cash else R.string.pay_upi)
    val awayKm = formatKm(offer.distanceToPickupKm)

    Scaffold(
        containerColor = tint,
        topBar = {
            SpeakTopBar(
                title = stringResource(R.string.request_title),
                speechText = stringResource(R.string.request_speech, pickupName, awayKm, offer.fare)
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .padding(padding)
                .fillMaxSize()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            // Service banner
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(20.dp),
                colors = CardDefaults.cardColors(containerColor = strong, contentColor = onStrong)
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 20.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(text = service.emoji, fontSize = 44.sp)
                    Spacer(modifier = Modifier.width(16.dp))
                    Text(text = serviceName, style = MaterialTheme.typography.headlineMedium)
                    Spacer(modifier = Modifier.weight(1f))
                    Text(text = "${payment.emoji} $paymentName", style = MaterialTheme.typography.titleLarge)
                }
            }

            // Pickup / drop / fare — upper half, scrolls on very small phones
            Column(
                modifier = Modifier
                    .weight(1f)
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Text(
                    text = "📍 " + stringResource(R.string.request_pickup),
                    style = MaterialTheme.typography.titleLarge,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Text(
                    text = pickupName,
                    fontSize = 34.sp,
                    lineHeight = 42.sp,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = "🛵 " + stringResource(R.string.request_away, awayKm),
                    fontSize = 34.sp,
                    lineHeight = 42.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary
                )
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "🏁 " + stringResource(R.string.request_drop),
                    style = MaterialTheme.typography.titleLarge,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Text(text = dropName, style = MaterialTheme.typography.headlineMedium)
                Text(
                    text = stringResource(R.string.request_trip_km, formatKm(offer.tripKm)),
                    style = MaterialTheme.typography.bodyLarge,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "₹${offer.fare}",
                    fontSize = 56.sp,
                    lineHeight = 64.sp,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.fillMaxWidth(),
                    textAlign = TextAlign.Center
                )
            }

            // Countdown (server secondsLeft)
            Text(
                text = "⏱ " + stringResource(R.string.seconds_left, secondsLeft),
                style = MaterialTheme.typography.titleLarge,
                modifier = Modifier.fillMaxWidth(),
                textAlign = TextAlign.Center
            )
            LinearProgressIndicator(
                progress = { progress },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(14.dp)
                    .clip(RoundedCornerShape(7.dp)),
                color = strong,
                trackColor = SurfaceMuted
            )

            // The giant ✅ Accept
            Button(
                onClick = { vm.acceptOffer(offer) },
                enabled = !vm.offerBusy && secondsLeft > 0,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(120.dp),
                shape = RoundedCornerShape(28.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Green, contentColor = Color.White)
            ) {
                Text(text = if (vm.offerBusy) "⏳" else "✅", fontSize = 44.sp)
                Spacer(modifier = Modifier.width(16.dp))
                Text(
                    text = stringResource(if (vm.offerBusy) R.string.please_wait else R.string.accept),
                    fontSize = 34.sp,
                    fontWeight = FontWeight.Bold
                )
            }

            TextButton(
                onClick = {
                    vm.rejectOffer(offer)
                    onDismiss()
                },
                enabled = !vm.offerBusy,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(56.dp)
            ) {
                Text(
                    text = "❌ " + stringResource(R.string.reject),
                    fontSize = 22.sp,
                    color = MaterialTheme.colorScheme.error
                )
            }
        }
    }
}
