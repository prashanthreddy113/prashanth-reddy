package com.manabandi.captain.ui.screens

import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.widget.Toast
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
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.manabandi.captain.R
import com.manabandi.captain.data.LocalePrefs
import com.manabandi.captain.ui.components.BigButton
import com.manabandi.captain.ui.components.SecondaryButton
import com.manabandi.captain.ui.components.SpeakTopBar

/**
 * Terms & conditions, shown once after login and again whenever
 * [LocalePrefs.TERMS_VERSION] changes. Six short rules with a picture each;
 * the 🔊 button reads all of them aloud; one big "I agree" button.
 * The full text lives at R.string.terms_url (owner portal → Settings → Terms).
 */
@Composable
fun TermsScreen(onAccept: () -> Unit) {
    val context = LocalContext.current
    val termsUrl = stringResource(R.string.terms_url)
    val rules = listOf(
        "🪪" to R.string.terms_1,
        "🔍" to R.string.terms_2,
        "💵" to R.string.terms_3,
        "🪖" to R.string.terms_4,
        "🔢" to R.string.terms_5,
        "📍" to R.string.terms_6
    )
    val ruleTexts = rules.map { stringResource(it.second) }
    val speech = stringResource(R.string.terms_speech) + " " + ruleTexts.joinToString(" ")

    Scaffold(
        topBar = {
            SpeakTopBar(
                title = stringResource(R.string.terms_title),
                speechText = speech
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .padding(padding)
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(
                text = "📜",
                fontSize = 56.sp,
                modifier = Modifier.fillMaxWidth(),
                textAlign = TextAlign.Center
            )
            Text(
                text = stringResource(R.string.terms_version_note, LocalePrefs.TERMS_VERSION),
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.fillMaxWidth(),
                textAlign = TextAlign.Center
            )
            rules.forEachIndexed { index, rule ->
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(20.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(text = rule.first, fontSize = 34.sp)
                        Spacer(modifier = Modifier.width(14.dp))
                        Text(text = ruleTexts[index], style = MaterialTheme.typography.bodyLarge)
                    }
                }
            }
            Spacer(modifier = Modifier.height(4.dp))
            SecondaryButton(
                text = stringResource(R.string.terms_full),
                emoji = "📄",
                onClick = {
                    try {
                        context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(termsUrl)))
                    } catch (e: ActivityNotFoundException) {
                        Toast.makeText(context, termsUrl, Toast.LENGTH_LONG).show()
                    }
                }
            )
            BigButton(
                text = stringResource(R.string.terms_accept),
                emoji = "✅",
                onClick = onAccept
            )
        }
    }
}
