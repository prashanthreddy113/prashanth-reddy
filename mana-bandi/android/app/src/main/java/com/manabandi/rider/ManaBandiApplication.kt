package com.manabandi.rider

import android.app.Application
import com.manabandi.rider.data.LocalePrefs
import com.manabandi.rider.data.SessionStore
import com.manabandi.rider.data.api.ApiClient
import com.manabandi.rider.data.api.RiderApi
import com.manabandi.rider.location.LocationProvider
import com.manabandi.rider.speech.SpeechHelper
import com.manabandi.rider.ui.components.ensureOsmConfigured
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking

class ManaBandiApplication : Application() {

    lateinit var prefs: LocalePrefs
        private set

    /** App-scoped so speech is not cut off when an Activity is recreated. */
    lateinit var speech: SpeechHelper
        private set

    /** Login token + user (DataStore). */
    lateinit var session: SessionStore
        private set

    lateinit var api: RiderApi
        private set

    lateinit var locations: LocationProvider
        private set

    /** For fire-and-forget work that must outlive a screen (e.g. clearing the session on 401). */
    val appScope: CoroutineScope = CoroutineScope(SupervisorJob() + Dispatchers.Main)

    override fun onCreate() {
        super.onCreate()
        prefs = LocalePrefs(this)
        speech = SpeechHelper(this)
        session = SessionStore(this)
        locations = LocationProvider(this)

        // Apply the saved language (Telugu by default) before any Activity exists, and load
        // the login token. runBlocking here is a tiny one-time read of two small files.
        val tag = runBlocking {
            session.load()
            prefs.languageTag.first()
        }
        LocalePrefs.applyLocale(tag)

        val client = ApiClient(
            tokenProvider = { session.token },
            languageProvider = { LocalePrefs.currentLocale(this).language },
            onUnauthorized = { appScope.launch { session.clear() } }
        )
        api = RiderApi(client)

        ensureOsmConfigured(this)
    }
}
