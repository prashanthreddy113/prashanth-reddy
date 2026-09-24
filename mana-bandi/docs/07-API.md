# Mana Bandi — API contract v1 (backend ↔ rider app ↔ captain app ↔ owner portal)

This is the single source of truth the three clients and the backend are built against.
Backend: ASP.NET Core 8 + EF Core + PostgreSQL, project `mana-bandi/backend/ManaBandi.Api`.
Base URL: `https://api.manabandi.in` in production, `http://10.0.2.2:5080` from the Android emulator, `http://localhost:5080` locally.
All JSON is camelCase. Times are ISO‑8601 UTC strings. Money is integer rupees. Coordinates are decimal degrees (`lat`, `lng`).

## Design choices for v1 (why this shape)

- **REST + short polling, no push service in v1.** Small‑town 3G/4G drops sockets constantly; a phone that retries a small POST is more reliable than a WebSocket, and it avoids needing Firebase setup to go live. The captain app, while online, runs a foreground location service that POSTs its position every 5 s on a trip / 10 s idle, and **that same response carries any pending ride offer**, so offers arrive within one location tick without push. The rider app polls its ride every 3 s while a ride is active. The owner portal polls every 5 s. FCM push and SignalR are a later optimisation, not a launch blocker.
- **Idempotent writes.** `POST /api/rides` takes a client‑generated `clientId` (UUID); resending returns the same ride.
- **Server is the authority** for fares, commission, dispatch, state transitions and OTPs.
- **Service area enforcement:** pickup must be inside an enabled town's `radiusKm` (when `enforceRadius`); parcel drops may go up to `extendedRadiusKm`, ride drops up to `radiusKm × 1.5`.
- **Distance:** v1 uses straight‑line (haversine) × 1.3 road factor for quotes; the final fare uses the recorded GPS trail length when it is longer than the straight line and shorter than 2× it, else the quote. (OSRM routing can replace this later behind `IRouteService`.)

## Errors

Non‑2xx responses are RFC 7807 problem JSON: `{ "title": "Pickup is outside the service area", "status": 422, "code": "outside_area" }`. `code` values used by the apps: `invalid_otp`, `otp_rate_limited`, `outside_area`, `no_town`, `terms_required`, `kyc_required`, `not_online`, `offer_expired`, `offer_taken`, `wrong_ride_otp`, `invalid_state`, `unauthorized`, `forbidden`, `not_found`, `validation`.

## Auth

| Method & path | Body | Response |
| --- | --- | --- |
| `POST /api/auth/otp/request` | `{ phone: "9876543210", role: "rider"\|"captain", channel: "sms"\|"call", lang: "te" }` | `{ sent: true, expiresInSec: 300, devCode?: "1234" }` — `devCode` only when `Otp:DevMode=true` (never in production). Rate limit: 3 per phone per 10 min. |
| `POST /api/auth/otp/verify` | `{ phone, role, code, name?, lang? }` | `{ token, user: { id, role, phone, name, lang, termsVersionAccepted, townId }, captain?: CaptainMe }` — creates the user on first login. Token = JWT (30 days for riders/captains). |
| `POST /api/auth/login` (portal) | `{ email, password, otp? }` | `{ token, user: { id, name, email, role: "owner"\|"town_manager", townId } }` (12 h token) |
| `GET /api/me` | — | same `user` (+ `captain` for captains) |
| `POST /api/me/terms` | `{ version: "1.0" }` | `{ ok: true }` — writes a `consents` row (kind `terms_rider`/`terms_captain`, version, time, IP, app version from `X-App-Version` header). |
| `PUT /api/me` | `{ name?, lang?, trustedContactPhone? }` | `user` |

Every mobile request sends `Authorization: Bearer <token>`, `X-App-Version: 0.2.0`, `Accept-Language: te`.
Endpoints under `/api/rider/*` require role `rider`, `/api/captain/*` role `captain`, admin endpoints role `owner` or `town_manager` (town managers are scoped to their town; commission/settings writes are owner‑only).

## Shared objects

