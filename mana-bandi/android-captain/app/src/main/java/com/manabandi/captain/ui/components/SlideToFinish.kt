package com.manabandi.captain.ui.components

import androidx.compose.animation.core.animate
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.Orientation
import androidx.compose.foundation.gestures.draggable
import androidx.compose.foundation.gestures.rememberDraggableState
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.layout.layout
import kotlin.math.roundToInt

private const val FINISH_FRACTION = 0.8f

/**
 * "Slide to finish": a round thumb the captain drags along a rounded track. When it is
 * released past 80 % of the track [onFinish] fires, otherwise it springs back.
 * No library; plain draggable + animate. Always laid out left-to-right so the gesture
 * is the same in Urdu.
 */
@Composable
fun SlideToFinish(
    text: String,
    onFinish: () -> Unit,
    modifier: Modifier = Modifier,
    color: Color = MaterialTheme.colorScheme.primary,
    trackColor: Color = MaterialTheme.colorScheme.surfaceVariant
) {
    val density = LocalDensity.current
    val thumbSize = 72.dp
    val trackPadding = 8.dp
    val thumbPx = with(density) { thumbSize.toPx() }
    val paddingPx = with(density) { trackPadding.toPx() }

    var trackWidthPx by remember { mutableIntStateOf(0) }
    var offsetPx by remember { mutableFloatStateOf(0f) }
    val currentOnFinish by rememberUpdatedState(onFinish)

    val maxOffset = (trackWidthPx - thumbPx - 2 * paddingPx).coerceAtLeast(0f)

    val dragState = rememberDraggableState { delta ->
        offsetPx = (offsetPx + delta).coerceIn(0f, maxOffset)
    }

    CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) {
        Box(
            modifier = modifier
                .fillMaxWidth()
                .height(88.dp)
                .onSizeChanged { trackWidthPx = it.width }
                .background(trackColor, RoundedCornerShape(44.dp)),
            contentAlignment = Alignment.CenterStart
        ) {
            Text(
                text = "$text  ➡️",
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface,
                modifier = Modifier
                    .align(Alignment.Center)
                    .padding(start = thumbSize)
            )
            Box(
                modifier = Modifier
                    .padding(trackPadding)
                    .layout { measurable, constraints ->
                        val placeable = measurable.measure(constraints)
                        layout(placeable.width, placeable.height) {
                            placeable.placeRelative(IntOffset(offsetPx.roundToInt(), 0))
                        }
                    }
                    .size(thumbSize)
                    .background(color, CircleShape)
                    .draggable(
                        state = dragState,
                        orientation = Orientation.Horizontal,
                        onDragStopped = {
                            if (maxOffset > 0f && offsetPx >= FINISH_FRACTION * maxOffset) {
                                animate(initialValue = offsetPx, targetValue = maxOffset) { value, _ ->
                                    offsetPx = value
                                }
                                currentOnFinish()
                            } else {
                                animate(initialValue = offsetPx, targetValue = 0f) { value, _ ->
                                    offsetPx = value
                                }
                            }
                        }
                    ),
                contentAlignment = Alignment.Center
            ) {
                Text(text = "🏁", fontSize = 32.sp)
            }
        }
    }
}
