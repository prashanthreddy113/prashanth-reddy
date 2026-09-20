package com.manabandi.rider.ui.screens

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
import androidx.compose.foundation.shape.CircleShape
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
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.manabandi.rider.R
import com.manabandi.rider.RideViewModel
import com.manabandi.rider.data.Service
import com.manabandi.rider.ui.components.SecondaryButton
import com.manabandi.rider.ui.components.SpeakTopBar
import com.manabandi.rider.ui.theme.Green
import com.manabandi.rider.ui.theme.ParcelOrange
import com.manabandi.rider.ui.theme.Turmeric
import kotlinx.coroutines.delay

private const val SEARCH_MILLIS = 3000L

@Composable
fun FindingCaptainScreen(vm: RideViewModel, onFound: () -> Unit, onCancel: () -> Unit) {
    val currentOnFound by rememberUpdatedState(onFound)

    LaunchedEffect(Unit) {
        vm.assignCaptain()
        delay(SEARCH_MILLIS)
        currentOnFound()
    }

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

    val accent = when (vm.service) {
        Service.BIKE -> Turmeric
        Service.AUTO -> Green
        Service.PARCEL -> ParcelOrange
    }

    Scaffold(
        topBar = {
            SpeakTopBar(
                title = stringResource(R.string.finding_title),
                speechText = stringResource(R.string.finding_speech)
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .padding(padding)
                .fillMaxSize()
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
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
                    Text(text = vm.service.emoji, fontSize = 72.sp)
                }
            }

            Spacer(modifier = Modifier.height(32.dp))
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

            Spacer(modifier = Modifier.height(40.dp))
            SecondaryButton(
                text = stringResource(R.string.cancel),
                emoji = "❌",
                color = MaterialTheme.colorScheme.error,
                onClick = onCancel
            )
        }
    }
}
