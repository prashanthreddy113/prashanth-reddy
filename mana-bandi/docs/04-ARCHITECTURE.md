# Mana Bandi — Technical architecture

## Apps
| App | Stack | Notes |
| --- | --- | --- |
| Rider (Android) | Kotlin, Jetpack Compose, Material 3, Navigation Compose, DataStore, Android TTS + SpeechRecognizer, FCM | Starter code in `../android`. minSdk 24, must run on 2 GB Android Go phones. |
| Captain (Android) | Same stack, separate module/app `in.manabandi.captain` | Foreground location service, Google Maps navigation intent, loud request screen. |
| Admin / dispatch (web) | React + Vite (same as the BrightLoop admin in this repo) | Manual dispatch console for phone bookings. |
| Backend | ASP.NET Core 8 Web API + EF Core + PostgreSQL/PostGIS (same as this repo's backend) + Redis + SignalR | Reuse auth, WhatsApp service, reminder scheduler patterns already in `backend/`. |

## Backend services
```
api/
  auth        phone OTP (SMS via DLT‑registered sender, voice OTP via Exotel/Knowlarity), JWT
  towns       fare tables, landmarks (seeded per town), support number, service hours
  rides       create → dispatch → accept → arrive → start(OTP) → finish → pay/rate
  parcels     create (3‑step) → pickup(OTP+photo) → deliver(OTP+photo) → COD reconcile
  dispatch    Redis geo index of online captains; nearest‑first with a 15 s offer window, 3 rounds, then manual queue
  captains    KYC docs, online state, location stream, earnings, settlements
  notify      FCM push, SMS, WhatsApp templates (Meta Cloud API), voice call via IVR provider
  ivr         missed‑call webhook → creates a "callback" ticket in the dispatch console
  admin       dashboards, exports, promo, broadcast
```
- **Realtime**: SignalR hub for rider ↔ captain location and status; captains publish location every 5 s when on a trip, every 20 s when idle.
- **Maps**: MapLibre + OpenStreetMap tiles on the rider map; OSRM (self‑hosted) or Google Distance Matrix for distance/fare; landmark table (`town_places`) gives names to coordinates without paid geocoding.
- **Offline tolerance**: idempotent `POST /rides` with a client‑generated id; retries; SMS fallback for captain details.

## Core data model (PostgreSQL)
```
users(id, phone, name, lang, trusted_contact_phone, created_at)
captains(id, user_id, vehicle_type[bike|auto], vehicle_no, kyc_status, online, last_lat, last_lng, rating, town_id)
towns(id, name_te, name_en, district, state, support_phone, missed_call_no, night_start, night_end)
town_places(id, town_id, name_te, name_en, kind[bus|hospital|market|temple|school|office|colony|other], lat, lng, icon)
fares(town_id, service, base, per_km, min_fare, night_pct)
rides(id, client_id, rider_id, booked_for_phone, service, pickup_lat/lng, pickup_name, drop_lat/lng, drop_name,
      fare_quoted, fare_final, distance_km, payment[cash|upi], status, captain_id, otp, created_at, ...timestamps)
parcels(id, ride_id, receiver_phone, receiver_name, size[s|m|l], photo_url, payer[sender|receiver],
        pickup_otp, delivery_otp, delivered_photo_url, cod_amount, status)
ride_events(id, ride_id, type, at, lat, lng, meta jsonb)
settlements(id, captain_id, period, cash_collected, upi_earned, commission, payout, status)
```

## Key flows
**Dispatch**: rider `POST /rides` → server quotes fare from `fares` + distance → status `searching` → Redis `GEORADIUS` 3 km → offer to nearest online captain (push + SignalR) with 15 s TTL → accept locks the ride (optimistic concurrency on `status`) → SMS/WhatsApp to rider with captain name, vehicle no, phone → live tracking.

**Voice OTP**: `POST /auth/otp {phone, channel: "call"}` → IVR provider calls and reads the 4 digits in the user's language.

**Missed call**: telecom webhook `POST /ivr/missed-call {from}` → if known user with saved home, create a callback ticket; support calls back, uses dispatch console to create ride on the user's behalf (`booked_by = support`).

**Parcel COD**: receiver pays fare (and later goods value) in cash to the captain; captain marks collected; settlement deducts it; shop sees it in the monthly statement.

## Non‑functional
- Localisation: all strings server‑side too (SMS/WhatsApp templates per language); Telugu default.
- Privacy: phone masking via the IVR provider for rider ↔ captain calls (phase 2); data stored in India (Mumbai/Hyderabad regions).
- Observability: request → accept latency, fulfilment, push delivery rate, per‑town dashboards.
- Cost: no Google Places autocomplete (landmark table instead), Maps only for captain navigation intents, TTS on device (free).
