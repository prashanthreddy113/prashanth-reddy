package com.manabandi.captain

import android.graphics.Color
import android.os.Bundle
import androidx.activity.SystemBarStyle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.app.AppCompatDelegate
import androidx.compose.runtime.CompositionLocalProvider
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import com.manabandi.captain.data.LocalePrefs
import com.manabandi.captain.ui.components.LocalSpeech
import com.manabandi.captain.ui.theme.ManaBandiTheme
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking

/**
 * Single Activity. Extends AppCompatActivity so that
 * AppCompatDelegate.setApplicationLocales works on Android 12 and below.
 */
class MainActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        super.onCreate(savedInstanceState)
        enableEdgeToEdge(
            statusBarStyle = SystemBarStyle.dark(Color.TRANSPARENT),
            navigationBarStyle = SystemBarStyle.light(Color.TRANSPARENT, Color.TRANSPARENT)
        )

        val app = application as ManaBandiCaptainApplication

        // On Android 13+ AppCompatDelegate.setApplicationLocales needs an attached
        // Activity, so the call made in ManaBandiCaptainApplication is a no-op there.
        // Apply the saved language (Telugu by default) here when nothing is set yet.
        if (AppCompatDelegate.getApplicationLocales().isEmpty) {
            LocalePrefs.applyLocale(runBlocking { app.prefs.languageTag.first() })
        }

        val startDestination = runBlocking {
            when {
                !app.prefs.languageChosen.first() -> Routes.LANGUAGE
                !app.prefs.loggedIn.first() -> Routes.PHONE
                !app.prefs.kycDone.first() -> Routes.KYC
                else -> Routes.HOME
            }
        }

        setContent {
            ManaBandiTheme {
                CompositionLocalProvider(LocalSpeech provides app.speech) {
                    ManaBandiCaptainApp(startDestination = startDestination, prefs = app.prefs)
                }
            }
        }
    }
}
