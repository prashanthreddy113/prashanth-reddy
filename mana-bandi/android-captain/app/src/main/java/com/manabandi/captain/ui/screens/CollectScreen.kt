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
import com.manabandi.captain.data.Payment
import com.manabandi.captain.data.Service
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
 * Collect the fare: "₹45 take cash 💵" in 64 sp, or a UPI QR to show the rider.
 * For a parcel the delivery proof (📷 photo + delivery OTP) comes first.
 * ✅ Collected -> fare is added to today's earnings, back to Home.
 */
@Composable
fun CollectScreen(vm: CaptainViewModel, onDone: () -> Unit) {
    val request = vm.request ?: return
    val isParcel = request.service == Service.PARCEL
    var deliveryStep by rememberSaveable { mutableStateOf(isParcel) }
    var deliveryOtp by rememberSaveable { mutableStateOf("") }
    val isCash = request.payment == Payment.CASH

    val speech = when {
        deliveryStep -> stringResource(R.string.delivery_speech)
        isCash -> stringResource(R.string.collect_speech_cash, request.fare)
        else -> stringResource(R.string.collect_speech_upi)
    }

    Scaffold(
        topBar = {
            SpeakTopBar(
                title = stringResource(if (deliveryStep) R.string.delivery_title else R.string.collect_title),
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
                .imePadding()
                .padding(20.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(18.dp)
        ) {
            if (deliveryStep) {
                DeliveryProof(
                    vm = vm,
                    otp = deliveryOtp,
                    onOtpChange = { deliveryOtp = it },
                    onNext = { deliveryStep = false }
                )
            } else {
                CollectFare(fare = request.fare, isCash = isCash, commission = vm.currentCommission, onDone = onDone)
            }
        }
    }
}

@Composable
private fun DeliveryProof(
    vm: CaptainViewModel,
    otp: String,
    onOtpChange: (String) -> Unit,
    onNext: () -> Unit
) {
    Text(text = "📦", fontSize = 64.sp)
    val photo = vm.deliveryPhoto
    if (photo != null) {
        Text(
            text = "✅ " + stringResource(R.string.photo_taken),
            style = MaterialTheme.typography.titleLarge,
            color = Green
        )
    }
    PhotoButton(
        label = stringResource(R.string.delivery_photo),
        onPhoto = { vm.deliveryPhoto = it },
        color = ParcelOrange
    )
    Text(
        text = "🔐 " + stringResource(R.string.delivery_otp_label),
        style = MaterialTheme.typography.headlineMedium,
        textAlign = TextAlign.Center
    )
    OtpEntry(
        otp = otp,
        onOtpChange = onOtpChange,
        boxWidth = 76.dp,
        boxHeight = 100.dp,
        fontSize = 56.sp,
        autoFocus = false
    )
    Spacer(modifier = Modifier.height(4.dp))
    BigButton(
        text = stringResource(R.string.delivery_next),
        emoji = "✅",
        enabled = otp.length == OTP_LENGTH,
        containerColor = ParcelOrange,
        onClick = onNext
    )
}

@Composable
private fun CollectFare(fare: Int, isCash: Boolean, commission: Int, onDone: () -> Unit) {
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

    // Commission line on every trip, from the owner-configured rule (never a surprise at settlement).
    Text(
        text = "💸 " + stringResource(R.string.collect_commission_line, commission, fare - commission),
        style = MaterialTheme.typography.titleLarge,
        modifier = Modifier.fillMaxWidth(),
        textAlign = TextAlign.Center
    )

    Spacer(modifier = Modifier.height(8.dp))
    BigButton(
        text = stringResource(R.string.collected),
        emoji = "✅",
        onClick = onDone
    )
}
