package com.manabandi.rider.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.manabandi.rider.LocateState
import com.manabandi.rider.R
import com.manabandi.rider.RideViewModel
import com.manabandi.rider.data.Payment
import com.manabandi.rider.data.Service
import com.manabandi.rider.data.displayName
import com.manabandi.rider.data.formatKm
import com.manabandi.rider.data.isPin
import com.manabandi.rider.data.landmarkEmoji
import com.manabandi.rider.data.api.QuoteResponse
import com.manabandi.rider.location.openLocationSettings
import com.manabandi.rider.ui.components.BigButton
import com.manabandi.rider.ui.components.CallButton
import com.manabandi.rider.ui.components.LandmarkChipsRow
import com.manabandi.rider.ui.components.LocationPermissionGate
import com.manabandi.rider.ui.components.MapMarker
import com.manabandi.rider.ui.components.MicButton
import com.manabandi.rider.ui.components.OsmMap
import com.manabandi.rider.ui.components.PlaceChip
import com.manabandi.rider.ui.components.SecondaryButton
import com.manabandi.rider.ui.components.SpeakTopBar
import com.manabandi.rider.ui.components.appLanguage
import com.manabandi.rider.ui.theme.GreenLight
import com.manabandi.rider.ui.theme.TurmericLight

/**
 * Book a bike or auto: GPS pickup (nearest landmark within 300 m, else "where you are") with a
 * small map, drop by landmark chip / 🎤 / typing / tapping the map, the server's fare quote,
 * 💵 Cash / 📱 UPI, and one big Book button.
 */
@Composable
fun BookRideScreen(
    vm: RideViewModel,
    service: Service,
    onBack: () -> Unit,
    onBooked: () -> Unit,
    onTermsRequired: () -> Unit
) {
    LaunchedEffect(service) { vm.selectService(service) }

    val isBike = service == Service.BIKE
    val title = stringResource(if (isBike) R.string.book_title_bike else R.string.book_title_auto)

    Scaffold(
        topBar = {
            SpeakTopBar(
                title = title,
                speechText = stringResource(R.string.book_speech),
                onBack = onBack
            )
        }
    ) { padding ->
        Box(modifier = Modifier.padding(padding)) {
            LocationPermissionGate(
                rationale = stringResource(R.string.perm_location_rider),
                includeNotifications = false,
                onCancel = onBack
            ) {
                LaunchedEffect(Unit) {
                    if (vm.pickup == null && vm.locateState != LocateState.LOCATING) vm.locate()
                }
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .verticalScroll(rememberScrollState())
                        .imePadding()
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    PickupSection(vm = vm, tint = if (isBike) TurmericLight else GreenLight)

                    if (vm.locateState == LocateState.READY) {
                        BookingMap(vm = vm)
                        DropSection(vm = vm)

                        FareCard(quote = vm.quote, busy = vm.quoteBusy, serviceEmoji = service.emoji)
                        ErrorText(vm.quoteError)

                        Text(
                            text = stringResource(R.string.pay_title),
                            style = MaterialTheme.typography.titleLarge
                        )
                        PaymentSelector(selected = vm.payment, onSelect = { vm.payment = it })

                        ErrorText(vm.bookError)
                        Spacer(modifier = Modifier.height(4.dp))
                        BigButton(
                            text = stringResource(if (vm.bookBusy) R.string.please_wait else R.string.book_now),
                            emoji = if (vm.bookBusy) "⏳" else service.emoji,
                            enabled = vm.pickup != null && vm.drop != null && vm.quote != null && !vm.bookBusy,
                            onClick = { vm.book(onBooked = onBooked, onTermsRequired = onTermsRequired) }
                        )
                    }
                }
            }
        }
    }
}

/**
 * Pickup card for every GPS state: finding you, GPS off, outside the service area, error,
 * or the pickup name. Shared with the parcel wizard.
 */
