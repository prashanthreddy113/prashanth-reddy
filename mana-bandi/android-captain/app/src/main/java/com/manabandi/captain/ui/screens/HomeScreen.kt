package com.manabandi.captain.ui.screens

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
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.manabandi.captain.CaptainViewModel
import com.manabandi.captain.R
import com.manabandi.captain.data.LocalePrefs
import com.manabandi.captain.ui.components.BottomTab
import com.manabandi.captain.ui.components.LocalSpeech
import com.manabandi.captain.ui.components.ManaBandiBottomBar
import com.manabandi.captain.ui.components.SecondaryButton
import com.manabandi.captain.ui.components.SpeakTopBar
import com.manabandi.captain.ui.components.dialNumber
import com.manabandi.captain.ui.components.vibrateNewRequest
import com.manabandi.captain.ui.theme.Green
import com.manabandi.captain.ui.theme.GreenLight
import com.manabandi.captain.ui.theme.SurfaceMuted
import com.manabandi.captain.ui.theme.TextDark
import kotlinx.coroutines.delay

/**
 * ONLINE / OFFLINE. One giant toggle card, today's earnings, and two shortcuts.
 * Demo dispatch: a fake request arrives a few seconds after going online
 * (4 s the first time, 8 s after each finished trip) — the phone buzzes and the
 * request is spoken in the app language.
 */
@Composable
fun HomeScreen(
    vm: CaptainViewModel,
    onRequest: () -> Unit,
    onEarnings: () -> Unit,
    onHelp: () -> Unit
) {
    val context = LocalContext.current
    val speech = LocalSpeech.current
    val supportNumber = stringResource(R.string.support_number)
    val currentOnRequest by rememberUpdatedState(onRequest)
    val online = vm.online

    LaunchedEffect(online) {
        if (online && vm.request == null) {
            delay(vm.nextRequestDelayMs)
            val request = vm.offerRequest()
            vibrateNewRequest(context)
            val spoken = context.getString(
                R.string.request_speech,
                context.getString(request.pickupNameRes),
                request.distanceToPickupKm,
                request.fare
            )
            speech?.speak(spoken, LocalePrefs.currentLocale(context))
            currentOnRequest()
        }
    }

    // Subtle pulsing ring while online (same approach as the rider's FindingCaptain screen).
    val pulse = rememberInfiniteTransition(label = "pulse")
    val ringScale by pulse.animateFloat(
        initialValue = 0.9f,
        targetValue = 1.15f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 1100, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "scale"
    )
    val ringAlpha by pulse.animateFloat(
        initialValue = 0.35f,
        targetValue = 0.05f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 1100, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "alpha"
    )

    Scaffold(
        topBar = {
            SpeakTopBar(
                title = stringResource(R.string.app_name),
                speechText = stringResource(
                    if (online) R.string.home_speech_online else R.string.home_speech_offline
                )
            )
        },
        bottomBar = {
            ManaBandiBottomBar(
                current = BottomTab.HOME,
                onHome = {},
                onEarnings = onEarnings,
                onHelp = onHelp
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
            // Giant ONLINE / OFFLINE toggle, top half of the screen
            Card(
                onClick = { vm.setOnlineState(!online) },
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f),
                shape = RoundedCornerShape(28.dp),
                colors = CardDefaults.cardColors(
                    containerColor = if (online) Green else SurfaceMuted,
                    contentColor = if (online) Color.White else TextDark
                ),
                elevation = CardDefaults.cardElevation(defaultElevation = 4.dp)
            ) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    if (online) {
                        Box(
                            modifier = Modifier
                                .size(220.dp)
                                .scale(ringScale)
                                .alpha(ringAlpha)
                                .background(Color.White, CircleShape)
                        )
                    }
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        modifier = Modifier.padding(horizontal = 24.dp)
                    ) {
                        Text(text = if (online) "🟢" else "🔴", fontSize = 80.sp)
                        Text(
                            text = stringResource(if (online) R.string.online_label else R.string.offline_label),
                            style = MaterialTheme.typography.headlineMedium,
                            textAlign = TextAlign.Center
                        )
                    }
                }
            }

            // Today's earnings in 48 sp digits
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(24.dp),
                colors = CardDefaults.cardColors(containerColor = GreenLight, contentColor = TextDark)
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 20.dp, vertical = 12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = "💰 " + stringResource(R.string.today_earnings),
                            style = MaterialTheme.typography.titleLarge
                        )
                        Text(
                            text = stringResource(R.string.today_trips, vm.tripsToday),
                            style = MaterialTheme.typography.bodyLarge,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                    Text(
                        text = "₹${vm.earningsToday}",
                        fontSize = 48.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.primary
                    )
                }
            }

            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                SecondaryButton(
                    text = stringResource(R.string.btn_earnings),
                    emoji = "💰",
                    onClick = onEarnings,
                    modifier = Modifier.weight(1f)
                )
                SecondaryButton(
                    text = stringResource(R.string.btn_office),
                    emoji = "📞",
                    onClick = { dialNumber(context, supportNumber) },
                    modifier = Modifier.weight(1f)
                )
            }
        }
    }
}
