package com.manabandi.captain.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.manabandi.captain.CaptainViewModel
import com.manabandi.captain.R
import com.manabandi.captain.data.CommissionConfig
import com.manabandi.captain.data.Service
import com.manabandi.captain.data.TripLogEntry
import com.manabandi.captain.ui.components.BottomTab
import com.manabandi.captain.ui.components.CallButton
import com.manabandi.captain.ui.components.ManaBandiBottomBar
import com.manabandi.captain.ui.components.SpeakTopBar
import com.manabandi.captain.ui.theme.GreenLight
import com.manabandi.captain.ui.theme.ParcelOrangeLight
import com.manabandi.captain.ui.theme.TextDark
import com.manabandi.captain.ui.theme.Turmeric
import com.manabandi.captain.ui.theme.TurmericLight

/** Today / this week / office owes you in 40 sp digits, today's trips, commission line, 📞 office. */
@Composable
fun EarningsScreen(vm: CaptainViewModel, onHome: () -> Unit, onHelp: () -> Unit) {
    val supportNumber = stringResource(R.string.support_number)

    Scaffold(
        topBar = {
            SpeakTopBar(
                title = stringResource(R.string.earnings_title),
                speechText = stringResource(R.string.earnings_speech)
            )
        },
        bottomBar = {
            ManaBandiBottomBar(
                current = BottomTab.EARNINGS,
                onHome = onHome,
                onEarnings = {},
                onHelp = onHelp
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .padding(padding)
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                StatCard(
                    emoji = "📅",
                    label = stringResource(R.string.earn_today),
                    amount = vm.earningsToday,
                    color = GreenLight,
                    modifier = Modifier.weight(1f)
                )
                StatCard(
                    emoji = "🗓️",
                    label = stringResource(R.string.earn_week),
                    amount = vm.earningsWeek,
                    color = TurmericLight,
                    modifier = Modifier.weight(1f)
                )
            }
            StatCard(
                emoji = "🏦",
                label = stringResource(R.string.earn_settlement),
                amount = vm.settlementDue,
                color = ParcelOrangeLight
            )

            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(20.dp),
                colors = CardDefaults.cardColors(containerColor = Turmeric, contentColor = TextDark)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    // Rule set by the owner in the web portal (Commission page).
                    val rule = CommissionConfig.rule
                    Text(
                        text = "🎁 " + stringResource(R.string.earn_commission_rate, vm.commissionRate),
                        style = MaterialTheme.typography.titleLarge,
                        textAlign = TextAlign.Center
                    )
                    if (rule.freeMonths > 0) {
                        Text(
                            text = stringResource(R.string.earn_commission_offer, rule.freePercent, rule.freeMonths, rule.percent),
                            style = MaterialTheme.typography.bodyLarge,
                            textAlign = TextAlign.Center
                        )
                    }
                    Text(
                        text = stringResource(R.string.earn_commission_today, vm.commissionToday),
                        style = MaterialTheme.typography.bodyLarge,
                        textAlign = TextAlign.Center
                    )
                    Text(
                        text = stringResource(R.string.commission_note),
                        style = MaterialTheme.typography.bodyLarge,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        textAlign = TextAlign.Center
                    )
                }
            }

            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = stringResource(R.string.earn_trips_list),
                style = MaterialTheme.typography.headlineMedium
            )
            if (vm.tripLog.isEmpty()) {
                Text(
                    text = stringResource(R.string.earn_no_trips),
                    style = MaterialTheme.typography.bodyLarge,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            } else {
                vm.tripLog.forEach { trip -> TripRow(trip) }
            }

            Spacer(modifier = Modifier.height(8.dp))
            CallButton(
                label = stringResource(R.string.call_office),
                phoneNumber = supportNumber
            )
            Spacer(modifier = Modifier.height(8.dp))
        }
    }
}

@Composable
private fun StatCard(
    emoji: String,
    label: String,
    amount: Int,
    color: Color,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = color, contentColor = TextDark)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(text = "$emoji $label", style = MaterialTheme.typography.bodyLarge, textAlign = TextAlign.Center)
            Text(
                text = "₹$amount",
                fontSize = 40.sp,
                lineHeight = 48.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.primary
            )
        }
    }
}

@Composable
private fun TripRow(trip: TripLogEntry) {
    val tint = when (trip.service) {
        Service.BIKE -> TurmericLight
        Service.AUTO -> GreenLight
        Service.PARCEL -> ParcelOrangeLight
    }
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = tint, contentColor = TextDark)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(text = trip.service.emoji, fontSize = 40.sp)
            Spacer(modifier = Modifier.width(16.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(text = stringResource(trip.dropNameRes), style = MaterialTheme.typography.titleLarge)
                Text(
                    text = "🕒 ${trip.time}   ${trip.payment.emoji}",
                    style = MaterialTheme.typography.bodyLarge,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            Text(
                text = "₹${trip.fare}",
                style = MaterialTheme.typography.headlineMedium,
                color = MaterialTheme.colorScheme.primary
            )
        }
    }
}