@Composable
fun PickupSection(vm: RideViewModel, tint: Color) {
    val context = LocalContext.current
    when (vm.locateState) {
        LocateState.IDLE, LocateState.LOCATING -> {
            InfoCard(emoji = "📍", tint = tint) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    CircularProgressIndicator(modifier = Modifier.size(28.dp), strokeWidth = 3.dp)
                    Spacer(modifier = Modifier.width(12.dp))
                    Text(text = stringResource(R.string.locating), style = MaterialTheme.typography.titleLarge)
                }
            }
        }
        LocateState.NO_GPS -> {
            InfoCard(emoji = "📡", tint = tint) {
                Text(text = stringResource(R.string.gps_off), style = MaterialTheme.typography.titleLarge)
            }
            BigButton(
                text = stringResource(R.string.gps_turn_on),
                emoji = "⚙️",
                onClick = { openLocationSettings(context) }
            )
            SecondaryButton(text = stringResource(R.string.retry), emoji = "🔁", onClick = { vm.locate() })
        }
        LocateState.OUTSIDE -> OutsideAreaCard(vm = vm)
        LocateState.ERROR -> {
            InfoCard(emoji = "⚠️", tint = tint) {
                Text(
                    text = stringResource(vm.locateError ?: R.string.err_generic),
                    style = MaterialTheme.typography.titleLarge
                )
            }
            SecondaryButton(text = stringResource(R.string.retry), emoji = "🔁", onClick = { vm.locate() })
        }
        LocateState.READY -> {
            val pinLabel = stringResource(R.string.pickup_gps_pin)
            val name = vm.pickup?.displayName(appLanguage(), pinLabel) ?: pinLabel
            InfoCard(emoji = "📍", tint = tint) {
                Text(
                    text = stringResource(R.string.pickup_label),
                    style = MaterialTheme.typography.bodyLarge,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Text(text = name, style = MaterialTheme.typography.titleLarge)
            }
        }
    }
}

/** Friendly "we do not come here yet" card with the support number. */
@Composable
private fun OutsideAreaCard(vm: RideViewModel) {
    val phone = vm.supportPhone
    InfoCard(emoji = "🙏", tint = MaterialTheme.colorScheme.surfaceVariant) {
        Text(text = stringResource(R.string.outside_area_title), style = MaterialTheme.typography.titleLarge)
        Text(
            text = stringResource(R.string.outside_area_body, phone),
            style = MaterialTheme.typography.bodyLarge
        )
    }
    CallButton(label = stringResource(R.string.help_call), phoneNumber = phone)
    SecondaryButton(text = stringResource(R.string.retry), emoji = "🔁", onClick = { vm.locate() })
}

/** Small map: 🧍 pickup and 🏁 drop. Tapping the map chooses the drop. */
@Composable
fun BookingMap(vm: RideViewModel) {
    val from = vm.pickup ?: return
    val markers = listOfNotNull(
        MapMarker(id = "pickup", lat = from.lat, lng = from.lng, emoji = "🧍"),
        vm.drop?.let { MapMarker(id = "drop", lat = it.lat, lng = it.lng, emoji = "🏁") }
    )
    OsmMap(
        markers = markers,
        modifier = Modifier
            .fillMaxWidth()
            .height(210.dp),
        onTap = { lat, lng -> vm.chooseDropOnMap(lat, lng) }
    )
    Text(
        text = "👆 " + stringResource(R.string.drop_tap_map),
        style = MaterialTheme.typography.bodyLarge,
        color = MaterialTheme.colorScheme.onSurfaceVariant
    )
}

/** "Where to?": text + 🎤, typed suggestions, a map-pin note, and the town's landmark chips. */
@Composable
fun DropSection(vm: RideViewModel) {
    Text(
        text = stringResource(R.string.drop_label),
        style = MaterialTheme.typography.headlineMedium
    )
    DropInput(
        value = vm.dropText,
        onValueChange = { vm.onDropTyped(it) },
        onSpoken = { vm.onDropSpoken(it) },
        placeholder = stringResource(R.string.drop_hint)
    )
    val drop = vm.drop
    if (drop != null && drop.isPin()) {
        Text(
            text = "✅ " + stringResource(R.string.drop_map_pin),
            style = MaterialTheme.typography.titleMedium,
            color = MaterialTheme.colorScheme.primary
        )
    }
    if (vm.dropNotFound) ErrorText(R.string.drop_not_found)

    val suggestions = vm.dropSuggestions
    if (suggestions.isNotEmpty()) {
        val language = appLanguage()
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            suggestions.forEach { landmark ->
                PlaceChip(
                    emoji = landmarkEmoji(landmark.kind),
                    label = landmark.displayName(language),
                    onClick = { vm.chooseDropLandmark(landmark) }
                )
            }
        }
    }
    LandmarkChipsRow(
        landmarks = vm.landmarks,
        selectedId = drop?.landmarkId,
        onPick = { vm.chooseDropLandmark(it) }
    )
}

