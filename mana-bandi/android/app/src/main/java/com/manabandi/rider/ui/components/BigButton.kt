package com.manabandi.rider.ui.components

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.Toast
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.manabandi.rider.ui.theme.TextDark

/** Primary action: 72dp tall, emoji + short label. One per screen. */
@Composable
fun BigButton(
    text: String,
    emoji: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    containerColor: Color = MaterialTheme.colorScheme.primary,
    contentColor: Color = Color.White
) {
    Button(
        onClick = onClick,
        enabled = enabled,
        modifier = modifier
            .fillMaxWidth()
            .heightIn(min = 72.dp),
        shape = RoundedCornerShape(20.dp),
        colors = ButtonDefaults.buttonColors(
            containerColor = containerColor,
            contentColor = contentColor,
            disabledContainerColor = containerColor.copy(alpha = 0.35f),
            disabledContentColor = contentColor.copy(alpha = 0.7f)
        ),
        contentPadding = PaddingValues(horizontal = 20.dp, vertical = 12.dp)
    ) {
        Text(text = emoji, fontSize = 30.sp)
        Spacer(modifier = Modifier.width(16.dp))
        Text(
            text = text,
            style = MaterialTheme.typography.labelLarge,
            fontSize = 24.sp,
            textAlign = TextAlign.Center
        )
    }
}

/** Secondary action: 64dp tall, outlined. */
@Composable
fun SecondaryButton(
    text: String,
    emoji: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    color: Color = MaterialTheme.colorScheme.primary
) {
    OutlinedButton(
        onClick = onClick,
        enabled = enabled,
        modifier = modifier
            .fillMaxWidth()
            .heightIn(min = 64.dp),
        shape = RoundedCornerShape(20.dp),
        border = BorderStroke(3.dp, color),
        colors = ButtonDefaults.outlinedButtonColors(contentColor = TextDark),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 10.dp)
    ) {
        Text(text = emoji, fontSize = 26.sp)
        Spacer(modifier = Modifier.width(12.dp))
        Text(text = text, style = MaterialTheme.typography.labelLarge, textAlign = TextAlign.Center)
    }
}

/** Big green 📞 button that opens the dialer (ACTION_DIAL needs no permission). */
@Composable
fun CallButton(
    label: String,
    phoneNumber: String,
    modifier: Modifier = Modifier,
    containerColor: Color = MaterialTheme.colorScheme.primary
) {
    val context = LocalContext.current
    BigButton(
        text = label,
        emoji = "📞",
        onClick = { dialNumber(context, phoneNumber) },
        modifier = modifier,
        containerColor = containerColor
    )
}

fun dialNumber(context: Context, phoneNumber: String) {
    try {
        val intent = Intent(Intent.ACTION_DIAL, Uri.parse("tel:$phoneNumber"))
        context.startActivity(intent)
    } catch (e: ActivityNotFoundException) {
        Toast.makeText(context, phoneNumber, Toast.LENGTH_LONG).show()
    }
}

fun openWhatsApp(context: Context, phoneDigits: String, message: String) {
    try {
        val url = "https://wa.me/$phoneDigits?text=" + Uri.encode(message)
        context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
    } catch (e: ActivityNotFoundException) {
        Toast.makeText(context, "+$phoneDigits", Toast.LENGTH_LONG).show()
    }
}

/** Share plain text (trip details) through the system share sheet — WhatsApp, SMS, anything. */
fun shareTripText(context: Context, text: String, chooserTitle: String) {
    try {
        val send = Intent(Intent.ACTION_SEND).apply {
            type = "text/plain"
            putExtra(Intent.EXTRA_TEXT, text)
        }
        context.startActivity(Intent.createChooser(send, chooserTitle))
    } catch (e: ActivityNotFoundException) {
        Toast.makeText(context, text, Toast.LENGTH_LONG).show()
    }
}
