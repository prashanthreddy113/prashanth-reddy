package com.manabandi.rider.ui.theme

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

private val LightColors = lightColorScheme(
    primary = Green,
    onPrimary = Color.White,
    primaryContainer = GreenLight,
    onPrimaryContainer = TextDark,
    secondary = Turmeric,
    onSecondary = TextDark,
    secondaryContainer = TurmericLight,
    onSecondaryContainer = TextDark,
    tertiary = ParcelOrange,
    onTertiary = Color.White,
    tertiaryContainer = ParcelOrangeLight,
    onTertiaryContainer = TextDark,
    error = DangerRed,
    onError = Color.White,
    background = SurfaceCream,
    onBackground = TextDark,
    surface = SurfaceCream,
    onSurface = TextDark,
    surfaceVariant = SurfaceMuted,
    onSurfaceVariant = TextGrey,
    outline = OutlineGrey
)

private val ManaBandiShapes = Shapes(
    extraSmall = RoundedCornerShape(8.dp),
    small = RoundedCornerShape(12.dp),
    medium = RoundedCornerShape(20.dp),
    large = RoundedCornerShape(24.dp),
    extraLarge = RoundedCornerShape(32.dp)
)

// Light only on purpose: a single high-contrast cream/green scheme is easier
// for low-literacy users than a switching dark mode.
@Composable
fun ManaBandiTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = LightColors,
        typography = ManaBandiTypography,
        shapes = ManaBandiShapes,
        content = content
    )
}
