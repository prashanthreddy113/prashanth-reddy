package com.manabandi.captain

import android.app.Application
import com.manabandi.captain.data.CommissionConfig
import com.manabandi.captain.data.LocalePrefs
import com.manabandi.captain.data.SessionStore
import com.manabandi.captain.data.api.ApiClient
import com.manabandi.captain.data.api.CaptainApi
import com.manabandi.captain.location.CaptainNotifications
import com.manabandi.captain.location.LocationProvider
import com.manabandi.captain.location.TrackingRepository
import com.manabandi.captain.location.TrackingService
import com.manabandi.captain.speech.SpeechHelper
import com.manabandi.captain.ui.components.ensureOsmConfigured
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking

class ManaBandiCaptainApplication : Application() {

    lateinit var prefs: LocalePrefs
        private set

    /** App-scoped so speech is not cut off when an Activity is recreated (also used by TrackingService). */
    lateinit var speech: SpeechHelper
        private set

    /** Login token + user (DataStore). */
    lateinit var session: SessionStore
        private set

    lateinit var api: CaptainApi
        private set

    lateinit var locations: LocationProvider
        private set

    /** For work that must outlive a screen (clearing the session on 401, uploads). */
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
            onUnauthorized = { appScope.launch { signOutLocally() } }
        )
        api = CaptainApi(client)

        CaptainNotifications.createChannels(this)
        ensureOsmConfigured(this)
    }

    /** Token rejected (401) or logout: stop tracking and forget the session. */
    suspend fun signOutLocally() {
        TrackingService.stop(this)
        TrackingRepository.reset()
        CommissionConfig.reset()
        session.clear()
    }
}