```jsonc
// Town (public subset used by apps)
{ "id": "nkd", "nameEn": "Narayanakhed", "nameTe": "నారాయణఖేడ్", "center": {"lat":18.033,"lng":77.755},
  "radiusKm": 12, "extendedRadiusKm": 25, "supportPhone": "+919494011001",
  "landmarks": [ { "id": "nkd_l1", "kind": "bus", "nameTe": "బస్టాండ్", "nameEn": "RTC Bus stand", "lat": 18.0338, "lng": 77.7562 } ] }

// Place (pickup/drop)
{ "lat": 18.0338, "lng": 77.7562, "name": "RTC Bus stand", "nameTe": "బస్టాండ్", "landmarkId": "nkd_l1" }   // landmarkId optional

// Ride (as the RIDER sees it)
{ "id": "r_01J…", "clientId": "uuid", "service": "bike"|"auto"|"parcel", "status": "searching"|"accepted"|"arrived"|"started"|"finished"|"cancelled"|"no_captain",
  "townId": "nkd", "pickup": Place, "drop": Place, "distanceKm": 4.2, "fareQuoted": 55, "fareFinal": null, "night": false,
  "payment": "cash"|"upi", "otp": "4729",               // ride OTP the rider tells the captain (shown once accepted)
  "captain": null | { "name": "Srinivas", "phone": "+91…", "vehicleNo": "TS 32 A 1234", "vehicleModel": "Hero Splendor+", "rating": 4.8, "photoUrl": null,
                      "location": { "lat": 18.0331, "lng": 77.7550, "heading": 120, "at": "…" } | null, "etaMin": 3 },
  "trackUrl": "https://api.manabandi.in/t/Xk29fQ",     // public share link for family
  "parcel": null | { "receiverName": "…", "receiverPhone": "…", "size": "s"|"m"|"l", "payer": "sender"|"receiver", "deliveryOtp": "8153", "photoUrl": null },
  "events": [ { "type": "requested"|"accepted"|"arrived"|"started"|"finished"|"cancelled"|"no_captain", "at": "…" } ],
  "createdAt": "…" }

// Offer (as the CAPTAIN sees it)
{ "id": "o_…", "rideId": "r_…", "service": "bike", "pickup": Place, "drop": Place, "distanceToPickupKm": 1.8, "tripKm": 4.2,
  "fare": 55, "payment": "cash", "expiresAt": "…", "secondsLeft": 14 }

// Trip (as the CAPTAIN sees it after accepting)
{ "rideId": "r_…", "status": "accepted"|"arrived"|"started"|"finished", "service": "bike", "pickup": Place, "drop": Place,
  "rider": { "name": "Lakshmi", "phone": "+91…" }, "fare": 55, "payment": "cash", "tripKm": 4.2,
  "commission": { "pct": 0, "amount": 0, "captainGets": 55, "rule": "Default rule: inside 3 free months" },
  "parcel": null | { "size": "m", "receiverName": "…", "receiverPhone": "…", "payer": "receiver", "codAmount": 0 } }

// CaptainMe
{ "id": "c_…", "status": "pending"|"verified"|"rejected"|"blocked", "vehicleType": "bike"|"auto", "vehicleNo": "TS 32 A 1234",
  "townId": "nkd", "online": false, "kyc": { "aadhaar": "missing"|"uploaded"|"verified", "dl": "…", "rc": "…", "selfie": "…", "bank": "…", "ownerConsent": "not_needed"|"missing"|"uploaded" },
  "commission": { "pct": 10, "freeMonths": 3, "freePct": 0, "currentPct": 0 } }
```

## Rider endpoints

| Method & path | Body / query | Response |
| --- | --- | --- |
| `GET /api/rider/towns/nearest?lat=&lng=` | — | `{ town: Town \| null, inside: true, distanceKm: 1.2 }` — the app uses this for saved‑place chips and to name the pickup (nearest landmark within 300 m, else "GPS pin"). |
| `POST /api/rider/quote` | `{ service, pickup: Place, drop: Place, parcelSize? }` | `{ townId, distanceKm, fare, night, etaPickupMin }` or 422 `outside_area` |
| `POST /api/rides` | `{ clientId, service, pickup, drop, payment, bookedFor?: {name, phone}, parcel?: { receiverName, receiverPhone, size, payer } }` | `201 Ride` (status `searching`). Idempotent on `clientId`. Requires terms accepted (`terms_required`). |
| `GET /api/rides/active` | — | `Ride \| 204` — the rider's current non‑terminal ride (app resumes it after restart). |
| `GET /api/rides/{id}` | — | `Ride` — poll every 3 s while active. Includes captain live location. |
| `POST /api/rides/{id}/cancel` | `{ reason }` | `Ride` — ₹10 fee noted in events if captain had been accepted > 2 min. |
| `POST /api/rides/{id}/rate` | `{ stars: 1..5, tip?: 0\|10\|20 }` | `{ ok }` |
| `GET /api/rides?mine=1&limit=20` | — | `[Ride]` history |
| `POST /api/rides/{id}/parcel-photo` | multipart `photo` | `{ photoUrl }` |
| `POST /api/rides/{id}/sos` | `{ lat, lng }` | `{ ok }` — records SOS, flags it on the owner dashboard, sends SMS with the track link to the trusted contact (if set). The app also dials 112 itself. |

## Captain endpoints

