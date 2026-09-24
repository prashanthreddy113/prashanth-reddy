package com.manabandi.rider.data.api

import com.manabandi.rider.BuildConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.KSerializer
import kotlinx.serialization.json.Json
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.IOException
import java.util.concurrent.TimeUnit

/**
 * JSON settings shared by every request and response (API contract v1, docs/07-API.md):
 * camelCase field names are the Kotlin property names, unknown fields are ignored so the
 * backend can add fields without breaking old apps, and nulls are simply left out.
 */
@OptIn(ExperimentalSerializationApi::class)
val ApiJson: Json = Json {
    ignoreUnknownKeys = true
    explicitNulls = false
    coerceInputValues = true
    encodeDefaults = true
}

/**
 * Every failure of an API call. The backend answers non-2xx with RFC 7807 problem JSON
 * `{ title, status, code }`; [code] is mapped to one subclass per documented value so screens
 * can `when` over them. [Network] = no connection / timeout; [Unknown] = anything else.
 */
sealed class ApiError(
    val code: String,
    val status: Int,
    val title: String?,
    cause: Throwable? = null
) : Exception(title ?: code, cause) {
    class Network(cause: Throwable?) : ApiError("network", 0, null, cause)
    class InvalidOtp(status: Int, title: String?) : ApiError("invalid_otp", status, title)
    class OtpRateLimited(status: Int, title: String?) : ApiError("otp_rate_limited", status, title)
    class OutsideArea(status: Int, title: String?) : ApiError("outside_area", status, title)
    class NoTown(status: Int, title: String?) : ApiError("no_town", status, title)
    class TermsRequired(status: Int, title: String?) : ApiError("terms_required", status, title)
    class KycRequired(status: Int, title: String?) : ApiError("kyc_required", status, title)
    class NotOnline(status: Int, title: String?) : ApiError("not_online", status, title)
    class OfferExpired(status: Int, title: String?) : ApiError("offer_expired", status, title)
    class OfferTaken(status: Int, title: String?) : ApiError("offer_taken", status, title)
    class WrongRideOtp(status: Int, title: String?) : ApiError("wrong_ride_otp", status, title)
    class InvalidState(status: Int, title: String?) : ApiError("invalid_state", status, title)
    class Unauthorized(status: Int, title: String?) : ApiError("unauthorized", status, title)
    class Forbidden(status: Int, title: String?) : ApiError("forbidden", status, title)
    class NotFound(status: Int, title: String?) : ApiError("not_found", status, title)
    class Validation(status: Int, title: String?) : ApiError("validation", status, title)
    class Unknown(code: String, status: Int, title: String?, cause: Throwable? = null) :
        ApiError(code, status, title, cause)

    companion object {
        /** Maps a problem `code` (or, when it is missing, the HTTP status) to an [ApiError]. */
        fun from(status: Int, code: String?, title: String?): ApiError = when (code) {
            "invalid_otp" -> InvalidOtp(status, title)
            "otp_rate_limited" -> OtpRateLimited(status, title)
            "outside_area" -> OutsideArea(status, title)
            "no_town" -> NoTown(status, title)
            "terms_required" -> TermsRequired(status, title)
            "kyc_required" -> KycRequired(status, title)
            "not_online" -> NotOnline(status, title)
            "offer_expired" -> OfferExpired(status, title)
            "offer_taken" -> OfferTaken(status, title)
            "wrong_ride_otp" -> WrongRideOtp(status, title)
            "invalid_state" -> InvalidState(status, title)
            "unauthorized" -> Unauthorized(status, title)
            "forbidden" -> Forbidden(status, title)
            "not_found" -> NotFound(status, title)
            "validation" -> Validation(status, title)
            null, "" -> when (status) {
                401 -> Unauthorized(status, title)
                403 -> Forbidden(status, title)
                404 -> NotFound(status, title)
                400, 422 -> Validation(status, title)
                429 -> OtpRateLimited(status, title)
                else -> Unknown("http_$status", status, title)
            }
            else -> Unknown(code, status, title)
        }
    }
}

/**
 * Small OkHttp + kotlinx.serialization client for the Mana Bandi backend.
 *
 * - Base URL comes from BuildConfig.API_BASE_URL (see app/build.gradle.kts).
 * - Every request sends `Authorization: Bearer <token>` (when logged in), `X-App-Version` and
 *   `Accept-Language` (the app language), as the contract asks.
 * - 15 s connect / read / write timeouts (photo uploads get 60 s).
 * - A 401 while a token is set calls [onUnauthorized] (the app clears the session and shows
 *   the phone screen) and then throws [ApiError.Unauthorized].
 * - All calls are main-safe suspend functions (the network work runs on Dispatchers.IO).
 */
