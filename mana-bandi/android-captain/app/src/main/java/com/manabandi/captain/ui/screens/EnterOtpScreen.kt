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
import com.manabandi.captain.ui.components.BigButton
import com.manabandi.captain.ui.components.OTP_LENGTH
import com.manabandi.captain.ui.components.OtpEntry
import com.manabandi.captain.ui.components.PhotoButton
import com.manabandi.captain.ui.components.SpeakTopBar
import com.manabandi.captain.ui.theme.Green
import com.manabandi.captain.ui.theme.ParcelOrange

/**
 * "Enter the 4 digits the rider says": four 56 sp boxes + numeric keyboard.
 * For a parcel it is the pickup OTP and there is a 📷 parcel photo button.
 * Demo: any 4 digits start the ride.
 */
@Composable
fun EnterOtpScreen(vm: CaptainViewModel, onStarted: () -> Unit) {
    val request = vm.request ?: return
    val isParcel = request.service == Service.PARCEL
    var otp by rememberSaveable { mutableStateOf("") }
    val accent = if (isParcel) ParcelOrange else MaterialTheme.colorScheme.primary

    Scaffold(
        topBar = {
            SpeakTopBar(
                title = stringResource(if (isParcel) R.string.enter_otp_parcel_title else R.string.enter_otp_title),
                speechText = stringResource(if (isParcel) R.string.enter_otp_parcel_speech else R.string.enter_otp_speech)
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
            Text(text = "${request.service.emoji}  🔐", fontSize = 56.sp)
            Text(
                text = stringResource(if (isParcel) R.string.enter_otp_parcel_title else R.string.enter_otp_title),
                style = MaterialTheme.typography.headlineMedium,
                textAlign = TextAlign.Center
            )

            OtpEntry(
                otp = otp,
                onOtpChange = { otp = it },
                boxWidth = 76.dp,
                boxHeight = 100.dp,
                fontSize = 56.sp
            )

            Text(
                text = stringResource(R.string.otp_demo_hint),
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            if (isParcel) {
                val photo = vm.parcelPhoto
                if (photo != null) {
                    Text(
                        text = "✅ " + stringResource(R.string.photo_taken),
                        style = MaterialTheme.typography.titleLarge,
                        color = Green
                    )
                }
                PhotoButton(
                    label = stringResource(R.string.parcel_photo),
                    onPhoto = { vm.parcelPhoto = it },
                    color = ParcelOrange
                )
            }

            Spacer(modifier = Modifier.height(4.dp))
            BigButton(
                text = stringResource(R.string.start_trip),
                emoji = "▶️",
                enabled = otp.length == OTP_LENGTH,
                containerColor = accent,
                onClick = onStarted
            )
        }
    }
}
