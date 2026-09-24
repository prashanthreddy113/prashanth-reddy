package com.manabandi.captain.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.manabandi.captain.R
import com.manabandi.captain.ui.components.BigButton
import com.manabandi.captain.ui.components.BottomTab
import com.manabandi.captain.ui.components.CallButton
import com.manabandi.captain.ui.components.ManaBandiBottomBar
import com.manabandi.captain.ui.components.SecondaryButton
import com.manabandi.captain.ui.components.SpeakTopBar
import com.manabandi.captain.ui.components.openWhatsApp
import com.manabandi.captain.ui.theme.TextDark
import com.manabandi.captain.ui.theme.Turmeric
import com.manabandi.captain.ui.theme.WhatsAppGreen

@Composable
fun HelpScreen(
    onHome: () -> Unit,
    onEarnings: () -> Unit,
    onChangeLanguage: () -> Unit,
    onLogout: () -> Unit
) {
    val context = LocalContext.current
    val supportNumber = stringResource(R.string.support_number)
    val supportDisplay = stringResource(R.string.support_number_display)
    val whatsappNumber = stringResource(R.string.whatsapp_number)
    val whatsappMsg = stringResource(R.string.whatsapp_msg)

    Scaffold(
        topBar = {
            SpeakTopBar(
                title = stringResource(R.string.help_title),
                speechText = stringResource(R.string.help_speech)
            )
        },
        bottomBar = {
            ManaBandiBottomBar(
                current = BottomTab.HELP,
                onHome = onHome,
                onEarnings = onEarnings,
                onHelp = {}
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .padding(padding)
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            CallButton(
                label = stringResource(R.string.call_office) + "\n" + supportDisplay,
                phoneNumber = supportNumber
            )
            BigButton(
                text = stringResource(R.string.help_whatsapp),
                emoji = "💬",
                containerColor = WhatsAppGreen,
                contentColor = TextDark,
                onClick = { openWhatsApp(context, whatsappNumber, whatsappMsg) }
            )
            SecondaryButton(
                text = stringResource(R.string.help_language),
                emoji = "🌐",
                color = Turmeric,
                onClick = onChangeLanguage
            )

            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = stringResource(R.string.help_how),
                style = MaterialTheme.typography.headlineMedium
            )
            HowRow(number = "1️⃣", pictos = "🟢 📳", text = stringResource(R.string.how1))
            HowRow(number = "2️⃣", pictos = "✅ 🔢", text = stringResource(R.string.how2))
            HowRow(number = "3️⃣", pictos = "🏁 💵", text = stringResource(R.string.how3))

            // Phones that kill background apps: let the captain fix it any time.
            Spacer(modifier = Modifier.height(8.dp))
            BatteryCard(alwaysShow = true)

            Spacer(modifier = Modifier.height(8.dp))
            SecondaryButton(
                text = stringResource(R.string.logout),
                emoji = "🚪",
                color = MaterialTheme.colorScheme.error,
                onClick = onLogout
            )
        }
    }
}

@Composable
private fun HowRow(number: String, pictos: String, text: String) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(text = number, fontSize = 32.sp)
            Spacer(modifier = Modifier.width(12.dp))
            Column {
                Text(text = pictos, fontSize = 34.sp)
                Text(text = text, style = MaterialTheme.typography.bodyLarge)
            }
        }
    }
}
