package com.manabandi.captain.data

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import com.manabandi.captain.data.api.ApiJson
import com.manabandi.captain.data.api.User
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first

private val Context.sessionDataStore: DataStore<Preferences> by preferencesDataStore(name = "mana_bandi_session")

/** The logged-in user: the JWT from POST /api/auth/otp/verify and the `user` object. */
data class Session(val token: String, val user: User)

/**
 * Keeps the login token and user in DataStore and mirrors them in a [StateFlow], so the
 * API client can read the token synchronously and the UI can react to logout.
 *
 * On a 401 the ApiClient calls [clear]; the app watches [session] and goes back to the
 * phone screen when it becomes null.
 */
class SessionStore(private val context: Context) {

    private val _session = MutableStateFlow<Session?>(null)
    val session: StateFlow<Session?> = _session.asStateFlow()

    /** Current token, or null when logged out. Safe to call from any thread. */
    val token: String?
        get() = _session.value?.token

    val isLoggedIn: Boolean
        get() = _session.value != null

    /** Reads the stored session once at start-up (called from the Application). */
    suspend fun load() {
        val prefs = context.sessionDataStore.data.first()
        val token = prefs[KEY_TOKEN]
        val userJson = prefs[KEY_USER]
        _session.value = if (!token.isNullOrBlank() && !userJson.isNullOrBlank()) {
            try {
                Session(token, ApiJson.decodeFromString(User.serializer(), userJson))
            } catch (e: IllegalArgumentException) {
                null
            }
        } else {
            null
        }
    }

    suspend fun save(token: String, user: User) {
        context.sessionDataStore.edit {
            it[KEY_TOKEN] = token
            it[KEY_USER] = ApiJson.encodeToString(User.serializer(), user)
        }
        _session.value = Session(token, user)
    }

    /** Updates the stored user (e.g. after accepting the terms) and keeps the token. */
    suspend fun updateUser(user: User) {
        val current = _session.value ?: return
        save(current.token, user)
    }

    suspend fun clear() {
        _session.value = null
        context.sessionDataStore.edit {
            it.remove(KEY_TOKEN)
            it.remove(KEY_USER)
        }
    }

    private companion object {
        val KEY_TOKEN = stringPreferencesKey("token")
        val KEY_USER = stringPreferencesKey("user")
    }
}
