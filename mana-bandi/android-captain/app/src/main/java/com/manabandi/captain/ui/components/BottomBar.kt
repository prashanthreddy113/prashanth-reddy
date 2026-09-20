package com.manabandi.captain.ui.components

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarDefaults
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.sp
import com.manabandi.captain.R

enum class BottomTab { HOME, EARNINGS, HELP }

/** Three big tabs: 🏠 Home, 💰 Earnings, 📞 Help. */
@Composable
fun ManaBandiBottomBar(
    current: BottomTab,
    onHome: () -> Unit,
    onEarnings: () -> Unit,
    onHelp: () -> Unit
) {
    val colors = MaterialTheme.colorScheme
    val itemColors = NavigationBarItemDefaults.colors(
        selectedIconColor = colors.onPrimaryContainer,
        selectedTextColor = colors.primary,
        indicatorColor = colors.primaryContainer,
        unselectedIconColor = colors.onSurface,
        unselectedTextColor = colors.onSurfaceVariant
    )
    NavigationBar(
        containerColor = colors.surface,
        tonalElevation = NavigationBarDefaults.Elevation
    ) {
        NavigationBarItem(
            selected = current == BottomTab.HOME,
            onClick = onHome,
            icon = { Text(text = "🏠", fontSize = 28.sp) },
            label = { Text(text = stringResource(R.string.nav_home), fontSize = 18.sp) },
            colors = itemColors
        )
        NavigationBarItem(
            selected = current == BottomTab.EARNINGS,
            onClick = onEarnings,
            icon = { Text(text = "💰", fontSize = 28.sp) },
            label = { Text(text = stringResource(R.string.nav_earnings), fontSize = 18.sp) },
            colors = itemColors
        )
        NavigationBarItem(
            selected = current == BottomTab.HELP,
            onClick = onHelp,
            icon = { Text(text = "📞", fontSize = 28.sp) },
            label = { Text(text = stringResource(R.string.nav_help), fontSize = 18.sp) },
            colors = itemColors
        )
    }
}
