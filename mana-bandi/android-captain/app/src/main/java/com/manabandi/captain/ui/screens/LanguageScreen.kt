package com.manabandi.captain.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.manabandi.captain.R
import com.manabandi.captain.ui.components.LocalSpeech
import com.manabandi.captain.ui.components.SpeakTopBar
import com.manabandi.captain.ui.theme.GreenLight
import com.manabandi.captain.ui.theme.TurmericLight
import java.util.Locale

data class LanguageOption(val tag: String, val nativeName: String, val greeting: String)

/** Greetings are hard-coded per language so they are spoken in the tapped language. */
val languageOptions = listOf(
    LanguageOption("te", "తెలుగు", "నమస్తే కెప్టెన్! మన బండికి స్వాగతం."),
    LanguageOption("en", "English", "Hello captain! Welcome to Mana Bandi."),
    LanguageOption("hi", "हिंदी", "नमस्ते कैप्टन! मन बंडी में आपका स्वागत है।"),
    LanguageOption("kn", "ಕನ್ನಡ", "ನಮಸ್ಕಾರ ಕ್ಯಾಪ್ಟನ್! ಮನ ಬಂಡಿಗೆ ಸ್ವಾಗತ."),
    LanguageOption("mr", "मराठी", "नमस्कार कॅप्टन! मन बंडी मध्ये स्वागत आहे."),
    LanguageOption("ur", "اردو", "السلام علیکم کیپٹن! منا بنڈی میں خوش آمدید۔")
)

@Composable
fun LanguageScreen(onLanguageChosen: (String) -> Unit) {
    val speech = LocalSpeech.current

    Scaffold(
        topBar = {
            SpeakTopBar(
                title = stringResource(R.string.lang_title),
                speechText = stringResource(R.string.lang_speech)
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
                text = "🌐",
                fontSize = 48.sp,
                modifier = Modifier.fillMaxWidth(),
                textAlign = TextAlign.Center
            )
            languageOptions.chunked(2).forEachIndexed { rowIndex, row ->
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    row.forEachIndexed { colIndex, option ->
                        val tinted = (rowIndex + colIndex) % 2 == 0
                        LanguageTile(
                            option = option,
                            highlighted = tinted,
                            modifier = Modifier.weight(1f),
                            onClick = {
                                speech?.speak(option.greeting, Locale.forLanguageTag(option.tag))
                                onLanguageChosen(option.tag)
                            }
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun LanguageTile(
    option: LanguageOption,
    highlighted: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Card(
        onClick = onClick,
        modifier = modifier.height(120.dp),
        shape = RoundedCornerShape(24.dp),
        colors = CardDefaults.cardColors(
            containerColor = if (highlighted) GreenLight else TurmericLight,
            contentColor = MaterialTheme.colorScheme.onSurface
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 3.dp)
    ) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Text(
                text = option.nativeName,
                fontSize = 32.sp,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center
            )
        }
    }
}
