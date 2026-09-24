package com.manabandi.captain

import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.view.WindowManager
import androidx.activity.SystemBarStyle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.app.AppCompatDelegate
import androidx.compose.runtime.CompositionLocalProvider
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.lifecycle.lifecycleScope
import com.manabandi.captain.data.LocalePrefs
import com.manabandi.captain.location.TrackingRepository
import com.manabandi.captain.ui.components.LocalSpeech
import com.manabandi.captain.ui.theme.ManaBandiTheme
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking

/**
 * Single Activity. Extends AppCompatActivity so that
 * AppCompatDelegate.setApplicationLocales works on Android 12 and below.
 *
 * It tells [TrackingRepository] whether the app is visible (offers only get a notification
 * when it is not) and, while a ride offer is waiting, lets the screen turn on and show over
 * the lock screen (the offer notification's full-screen intent opens this Activity).
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
                !app.session.isLoggedIn -> Routes.PHONE
                !app.prefs.termsAccepted.first() -> Routes.TERMS
                !app.prefs.kycDone.first() -> Routes.KYC
                else -> Routes.HOME
            }
        }

        // Show over the lock screen only while an offer is waiting.
        lifecycleScope.launch {
            TrackingRepository.state
                .map { it.offer != null }
                .distinctUntilChanged()
                .collect { waiting -> showOverLockScreen(waiting) }
        }

        setContent {
            ManaBandiTheme {
                CompositionLocalProvider(LocalSpeech provides app.speech) {
                    ManaBandiCaptainApp(startDestination = startDestination, prefs = app.prefs, session = app.session)
                }
            }
        }
    }

    override fun onStart() {
        super.onStart()
        TrackingRepository.setAppVisible(true)
    }

    override fun onStop() {
        TrackingRepository.setAppVisible(false)
        super.onStop()
    }

    private fun showOverLockScreen(show: Boolean) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(show)
            setTurnScreenOn(show)
        } else {
            @Suppress("DEPRECATION")
            val flags = WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
            if (show) window.addFlags(flags) else window.clearFlags(flags)
        }
    }
}
