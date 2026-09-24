package com.manabandi.captain.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
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
import com.manabandi.captain.data.Payment
import com.manabandi.captain.data.Service
import com.manabandi.captain.data.api.EarningsTrip
import com.manabandi.captain.data.formatIsoClock
import com.manabandi.captain.data.formatPct
import com.manabandi.captain.ui.components.BottomTab
import com.manabandi.captain.ui.components.CallButton
import com.manabandi.captain.ui.components.ManaBandiBottomBar
import com.manabandi.captain.ui.components.SecondaryButton
import com.manabandi.captain.ui.components.SpeakTopBar
import com.manabandi.captain.ui.theme.GreenLight
import com.manabandi.captain.ui.theme.ParcelOrangeLight
import com.manabandi.captain.ui.theme.TextDark
import com.manabandi.captain.ui.theme.Turmeric
import com.manabandi.captain.ui.theme.TurmericLight

/**
 * GET /api/captain/earnings: today / this week / office owes you in 40 sp digits, the
 * owner-configured commission rule, the trips list, 📞 office.
 */
@Composable
fun EarningsScreen(vm: CaptainViewModel, onHome: () -> Unit, onHelp: () -> Unit) {
    val supportNumber = stringResource(R.string.support_number)
    LaunchedEffect(Unit) { vm.loadEarnings() }
    val earnings = vm.earnings

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
            if (vm.earningsBusy && earnings == null) {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Center) {
                    CircularProgressIndicator(modifier = Modifier.size(48.dp))
                }
            }
            val error = vm.earningsError
            if (error != null) {
                TripErrorText(error)
                SecondaryButton(text = stringResource(R.string.retry), emoji = "🔁", onClick = { vm.loadEarnings() })
            }

            if (earnings != null) {
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    StatCard(
                        emoji = "📅",
                        label = stringResource(R.string.earn_today),
                        amount = earnings.today.net,
                        sub = stringResource(R.string.today_trips, earnings.today.trips),
                        color = GreenLight,
                        modifier = Modifier.weight(1f)
                    )
                    StatCard(
                        emoji = "🗓️",
                        label = stringResource(R.string.earn_week),
                        amount = earnings.week.net,
                        sub = stringResource(R.string.today_trips, earnings.week.trips),
                        color = TurmericLight,
                        modifier = Modifier.weight(1f)
                    )
                }
                StatCard(
                    emoji = "🏦",
                    label = stringResource(R.string.earn_settlement),
                    amount = earnings.settlementDue,
                    sub = null,
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
                        // Rule set by the owner in the web portal (Commission page), sent by the server.
                        val rule = CommissionConfig.info ?: earnings.commission
                        Text(
                            text = "🎁 " + stringResource(R.string.earn_commission_rate, formatPct(rule.currentPct)),
                            style = MaterialTheme.typography.titleLarge,
                            textAlign = TextAlign.Center
                        )
                        if (rule.freeMonths > 0) {
                            Text(
                                text = stringResource(
                                    R.string.earn_commission_offer,
                                    formatPct(rule.freePct),
                                    rule.freeMonths,
                                    formatPct(rule.pct)
                                ),
                                style = MaterialTheme.typography.bodyLarge,
                                textAlign = TextAlign.Center
                            )
                        }
                        Text(
                            text = stringResource(R.string.earn_commission_today, earnings.today.commission),
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
                if (earnings.trips.isEmpty()) {
                    Text(
                        text = stringResource(R.string.earn_no_trips),
                        style = MaterialTheme.typography.bodyLarge,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                } else {
                    earnings.trips.forEach { trip -> TripRow(trip) }
                }
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
    sub: String?,
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
            if (sub != null) {
                Text(text = sub, style = MaterialTheme.typography.bodyLarge)
            }
        }
    }
}

@Composable
private fun TripRow(trip: EarningsTrip) {
    val service = Service.fromApi(trip.service)
    val tint = when (service) {
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
            Text(text = service.emoji, fontSize = 40.sp)
            Spacer(modifier = Modifier.width(16.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(text = trip.dropName, style = MaterialTheme.typography.titleLarge)
                Text(
                    text = "🕒 ${formatIsoClock(trip.finishedAt)}   ${Payment.fromApi(trip.payment).emoji}",
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
