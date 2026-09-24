package com.manabandi.captain.ui.screens

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
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.manabandi.captain.CaptainViewModel
import com.manabandi.captain.R
import com.manabandi.captain.data.KycDoc
import com.manabandi.captain.data.VehicleType
import com.manabandi.captain.data.api.KycState
import com.manabandi.captain.ui.components.BigButton
import com.manabandi.captain.ui.components.CallButton
import com.manabandi.captain.ui.components.PhotoButton
import com.manabandi.captain.ui.components.SpeakTopBar
import com.manabandi.captain.ui.theme.Green
import com.manabandi.captain.ui.theme.GreenLight
import com.manabandi.captain.ui.theme.SurfaceMuted

/**
 * "Register at the office": each document photo is uploaded as soon as it is taken
 * (POST /api/captain/documents/{kind}, JPEG ≤ 1600 px), the server's status is shown per row
 * (⬜ missing, ⏳ with the office, ✅ checked), and the vehicle is saved with
 * PUT /api/captain/vehicle when the captain taps Done.
 */
@Composable
fun KycScreen(vm: CaptainViewModel, onDone: () -> Unit) {
    val supportNumber = stringResource(R.string.support_number)
    LaunchedEffect(Unit) { vm.refreshMe() }
    val showOwnerConsent = vm.kycState(KycDoc.OWNER_CONSENT) != KycState.NOT_NEEDED

    Scaffold(
        topBar = {
            SpeakTopBar(
                title = stringResource(R.string.kyc_title),
                speechText = stringResource(R.string.kyc_speech)
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
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            val me = vm.me
            if (me != null) CaptainStatusCard(status = me.status, reason = me.rejectReason ?: me.blockReason)

            Text(
                text = "📋 " + stringResource(R.string.kyc_intro),
                style = MaterialTheme.typography.headlineMedium
            )

            KycDoc.entries
                .filter { it != KycDoc.OWNER_CONSENT || showOwnerConsent }
                .forEach { doc -> KycRow(vm = vm, doc = doc) }

            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = stringResource(R.string.kyc_vehicle_type),
                style = MaterialTheme.typography.titleLarge
            )
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                VehicleType.entries.forEach { type ->
                    VehicleTile(
                        type = type,
                        selected = vm.vehicleType == type,
                        onClick = { vm.vehicleType = type },
                        modifier = Modifier.weight(1f)
                    )
                }
            }

            Text(
                text = "🔢 " + stringResource(R.string.kyc_vehicle_number),
                style = MaterialTheme.typography.titleLarge
            )
            BigTextField(
                value = vm.vehicleNumber,
                onValueChange = { input -> vm.vehicleNumber = input.uppercase().take(20) },
                placeholder = stringResource(R.string.kyc_vehicle_hint),
                capitalization = KeyboardCapitalization.Characters,
                fontSize = 32
            )
            Text(
                text = "🏍️ " + stringResource(R.string.kyc_vehicle_model),
                style = MaterialTheme.typography.titleLarge
            )
            BigTextField(
                value = vm.vehicleModel,
                onValueChange = { input -> vm.vehicleModel = input.take(40) },
                placeholder = stringResource(R.string.kyc_vehicle_model_hint),
                capitalization = KeyboardCapitalization.Words,
                fontSize = 24
            )

            val error = vm.kycError
            if (error != null) {
                Text(
                    text = stringResource(error),
                    style = MaterialTheme.typography.titleMedium,
                    color = MaterialTheme.colorScheme.error
                )
            }

            Spacer(modifier = Modifier.height(8.dp))
            CallButton(
                label = stringResource(R.string.call_office),
                phoneNumber = supportNumber,
                containerColor = MaterialTheme.colorScheme.secondary,
                contentColor = MaterialTheme.colorScheme.onSecondary
            )
            BigButton(
                text = stringResource(if (vm.vehicleBusy) R.string.please_wait else R.string.kyc_done),
                emoji = if (vm.vehicleBusy) "⏳" else "✅",
                enabled = vm.vehicleNumber.trim().length >= 6 && !vm.vehicleBusy,
                onClick = { vm.saveVehicle(onDone) }
            )
            Spacer(modifier = Modifier.height(8.dp))
        }
    }
}

/** pending → "the office is checking" + call; rejected → reason; blocked → reason + call. */
@Composable
fun CaptainStatusCard(status: String, reason: String?) {
    val (emoji, textRes) = when (status) {
        "verified" -> "✅" to R.string.status_verified
        "rejected" -> "❌" to R.string.status_rejected
        "blocked" -> "🚫" to R.string.status_blocked
        else -> "⏳" to R.string.status_pending
    }
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(
            containerColor = if (status == "verified") GreenLight else MaterialTheme.colorScheme.secondaryContainer
        )
    ) {
        Row(
            modifier = Modifier.padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(text = emoji, fontSize = 40.sp)
            Spacer(modifier = Modifier.width(12.dp))
            Column {
                Text(text = stringResource(textRes), style = MaterialTheme.typography.titleLarge)
                if (!reason.isNullOrBlank() && (status == "rejected" || status == "blocked")) {
                    Text(
                        text = stringResource(R.string.status_reason, reason),
                        style = MaterialTheme.typography.bodyLarge
                    )
                }
            }
        }
    }
}

