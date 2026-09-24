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
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.manabandi.rider.R
import com.manabandi.rider.ui.components.BigButton
import com.manabandi.rider.ui.components.SecondaryButton
import com.manabandi.rider.ui.components.SpeakTopBar

private const val OTP_LENGTH = 4

/**
 * Login code. [devCode] is shown as a small grey hint only when the server runs in OTP dev
 * mode (testing); production never sends it.
 */
@Composable
fun OtpScreen(
    phone: String,
    devCode: String?,
    busy: Boolean,
    error: Int?,
    onBack: () -> Unit,
    onVerify: (String) -> Unit,
    onCallMe: () -> Unit
) {
    var otp by rememberSaveable { mutableStateOf("") }
    val focusRequester = remember { FocusRequester() }
    val context = LocalContext.current
    val callStub = stringResource(R.string.otp_call_stub)

    LaunchedEffect(Unit) {
        try {
            focusRequester.requestFocus()
        } catch (e: Exception) {
            // focus is a convenience only
        }
    }

    Scaffold(
        topBar = {
            SpeakTopBar(
                title = stringResource(R.string.otp_title),
                speechText = stringResource(R.string.otp_speech),
                onBack = onBack
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
            Text(text = "🔐", fontSize = 64.sp)
            Text(
                text = stringResource(R.string.otp_sub, "+91 $phone"),
                style = MaterialTheme.typography.bodyLarge,
                textAlign = TextAlign.Center
            )

            // Four visible boxes, one invisible text field on top that receives the digits.
            Box(modifier = Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    repeat(OTP_LENGTH) { index ->
                        OtpBox(
                            digit = otp.getOrNull(index)?.toString() ?: "",
                            active = index == otp.length
                        )
                    }
                }
                BasicTextField(
                    value = otp,
                    onValueChange = { input ->
                        if (input.length <= OTP_LENGTH && input.all { it.isDigit() }) otp = input
                    },
                    modifier = Modifier
                        .matchParentSize()
                        .alpha(0f)
                        .focusRequester(focusRequester),
                    textStyle = TextStyle(color = Color.Transparent),
                    cursorBrush = SolidColor(Color.Transparent),
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(
                        keyboardType = KeyboardType.NumberPassword,
                        imeAction = ImeAction.Done
                    )
                )
            }

            if (!devCode.isNullOrBlank()) {
                Text(
                    text = stringResource(R.string.otp_dev_hint, devCode),
                    fontSize = 14.sp,
                    color = Color.Gray
                )
            }

            if (error != null) {
                Text(
                    text = stringResource(error),
                    style = MaterialTheme.typography.titleMedium,
                    color = MaterialTheme.colorScheme.error,
                    textAlign = TextAlign.Center
                )
            }

            Spacer(modifier = Modifier.height(4.dp))

            BigButton(
                text = stringResource(if (busy) R.string.please_wait else R.string.otp_verify),
                emoji = if (busy) "⏳" else "✅",
                enabled = otp.length == OTP_LENGTH && !busy,
                onClick = { onVerify(otp) }
            )

            SecondaryButton(
                text = stringResource(R.string.otp_call),
                emoji = "📞",
                enabled = !busy,
                onClick = {
                    Toast.makeText(context, callStub, Toast.LENGTH_SHORT).show()
                    onCallMe()
                }
            )
        }
    }
}

@Composable
private fun OtpBox(digit: String, active: Boolean) {
    val colors = MaterialTheme.colorScheme
    Box(
        modifier = Modifier
            .size(width = 68.dp, height = 84.dp)
            .background(colors.surfaceVariant, RoundedCornerShape(16.dp))
            .border(
                width = 3.dp,
                color = if (active) colors.primary else colors.outline,
                shape = RoundedCornerShape(16.dp)
            ),
        contentAlignment = Alignment.Center
    ) {
        Text(text = digit, fontSize = 40.sp, fontWeight = FontWeight.Bold)
    }
}
