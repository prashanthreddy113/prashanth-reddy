package com.manabandi.rider.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.manabandi.rider.R
import com.manabandi.rider.data.Service
import com.manabandi.rider.ui.components.BottomTab
import com.manabandi.rider.ui.components.ManaBandiBottomBar
import com.manabandi.rider.ui.components.SavedPlacesRow
import com.manabandi.rider.ui.components.ServiceCard
import com.manabandi.rider.ui.components.SpeakTopBar
import com.manabandi.rider.ui.theme.Green
import com.manabandi.rider.ui.theme.ParcelOrange
import com.manabandi.rider.ui.theme.TextDark
import com.manabandi.rider.ui.theme.Turmeric

@Composable
fun HomeScreen(
    onService: (Service) -> Unit,
    onPlace: (String) -> Unit,
    onRides: () -> Unit,
    onHelp: () -> Unit
) {
    val name = stringResource(R.string.default_name)

    Scaffold(
        topBar = {
            SpeakTopBar(
                title = stringResource(R.string.app_name),
                speechText = stringResource(R.string.home_speech)
            )
        },
        bottomBar = {
            ManaBandiBottomBar(
                current = BottomTab.HOME,
                onHome = {},
                onRides = onRides,
                onHelp = onHelp
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .padding(padding)
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            Text(
                text = stringResource(R.string.home_greeting, name),
                style = MaterialTheme.typography.headlineMedium
            )
            Text(
                text = stringResource(R.string.home_what),
                style = MaterialTheme.typography.titleLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            ServiceCard(
                emoji = Service.BIKE.emoji,
                title = stringResource(R.string.service_bike),
                subtitle = stringResource(R.string.service_bike_sub),
                color = Turmeric,
                contentColor = TextDark,
                onClick = { onService(Service.BIKE) }
            )
            ServiceCard(
                emoji = Service.AUTO.emoji,
                title = stringResource(R.string.service_auto),
                subtitle = stringResource(R.string.service_auto_sub),
                color = Green,
                contentColor = Color.White,
                onClick = { onService(Service.AUTO) }
            )
            ServiceCard(
                emoji = Service.PARCEL.emoji,
                title = stringResource(R.string.service_parcel),
                subtitle = stringResource(R.string.service_parcel_sub),
                color = ParcelOrange,
                contentColor = Color.White,
                onClick = { onService(Service.PARCEL) }
            )

            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = stringResource(R.string.saved_places),
                style = MaterialTheme.typography.titleLarge
            )
            SavedPlacesRow(onPick = { _, label -> onPlace(label) })
            Spacer(modifier = Modifier.height(8.dp))
        }
    }
}
