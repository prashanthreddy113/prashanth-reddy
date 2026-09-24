package com.manabandi.captain.data.api

/** Typed captain endpoints of API contract v1 (docs/07-API.md). */
class CaptainApi(private val client: ApiClient) {

    // --- auth ---

    suspend fun requestOtp(phone: String, channel: String, lang: String): OtpRequestResponse =
        client.post(
            "/api/auth/otp/request",
            OtpRequestBody(phone = phone, role = Roles.CAPTAIN, channel = channel, lang = lang),
            OtpRequestBody.serializer(),
            OtpRequestResponse.serializer()
        )

    suspend fun verifyOtp(phone: String, code: String, lang: String): AuthResponse =
        client.post(
            "/api/auth/otp/verify",
            OtpVerifyBody(phone = phone, role = Roles.CAPTAIN, code = code, lang = lang),
            OtpVerifyBody.serializer(),
            AuthResponse.serializer()
        )

    /** GET /api/me — used to read the current terms version right before accepting. */
    suspend fun account(): User = client.get("/api/me", User.serializer())

    suspend fun acceptTerms(version: String): OkResponse =
        client.post("/api/me/terms", TermsBody(version), TermsBody.serializer(), OkResponse.serializer())

    // --- profile / KYC ---

    suspend fun me(): CaptainMe = client.get("/api/captain/me", CaptainMe.serializer())

    suspend fun setVehicle(body: VehicleBody): CaptainMe =
        client.put("/api/captain/vehicle", body, VehicleBody.serializer(), CaptainMe.serializer())

    /** [kind] ∈ aadhaar, dl, rc, selfie, bank, owner_consent; [fields] = bank details for `bank`. */
    suspend fun uploadDocument(kind: String, jpeg: ByteArray, fields: Map<String, String>): CaptainMe =
        client.uploadPhoto("/api/captain/documents/$kind", jpeg, fields, CaptainMe.serializer())

    // --- online + heartbeat ---

    suspend fun setOnline(online: Boolean, lat: Double?, lng: Double?): CaptainMe =
        client.post(
            "/api/captain/online",
            OnlineBody(online = online, lat = lat, lng = lng),
            OnlineBody.serializer(),
            CaptainMe.serializer()
        )

    /** The heartbeat: 1–20 points, oldest first. The answer carries any pending offer and the trip. */
    suspend fun heartbeat(points: List<LocationPoint>): HeartbeatResponse =
        client.post(
            "/api/captain/location",
            HeartbeatBody(points),
            HeartbeatBody.serializer(),
            HeartbeatResponse.serializer()
        )

    // --- offers ---

    suspend fun acceptOffer(offerId: String): Trip =
        client.postEmpty("/api/captain/offers/$offerId/accept", Trip.serializer())

    suspend fun rejectOffer(offerId: String): OkResponse =
        client.postEmpty("/api/captain/offers/$offerId/reject", OkResponse.serializer())

    // --- trip ---

    /** The current trip, or null (204) — used to resume after the app was closed. */
    suspend fun currentTrip(): Trip? = client.getOrNull("/api/captain/trip", Trip.serializer())

    suspend fun arrived(): Trip = client.postEmpty("/api/captain/trip/arrived", Trip.serializer())

    suspend fun startTrip(otp: String): Trip =
        client.post("/api/captain/trip/start", StartTripBody(otp), StartTripBody.serializer(), Trip.serializer())

    suspend fun finishTrip(lat: Double, lng: Double): Trip =
        client.post("/api/captain/trip/finish", FinishTripBody(lat, lng), FinishTripBody.serializer(), Trip.serializer())

    suspend fun deliver(deliveryOtp: String): Trip =
        client.post("/api/captain/trip/deliver", DeliverBody(deliveryOtp), DeliverBody.serializer(), Trip.serializer())

    /** [stage] = `pickup` | `delivery`. */
    suspend fun tripPhoto(stage: String, jpeg: ByteArray): PhotoUrlResponse =
        client.uploadPhoto("/api/captain/trip/photo", jpeg, mapOf("stage" to stage), PhotoUrlResponse.serializer())

    suspend fun collected(method: String): CollectedResponse =
        client.post("/api/captain/trip/collected", CollectedBody(method), CollectedBody.serializer(), CollectedResponse.serializer())

    suspend fun cancelTrip(reason: String): OkResponse =
        client.post("/api/captain/trip/cancel", CancelBody(reason), CancelBody.serializer(), OkResponse.serializer())

    // --- money ---

    suspend fun earnings(): Earnings = client.get("/api/captain/earnings", Earnings.serializer())
}