| Method & path | Body / query | Response |
| --- | --- | --- |
| `GET /api/captain/me` | — | `CaptainMe` |
| `PUT /api/captain/vehicle` | `{ vehicleType, vehicleNo, vehicleModel? }` | `CaptainMe` |
| `POST /api/captain/documents/{kind}` | multipart `photo`; `kind` ∈ `aadhaar`, `dl`, `rc`, `selfie`, `bank`, `owner_consent` (+ form fields for bank: `upi`, `ifsc`, `accountLast4`) | `CaptainMe` — status stays `pending` until approved in the portal (or by the KYC provider when configured). |
| `POST /api/captain/online` | `{ online: true\|false, lat?, lng? }` | `CaptainMe` — going online requires `status = verified` (`kyc_required`) and a location. |
| **`POST /api/captain/location`** | `{ points: [ { lat, lng, accuracy, speed, heading, at } ] }` (1–20 points, oldest first; the app batches while offline and flushes when back) | `{ online: true, offer: Offer \| null, trip: Trip \| null, serverTime }` — **the heartbeat**. A captain whose last point is older than 60 s is treated as offline for dispatch. |
| `POST /api/captain/offers/{id}/accept` | — | `Trip` or 409 `offer_expired` / `offer_taken` |
| `POST /api/captain/offers/{id}/reject` | — | `{ ok }` |
| `GET /api/captain/trip` | — | `Trip \| 204` (resume after restart) |
| `POST /api/captain/trip/arrived` | — | `Trip` (rider app then shows "arrived") |
| `POST /api/captain/trip/start` | `{ otp: "4729" }` | `Trip` or 422 `wrong_ride_otp` (for parcels this is the **pickup** OTP = the ride OTP shown to the sender) |
| `POST /api/captain/trip/finish` | `{ lat, lng }` | `Trip` with `fareFinal` and commission |
| `POST /api/captain/trip/deliver` | `{ deliveryOtp }` (parcels, before finish) | `Trip` or 422 `wrong_ride_otp` |
| `POST /api/captain/trip/photo` | multipart `photo`, `stage` = `pickup`\|`delivery` | `{ photoUrl }` |
| `POST /api/captain/trip/collected` | `{ method: "cash"\|"upi" }` | `{ ok, earningsToday, tripsToday }` |
| `POST /api/captain/trip/cancel` | `{ reason }` | `{ ok }` — ride goes back to `searching` and is re‑dispatched. |
| `GET /api/captain/earnings` | — | `{ today: { gross, commission, net, trips }, week: {…}, settlementDue, commission: CaptainMe.commission, trips: [ { rideId, service, dropName, fare, commission, payment, finishedAt } ] }` |

## Dispatch rules (server)

- A `DispatchService` (hosted, 1 s tick) takes rides in `searching` without a live offer and offers each to the **nearest** eligible captain: `verified`, online, heartbeat < 60 s, not on a trip, vehicle matches (bike ride → bike; auto ride → auto; parcel → bike for size s/m, auto for l), not already offered this ride. Search radius by round: 3 km → 5 km → 8 km (config `Dispatch:RadiiKm`).
- Offer lives 15 s (`Dispatch:OfferSeconds`). Rejected/expired → next captain. After 90 s total (`Dispatch:MaxSearchSeconds`) with no acceptance → `no_captain`; it appears on the owner dashboard "needs attention".
- Accept uses an optimistic concurrency check on the ride row so two captains can never get the same ride.
- Captain location on the rider's ride is included only between `accepted` and `finished`.

## Public tracking page (share trip with family)

- `GET /t/{token}` → small HTML page (Telugu + English, no login) showing captain name, vehicle number, status and a live map (Leaflet + OpenStreetMap), polling `GET /api/public/track/{token}` every 5 s → `{ status, service, captain: { name, vehicleNo, location }, pickup, drop, updatedAt }`. The token is random (12 chars), expires 2 h after the ride ends, and exposes no phone numbers.

## Owner portal endpoints

The portal already calls these; the paths and response shapes are **exactly** those documented above each function in `mana-bandi/owner-web/src/lib/api.js` and returned by its mock today (same field names, so the pages need no changes). In summary: `POST /api/auth/login`; `GET/PUT/POST /api/towns…`; `GET/POST /api/captains…` (+ `approve`, `reject`, `block`, `unblock`, `request-reupload`, `documents/consent-letter`, `police-verification`, `verify`); `GET /api/live/captains`, `GET /api/live/requests` (now real positions and rides); `GET /api/admin/dashboard`; `GET /api/rides`, `GET /api/parcels`, `GET /api/rides/{id}`; `GET /api/admin/analytics`; `GET /api/settlements`, `POST /api/settlements/{id}/pay`; `GET/PUT /api/config/commission` and the town‑override routes; `GET/PUT /api/admin/settings/company`; `GET/POST /api/admin/terms`; `GET/PUT /api/admin/templates…`; `GET/POST/DELETE /api/admin/users…`; `GET /api/admin/audit`. Captain document images are served from `GET /api/files/{id}` (auth required, owner/town manager only).

## Configuration (environment variables)

`ConnectionStrings__Default` (PostgreSQL), `Jwt__Key` (≥ 32 chars), `Otp__DevMode` (`true` only in testing; returns and logs the code), `Otp__Provider` (`console`\|`msg91`), `Msg91__AuthKey`, `Msg91__TemplateId`, `Files__Root` (document storage folder, e.g. a mounted disk), `Public__BaseUrl` (for track links), `Cors__AllowedOrigins`, `Seed__OwnerEmail`, `Seed__OwnerPassword`, `Dispatch__OfferSeconds`, `Dispatch__RadiiKm`, `Dispatch__MaxSearchSeconds`.
