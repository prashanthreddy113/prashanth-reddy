package com.manabandi.captain.ui.screens

import android.widget.Toast
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.manabandi.captain.R
import com.manabandi.captain.ui.components.BigButton
import com.manabandi.captain.ui.components.OTP_LENGTH
import com.manabandi.captain.ui.components.OtpEntry
import com.manabandi.captain.ui.components.SecondaryButton
import com.manabandi.captain.ui.components.SpeakTopBar

/** Login OTP. Demo: any 4 digits are accepted. */
@Composable
fun OtpScreen(phone: String, onBack: () -> Unit, onVerified: () -> Unit) {
    var otp by rememberSaveable { mutableStateOf("") }
    val context = LocalContext.current
    val callStub = stringResource(R.string.otp_call_stub)

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

            OtpEntry(otp = otp, onOtpChange = { otp = it })

            Text(
                text = stringResource(R.string.otp_demo_hint),
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            Spacer(modifier = Modifier.height(4.dp))

            BigButton(
                text = stringResource(R.string.otp_verify),
                emoji = "✅",
                enabled = otp.length == OTP_LENGTH,
                onClick = onVerified
            )

            SecondaryButton(
                text = stringResource(R.string.otp_call),
                emoji = "📞",
                onClick = { Toast.makeText(context, callStub, Toast.LENGTH_SHORT).show() }
            )
        }
    }
}
