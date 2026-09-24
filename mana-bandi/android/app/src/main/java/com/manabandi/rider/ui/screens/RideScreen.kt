package com.manabandi.rider.ui.screens

import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.manabandi.rider.R
import com.manabandi.rider.RideViewModel
import com.manabandi.rider.data.Service
import com.manabandi.rider.data.displayName
import com.manabandi.rider.data.api.Payments
import com.manabandi.rider.data.api.Ride
import com.manabandi.rider.data.api.RideStatus
import com.manabandi.rider.ui.components.BigButton
import com.manabandi.rider.ui.components.CallButton
import com.manabandi.rider.ui.components.MapMarker
import com.manabandi.rider.ui.components.OsmMap
import com.manabandi.rider.ui.components.SecondaryButton
import com.manabandi.rider.ui.components.SpeakTopBar
import com.manabandi.rider.ui.components.appLanguage
import com.manabandi.rider.ui.components.dialNumber
import com.manabandi.rider.ui.components.shareTripText
import com.manabandi.rider.ui.theme.GreenLight
import com.manabandi.rider.ui.theme.TextDark
import com.manabandi.rider.ui.theme.Turmeric
import com.manabandi.rider.ui.theme.TurmericLight

/**
 * The live ride: polls GET /api/rides/{id} every 3 s. Shows the map with the captain moving,
 * ETA, the real captain / vehicle / OTP, 📞 call, 👨‍👩‍👧 share (server trackUrl), ❌ cancel,
 * 🆘 SOS (POST /sos with our location, then dial 112). On `finished`: done + rating.
 */
@Composable
fun RideScreen(vm: RideViewModel, onHome: () -> Unit, onBackToFinding: () -> Unit) {
    val context = LocalContext.current
    val currentOnHome by rememberUpdatedState(onHome)
    val currentOnBackToFinding by rememberUpdatedState(onBackToFinding)
    val cancelledText = stringResource(R.string.ride_cancelled)
    val ride = vm.ride

    LaunchedEffect(ride?.id) {
        if (ride == null) currentOnHome() else vm.pollRide()
    }
    val status = ride?.status
    LaunchedEffect(status) {
        when (status) {
            // A captain cancelled: the ride is re-dispatched, so we are searching again.
            RideStatus.SEARCHING, RideStatus.NO_CAPTAIN -> currentOnBackToFinding()
            RideStatus.CANCELLED -> {
                Toast.makeText(context, cancelledText, Toast.LENGTH_LONG).show()
                vm.clearRide()
                currentOnHome()
            }
            else -> Unit
        }
    }
    if (ride == null) return

    if (status == RideStatus.FINISHED) {
        DoneAndRate(vm = vm, ride = ride, onHome = onHome)
    } else {
        LiveRide(vm = vm, ride = ride, onHome = onHome)
    }
}

