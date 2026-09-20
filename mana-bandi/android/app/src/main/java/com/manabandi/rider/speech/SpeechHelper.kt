package com.manabandi.rider.speech

import android.content.Context
import android.speech.tts.TextToSpeech
import java.util.Locale

/**
 * Thin wrapper around Android TextToSpeech.
 *
 * - Initialisation is asynchronous, so the first request is queued until the engine is ready.
 * - If the requested language has no voice data we try the bare language ("te-IN" -> "te");
 *   if that is unsupported too we stay silent. Reading Telugu with an English voice would only
 *   confuse the user. Never throws.
 */
class SpeechHelper(context: Context) : TextToSpeech.OnInitListener {

    private var tts: TextToSpeech? = null
    private var ready = false
    private var failed = false
    private var pending: Pair<String, Locale>? = null
    private var appliedLocale: Locale? = null
    private var appliedLocaleSupported = false

    init {
        try {
            tts = TextToSpeech(context.applicationContext, this)
        } catch (e: Exception) {
            failed = true
        }
    }

    override fun onInit(status: Int) {
        if (status == TextToSpeech.SUCCESS) {
            ready = true
            val queued = pending
            pending = null
            if (queued != null) speak(queued.first, queued.second)
        } else {
            failed = true
        }
    }

    /** Speaks [text] in [locale]; silently does nothing if the engine or language is unavailable. */
    fun speak(text: String, locale: Locale) {
        if (failed || text.isBlank()) return
        val engine = tts
        if (!ready || engine == null) {
            pending = text to locale
            return
        }
        if (!applyLocale(engine, locale)) return
        try {
            engine.speak(text, TextToSpeech.QUEUE_FLUSH, null, "mb-" + System.currentTimeMillis())
        } catch (e: Exception) {
            // silent fallback
        }
    }

    fun stop() {
        try {
            tts?.stop()
        } catch (e: Exception) {
            // ignore
        }
    }

    fun shutdown() {
        try {
            tts?.shutdown()
        } catch (e: Exception) {
            // ignore
        }
        tts = null
        ready = false
    }

    /** @return true when a usable voice for [locale] (or its bare language) is now selected. */
    private fun applyLocale(engine: TextToSpeech, locale: Locale): Boolean {
        if (locale == appliedLocale) return appliedLocaleSupported
        var supported = isSupported(trySetLanguage(engine, locale))
        if (!supported && locale.country.isNotEmpty()) {
            supported = isSupported(trySetLanguage(engine, Locale.forLanguageTag(locale.language)))
        }
        appliedLocale = locale
        appliedLocaleSupported = supported
        return supported
    }

    private fun trySetLanguage(engine: TextToSpeech, locale: Locale): Int = try {
        engine.setLanguage(locale)
    } catch (e: Exception) {
        TextToSpeech.LANG_NOT_SUPPORTED
    }

    private fun isSupported(result: Int): Boolean =
        result != TextToSpeech.LANG_MISSING_DATA && result != TextToSpeech.LANG_NOT_SUPPORTED
}
