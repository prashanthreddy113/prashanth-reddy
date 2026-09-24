package com.manabandi.captain.data

import android.content.Context
import android.content.res.Configuration
import androidx.appcompat.app.AppCompatDelegate
import androidx.core.os.LocaleListCompat
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import java.util.Locale

private val Context.dataStore: DataStore<Preferences> by preferencesDataStore(name = "mana_bandi_captain_prefs")

/**
 * Small DataStore wrapper for the chosen language, the accepted terms version and whether the
 * KYC screen was completed once on this phone. (The login token lives in [SessionStore].)
 * The language is also applied through [AppCompatDelegate.setApplicationLocales]
 * so it works on every API level (see [applyLocale]).
 */
class LocalePrefs(private val context: Context) {

    companion object {
        /** Telugu is the default language of the app. */
        const val DEFAULT_LANGUAGE = "te"

        /** Bump when the terms change; the app then asks every user to accept again. */
        const val TERMS_VERSION = "1.0"
        val SUPPORTED = listOf("te", "en", "hi", "kn", "mr", "ur")

        private val KEY_LANGUAGE = stringPreferencesKey("language")
        private val KEY_LANGUAGE_CHOSEN = booleanPreferencesKey("language_chosen")
        private val KEY_TERMS_VERSION = stringPreferencesKey("terms_version_accepted")
        private val KEY_KYC_DONE = booleanPreferencesKey("kyc_done")
        private val KEY_VEHICLE_TYPE = stringPreferencesKey("vehicle_type")
        private val KEY_VEHICLE_NUMBER = stringPreferencesKey("vehicle_number")

        /** Applies a BCP-47 tag app-wide. Recreates activities on API < 33. */
        fun applyLocale(tag: String) {
            AppCompatDelegate.setApplicationLocales(LocaleListCompat.forLanguageTags(tag))
        }

        /** The locale the app is currently showing (falls back to the resource locale). */
        fun currentLocale(context: Context): Locale {
            val appLocales = AppCompatDelegate.getApplicationLocales()
            if (!appLocales.isEmpty) {
                appLocales.get(0)?.let { return it }
            }
            return context.resources.configuration.locales.get(0) ?: Locale.getDefault()
        }

        /**
         * A context whose resources use the app language. Services and notifications need it:
         * on Android 12 and below AppCompat only localises Activities.
         */
        fun localizedContext(context: Context): Context {
            val config = Configuration(context.resources.configuration)
            config.setLocale(currentLocale(context))
            return context.createConfigurationContext(config)
        }

        /** Region-qualified tag for speech recognition ("te" -> "te-IN"). */
        fun speechTag(locale: Locale): String = when (locale.language) {
            "te" -> "te-IN"
            "hi" -> "hi-IN"
            "kn" -> "kn-IN"
            "mr" -> "mr-IN"
            "ur" -> "ur-IN"
            "en" -> "en-IN"
            else -> locale.toLanguageTag()
        }
    }

    val languageTag: Flow<String> = context.dataStore.data.map { it[KEY_LANGUAGE] ?: DEFAULT_LANGUAGE }
    val languageChosen: Flow<Boolean> = context.dataStore.data.map { it[KEY_LANGUAGE_CHOSEN] ?: false }
    /** True only when the CURRENT terms version has been accepted. */
    val termsAccepted: Flow<Boolean> = context.dataStore.data.map { it[KEY_TERMS_VERSION] == TERMS_VERSION }
    val kycDone: Flow<Boolean> = context.dataStore.data.map { it[KEY_KYC_DONE] ?: false }
    val vehicleType: Flow<String> = context.dataStore.data.map { it[KEY_VEHICLE_TYPE] ?: "" }
    val vehicleNumber: Flow<String> = context.dataStore.data.map { it[KEY_VEHICLE_NUMBER] ?: "" }

    suspend fun setLanguage(tag: String) {
        val safe = if (tag in SUPPORTED) tag else DEFAULT_LANGUAGE
        context.dataStore.edit {
            it[KEY_LANGUAGE] = safe
            it[KEY_LANGUAGE_CHOSEN] = true
        }
    }

    suspend fun acceptTerms() {
        context.dataStore.edit { it[KEY_TERMS_VERSION] = TERMS_VERSION }
    }

    /** Mirrors the server's `user.termsVersionAccepted` after login. */
    suspend fun setTermsAccepted(accepted: Boolean) {
        context.dataStore.edit {
            if (accepted) it[KEY_TERMS_VERSION] = TERMS_VERSION else it.remove(KEY_TERMS_VERSION)
        }
    }

    /** The KYC screen was completed (documents are uploaded one by one as photos are taken). */
    suspend fun setKycDone(vehicleType: String, vehicleNumber: String) {
        context.dataStore.edit {
            it[KEY_KYC_DONE] = true
            it[KEY_VEHICLE_TYPE] = vehicleType
            it[KEY_VEHICLE_NUMBER] = vehicleNumber
        }
    }

    /** On logout: the next captain on this phone starts from the KYC screen again. */
    suspend fun resetKyc() {
        context.dataStore.edit {
            it.remove(KEY_KYC_DONE)
            it.remove(KEY_VEHICLE_TYPE)
            it.remove(KEY_VEHICLE_NUMBER)
        }
    }
}
