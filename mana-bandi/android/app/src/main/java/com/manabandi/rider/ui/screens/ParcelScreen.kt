package com.manabandi.rider.ui.screens

import android.Manifest
import android.content.ActivityNotFoundException
import android.content.pm.PackageManager
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import com.manabandi.rider.LocateState
import com.manabandi.rider.R
import com.manabandi.rider.RideViewModel
import com.manabandi.rider.data.ParcelSize
import com.manabandi.rider.data.Payer
import com.manabandi.rider.data.Service
import com.manabandi.rider.ui.components.BigButton
import com.manabandi.rider.ui.components.LocationPermissionGate
import com.manabandi.rider.ui.components.SecondaryButton
import com.manabandi.rider.ui.components.SpeakTopBar
import com.manabandi.rider.ui.theme.Green
import com.manabandi.rider.ui.theme.ParcelOrange
import com.manabandi.rider.ui.theme.ParcelOrangeLight
import com.manabandi.rider.ui.theme.SurfaceMuted
import com.manabandi.rider.ui.theme.TextGrey

private const val STEP_WHERE = 1
private const val STEP_WHAT = 2
private const val STEP_PAY = 3

/**
 * Three-step parcel wizard: (1) GPS pickup, receiver and drop, (2) size + 📷 photo,
 * (3) who pays + server fare + confirm (POST /api/rides with the parcel fields; the photo is
 * uploaded to /api/rides/{id}/parcel-photo right after).
 */
@Composable
fun ParcelScreen(vm: RideViewModel, onBack: () -> Unit, onConfirm: () -> Unit, onTermsRequired: () -> Unit) {
    var step by rememberSaveable { mutableIntStateOf(STEP_WHERE) }

    val speech = stringResource(
        when (step) {
            STEP_WHERE -> R.string.parcel_speech1
            STEP_WHAT -> R.string.parcel_speech2
            else -> R.string.parcel_speech3
        }
    )

    Scaffold(
        topBar = {
            SpeakTopBar(
                title = stringResource(R.string.parcel_title),
                speechText = speech,
                onBack = { if (step > STEP_WHERE) step-- else onBack() },
                containerColor = ParcelOrange
            )
        }
    ) { padding ->
        Box(modifier = Modifier.padding(padding)) {
            LocationPermissionGate(
                rationale = stringResource(R.string.perm_location_rider),
                includeNotifications = false,
                onCancel = onBack
            ) {
                LaunchedEffect(Unit) {
                    if (vm.pickup == null && vm.locateState != LocateState.LOCATING) vm.locate()
                }
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .verticalScroll(rememberScrollState())
                        .imePadding()
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    StepRow(current = step)

                    when (step) {
                        STEP_WHERE -> StepWhere(vm = vm, onNext = { step = STEP_WHAT })
                        STEP_WHAT -> StepWhat(vm = vm, onNext = { step = STEP_PAY })
                        else -> StepPay(vm = vm, onConfirm = onConfirm, onTermsRequired = onTermsRequired)
                    }
                }
            }
        }
    }
}

@Composable
private fun StepRow(current: Int) {
    val steps = listOf(
        Triple(STEP_WHERE, "📍", stringResource(R.string.parcel_step1)),
        Triple(STEP_WHAT, "📦", stringResource(R.string.parcel_step2)),
        Triple(STEP_PAY, "💰", stringResource(R.string.parcel_step3))
    )
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceEvenly
    ) {
        steps.forEach { (index, emoji, label) ->
            val done = index < current
            val active = index == current
            val bg = when {
                active -> ParcelOrange
                done -> Green
                else -> SurfaceMuted
            }
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Box(
                    modifier = Modifier
                        .size(64.dp)
                        .background(bg, CircleShape),
                    contentAlignment = Alignment.Center
                ) {
                    Text(text = if (done) "✅" else emoji, fontSize = 30.sp)
                }
                Text(
                    text = label,
                    style = MaterialTheme.typography.labelMedium,
                    color = if (active) ParcelOrange else TextGrey
                )
            }
        }
    }
}