@Composable
private fun LiveRide(vm: RideViewModel, ride: Ride, onHome: () -> Unit) {
    val context = LocalContext.current
    val service = Service.fromApi(ride.service)
    val isParcel = service == Service.PARCEL
    val captain = ride.captain
    val language = appLanguage()
    val pinLabel = stringResource(R.string.pickup_gps_pin)
    val dropName = ride.drop.displayName(language, stringResource(R.string.drop_map_pin))
    val serviceName = stringResource(
        when (service) {
            Service.BIKE -> R.string.service_bike
            Service.AUTO -> R.string.service_auto
            Service.PARCEL -> R.string.service_parcel
        }
    )
    val emergency = stringResource(R.string.emergency_number)
    val sosSent = stringResource(R.string.sos_sent)
    var confirmCancel by rememberSaveable { mutableStateOf(false) }

    val title = stringResource(
        when (ride.status) {
            RideStatus.ARRIVED -> R.string.ride_arrived
            RideStatus.STARTED -> R.string.ride_started
            else -> R.string.ride_captain_coming
        }
    )
    val speech = stringResource(
        when (ride.status) {
            RideStatus.ARRIVED -> R.string.ride_arrived_speech
            RideStatus.STARTED -> R.string.ride_started_speech
            else -> R.string.ride_speech
        }
    )

    // "Share trip with family": captain, vehicle number, drop and the server's live tracking link.
    val shareMessage = stringResource(
        R.string.share_trip_text,
        captain?.name ?: "—",
        captain?.vehicleNo ?: "—",
        dropName,
        ride.trackUrl ?: "—"
    )
    val shareChooser = stringResource(R.string.share_chooser)

    Scaffold(
        topBar = { SpeakTopBar(title = title, speechText = speech) }
    ) { padding ->
        Column(
            modifier = Modifier
                .padding(padding)
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            if (vm.pollOffline) {
                Text(
                    text = "📶 " + stringResource(R.string.network_weak),
                    style = MaterialTheme.typography.bodyLarge,
                    color = MaterialTheme.colorScheme.error
                )
            }

            // ETA while the captain is on the way
            val eta = captain?.etaMin
            if (ride.status == RideStatus.ACCEPTED && eta != null) {
                Text(
                    text = "🕒 " + stringResource(R.string.eta_min, eta),
                    style = MaterialTheme.typography.headlineMedium,
                    color = MaterialTheme.colorScheme.primary
                )
            }

            // Live map: pickup, drop and the captain
            val captainLocation = captain?.location
            val markers = listOfNotNull(
                MapMarker(id = "pickup", lat = ride.pickup.lat, lng = ride.pickup.lng, emoji = "🧍", title = pinLabel),
                MapMarker(id = "drop", lat = ride.drop.lat, lng = ride.drop.lng, emoji = "🏁", title = dropName),
                captainLocation?.let {
                    MapMarker(id = "captain", lat = it.lat, lng = it.lng, emoji = service.emoji, title = captain?.name)
                }
            )
            OsmMap(
                markers = markers,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(240.dp)
            )

            // Captain card
            if (captain != null) {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(24.dp),
                    colors = CardDefaults.cardColors(containerColor = GreenLight)
                ) {
                    Row(
                        modifier = Modifier.padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Box(
                            modifier = Modifier
                                .size(88.dp)
                                .background(Color.White, CircleShape)
                                .border(3.dp, MaterialTheme.colorScheme.primary, CircleShape),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(text = "👨", fontSize = 48.sp)
                        }
                        Spacer(modifier = Modifier.width(16.dp))
                        Column {
                            Text(
                                text = stringResource(R.string.captain),
                                style = MaterialTheme.typography.bodyLarge,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                            Text(text = captain.name, style = MaterialTheme.typography.headlineMedium)
                            val rating = captain.rating
                            Text(
                                text = (if (rating != null) "⭐ " + String.format(java.util.Locale.US, "%.1f", rating) + "   " else "") +
                                    "${service.emoji} $serviceName",
                                style = MaterialTheme.typography.bodyLarge
                            )
                            val model = captain.vehicleModel
                            if (!model.isNullOrBlank()) {
                                Text(text = model, style = MaterialTheme.typography.bodyLarge)
                            }
                        }
                    }
                }

                // Vehicle number — huge, like a number plate
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
                        Text(
                            text = "🔢 " + stringResource(R.string.ride_vehicle),
                            style = MaterialTheme.typography.bodyLarge
                        )
                        Text(
                            text = captain.vehicleNo,
                            style = MaterialTheme.typography.displayLarge,
                            letterSpacing = 4.sp,
                            textAlign = TextAlign.Center
                        )
                    }
                }
            }

            // Ride OTP (pickup OTP for a parcel) until the ride starts; the delivery OTP for parcels.
            val otp = ride.otp
            if (!otp.isNullOrBlank() && ride.status != RideStatus.STARTED) {
                OtpBlock(
                    label = stringResource(if (isParcel) R.string.ride_pickup_otp else R.string.ride_otp),
                    otp = otp
                )
            }
            val deliveryOtp = ride.parcel?.deliveryOtp
            if (isParcel && !deliveryOtp.isNullOrBlank()) {
                OtpBlock(label = stringResource(R.string.ride_delivery_otp), otp = deliveryOtp)
            }

            Spacer(modifier = Modifier.height(8.dp))

            if (captain != null && captain.phone.isNotBlank()) {
                CallButton(
                    label = stringResource(R.string.call_captain),
                    phoneNumber = captain.phone
                )
            }

            SecondaryButton(
                text = stringResource(R.string.share_trip),
                emoji = "👨‍👩‍👧",
                onClick = { shareTripText(context, shareMessage, shareChooser) }
            )

            ErrorText(vm.actionError)
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                if (ride.status != RideStatus.STARTED) {
                    SecondaryButton(
                        text = stringResource(R.string.cancel),
                        emoji = "❌",
                        color = MaterialTheme.colorScheme.error,
                        enabled = !vm.actionBusy,
                        onClick = { confirmCancel = true },
                        modifier = Modifier.weight(1f)
                    )
                }
                BigButton(
                    text = stringResource(R.string.sos),
                    emoji = "🆘",
                    containerColor = MaterialTheme.colorScheme.error,
                    onClick = {
                        vm.sendSos()
                        Toast.makeText(context, sosSent, Toast.LENGTH_LONG).show()
                        dialNumber(context, emergency)
                    },
                    modifier = Modifier.weight(1f)
                )
            }
        }
    }

    if (confirmCancel) {
        AlertDialog(
            onDismissRequest = { confirmCancel = false },
            title = { Text(text = stringResource(R.string.cancel_confirm_title)) },
            confirmButton = {
                TextButton(onClick = {
                    confirmCancel = false
                    vm.cancelRide(onDone = onHome)
                }) {
                    Text(text = "❌ " + stringResource(R.string.cancel_confirm_yes), fontSize = 20.sp)
                }
            },
            dismissButton = {
                TextButton(onClick = { confirmCancel = false }) {
                    Text(text = "✅ " + stringResource(R.string.cancel_confirm_no), fontSize = 20.sp)
                }
            }
        )
    }
}

