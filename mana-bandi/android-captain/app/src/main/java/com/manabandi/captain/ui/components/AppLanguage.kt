package com.manabandi.captain.ui.components

import androidx.compose.runtime.Composable
import androidx.compose.ui.platform.LocalContext
import com.manabandi.captain.data.LocalePrefs

/** The language the app is showing right now ("te", "en", "hi", …). */
@Composable
fun appLanguage(): String = LocalePrefs.currentLocale(LocalContext.current).language