@Composable
private fun StepWhere(vm: RideViewModel, onNext: () -> Unit) {
    PickupSection(vm = vm, tint = ParcelOrangeLight)
    if (vm.locateState != LocateState.READY) return

    Text(
        text = "🧑 " + stringResource(R.string.parcel_receiver_name),
        style = MaterialTheme.typography.titleLarge
    )
    OutlinedTextField(
        value = vm.receiverName,
        onValueChange = { input -> vm.receiverName = input.take(40) },
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = 72.dp),
        textStyle = TextStyle(fontSize = 24.sp, fontWeight = FontWeight.SemiBold),
        placeholder = { Text(text = stringResource(R.string.parcel_receiver_name_hint), fontSize = 20.sp) },
        singleLine = true,
        shape = RoundedCornerShape(20.dp),
        keyboardOptions = KeyboardOptions(imeAction = ImeAction.Next),
        colors = OutlinedTextFieldDefaults.colors(
            focusedBorderColor = ParcelOrange,
            unfocusedBorderColor = MaterialTheme.colorScheme.outline
        )
    )

    Text(
        text = "📞 " + stringResource(R.string.parcel_receiver_phone),
        style = MaterialTheme.typography.titleLarge
    )
    OutlinedTextField(
        value = vm.receiverPhone,
        onValueChange = { input ->
            if (input.length <= 10 && input.all { it.isDigit() }) vm.receiverPhone = input
        },
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = 72.dp),
        textStyle = TextStyle(fontSize = 28.sp, fontWeight = FontWeight.Bold, letterSpacing = 2.sp),
        prefix = { Text(text = "+91 ", fontSize = 28.sp, fontWeight = FontWeight.Bold) },
        placeholder = { Text(text = stringResource(R.string.phone_hint), fontSize = 20.sp) },
        singleLine = true,
        shape = RoundedCornerShape(20.dp),
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone, imeAction = ImeAction.Next),
        colors = OutlinedTextFieldDefaults.colors(
            focusedBorderColor = ParcelOrange,
            unfocusedBorderColor = MaterialTheme.colorScheme.outline
        )
    )

    Text(
        text = "📍 " + stringResource(R.string.parcel_drop),
        style = MaterialTheme.typography.titleLarge
    )
    BookingMap(vm = vm)
    DropSection(vm = vm)

    Spacer(modifier = Modifier.height(4.dp))
    BigButton(
        text = stringResource(R.string.next),
        emoji = "➡️",
        containerColor = ParcelOrange,
        enabled = vm.receiverPhone.length == 10 && vm.drop != null,
        onClick = onNext
    )
}

@Composable
private fun StepWhat(vm: RideViewModel, onNext: () -> Unit) {
    val context = LocalContext.current
    val cameraUnavailable = stringResource(R.string.camera_unavailable)

    val photoLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.TakePicturePreview()
    ) { bitmap ->
        if (bitmap != null) vm.parcelPhoto = bitmap
    }
    val launchCamera: () -> Unit = {
        try {
            photoLauncher.launch(null)
        } catch (e: ActivityNotFoundException) {
            Toast.makeText(context, cameraUnavailable, Toast.LENGTH_LONG).show()
        }
    }
    // CAMERA is declared in the manifest, so it must be granted before ACTION_IMAGE_CAPTURE.
    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (granted) launchCamera() else Toast.makeText(context, cameraUnavailable, Toast.LENGTH_LONG).show()
    }

    ParcelSize.entries.forEach { size ->
        SelectTile(
            emoji = size.emoji,
            label = stringResource(size.labelRes),
            selected = vm.parcelSize == size,
            onClick = { vm.selectParcelSize(size) }
        )
    }

    val photo = vm.parcelPhoto
    if (photo != null) {
        Image(
            bitmap = photo.asImageBitmap(),
            contentDescription = stringResource(R.string.photo_taken),
            modifier = Modifier
                .fillMaxWidth()
                .height(220.dp)
                .clip(RoundedCornerShape(20.dp)),
            contentScale = ContentScale.Crop
        )
        Text(
            text = "✅ " + stringResource(R.string.photo_taken),
            style = MaterialTheme.typography.bodyLarge,
            color = Green
        )
    }

    SecondaryButton(
        text = stringResource(R.string.take_photo),
        emoji = "📷",
        color = ParcelOrange,
        onClick = {
            val granted = ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) ==
                PackageManager.PERMISSION_GRANTED
            if (granted) launchCamera() else permissionLauncher.launch(Manifest.permission.CAMERA)
        }
    )

    Spacer(modifier = Modifier.height(4.dp))
    BigButton(
        text = stringResource(R.string.next),
        emoji = "➡️",
        containerColor = ParcelOrange,
        onClick = onNext
    )
}

@Composable
private fun StepPay(vm: RideViewModel, onConfirm: () -> Unit, onTermsRequired: () -> Unit) {
    Text(
        text = stringResource(R.string.parcel_step3),
        style = MaterialTheme.typography.headlineMedium
    )
    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        SelectTile(
            emoji = "🙋",
            label = stringResource(R.string.pay_me),
            selected = vm.parcelPayer == Payer.ME,
            onClick = { vm.parcelPayer = Payer.ME },
            modifier = Modifier.weight(1f)
        )
        SelectTile(
            emoji = "🧑",
            label = stringResource(R.string.pay_receiver),
            selected = vm.parcelPayer == Payer.RECEIVER,
            onClick = { vm.parcelPayer = Payer.RECEIVER },
            modifier = Modifier.weight(1f)
        )
    }

    FareCard(quote = vm.quote, busy = vm.quoteBusy, serviceEmoji = Service.PARCEL.emoji)
    ErrorText(vm.quoteError)

    if (vm.parcelPayer == Payer.ME) {
        Text(text = stringResource(R.string.pay_title), style = MaterialTheme.typography.titleLarge)
        PaymentSelector(selected = vm.payment, onSelect = { vm.payment = it })
    }

    ErrorText(vm.bookError)
    Spacer(modifier = Modifier.height(4.dp))
    BigButton(
        text = stringResource(if (vm.bookBusy) R.string.please_wait else R.string.confirm),
        emoji = if (vm.bookBusy) "⏳" else "📦",
        containerColor = ParcelOrange,
        contentColor = Color.White,
        enabled = vm.quote != null && !vm.bookBusy,
        onClick = { vm.book(onBooked = onConfirm, onTermsRequired = onTermsRequired) }
    )
}
