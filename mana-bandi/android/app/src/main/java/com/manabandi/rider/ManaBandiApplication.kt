package com.manabandi.rider

import android.app.Application
import com.manabandi.rider.data.LocalePrefs
import com.manabandi.rider.speech.SpeechHelper
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking

class ManaBandiApplication : Application() {

    lateinit var prefs: LocalePrefs
        private set

    /** App-scoped so speech is not cut off when an Activity is recreated. */
    lateinit var speech: SpeechHelper
        private set

    override fun onCreate() {
        super.onCreate()
        prefs = LocalePrefs(this)
        speech = SpeechHelper(this)

        // Apply the saved language (Telugu by default) before any Activity exists.
        // runBlocking here is a tiny one-time read of a small preferences file.
        val tag = runBlocking { prefs.languageTag.first() }
        LocalePrefs.applyLocale(tag)
    }
}