@Composable
private fun OtpBlock(label: String, otp: String) {
    Text(
        text = label,
        style = MaterialTheme.typography.titleLarge,
        textAlign = TextAlign.Center,
        modifier = Modifier.fillMaxWidth()
    )
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(12.dp, Alignment.CenterHorizontally)
    ) {
        otp.forEach { digit ->
            Box(
                modifier = Modifier
                    .size(width = 68.dp, height = 84.dp)
                    .background(TurmericLight, RoundedCornerShape(16.dp))
                    .border(3.dp, MaterialTheme.colorScheme.primary, RoundedCornerShape(16.dp)),
                contentAlignment = Alignment.Center
            ) {
                Text(text = digit.toString(), fontSize = 44.sp, fontWeight = FontWeight.Bold)
            }
        }
    }
}

/** Ride finished: fare to pay, three faces (😊 😐 😞 → 5 / 3 / 1 stars) and an optional tip. */
@Composable
private fun DoneAndRate(vm: RideViewModel, ride: Ride, onHome: () -> Unit) {
    val fare = ride.fareFinal ?: ride.fareQuoted
    var stars by rememberSaveable { mutableIntStateOf(0) }
    var tip by rememberSaveable { mutableIntStateOf(0) }
    val payName = stringResource(if (ride.payment == Payments.UPI) R.string.pay_upi else R.string.pay_cash)

    Scaffold(
        topBar = {
            SpeakTopBar(
                title = stringResource(R.string.done_title),
                speechText = stringResource(R.string.done_speech, fare)
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .padding(padding)
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Text(text = "✅", fontSize = 72.sp)
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(24.dp),
                colors = CardDefaults.cardColors(containerColor = Turmeric, contentColor = TextDark)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(20.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(text = "₹$fare", fontSize = 56.sp, lineHeight = 64.sp, fontWeight = FontWeight.Bold)
                    Text(
                        text = stringResource(R.string.done_pay, fare) + "  " +
                            (if (ride.payment == Payments.UPI) "📱 " else "💵 ") + payName,
                        style = MaterialTheme.typography.titleLarge,
                        textAlign = TextAlign.Center
                    )
                }
            }

            Text(text = stringResource(R.string.rate_title), style = MaterialTheme.typography.headlineMedium)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                SelectTile(emoji = "😊", label = stringResource(R.string.rate_good), selected = stars == 5,
                    onClick = { stars = 5 }, modifier = Modifier.weight(1f))
                SelectTile(emoji = "😐", label = stringResource(R.string.rate_ok), selected = stars == 3,
                    onClick = { stars = 3 }, modifier = Modifier.weight(1f))
            }
            SelectTile(emoji = "😞", label = stringResource(R.string.rate_bad), selected = stars == 1,
                onClick = { stars = 1 }, modifier = Modifier.fillMaxWidth())

            Text(text = stringResource(R.string.tip_title), style = MaterialTheme.typography.titleLarge)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                SelectTile(emoji = "🙅", label = stringResource(R.string.tip_none), selected = tip == 0,
                    onClick = { tip = 0 }, modifier = Modifier.weight(1f))
                SelectTile(emoji = "💰", label = "₹10", selected = tip == 10,
                    onClick = { tip = 10 }, modifier = Modifier.weight(1f))
                SelectTile(emoji = "💰", label = "₹20", selected = tip == 20,
                    onClick = { tip = 20 }, modifier = Modifier.weight(1f))
            }

            BigButton(
                text = stringResource(if (vm.actionBusy) R.string.please_wait else R.string.rate_send),
                emoji = "✅",
                enabled = stars > 0 && !vm.actionBusy,
                onClick = { vm.rate(stars = stars, tip = if (tip > 0) tip else null, onDone = onHome) }
            )
            SecondaryButton(
                text = stringResource(R.string.rate_skip),
                emoji = "🏠",
                onClick = {
                    vm.clearRide()
                    onHome()
                }
            )
        }
    }
}
