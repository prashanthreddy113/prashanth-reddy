package com.manabandi.rider.ui.components

import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.manabandi.rider.R
import com.manabandi.rider.data.LocalePrefs
import com.manabandi.rider.speech.SpeechHelper

/** Provided by MainActivity; null in previews. */
val LocalSpeech = staticCompositionLocalOf<SpeechHelper?> { null }

/**
 * Top bar used on every screen: title, optional back arrow, and the 🔊 button that
 * reads [speechText] aloud in the current app locale.
 */
@Composable
fun SpeakTopBar(
    title: String,
    speechText: String,
    onBack: (() -> Unit)? = null,
    containerColor: Color = MaterialTheme.colorScheme.primary,
    contentColor: Color = Color.White
) {
    TopAppBar(
        title = {
            Text(
                text = title,
                style = MaterialTheme.typography.headlineMedium,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        },
        navigationIcon = {
            if (onBack != null) {
                IconButton(onClick = onBack, modifier = Modifier.size(64.dp)) {
                    Icon(
                        imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                        contentDescription = stringResource(R.string.back),
                        modifier = Modifier.size(36.dp)
                    )
                }
            }
        },
        actions = { SpeakButton(text = speechText) },
        colors = TopAppBarDefaults.topAppBarColors(
            containerColor = containerColor,
            titleContentColor = contentColor,
            navigationIconContentColor = contentColor,
            actionIconContentColor = contentColor
        )
    )
}

/** The 🔊 button. Speaks [text] with TTS in the current app locale. */
@Composable
fun SpeakButton(text: String, modifier: Modifier = Modifier) {
    val speech = LocalSpeech.current
    val context = LocalContext.current
    val cd = stringResource(R.string.speak_cd)
    IconButton(
        onClick = { speech?.speak(text, LocalePrefs.currentLocale(context)) },
        modifier = modifier
            .size(64.dp)
            .semantics { contentDescription = cd }
    ) {
        Text(text = "🔊", fontSize = 32.sp)
    }
}
