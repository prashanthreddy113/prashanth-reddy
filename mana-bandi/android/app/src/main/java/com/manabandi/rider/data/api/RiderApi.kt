package com.manabandi.rider.data.api

import kotlinx.serialization.builtins.ListSerializer

/** Typed rider endpoints of API contract v1 (docs/07-API.md). */
class RiderApi(private val client: ApiClient) {

    // --- auth ---

    suspend fun requestOtp(phone: String, channel: String, lang: String): OtpRequestResponse =
        client.post(
            "/api/auth/otp/request",
            OtpRequestBody(phone = phone, role = Roles.RIDER, channel = channel, lang = lang),
            OtpRequestBody.serializer(),
            OtpRequestResponse.serializer()
        )

    suspend fun verifyOtp(phone: String, code: String, lang: String): AuthResponse =
        client.post(
            "/api/auth/otp/verify",
            OtpVerifyBody(phone = phone, role = Roles.RIDER, code = code, lang = lang),
            OtpVerifyBody.serializer(),
            AuthResponse.serializer()
        )

    /** GET /api/me — used to read the current terms version right before accepting. */
    suspend fun account(): User = client.get("/api/me", User.serializer())

    suspend fun acceptTerms(version: String): OkResponse =
        client.post("/api/me/terms", TermsBody(version), TermsBody.serializer(), OkResponse.serializer())

    // --- rider ---

    suspend fun nearestTown(lat: Double, lng: Double): NearestTownResponse =
        client.get("/api/rider/towns/nearest?lat=$lat&lng=$lng", NearestTownResponse.serializer())

    suspend fun quote(body: QuoteBody): QuoteResponse =
        client.post("/api/rider/quote", body, QuoteBody.serializer(), QuoteResponse.serializer())

    suspend fun createRide(body: CreateRideBody): Ride =
        client.post("/api/rides", body, CreateRideBody.serializer(), Ride.serializer())

    /** The rider's current non-terminal ride, or null (204). */
    suspend fun activeRide(): Ride? = client.getOrNull("/api/rides/active", Ride.serializer())

    suspend fun ride(id: String): Ride = client.get("/api/rides/$id", Ride.serializer())

    suspend fun cancel(id: String, reason: String): Ride =
        client.post("/api/rides/$id/cancel", CancelBody(reason), CancelBody.serializer(), Ride.serializer())

    suspend fun rate(id: String, stars: Int, tip: Int?): OkResponse =
        client.post("/api/rides/$id/rate", RateBody(stars, tip), RateBody.serializer(), OkResponse.serializer())

    suspend fun myRides(limit: Int = 20): List<Ride> =
        client.get("/api/rides?mine=1&limit=$limit", ListSerializer(Ride.serializer()))

    suspend fun uploadParcelPhoto(id: String, jpeg: ByteArray): PhotoUrlResponse =
        client.uploadPhoto("/api/rides/$id/parcel-photo", jpeg, emptyMap(), PhotoUrlResponse.serializer())

    suspend fun sos(id: String, lat: Double, lng: Double): OkResponse =
        client.post("/api/rides/$id/sos", SosBody(lat, lng), SosBody.serializer(), OkResponse.serializer())
}
