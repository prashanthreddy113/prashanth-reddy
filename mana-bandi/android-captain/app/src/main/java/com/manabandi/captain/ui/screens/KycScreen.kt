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
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
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
import com.manabandi.captain.ui.components.BigButton
import com.manabandi.captain.ui.components.CallButton
import com.manabandi.captain.ui.components.PhotoButton
import com.manabandi.captain.ui.components.SpeakTopBar
import com.manabandi.captain.ui.theme.Green
import com.manabandi.captain.ui.theme.GreenLight
import com.manabandi.captain.ui.theme.SurfaceMuted

/**
 * "Register at the office": photo checklist (Aadhaar, licence, RC, photo, bank/UPI),
 * vehicle type and number. Demo: photos stay in memory, Done only sets a flag.
 */
@Composable
fun KycScreen(vm: CaptainViewModel, onDone: () -> Unit) {
    val supportNumber = stringResource(R.string.support_number)

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
            Text(
                text = "📋 " + stringResource(R.string.kyc_intro),
                style = MaterialTheme.typography.headlineMedium
            )

            KycDoc.entries.forEach { doc ->
                KycRow(
                    doc = doc,
                    done = vm.kycPhotos.containsKey(doc),
                    onPhoto = { bitmap -> vm.kycPhotos[doc] = bitmap }
                )
            }

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
            OutlinedTextField(
                value = vm.vehicleNumber,
                onValueChange = { input -> vm.vehicleNumber = input.uppercase().take(13) },
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(min = 84.dp),
                textStyle = TextStyle(
                    fontSize = 32.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 3.sp
                ),
                placeholder = { Text(text = stringResource(R.string.kyc_vehicle_hint), fontSize = 26.sp) },
                singleLine = true,
                shape = RoundedCornerShape(20.dp),
                keyboardOptions = KeyboardOptions(
                    capitalization = KeyboardCapitalization.Characters,
                    keyboardType = KeyboardType.Text,
                    imeAction = ImeAction.Done
                ),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = MaterialTheme.colorScheme.primary,
                    unfocusedBorderColor = MaterialTheme.colorScheme.outline
                )
            )

            Spacer(modifier = Modifier.height(8.dp))
            CallButton(
                label = stringResource(R.string.call_office),
                phoneNumber = supportNumber,
                containerColor = MaterialTheme.colorScheme.secondary,
                contentColor = MaterialTheme.colorScheme.onSecondary
            )
            BigButton(
                text = stringResource(R.string.kyc_done),
                emoji = "✅",
                enabled = vm.vehicleNumber.trim().length >= 4,
                onClick = onDone
            )
            Spacer(modifier = Modifier.height(8.dp))
        }
    }
}

@Composable
private fun KycRow(doc: KycDoc, done: Boolean, onPhoto: (android.graphics.Bitmap) -> Unit) {
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
                Text(text = if (done) "✅" else "⬜", fontSize = 32.sp)
            }
            PhotoButton(
                label = stringResource(if (done) R.string.photo_taken else R.string.take_photo),
                onPhoto = onPhoto,
                color = if (done) Green else MaterialTheme.colorScheme.primary
            )
        }
    }
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