class ApiClient(
    private val tokenProvider: () -> String?,
    private val languageProvider: () -> String,
    private val onUnauthorized: () -> Unit,
    private val baseUrl: String = BuildConfig.API_BASE_URL.trimEnd('/')
) {
    val json: Json = ApiJson

    private val http: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .writeTimeout(15, TimeUnit.SECONDS)
        .retryOnConnectionFailure(true)
        .build()

    /** Same connection pool, longer timeouts for multipart photo uploads on slow 3G. */
    private val uploadHttp: OkHttpClient = http.newBuilder()
        .readTimeout(60, TimeUnit.SECONDS)
        .writeTimeout(60, TimeUnit.SECONDS)
        .build()

    suspend fun <T> get(path: String, response: KSerializer<T>): T =
        decode(execute(newRequest(path).get(), http), response)

    /** GET that may answer 204 No Content (e.g. `GET /api/rides/active`): returns null then. */
    suspend fun <T> getOrNull(path: String, response: KSerializer<T>): T? {
        val text = execute(newRequest(path).get(), http) ?: return null
        return decode(text, response)
    }

    suspend fun <B, T> post(path: String, body: B, bodySerializer: KSerializer<B>, response: KSerializer<T>): T =
        decode(execute(newRequest(path).post(jsonBody(body, bodySerializer)), http), response)

    /** POST without a request body (sends `{}`), e.g. accept / reject / arrived. */
    suspend fun <T> postEmpty(path: String, response: KSerializer<T>): T =
        decode(execute(newRequest(path).post("{}".toRequestBody(JSON_MEDIA)), http), response)

    suspend fun <B, T> put(path: String, body: B, bodySerializer: KSerializer<B>, response: KSerializer<T>): T =
        decode(execute(newRequest(path).put(jsonBody(body, bodySerializer)), http), response)

    /**
     * Multipart upload of one JPEG in the part named `photo` plus optional text [fields]
     * (e.g. `stage=pickup`, or the bank details for the KYC bank document).
     */
    suspend fun <T> uploadPhoto(
        path: String,
        jpeg: ByteArray,
        fields: Map<String, String>,
        response: KSerializer<T>
    ): T {
        val builder = MultipartBody.Builder().setType(MultipartBody.FORM)
        for ((name, value) in fields) {
            builder.addFormDataPart(name, value)
        }
        builder.addFormDataPart("photo", "photo.jpg", jpeg.toRequestBody(JPEG_MEDIA))
        return decode(execute(newRequest(path).post(builder.build()), uploadHttp), response)
    }

    private fun <B> jsonBody(body: B, serializer: KSerializer<B>) =
        ApiJson.encodeToString(serializer, body).toRequestBody(JSON_MEDIA)

    private fun newRequest(path: String): Request.Builder {
        val builder = try {
            Request.Builder().url(baseUrl + path)
        } catch (e: IllegalArgumentException) {
            // A malformed manabandi.apiBaseUrl (e.g. missing http://).
            throw ApiError.Unknown("bad_base_url", 0, "$baseUrl$path", e)
        }
        builder
            .header("Accept", "application/json")
            .header("X-App-Version", BuildConfig.VERSION_NAME)
            .header("Accept-Language", languageProvider())
        val token = tokenProvider()
        if (!token.isNullOrBlank()) builder.header("Authorization", "Bearer $token")
        return builder
    }

    private fun <T> decode(text: String?, serializer: KSerializer<T>): T {
        if (text == null) throw ApiError.Unknown("empty_body", 204, null)
        return try {
            ApiJson.decodeFromString(serializer, text)
        } catch (e: IllegalArgumentException) {
            // SerializationException extends IllegalArgumentException.
            throw ApiError.Unknown("bad_response", 200, e.message, e)
        }
    }

    /** Runs the call on the IO dispatcher. Returns the body text, or null for 204 / empty body. */
    private suspend fun execute(builder: Request.Builder, client: OkHttpClient): String? =
        withContext(Dispatchers.IO) {
            if (!isCleartextAllowed(baseUrl)) {
                throw ApiError.Network(IllegalStateException("Plain http is only allowed to the emulator host or a LAN address in debug builds: $baseUrl"))
            }
            val hadToken = !tokenProvider().isNullOrBlank()
            val response = try {
                client.newCall(builder.build()).execute()
            } catch (e: IOException) {
                throw ApiError.Network(e)
            } catch (e: IllegalArgumentException) {
                // e.g. a malformed base URL in local.properties
                throw ApiError.Unknown("bad_request", 0, e.message, e)
            }
            response.use { r ->
                val text = try {
                    r.body?.string()
                } catch (e: IOException) {
                    throw ApiError.Network(e)
                }
                if (r.isSuccessful) {
                    if (r.code == 204 || text.isNullOrBlank()) null else text
                } else {
                    val problem = text?.takeIf { it.isNotBlank() }?.let {
                        try {
                            ApiJson.decodeFromString(Problem.serializer(), it)
                        } catch (e: IllegalArgumentException) {
                            null
                        }
                    }
                    val error = ApiError.from(r.code, problem?.code, problem?.title)
                    if (error is ApiError.Unauthorized && hadToken) onUnauthorized()
                    throw error
                }
            }
        }

    companion object {
        private val JSON_MEDIA = "application/json; charset=utf-8".toMediaType()
        private val JPEG_MEDIA = "image/jpeg".toMediaType()
        private val PRIVATE_172 = Regex("^172\\.(1[6-9]|2[0-9]|3[01])\\.")

        /**
         * https is always fine. Plain http only in debug builds and only to the emulator host,
         * localhost or a private LAN address (10.x, 192.168.x, 172.16-31.x). Release = https only.
         */
        fun isCleartextAllowed(baseUrl: String): Boolean {
            val url = baseUrl.toHttpUrlOrNull() ?: return false
            if (url.scheme == "https") return true
            if (!BuildConfig.DEBUG) return false
            val host = url.host
            return host == "10.0.2.2" || host == "localhost" || host == "127.0.0.1" ||
                host.startsWith("10.") || host.startsWith("192.168.") || PRIVATE_172.containsMatchIn(host)
        }
    }
}
