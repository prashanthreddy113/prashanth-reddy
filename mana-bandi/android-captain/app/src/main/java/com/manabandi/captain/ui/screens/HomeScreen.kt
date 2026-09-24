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
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
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
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.LifecycleOwner
import com.manabandi.captain.CaptainViewModel
import com.manabandi.captain.R
import com.manabandi.captain.data.api.CaptainStatus
import com.manabandi.captain.location.BatteryOptimization
import com.manabandi.captain.location.PermissionOutcome
import com.manabandi.captain.location.TrackingRepository
import com.manabandi.captain.location.findActivity
import com.manabandi.captain.location.hasLocationPermission
import com.manabandi.captain.location.rememberLocationPermissionLauncher
import com.manabandi.captain.ui.components.BottomTab
import com.manabandi.captain.ui.components.ManaBandiBottomBar
import com.manabandi.captain.ui.components.PermissionRationale
import com.manabandi.captain.ui.components.SecondaryButton
import com.manabandi.captain.ui.components.SpeakTopBar
import com.manabandi.captain.ui.components.dialNumber
import com.manabandi.captain.ui.theme.Green
import com.manabandi.captain.ui.theme.GreenLight
import com.manabandi.captain.ui.theme.SurfaceMuted
import com.manabandi.captain.ui.theme.TextDark
import com.manabandi.captain.ui.theme.TurmericLight

/**
 * ONLINE / OFFLINE. Going online: location rationale (first time) → system permission dialog
 * → POST /api/captain/online → TrackingService. Offers then arrive with the heartbeat and the
 * app opens the request screen by itself. Also shows the verification status from
 * GET /api/captain/me (pending / rejected / blocked) and today's earnings.
 */
@Composable
fun HomeScreen(
    vm: CaptainViewModel,
    onKyc: () -> Unit,
    onEarnings: () -> Unit,
    onHelp: () -> Unit
) {
    val context = LocalContext.current
    val supportNumber = stringResource(R.string.support_number)
    val tracking by TrackingRepository.state.collectAsState()
    val online = tracking.running
    val me = vm.me

    var showRationale by rememberSaveable { mutableStateOf(false) }
    var outcome by remember { mutableStateOf<PermissionOutcome?>(null) }
    val requestPermission = rememberLocationPermissionLauncher(includeNotifications = true) { result ->
        outcome = result
        if (result == PermissionOutcome.GRANTED) {
            showRationale = false
            vm.goOnline()
        }
    }

    LaunchedEffect(Unit) {
        vm.refreshMe()
        vm.loadEarnings()
    }

    Scaffold(
        topBar = {
            SpeakTopBar(
                title = stringResource(R.string.app_name),
                speechText = stringResource(
                    when {
                        showRationale -> R.string.perm_location_captain
                        online -> R.string.home_speech_online
                        else -> R.string.home_speech_offline
                    }
                )
            )
        },
        bottomBar = {
            if (!showRationale) {
                ManaBandiBottomBar(
                    current = BottomTab.HOME,
                    onHome = {},
                    onEarnings = onEarnings,
                    onHelp = onHelp
                )
            }
        }
    ) { padding ->
        if (showRationale) {
            PermissionRationale(
                emoji = "📍",
                text = stringResource(R.string.perm_location_captain),
                outcome = outcome,
                onAllow = requestPermission,
                modifier = Modifier.padding(padding),
                onCancel = { showRationale = false }
            )
        } else {
            Column(
                modifier = Modifier
                    .padding(padding)
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                val status = me?.status
                if (status != null && status != CaptainStatus.VERIFIED && !online) {
                    CaptainStatusCard(status = status, reason = me?.rejectReason ?: me?.blockReason)
                    if (status != CaptainStatus.BLOCKED) {
                        SecondaryButton(text = stringResource(R.string.kyc_open), emoji = "📋", onClick = onKyc)
                    }
                    SecondaryButton(
                        text = stringResource(R.string.call_office),
                        emoji = "📞",
                        onClick = { dialNumber(context, supportNumber) }
                    )
                } else {
                    OnlineToggle(
                        online = online,
                        busy = vm.onlineBusy,
                        onClick = {
                            when {
                                online -> vm.goOffline()
                                !hasLocationPermission(context) -> {
                                    outcome = null
                                    showRationale = true
                                }
                                else -> vm.goOnline()
                            }
                        }
                    )
                }

                if (online && !tracking.connected) {
                    Text(
                        text = "📶 " + stringResource(R.string.no_network_buffering),
                        style = MaterialTheme.typography.titleMedium,
                        color = MaterialTheme.colorScheme.error
                    )
                }
                val error = vm.onlineError
                if (error != null) {
                    Text(
                        text = stringResource(error),
                        style = MaterialTheme.typography.titleMedium,
                        color = MaterialTheme.colorScheme.error,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.fillMaxWidth()
                    )
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

                BatteryCard()

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
}

/** The giant 🔴 OFFLINE / 🟢 ONLINE card with a pulsing ring while online. */
@Composable
private fun OnlineToggle(online: Boolean, busy: Boolean, onClick: () -> Unit) {
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
    Card(
        onClick = { if (!busy) onClick() },
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = 280.dp),
        shape = RoundedCornerShape(28.dp),
        colors = CardDefaults.cardColors(
            containerColor = if (online) Green else SurfaceMuted,
            contentColor = if (online) Color.White else TextDark
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 4.dp)
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .heightIn(min = 280.dp),
            contentAlignment = Alignment.Center
        ) {
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
                if (busy) {
                    CircularProgressIndicator(modifier = Modifier.size(80.dp), strokeWidth = 6.dp)
                } else {
                    Text(text = if (online) "🟢" else "🔴", fontSize = 80.sp)
                }
                Text(
                    text = stringResource(
                        when {
                            busy -> R.string.please_wait
                            online -> R.string.online_label
                            else -> R.string.offline_label
                        }
                    ),
                    style = MaterialTheme.typography.headlineMedium,
                    textAlign = TextAlign.Center
                )
            }
        }
    }
}

/**
 * "Allow the app to run in the background" card, shown while Android still battery-optimises
 * the app (common on Xiaomi / Realme / Vivo, which then kill it and the rides stop coming).
 */
@Composable
fun BatteryCard(alwaysShow: Boolean = false) {
    val context = LocalContext.current
    var ignoring by remember { mutableStateOf(BatteryOptimization.isIgnoringOptimizations(context)) }
    val owner = remember(context) { context.findActivity() as? LifecycleOwner }
    DisposableEffect(owner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) ignoring = BatteryOptimization.isIgnoringOptimizations(context)
        }
        owner?.lifecycle?.addObserver(observer)
        onDispose { owner?.lifecycle?.removeObserver(observer) }
    }
    if (ignoring && !alwaysShow) return

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = TurmericLight, contentColor = TextDark)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Text(text = "🔋 " + stringResource(R.string.battery_title), style = MaterialTheme.typography.titleLarge)
            Text(text = stringResource(R.string.battery_body), style = MaterialTheme.typography.bodyLarge)
            if (!ignoring) {
                SecondaryButton(
                    text = stringResource(R.string.battery_allow),
                    emoji = "🔋",
                    onClick = { BatteryOptimization.openBatterySettings(context) }
                )
            }
            if (BatteryOptimization.isAggressiveMaker) {
                SecondaryButton(
                    text = stringResource(R.string.battery_autostart),
                    emoji = "🚀",
                    onClick = {
                        if (!BatteryOptimization.openAutoStart(context)) BatteryOptimization.openBatterySettings(context)
                    }
                )
            }
        }
    }
}