@Composable
fun ErrorText(message: Int?) {
    if (message == null) return
    Text(
        text = stringResource(message),
        style = MaterialTheme.typography.titleMedium,
        color = MaterialTheme.colorScheme.error,
        modifier = Modifier.fillMaxWidth(),
        textAlign = TextAlign.Center
    )
}

@Composable
private fun InfoCard(emoji: String, tint: Color, content: @Composable () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = tint)
    ) {
        Row(
            modifier = Modifier.padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(text = emoji, fontSize = 36.sp)
            Spacer(modifier = Modifier.width(12.dp))
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) { content() }
        }
    }
}

/** Huge text field + 🎤 mic. Shared with the parcel wizard. */
@Composable
fun DropInput(
    value: String,
    onValueChange: (String) -> Unit,
    onSpoken: (String) -> Unit,
    placeholder: String,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        OutlinedTextField(
            value = value,
            onValueChange = onValueChange,
            modifier = Modifier
                .weight(1f)
                .heightIn(min = 72.dp),
            textStyle = TextStyle(fontSize = 24.sp, fontWeight = FontWeight.SemiBold),
            placeholder = { Text(text = placeholder, fontSize = 20.sp) },
            singleLine = true,
            shape = RoundedCornerShape(20.dp),
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = MaterialTheme.colorScheme.primary,
                unfocusedBorderColor = MaterialTheme.colorScheme.outline
            )
        )
        MicButton(onResult = onSpoken)
    }
}

/** Distance + fare in ₹ from POST /api/rider/quote (🌙 when the night fare applies). */
@Composable
fun FareCard(quote: QuoteResponse?, busy: Boolean, serviceEmoji: String, modifier: Modifier = Modifier) {
    Card(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(20.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Column {
                Text(
                    text = "📏 " + stringResource(R.string.fare_distance),
                    style = MaterialTheme.typography.bodyLarge,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Text(
                    text = if (quote != null) stringResource(R.string.km, formatKm(quote.distanceKm)) else "—",
                    style = MaterialTheme.typography.headlineMedium
                )
                val eta = quote?.etaPickupMin
                if (eta != null && eta > 0) {
                    Text(
                        text = "🕒 " + stringResource(R.string.eta_pickup, eta),
                        style = MaterialTheme.typography.bodyLarge
                    )
                }
            }
            Column(horizontalAlignment = Alignment.End) {
                Text(
                    text = serviceEmoji + " " + stringResource(R.string.fare_amount),
                    style = MaterialTheme.typography.bodyLarge,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                if (busy) {
                    CircularProgressIndicator(modifier = Modifier.size(40.dp))
                } else {
                    Text(
                        text = if (quote != null) "₹ ${quote.fare}" else "₹ —",
                        style = MaterialTheme.typography.displayLarge,
                        color = MaterialTheme.colorScheme.primary
                    )
                }
                if (quote?.night == true) {
                    Text(text = stringResource(R.string.fare_night), style = MaterialTheme.typography.bodyLarge)
                }
            }
        }
    }
}

/** Two big tiles: 💵 Cash (default) and 📱 UPI. */
@Composable
fun PaymentSelector(selected: Payment, onSelect: (Payment) -> Unit, modifier: Modifier = Modifier) {
    Row(
        modifier = modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        SelectTile(
            emoji = "💵",
            label = stringResource(R.string.pay_cash),
            selected = selected == Payment.CASH,
            onClick = { onSelect(Payment.CASH) },
            modifier = Modifier.weight(1f)
        )
        SelectTile(
            emoji = "📱",
            label = stringResource(R.string.pay_upi),
            selected = selected == Payment.UPI,
            onClick = { onSelect(Payment.UPI) },
            modifier = Modifier.weight(1f)
        )
    }
}

/** Generic selectable tile (payment, parcel size, payer, rating). Min 80dp tall. */
@Composable
fun SelectTile(
    emoji: String,
    label: String,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val colors = MaterialTheme.colorScheme
    Surface(
        onClick = onClick,
        modifier = modifier.heightIn(min = 80.dp),
        shape = RoundedCornerShape(20.dp),
        color = if (selected) colors.primaryContainer else colors.surface,
        border = BorderStroke(if (selected) 4.dp else 2.dp, if (selected) colors.primary else colors.outline)
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(text = emoji, fontSize = 34.sp)
            Spacer(modifier = Modifier.width(12.dp))
            Text(
                text = label,
                style = MaterialTheme.typography.titleLarge,
                modifier = Modifier.weight(1f)
            )
            if (selected) Text(text = "✅", fontSize = 26.sp)
        }
    }
}
