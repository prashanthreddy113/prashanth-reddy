package com.manabandi.rider.ui.screens

import android.widget.Toast
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.scale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.manabandi.rider.R
import com.manabandi.rider.RideViewModel
import com.manabandi.rider.data.Service
import com.manabandi.rider.data.api.RideStatus
import com.manabandi.rider.ui.components.BigButton
import com.manabandi.rider.ui.components.CallButton
import com.manabandi.rider.ui.components.SecondaryButton
import com.manabandi.rider.ui.components.SpeakTopBar
import com.manabandi.rider.ui.theme.Green
import com.manabandi.rider.ui.theme.ParcelOrange
import com.manabandi.rider.ui.theme.Turmeric

/**
 * Waiting for a captain: polls GET /api/rides/{id} every 3 s. When a captain accepts we move
 * to the ride screen; if nobody accepts in time (`no_captain`) we offer 📞 call support and
 * 🔁 try again (a new booking with a new clientId).
 */
@Composable
fun FindingCaptainScreen(
    vm: RideViewModel,
    onAccepted: () -> Unit,
    onHome: () -> Unit,
    onTermsRequired: () -> Unit
) {
    val context = LocalContext.current
    val currentOnAccepted by rememberUpdatedState(onAccepted)
    val currentOnHome by rememberUpdatedState(onHome)
    val cancelledText = stringResource(R.string.ride_cancelled)
    val ride = vm.ride

    LaunchedEffect(ride?.id) {
        if (ride == null) currentOnHome() else vm.pollRide()
    }
    val status = ride?.status
    LaunchedEffect(status) {
        when (status) {
            RideStatus.ACCEPTED, RideStatus.ARRIVED, RideStatus.STARTED, RideStatus.FINISHED -> currentOnAccepted()
            RideStatus.CANCELLED -> {
                Toast.makeText(context, cancelledText, Toast.LENGTH_LONG).show()
                vm.clearRide()
                currentOnHome()
            }
            else -> Unit
        }
    }

    val service = Service.fromApi(ride?.service)
    val noCaptain = status == RideStatus.NO_CAPTAIN

    Scaffold(
        topBar = {
            SpeakTopBar(
                title = stringResource(if (noCaptain) R.string.no_captain_title else R.string.finding_title),
                speechText = stringResource(if (noCaptain) R.string.no_captain_speech else R.string.finding_speech)
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .padding(padding)
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(16.dp, Alignment.CenterVertically)
        ) {
            if (noCaptain) {
                NoCaptain(vm = vm, onHome = onHome, onTermsRequired = onTermsRequired)
            } else {
                Searching(vm = vm, service = service, onHome = onHome)
            }
        }
    }
}

@Composable
private fun Searching(vm: RideViewModel, service: Service, onHome: () -> Unit) {
    val pulse = rememberInfiniteTransition(label = "pulse")
    val scale by pulse.animateFloat(
        initialValue = 0.85f,
        targetValue = 1.25f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 900, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "scale"
    )
    val ringAlpha by pulse.animateFloat(
        initialValue = 0.45f,
        targetValue = 0.1f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 900, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "alpha"
    )
    val accent = when (service) {
        Service.BIKE -> Turmeric
        Service.AUTO -> Green
        Service.PARCEL -> ParcelOrange
    }

    Box(contentAlignment = Alignment.Center, modifier = Modifier.size(260.dp)) {
        Box(
            modifier = Modifier
                .size(240.dp)
                .scale(scale)
                .alpha(ringAlpha)
                .background(accent, CircleShape)
        )
        Box(
            modifier = Modifier
                .size(160.dp)
                .background(accent, CircleShape),
            contentAlignment = Alignment.Center
        ) {
            Text(text = service.emoji, fontSize = 72.sp)
        }
    }

    Spacer(modifier = Modifier.height(16.dp))
    Text(
        text = stringResource(R.string.finding_title),
        style = MaterialTheme.typography.headlineMedium,
        textAlign = TextAlign.Center
    )
    Text(
        text = stringResource(R.string.finding_sub),
        style = MaterialTheme.typography.bodyLarge,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        textAlign = TextAlign.Center
    )
    if (vm.pollOffline) {
        Text(
            text = "📶 " + stringResource(R.string.network_weak),
            style = MaterialTheme.typography.bodyLarge,
            color = MaterialTheme.colorScheme.error,
            textAlign = TextAlign.Center
        )
    }
    ErrorText(vm.actionError)

    Spacer(modifier = Modifier.height(24.dp))
    SecondaryButton(
        text = stringResource(R.string.cancel),
        emoji = "❌",
        color = MaterialTheme.colorScheme.error,
        enabled = !vm.actionBusy,
        onClick = { vm.cancelRide(onDone = onHome) }
    )
}

@Composable
private fun NoCaptain(vm: RideViewModel, onHome: () -> Unit, onTermsRequired: () -> Unit) {
    Text(text = "😔", fontSize = 88.sp)
    Text(
        text = stringResource(R.string.no_captain_title),
        style = MaterialTheme.typography.headlineMedium,
        textAlign = TextAlign.Center
    )
    Text(
        text = stringResource(R.string.no_captain_body),
        style = MaterialTheme.typography.bodyLarge,
        textAlign = TextAlign.Center
    )
    ErrorText(vm.bookError)
    BigButton(
        text = stringResource(if (vm.bookBusy) R.string.please_wait else R.string.retry),
        emoji = "🔁",
        enabled = !vm.bookBusy,
        onClick = { vm.retryBooking(onTermsRequired = onTermsRequired) }
    )
    CallButton(label = stringResource(R.string.help_call), phoneNumber = vm.supportPhone)
    SecondaryButton(
        text = stringResource(R.string.nav_home),
        emoji = "🏠",
        onClick = {
            vm.clearRide()
            onHome()
        }
    )
}
