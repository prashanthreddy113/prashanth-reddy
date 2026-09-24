package com.manabandi.captain.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.LifecycleOwner
import com.manabandi.captain.R
import com.manabandi.captain.location.PermissionOutcome
import com.manabandi.captain.location.findActivity
import com.manabandi.captain.location.hasLocationPermission
import com.manabandi.captain.location.openAppSettings
import com.manabandi.captain.location.rememberLocationPermissionLauncher

/**
 * Explains, in one short sentence with a big picture, why we need a permission BEFORE the
 * system dialog appears. 🔊 reads the sentence aloud. After a denial it says what happens now
 * and offers "open settings" (the only way back after "don't ask again").
 */
@Composable
fun PermissionRationale(
    emoji: String,
    text: String,
    outcome: PermissionOutcome?,
    onAllow: () -> Unit,
    modifier: Modifier = Modifier,
    onCancel: (() -> Unit)? = null
) {
    val context = LocalContext.current
    val denied = outcome == PermissionOutcome.DENIED || outcome == PermissionOutcome.DENIED_FOREVER
    val spoken = if (denied) text + " " + stringResource(R.string.perm_denied) else text

    Column(
        modifier = modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(20.dp)
    ) {
        Text(text = emoji, fontSize = 96.sp)
        Text(
            text = text,
            style = MaterialTheme.typography.headlineMedium,
            textAlign = TextAlign.Center,
            modifier = Modifier.fillMaxWidth()
        )
        SpeakButton(text = spoken, modifier = Modifier.size(80.dp))
        if (denied) {
            Text(
                text = stringResource(R.string.perm_denied),
                style = MaterialTheme.typography.titleLarge,
                color = MaterialTheme.colorScheme.error,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth()
            )
        }
        if (outcome == PermissionOutcome.DENIED_FOREVER) {
            BigButton(
                text = stringResource(R.string.perm_open_settings),
                emoji = "⚙️",
                onClick = { openAppSettings(context) }
            )
            SecondaryButton(
                text = stringResource(R.string.perm_try_again),
                emoji = "🔁",
                onClick = onAllow
            )
        } else {
            BigButton(
                text = stringResource(R.string.perm_allow),
                emoji = "✅",
                onClick = onAllow
            )
        }
        if (onCancel != null) {
            SecondaryButton(
                text = stringResource(R.string.back),
                emoji = "⬅️",
                onClick = onCancel
            )
        }
    }
}

/**
 * Shows [content] only when location permission is granted; otherwise the rationale screen
 * with an "allow" button that opens the system dialog. Re-checks when the user comes back
 * from system settings.
 */
@Composable
fun LocationPermissionGate(
    rationale: String,
    includeNotifications: Boolean,
    modifier: Modifier = Modifier,
    onCancel: (() -> Unit)? = null,
    content: @Composable () -> Unit
) {
    val context = LocalContext.current
    var granted by remember { mutableStateOf(hasLocationPermission(context)) }
    var outcome by remember { mutableStateOf<PermissionOutcome?>(null) }

    val owner = remember(context) { context.findActivity() as? LifecycleOwner }
    DisposableEffect(owner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) granted = hasLocationPermission(context)
        }
        owner?.lifecycle?.addObserver(observer)
        onDispose { owner?.lifecycle?.removeObserver(observer) }
    }

    val request = rememberLocationPermissionLauncher(includeNotifications) { result ->
        outcome = result
        if (result == PermissionOutcome.GRANTED) granted = true
    }

    if (granted) {
        content()
    } else {
        PermissionRationale(
            emoji = "📍",
            text = rationale,
            outcome = outcome,
            onAllow = request,
            modifier = modifier,
            onCancel = onCancel
        )
    }
}
