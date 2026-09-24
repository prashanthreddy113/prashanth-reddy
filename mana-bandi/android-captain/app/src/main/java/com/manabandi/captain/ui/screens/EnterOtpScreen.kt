package com.manabandi.captain.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
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
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.manabandi.captain.CaptainViewModel
import com.manabandi.captain.R
import com.manabandi.captain.data.Service
import com.manabandi.captain.location.TrackingRepository
import com.manabandi.captain.ui.components.BigButton
import com.manabandi.captain.ui.components.OTP_LENGTH
import com.manabandi.captain.ui.components.OtpEntry
import com.manabandi.captain.ui.components.PhotoButton
import com.manabandi.captain.ui.components.SpeakTopBar
import com.manabandi.captain.ui.theme.Green
import com.manabandi.captain.ui.theme.ParcelOrange

/**
 * "Enter the 4 digits the rider says" → POST /api/captain/trip/start {otp}; a wrong code
 * (422 wrong_ride_otp) shows a clear message and clears the boxes. For a parcel it is the
 * pickup OTP and a 📷 parcel photo is required (uploaded with stage=pickup).
 */
@Composable
fun EnterOtpScreen(vm: CaptainViewModel) {
    val tracking by TrackingRepository.state.collectAsState()
    val trip = tracking.trip ?: return
    val service = Service.fromApi(trip.service)
    val isParcel = service == Service.PARCEL
    var otp by rememberSaveable { mutableStateOf("") }
    val accent = if (isParcel) ParcelOrange else MaterialTheme.colorScheme.primary
    val wrongOtp = vm.tripError == R.string.wrong_otp

    LaunchedEffect(vm.tripError) {
        if (vm.tripError == R.string.wrong_otp) otp = ""
    }

    Scaffold(
        topBar = {
            SpeakTopBar(
                title = stringResource(if (isParcel) R.string.enter_otp_parcel_title else R.string.enter_otp_title),
                speechText = stringResource(
                    when {
                        wrongOtp -> R.string.wrong_otp
                        isParcel -> R.string.enter_otp_parcel_speech
                        else -> R.string.enter_otp_speech
                    }
                )
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .padding(padding)
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .imePadding()
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(20.dp)
        ) {
            Text(text = "${service.emoji}  🔐", fontSize = 56.sp)
            Text(
                text = stringResource(if (isParcel) R.string.enter_otp_parcel_title else R.string.enter_otp_title),
                style = MaterialTheme.typography.headlineMedium,
                textAlign = TextAlign.Center
            )

            OtpEntry(
                otp = otp,
                onOtpChange = {
                    otp = it
                    if (vm.tripError != null) vm.clearTripError()
                },
                boxWidth = 76.dp,
                boxHeight = 100.dp,
                fontSize = 56.sp
            )

            TripErrorText(vm.tripError)

            val photoTaken = vm.tripPhotos.containsKey(STAGE_PICKUP)
            if (isParcel) {
                if (photoTaken) {
                    Text(
                        text = "✅ " + stringResource(
                            if (vm.tripPhotoUploaded[STAGE_PICKUP] == true) R.string.photo_sent else R.string.photo_taken
                        ),
                        style = MaterialTheme.typography.titleLarge,
                        color = Green
                    )
                }
                PhotoButton(
                    label = stringResource(R.string.parcel_photo),
                    onPhoto = { vm.uploadTripPhoto(STAGE_PICKUP, it) },
                    color = ParcelOrange
                )
            }

            Spacer(modifier = Modifier.height(4.dp))
            BigButton(
                text = stringResource(if (vm.tripBusy) R.string.please_wait else R.string.start_trip),
                emoji = if (vm.tripBusy) "⏳" else "▶️",
                enabled = otp.length == OTP_LENGTH && !vm.tripBusy && (!isParcel || photoTaken),
                containerColor = accent,
                onClick = { vm.startTrip(otp) }
            )
        }
    }
}

const val STAGE_PICKUP = "pickup"
const val STAGE_DELIVERY = "delivery"