@Composable
private fun KycRow(vm: CaptainViewModel, doc: KycDoc) {
    val serverState = vm.kycState(doc)
    val uploading = vm.kycUploading[doc] == true
    val failed = vm.kycFailed[doc] == true
    val done = serverState == KycState.UPLOADED || serverState == KycState.VERIFIED
    val badge = when {
        uploading -> "⏫"
        failed -> "❌"
        serverState == KycState.VERIFIED -> "✅"
        serverState == KycState.UPLOADED -> "⏳"
        else -> "⬜"
    }
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = if (done) GreenLight else SurfaceMuted),
        border = if (done) BorderStroke(2.dp, Green) else null
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(text = doc.emoji, fontSize = 40.sp)
                Spacer(modifier = Modifier.width(16.dp))
                Text(
                    text = stringResource(doc.labelRes),
                    style = MaterialTheme.typography.titleLarge,
                    modifier = Modifier.weight(1f)
                )
                if (uploading) {
                    CircularProgressIndicator(modifier = Modifier.size(32.dp), strokeWidth = 3.dp)
                } else {
                    Text(text = badge, fontSize = 32.sp)
                }
            }
            val stateText = when {
                uploading -> R.string.kyc_sending
                failed -> R.string.kyc_failed
                serverState == KycState.VERIFIED -> R.string.kyc_verified
                serverState == KycState.UPLOADED -> R.string.kyc_uploaded
                else -> null
            }
            if (stateText != null) {
                Text(
                    text = stringResource(stateText),
                    style = MaterialTheme.typography.bodyLarge,
                    color = if (failed) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            if (doc == KycDoc.BANK) {
                BigTextField(
                    value = vm.bankUpi,
                    onValueChange = { vm.bankUpi = it.trim().take(60) },
                    placeholder = stringResource(R.string.kyc_bank_upi),
                    capitalization = KeyboardCapitalization.None,
                    fontSize = 22
                )
                BigTextField(
                    value = vm.bankIfsc,
                    onValueChange = { vm.bankIfsc = it.uppercase().take(11) },
                    placeholder = stringResource(R.string.kyc_bank_ifsc),
                    capitalization = KeyboardCapitalization.Characters,
                    fontSize = 22
                )
                BigTextField(
                    value = vm.bankLast4,
                    onValueChange = { input -> if (input.length <= 4 && input.all { it.isDigit() }) vm.bankLast4 = input },
                    placeholder = stringResource(R.string.kyc_bank_last4),
                    capitalization = KeyboardCapitalization.None,
                    fontSize = 22,
                    keyboardType = KeyboardType.Number
                )
            }
            PhotoButton(
                label = stringResource(if (done || vm.kycPhotos.containsKey(doc)) R.string.kyc_retake else R.string.take_photo),
                onPhoto = { bitmap -> vm.uploadDocument(doc, bitmap) },
                color = if (done) Green else MaterialTheme.colorScheme.primary
            )
        }
    }
}

@Composable
private fun BigTextField(
    value: String,
    onValueChange: (String) -> Unit,
    placeholder: String,
    capitalization: KeyboardCapitalization,
    fontSize: Int,
    keyboardType: KeyboardType = KeyboardType.Text
) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = 72.dp),
        textStyle = TextStyle(
            fontSize = fontSize.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 2.sp
        ),
        placeholder = { Text(text = placeholder, fontSize = 20.sp) },
        singleLine = true,
        shape = RoundedCornerShape(20.dp),
        keyboardOptions = KeyboardOptions(
            capitalization = capitalization,
            keyboardType = keyboardType,
            imeAction = ImeAction.Done
        ),
        colors = OutlinedTextFieldDefaults.colors(
            focusedBorderColor = MaterialTheme.colorScheme.primary,
            unfocusedBorderColor = MaterialTheme.colorScheme.outline
        )
    )
}

@Composable
private fun VehicleTile(
    type: VehicleType,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val colors = MaterialTheme.colorScheme
    Card(
        onClick = onClick,
        modifier = modifier.height(110.dp),
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(
            containerColor = if (selected) colors.primaryContainer else colors.surfaceVariant
        ),
        border = BorderStroke(3.dp, if (selected) colors.primary else colors.outline)
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(8.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Text(text = type.emoji, fontSize = 44.sp)
            Text(
                text = stringResource(type.labelRes),
                style = MaterialTheme.typography.titleLarge
            )
        }
    }
}
