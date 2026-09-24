package com.manabandi.captain.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
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
import com.manabandi.captain.location.TrackingRepository
import com.manabandi.captain.ui.components.BigButton
import com.manabandi.captain.ui.components.FakeQrBox
import com.manabandi.captain.ui.components.OTP_LENGTH
import com.manabandi.captain.ui.components.OtpEntry
import com.manabandi.captain.ui.components.PhotoButton
import com.manabandi.captain.ui.components.SpeakTopBar
import com.manabandi.captain.ui.theme.Green
import com.manabandi.captain.ui.theme.GreenDark
import com.manabandi.captain.ui.theme.GreenLight
import com.manabandi.captain.ui.theme.ParcelOrange
import com.manabandi.captain.ui.theme.TextDark
import com.manabandi.captain.ui.theme.Turmeric

/**
 * Parcel delivery proof, before finishing: 📷 delivery photo (POST /trip/photo stage=delivery)
 * + the receiver's delivery OTP (POST /trip/deliver), then POST /trip/finish.
 * A wrong code shows a clear message and clears the boxes.
 */
@Composable
fun DeliverScreen(vm: CaptainViewModel) {
    val tracking by TrackingRepository.state.collectAsState()
    tracking.trip ?: return
    var deliveryOtp by rememberSaveable { mutableStateOf("") }
    val photoTaken = vm.tripPhotos.containsKey(STAGE_DELIVERY)

    LaunchedEffect(vm.tripError) {
        if (vm.tripError == R.string.wrong_otp) deliveryOtp = ""
    }

    Scaffold(
        topBar = {
            SpeakTopBar(
                title = stringResource(R.string.delivery_title),
                speechText = stringResource(
                    if (vm.tripError == R.string.wrong_otp) R.string.wrong_otp else R.string.delivery_speech
                ),
                containerColor = ParcelOrange
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .padding(padding)
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .imePadding()
                .padding(20.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(18.dp)
        ) {
            Text(text = "📦", fontSize = 64.sp)
            if (photoTaken) {
                Text(
                    text = "✅ " + stringResource(
                        if (vm.tripPhotoUploaded[STAGE_DELIVERY] == true) R.string.photo_sent else R.string.photo_taken
                    ),
                    style = MaterialTheme.typography.titleLarge,
                    color = Green
                )
            }
            PhotoButton(
                label = stringResource(R.string.delivery_photo),
                onPhoto = { vm.uploadTripPhoto(STAGE_DELIVERY, it) },
                color = ParcelOrange
            )
            Text(
                text = "🔐 " + stringResource(R.string.delivery_otp_label),
                style = MaterialTheme.typography.headlineMedium,
                textAlign = TextAlign.Center
            )
            OtpEntry(
                otp = deliveryOtp,
                onOtpChange = {
                    deliveryOtp = it
                    if (vm.tripError != null) vm.clearTripError()
                },
                boxWidth = 76.dp,
                boxHeight = 100.dp,
                fontSize = 56.sp,
                autoFocus = false
            )
            TripErrorText(vm.tripError)
            Spacer(modifier = Modifier.height(4.dp))
            BigButton(
                text = stringResource(if (vm.tripBusy) R.string.please_wait else R.string.delivery_next),
                emoji = if (vm.tripBusy) "⏳" else "✅",
                enabled = deliveryOtp.length == OTP_LENGTH && photoTaken && !vm.tripBusy,
                containerColor = ParcelOrange,
                onClick = { vm.deliverAndFinish(deliveryOtp) }
            )
        }
    }
}

/**
 * Collect the fare: "₹45 take cash 💵" in 64 sp, or a UPI QR to show the rider, with the
 * server's commission line (`trip.commission`). ✅ Collected → POST /trip/collected, Home.
 */
@Composable
fun CollectScreen(vm: CaptainViewModel, onDone: () -> Unit) {
    val tracking by TrackingRepository.state.collectAsState()
    val trip = tracking.trip ?: return
    val isParcel = Service.fromApi(trip.service) == Service.PARCEL
    val isCash = Payment.fromApi(trip.payment) == Payment.CASH
    val fare = trip.fareFinal ?: trip.fare
    val commission = trip.commission?.amount ?: CommissionConfig.estimate(fare)
    val captainGets = trip.commission?.captainGets ?: (fare - commission)

    val speech = if (isCash) {
        stringResource(R.string.collect_speech_cash, fare)
    } else {
        stringResource(R.string.collect_speech_upi)
    }

    Scaffold(
        topBar = {
            SpeakTopBar(
                title = stringResource(R.string.collect_title),
                speechText = speech,
                containerColor = if (isParcel) ParcelOrange else GreenDark
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .padding(padding)
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(20.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(18.dp)
        ) {
            if (isCash) {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(28.dp),
                    colors = CardDefaults.cardColors(containerColor = Turmeric, contentColor = TextDark)
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(24.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text(
                            text = "₹$fare",
                            fontSize = 64.sp,
                            lineHeight = 76.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = stringResource(R.string.collect_cash) + " 💵",
                            fontSize = 34.sp,
                            lineHeight = 42.sp,
                            fontWeight = FontWeight.Bold,
                            textAlign = TextAlign.Center
                        )
                    }
                }
            } else {
                Text(
                    text = "📱 " + stringResource(R.string.collect_upi),
                    style = MaterialTheme.typography.headlineMedium,
                    textAlign = TextAlign.Center
                )
                FakeQrBox(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 24.dp),
                    seed = fare
                )
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(24.dp),
                    colors = CardDefaults.cardColors(containerColor = GreenLight, contentColor = TextDark)
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text(
                            text = "₹$fare",
                            fontSize = 56.sp,
                            lineHeight = 66.sp,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.primary
                        )
                        Text(
                            text = stringResource(R.string.collect_upi_sub),
                            style = MaterialTheme.typography.bodyLarge,
                            textAlign = TextAlign.Center
                        )
                    }
                }
            }

            // Commission line on every trip, from the server (never a surprise at settlement).
            Text(
                text = "💸 " + stringResource(R.string.collect_commission_line, commission, captainGets),
                style = MaterialTheme.typography.titleLarge,
                modifier = Modifier.fillMaxWidth(),
                textAlign = TextAlign.Center
            )

            TripErrorText(vm.tripError)
            Spacer(modifier = Modifier.height(8.dp))
            BigButton(
                text = stringResource(if (vm.tripBusy) R.string.please_wait else R.string.collected),
                emoji = if (vm.tripBusy) "⏳" else "✅",
                enabled = !vm.tripBusy,
                onClick = { vm.collected(onDone) }
            )
        }
    }
}
