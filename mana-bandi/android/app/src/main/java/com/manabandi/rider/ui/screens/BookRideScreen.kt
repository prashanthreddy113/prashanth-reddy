package com.manabandi.rider.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
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
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.manabandi.rider.R
import com.manabandi.rider.RideViewModel
import com.manabandi.rider.data.Payment
import com.manabandi.rider.data.Service
import com.manabandi.rider.ui.components.BigButton
import com.manabandi.rider.ui.components.MicButton
import com.manabandi.rider.ui.components.SavedPlacesRow
import com.manabandi.rider.ui.components.SpeakTopBar
import com.manabandi.rider.ui.theme.GreenLight
import com.manabandi.rider.ui.theme.TurmericLight

@Composable
fun BookRideScreen(
    vm: RideViewModel,
    service: Service,
    onBack: () -> Unit,
    onBook: () -> Unit
) {
    LaunchedEffect(service) {
        if (vm.service != service) vm.service = service
    }

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
        Column(
            modifier = Modifier
                .padding(padding)
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .imePadding()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Pickup (auto-filled)
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(20.dp),
                colors = CardDefaults.cardColors(containerColor = if (isBike) TurmericLight else GreenLight)
            ) {
                Row(
                    modifier = Modifier.padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(text = "📍", fontSize = 36.sp)
                    Spacer(modifier = Modifier.width(12.dp))
                    Column {
                        Text(
                            text = stringResource(R.string.pickup_label),
                            style = MaterialTheme.typography.bodyLarge,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Text(
                            text = stringResource(R.string.pickup_current),
                            style = MaterialTheme.typography.titleLarge
                        )
                    }
                }
            }

            // Drop
            Text(
                text = stringResource(R.string.drop_label),
                style = MaterialTheme.typography.headlineMedium
            )
            DropInput(
                value = vm.drop,
                onValueChange = { vm.drop = it },
                placeholder = stringResource(R.string.drop_hint)
            )
            SavedPlacesRow(
                selectedLabel = vm.drop,
                onPick = { _, label -> vm.drop = label }
            )

            // Fare + payment
            FareCard(distanceKm = vm.distanceKm, fare = vm.fare, serviceEmoji = service.emoji)
            Text(
                text = stringResource(R.string.pay_title),
                style = MaterialTheme.typography.titleLarge
            )
            PaymentSelector(selected = vm.payment, onSelect = { vm.payment = it })

            Spacer(modifier = Modifier.height(4.dp))
            BigButton(
                text = stringResource(R.string.book_now),
                emoji = service.emoji,
                enabled = vm.drop.isNotBlank(),
                onClick = onBook
            )
        }
    }
}

/** Huge text field + 🎤 mic. Shared with the parcel wizard. */
@Composable
fun DropInput(
    value: String,
    onValueChange: (String) -> Unit,
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
        MicButton(onResult = onValueChange)
    }
}

/** Distance + fare in ₹. */
@Composable
fun FareCard(distanceKm: Int, fare: Int, serviceEmoji: String, modifier: Modifier = Modifier) {
    val known = distanceKm > 0
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
                    text = if (known) stringResource(R.string.km, distanceKm) else "—",
                    style = MaterialTheme.typography.headlineMedium
                )
            }
            Column(horizontalAlignment = Alignment.End) {
                Text(
                    text = serviceEmoji + " " + stringResource(R.string.fare_amount),
                    style = MaterialTheme.typography.bodyLarge,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Text(
                    text = if (known) "₹ $fare" else "₹ —",
                    style = MaterialTheme.typography.displayLarge,
                    color = MaterialTheme.colorScheme.primary
                )
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

/** Generic selectable tile (payment, parcel size, payer). Min 80dp tall. */
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
