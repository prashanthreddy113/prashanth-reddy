package com.manabandi.rider.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.manabandi.rider.data.LocalePrefs
import com.manabandi.rider.data.api.Landmark
import com.manabandi.rider.data.displayName
import com.manabandi.rider.data.landmarkEmoji

/** 64dp tall chip with an emoji and a short label. */
@Composable
fun PlaceChip(
    emoji: String,
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    selected: Boolean = false
) {
    val colors = MaterialTheme.colorScheme
    Surface(
        onClick = onClick,
        modifier = modifier.height(64.dp),
        shape = RoundedCornerShape(32.dp),
        color = if (selected) colors.primaryContainer else colors.surfaceVariant,
        border = BorderStroke(2.dp, if (selected) colors.primary else colors.outline)
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 20.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(text = emoji, fontSize = 26.sp)
            Spacer(modifier = Modifier.width(8.dp))
            Text(text = label, style = MaterialTheme.typography.titleLarge)
        }
    }
}

/**
 * Horizontally scrolling row of the town's landmarks (bus stand, hospital, market, …) from
 * GET /api/rider/towns/nearest. Nothing is shown until the town is known.
 */
@Composable
fun LandmarkChipsRow(
    landmarks: List<Landmark>,
    onPick: (Landmark) -> Unit,
    modifier: Modifier = Modifier,
    selectedId: String? = null
) {
    if (landmarks.isEmpty()) return
    val language = appLanguage()
    Row(
        modifier = modifier
            .fillMaxWidth()
            .horizontalScroll(rememberScrollState()),
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        landmarks.forEach { landmark ->
            PlaceChip(
                emoji = landmarkEmoji(landmark.kind),
                label = landmark.displayName(language),
                selected = selectedId == landmark.id,
                onClick = { onPick(landmark) }
            )
        }
    }
}

/** The language the app is showing right now ("te", "en", "hi", …). */
@Composable
fun appLanguage(): String = LocalePrefs.currentLocale(LocalContext.current).language
