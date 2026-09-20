package com.manabandi.captain.data

import android.content.Context
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
 * Small DataStore wrapper for the chosen language, the demo login and the KYC status.
 * The language is also applied through [AppCompatDelegate.setApplicationLocales]
 * so it works on every API level (see [applyLocale]).
 */
class LocalePrefs(private val context: Context) {

    companion object {
        /** Telugu is the default language of the app. */
        const val DEFAULT_LANGUAGE = "te"
        val SUPPORTED = listOf("te", "en", "hi", "kn", "mr", "ur")

        private val KEY_LANGUAGE = stringPreferencesKey("language")
        private val KEY_LANGUAGE_CHOSEN = booleanPreferencesKey("language_chosen")
        private val KEY_PHONE = stringPreferencesKey("phone")
        private val KEY_LOGGED_IN = booleanPreferencesKey("logged_in")
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
    val phone: Flow<String> = context.dataStore.data.map { it[KEY_PHONE] ?: "" }
    val loggedIn: Flow<Boolean> = context.dataStore.data.map { it[KEY_LOGGED_IN] ?: false }
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

    suspend fun setLoggedIn(phone: String) {
        context.dataStore.edit {
            it[KEY_PHONE] = phone
            it[KEY_LOGGED_IN] = true
        }
    }

    /** Demo KYC: nothing is uploaded, we only remember that the captain finished the checklist. */
    suspend fun setKycDone(vehicleType: String, vehicleNumber: String) {
        context.dataStore.edit {
            it[KEY_KYC_DONE] = true
            it[KEY_VEHICLE_TYPE] = vehicleType
            it[KEY_VEHICLE_NUMBER] = vehicleNumber
        }
    }

    suspend fun logout() {
        context.dataStore.edit {
            it.remove(KEY_PHONE)
            it[KEY_LOGGED_IN] = false
        }
    }
}
