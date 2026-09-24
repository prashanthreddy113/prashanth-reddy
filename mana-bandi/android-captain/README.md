# Mana Bandi (మన బండి) — Android captain (driver) app

Starter Android app (Kotlin + Jetpack Compose, Material 3) for the **captains**
(bike / auto drivers) of **Mana Bandi**, the Rapido-style ride + parcel app for
small Telangana towns (Narayanakhed, Zaheerabad). It is the sibling of the rider
app in `../android` and follows the same rules: big tiles, one primary action
per screen, an emoji on every button, a 🔊 button on every screen that reads the
screen aloud, Telugu by default. The header is **dark green** (`#0B5E2F`) and the
launcher icon background is dark green too, so a captain who has both apps can
tell them apart at a glance.

Since v0.2.0 the app talks to the real backend (API contract v1,
`mana-bandi/docs/07-API.md`): OTP login, KYC photo uploads, verification status, going
online with **real GPS** in a location foreground service whose heartbeat brings the ride
offers, the whole trip state machine, and earnings. `FakeDispatch` is gone.

## Stack

| Thing | Version |
|---|---|
| Android Gradle Plugin | 8.5.2 |
| Kotlin | 2.0.20 (+ `org.jetbrains.kotlin.plugin.compose`) |
| Gradle | 8.7 (wrapper) |
| Compose BOM | 2024.09.03 (Material 3) |
| navigation-compose | 2.8.2 |
| activity-compose | 1.9.2 |
| lifecycle 2.8.6, datastore-preferences 1.1.1, core-ktx 1.13.1, appcompat 1.7.0, core-splashscreen 1.0.1 |
| compileSdk / targetSdk 35, minSdk 24 |
| kotlinx-serialization-json 1.7.3 (+ `org.jetbrains.kotlin.plugin.serialization` 2.0.20) | JSON |
| okhttp 4.12.0 | HTTP |
| kotlinx-coroutines-android 1.8.1 | coroutines |
| play-services-location 21.3.0 | fused GPS |
| osmdroid-android 6.1.20 | OpenStreetMap maps (no API key) |

Identical to the rider app on purpose (same `gradle/libs.versions.toml`). No Retrofit, no
Firebase, no WorkManager (the foreground service does the work).

## Point the app at a backend

Exactly as in the rider app: debug → `http://10.0.2.2:5080` (emulator → laptop), release →
`https://api.manabandi.in`; override with `manabandi.apiBaseUrl=http://192.168.1.20:5080`
in `android-captain/local.properties` or `-Pmanabandi.apiBaseUrl=…`. Release is HTTPS only;
debug allows http only to the emulator host, localhost and private LAN addresses. Run the
backend with `Otp__DevMode=true` to see the login code as a grey hint.

A new captain starts `pending`: approve them in the owner portal (Captains → Approve)
before they can go online (`kyc_required` otherwise).

## How GPS tracking works

```
Home "Go online" ─► rationale ─► FINE+COARSE (+ POST_NOTIFICATIONS on 13+)
      └─► POST /api/captain/online {online:true, lat, lng} ─► TrackingService (foreground, type=location)
TrackingService
  ├─ fused updates: every 5 s on a trip, 10 s idle, min 5 m ─► in-memory buffer (max 200 points)
  ├─ every tick: POST /api/captain/location {points: oldest 1–20}
  │     ok  → drop the sent points, publish {online, offer, trip} in TrackingRepository (StateFlow)
  │     fail → keep the points, exponential backoff (interval × 2ⁿ, max 60 s), flush when back
  │     not moving → re-send the last fix with the current time (server: stale after 60 s)
  ├─ new offer → buzz + notification ringtone + spoken ("కొత్త రైడ్…") and, if the app is not
  │     visible, a high-priority full-screen notification (channel `ride_offers`) → Request screen
  └─ notification "🟢 ఆన్‌లైన్ — రైడ్ల కోసం చూస్తున్నాం" with "ఆఫ్‌లైన్ అవ్వండి" (hidden on a trip)
UI (Compose) collects TrackingRepository.state: offer → Request screen, trip.status →
  accepted: To pickup · arrived: Enter OTP · started: On trip (parcel: Deliver) · finished: Collect
```

- The service keeps running for the whole trip even if the app is swiped away, and stops on
  "go offline" (notification or Home), logout, a 401, or when the server says the captain
  is offline without a trip.
- Android 14: the service is only started from the visible Home screen after the runtime
  location permission is granted (`FOREGROUND_SERVICE` + `FOREGROUND_SERVICE_LOCATION`
  declared); a refused start is caught and the captain simply stays offline. No background
  location permission is needed.
- Race safety: a heartbeat sent before the captain accepted / rejected / finished something
  cannot bring an old offer or trip state back (`TrackingRepository`).
- On app start `GET /api/captain/me` + `GET /api/captain/trip` resume a running trip (and
  tracking, if the permission is there).

### Battery (Xiaomi / Redmi / POCO, Realme / OPPO, Vivo / iQOO, …)

These phones kill background apps, and a killed captain app gets no rides. Home shows a
🔋 card while Android still battery-optimises the app; Help always has it:
- "Allow battery use" → the system "stop optimising this app?" dialog
  (`ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`, permission
  `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`), falling back to the battery-optimisation list.
  Google Play allows this permission only for some app types; if the listing is rejected,
  remove the permission — the helper then opens the settings list instead.
- "Turn on auto-start" (on those brands) → the maker's own auto-start screen
  (`BatteryOptimization.openAutoStart`, known MIUI / ColorOS / Funtouch / EMUI components).
Tell new captains at the office to do both once, and to lock the app in "recent apps".

Package naming: the **applicationId is `in.manabandi.captain`** but the **Kotlin
package / namespace is `com.manabandi.captain`**, because `in` is a Kotlin keyword
and back-ticked package segments are fragile in tooling. Both are set in
`app/build.gradle.kts`.

## Open and run

1. Install Android Studio (Koala or newer) with the Android 35 SDK.
2. **Gradle wrapper jar**: the binary `gradle/wrapper/gradle-wrapper.jar` is
   intentionally not checked in. Generate it once, from this folder, with any
   locally installed Gradle (8.x):

   ```bash
   cd mana-bandi/android-captain
   gradle wrapper --gradle-version 8.7
   ```

   After that, `./gradlew` works (and Android Studio will use it).
   Android Studio can also do this for you when it offers to "fix" the wrapper.
3. *File → Open* → select `mana-bandi/android-captain`.
4. Let Gradle sync, then run the `app` configuration on an emulator or a phone
   (a real phone is better: TTS, the camera, vibration and Google Maps need
   Google apps that many emulator images lack).

Command line: `./gradlew :app:assembleDebug` then
`adb install app/build/outputs/apk/debug/app-debug.apk`.

Both apps can be installed on the same phone (different applicationIds).

## What is in the app

Single `MainActivity` (an `AppCompatActivity`, needed for per-app language on
Android 12 and below) hosting a Navigation Compose graph in
`ManaBandiCaptainApp.kt`. Start-up: language → phone → OTP → KYC (first time
only) → home.

| Route | Screen | Notes |
|---|---|---|
| `language` | `LanguageScreen` | 6 tiles in native script; tapping speaks a greeting in that language and continues |
| `phone` | `PhoneScreen` | 10-digit number, 32sp; `POST /api/auth/otp/request` |
| `otp` | `OtpScreen` | 4 boxes, "📞 Call me with OTP" (voice), grey test-code hint in dev mode; `/verify` |
| `terms` | `TermsScreen` | six captain rules (documents, DigiLocker consent, fare, safety, OTP, location) read aloud, "✅ I agree"; re‑asked when `LocalePrefs.TERMS_VERSION` changes |
| `kyc` | `KycScreen` | status card (pending / rejected + reason / blocked); 🪪 Aadhaar, 🚗 licence, 📄 RC, 📷 selfie, 🏦 bank (+ UPI / IFSC / last 4 digits), ✍️ owner's letter (only when the server asks); each photo uploads at once to `POST /api/captain/documents/{kind}` (JPEG ≤ 1600 px, q85) and shows ⬜ / ⏫ / ⏳ / ✅ / ❌; vehicle type, number, model → `PUT /api/captain/vehicle` |
| `home` | `HomeScreen` | verification status from `GET /api/captain/me` (pending → "ఆఫీసు వాళ్ళు చెక్ చేస్తున్నారు" + 📞 office; rejected → reason + "see my papers"); when verified the giant 🔴 OFFLINE / 🟢 ONLINE card (location rationale first time); "no network, keeping your location" banner; today's earnings; 🔋 battery card |
| `request` | `RequestScreen` | the real offer: tinted by service, pickup + distance, drop, trip km, ₹ fare, 💵/📱, countdown from the server's `secondsLeft`; **✅ ఒప్పుకోండి** → `/offers/{id}/accept` (409 expired / taken → friendly toast, Home); ❌ or Back → `/reject` |
| `to_pickup` | `ToPickupScreen` | OpenStreetMap with you + 🧍 pickup, rider name + phone, 📞 Call rider, 🧭 Show the way (Google Maps to the real coordinates), ✅ I have arrived → `/trip/arrived`, small "cancel this ride" → `/trip/cancel` |
| `enter_otp` | `EnterOtpScreen` | 4 digits → `/trip/start` (wrong OTP → clear message, boxes cleared); parcel: pickup OTP + 📷 pickup photo (`/trip/photo stage=pickup`) |
| `on_trip` | `OnTripScreen` | map with you + 🏁 drop, drop name, km, 🧭 navigate, slide-to-finish → `/trip/finish {lat,lng}`; parcel: slide → delivery step; 🆘 SOS (dials 112) |
| `deliver` | `DeliverScreen` | parcel: 📷 delivery photo (`stage=delivery`) + delivery OTP → `/trip/deliver`, then `/trip/finish` |
| `collect` | `CollectScreen` | final fare (`fareFinal`) in 64sp, cash or 📱 QR placeholder, **commission line from the server's `trip.commission`**, ✅ తీసుకున్నాను → `/trip/collected {method}` → Home, still online |
| `earnings` | `EarningsScreen` | `GET /api/captain/earnings`: today / week / office owes you, the owner-configured commission rule (`CaptainMe.commission`), today's trips |
| `help` | `HelpScreen` | 📞 call office, 💬 WhatsApp, 🌐 language, how-it-works rows, 🔋 battery / auto-start, 🚪 log out (stops tracking) |

The trip's server status drives navigation (`ManaBandiCaptainApp.kt`): trip steps replace
each other above `home`, so Back during a trip returns to Home and the app brings the captain
straight back to the current step. A rider cancelling shows a toast and returns Home.

Screen state lives in `CaptainViewModel` (Activity scoped); live data (offer, trip, GPS) lives
in the process-wide `TrackingRepository`, written by `TrackingService`.

### Code layout

```
app/src/main/java/com/manabandi/captain/
  MainActivity.kt                 splash + edge-to-edge + start destination
  ManaBandiCaptainApplication.kt  creates LocalePrefs + SpeechHelper, applies saved locale
  ManaBandiCaptainApp.kt          NavHost + Routes
  CaptainViewModel.kt             login, KYC uploads, CaptainMe, online/offline, offer, trip steps, earnings
  data/LocalePrefs.kt             DataStore (language, terms, KYC screen done) + locale helpers + localizedContext
  data/SessionStore.kt            DataStore: JWT + user (401 → logout)
  data/CommissionConfig.kt        the rule from CaptainMe.commission / Earnings.commission (no hard-coded rule)
  data/Types.kt                   Service, Payment, VehicleType, KycDoc (+ contract values), formatting
  data/api/ApiClient.kt, Models.kt, Jpeg.kt   same as the rider app (package renamed)
  data/api/CaptainApi.kt          one suspend function per captain endpoint
  location/LocationProvider.kt    same as the rider app
  location/TrackingService.kt     foreground location service + heartbeat + offer alerts
  location/TrackingRepository.kt  process-wide StateFlow: running, offer (+ deadline), trip, GPS, connection
  location/CaptainNotifications.kt  channels `tracking` / `ride_offers`, online + offer notifications
  location/BatteryOptimization.kt battery-optimisation dialog + maker auto-start screens
  speech/SpeechHelper.kt          TextToSpeech wrapper (queues until ready, silent if unsupported)
  ui/theme/                       Color.kt, Type.kt (20sp body / 28sp headings), Theme.kt
  ui/components/                  SpeakTopBar (🔊, dark green), BigButton (72dp) / SecondaryButton / CallButton,
                                  BottomBar (🏠 💰 📞), OtpEntry (4 boxes + hidden field), PhotoButton (camera
                                  permission + TakePicturePreview), SlideToFinish, FakeQrBox, Navigate
                                  (NavigateButton + openNavigation), Vibrate (vibrateNewRequest),
                                  OsmMap, PermissionRationale, AppLanguage
  ui/screens/                     one file per screen
```

### Design rules baked in

- Colours: header dark green `#0B5E2F`, primary green `#128A46`, turmeric yellow
  `#FFC72C` (bike), parcel orange `#E8641B`, danger red `#D32F2F`, surface
  `#FFFDF7`, text `#1B1B1B`.
- Minimum touch target 64dp, primary buttons 72dp (Accept 120dp), body 20sp,
  headings 28sp, digits (fare, OTP, plate) 40–64sp.
- One primary action per screen; every button = emoji + short label.
- Every screen has 🔊 in the top bar (`SpeakTopBar`) that reads the screen's
  purpose in the current app language; a new request is also spoken automatically.
- 📞 buttons use `ACTION_DIAL`, so no `CALL_PHONE` permission.

## Languages

Strings live in `app/src/main/res/`:

| Folder | Language |
|---|---|
| `values/strings.xml` | English (resource default) |
| `values-te/` | Telugu — **the app's default language**. Spoken Telangana register, polite ‑ండి forms on every button ("ఒప్పుకోండి", "కాల్ చెయ్యండి", "తీసుకోండి"), first person only where the captain speaks for himself ("వచ్చాను", "తీసుకున్నాను"), short everyday words ("డబ్బులు" not "ధనం", "బండి" not "వాహనం", "దవాఖానా", "బజారు", "సాయం", "కెప్టెన్", "రైడర్"). System Noto Sans Telugu, generous line height. |
| `values-hi/` | Hindi |
| `values-kn/` | Kannada |
| `values-mr/` | Marathi |
| `values-ur/` | Urdu (RTL; `supportsRtl` is on; the slide-to-finish control is forced LTR) |

All six files contain exactly the same keys. Only `values/strings.xml` also
holds the `translatable="false"` config strings (support / WhatsApp / 112
numbers) — change them there.

The chosen language is stored in DataStore (`LocalePrefs`) and applied with
`AppCompatDelegate.setApplicationLocales`, so switching works on every API
level. `res/xml/locales_config.xml` (referenced by `android:localeConfig`) also
lists the languages so they appear in the Android 13+ per-app language setting.
Telugu is applied on first launch, before the user picks anything.

Adding a language works exactly as in the rider README (strings folder,
`locales_config.xml`, `LocalePrefs.SUPPORTED`, a tile in `LanguageScreen.kt`).

## Permissions and device features

- `CAMERA` is declared, so it is requested at runtime before
  `TakePicturePreview` (`PhotoButton`). `RECORD_AUDIO` is declared for a
  future in-app speech recogniser (nothing uses it yet). `VIBRATE` buzzes the
  phone on a new request.
- `ACCESS_FINE_LOCATION` + `ACCESS_COARSE_LOCATION`: position while online (dispatch picks
  the nearest captain; the rider sees you coming; the fare uses the GPS trail). Asked when
  the captain first taps "go online", after a Telugu rationale screen with 🔊; if denied, an
  explanation + "open settings". Tracked **only while online** (terms rule 6).
- `FOREGROUND_SERVICE` + `FOREGROUND_SERVICE_LOCATION`: `TrackingService` (type `location`).
- `POST_NOTIFICATIONS` (Android 13+, asked together with location): the online notification
  and new-ride notifications.
- `USE_FULL_SCREEN_INTENT`: a new ride over the lock screen (Android 14 may only allow a
  heads-up notification for non-calling apps); `MainActivity` turns the screen on / shows over
  the lock screen only while an offer is waiting.
- `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`: see *Battery* above.
- `ACCESS_NETWORK_STATE`: osmdroid map tiles.
- `<queries>` covers the speech recogniser, TTS engine, camera intent, the
  Google Maps package and `geo:` handlers for Android 11+ package visibility.
- 🧭 "Show the way" tries `google.navigation:q=lat,lng` in Google Maps, then any
  `geo:` app, then shows a toast.
- TTS quality depends on the installed engine. Google TTS ships Telugu, Hindi,
  Kannada and Marathi voices; Urdu may be missing, in which case the 🔊 button
  is simply silent for that language.

## Device test checklist

1. Backend running with `Otp__DevMode=true`; `manabandi.apiBaseUrl` = laptop LAN IP; debug
   APKs of both apps on two **real phones** (or one phone + emulator).
2. Captain: language → phone → grey test code → terms → KYC: take each photo (watch ⏫ → ⏳),
   enter the vehicle (try a wrong number: clear message) → Home shows "office is checking".
3. Approve the captain in the owner portal → pull Home again (or restart) → the online card.
4. Tap Online → rationale → allow location + notifications → 🟢, notification shows
   "🟢 ఆన్‌లైన్ — రైడ్ల కోసం చూస్తున్నాం"; the owner live map shows the captain.
5. Rider books nearby → within one tick (≤ 10 s) the captain phone buzzes, rings, speaks and
   opens the request with the server countdown. Also try with the captain app in the
   background and with the screen locked (full-screen / heads-up notification).
6. Let one offer time out, reject one, and accept one on two captain phones at once
   (the second gets "another captain took this ride").
7. To pickup → the map shows both pins; 🧭 opens Google Maps at the real pickup. For
   movement without driving use a **mock location app** (e.g. "Fake GPS location" /
   "Lockito" with *Developer options → Select mock location app*); the rider's map follows.
8. Arrived → wrong OTP (message) → right OTP → On trip → slide → Collect shows the fare and the
   server's commission line → Collected → Home, still online, earnings updated.
9. Parcel: pickup photo + pickup OTP, then slide → delivery photo + delivery OTP → Collect.
10. Airplane mode for a minute while online → "no network" banner; back online → the
    buffered points arrive (owner portal trail), no crash.
11. Swipe the app away during a trip → the notification stays, the rider still sees you
    moving; reopen → you are on the same step.
12. Notification "ఆఫ్‌లైన్ అవ్వండి" → offline; Help → Log out → tracking stops.
13. Xiaomi / Realme / Vivo: 🔋 card → allow; auto-start → allowed; lock the phone for 15 min
    online and check the heartbeat keeps coming (owner live map).

## Not built here — known risks

This app was written without an Android SDK (Google Maven is not reachable from the
build machine), so it has **not been built with Gradle/AGP**. What was checked instead:
the API layer was compiled with Kotlin 2.0.20 + the serialization plugin and run against
a MockWebServer with backend-shaped JSON; every Kotlin file was type-checked with the
Compose compiler plugin against JetBrains Compose 1.7 / Material3 1.3 (same API level as
BOM 2024.09.03) plus signature stubs for Android, AndroidX, Play services and osmdroid.
If the first sync or build complains, look here first:

- `kotlinOptions { }` in `app/build.gradle.kts` prints a deprecation warning
  with Kotlin 2.0 — harmless.
- `LinearProgressIndicator(progress = { … })` (lambda overload) on
  `RequestScreen` needs Material 3 ≥ 1.2, which the 2024.09.03 BOM provides.
- `SlideToFinish` positions the thumb with a `Modifier.layout { }` and
  `draggable`; if the thumb does not move on a device, switch to
  `Modifier.offset { IntOffset(...) }`.
- `mipmap-anydpi/ic_launcher.xml` is a `<layer-list>` fallback icon for API
  24-25 (no PNGs are checked in). If AAPT or lint objects, replace it with
  PNGs from Android Studio's *Image Asset* tool.
- The launch-time `runBlocking` reads of DataStore in the Application and
  `MainActivity` are tiny but synchronous.
- Android / Play-services / osmdroid calls were checked against stubs written from their
  documented signatures, not the real jars. Most worth a glance on first build:
  `ServiceCompat.startForeground(service, id, notification, FOREGROUND_SERVICE_TYPE_LOCATION)`
  (core ≥ 1.12), `NotificationCompat.Builder.setForegroundServiceBehavior`, fused
  `LocationRequest.Builder(...).setMinUpdateDistanceMeters(...)`, osmdroid
  `BoundingBox.contains(lat, lon)` and `MapView.setMinZoomLevel(Double)`.
- The maker auto-start activities in `BatteryOptimization` change between ROM versions;
  each launch is wrapped in try/catch and falls back to the battery settings list.
- The UPI QR on the Collect screen is still the placeholder `FakeQrBox` (no payment
  integration yet).

### Shared code is duplicated for now

`SpeechHelper`, `LocalePrefs` (minus the KYC keys), `ui/theme/*`,
`SpeakTopBar`, `BigButton`, `LanguageScreen`, `PhoneScreen`, `TermsScreen`, the launcher
drawables and — new in 0.2.0 — `data/api/ApiClient.kt`, `data/api/Models.kt`,
`data/api/Jpeg.kt`, `data/SessionStore.kt`, `location/LocationProvider.kt`,
`ui/components/OsmMap.kt` and `ui/components/PermissionRationale.kt` are copies of the rider app's files with only the package renamed
(and `CallButton` gained a `contentColor` parameter). Once both apps compile,
move them into a `core` Gradle module (`:core`, Android library, package
`com.manabandi.core`) that both `android/app` and `android-captain/app` depend
on, and keep only the per-app colour defaults (header green vs dark green) in
each app.

## CHANGES

### 0.2.0 — real backend, real GPS, live dispatch

- **Backend**: API contract v1 through `data/api/ApiClient.kt` (OkHttp 4.12 +
  kotlinx.serialization; same file as the rider app) and `CaptainApi.kt`.
- **Login**: real OTP (SMS / voice), dev-mode code hint, JWT in `SessionStore`, terms via
  `POST /api/me/terms`, 401 → phone screen (tracking stops).
- **KYC**: each document photo uploads immediately (`POST /api/captain/documents/{kind}`,
  JPEG ≤ 1600 px, q85; bank with UPI / IFSC / last 4), vehicle via `PUT /api/captain/vehicle`,
  status from `GET /api/captain/me` (pending → "ఆఫీసు వాళ్ళు చెక్ చేస్తున్నారు" + call office;
  rejected → reason; blocked).
- **Online**: location rationale → permission → `POST /api/captain/online` →
  `location/TrackingService.kt` (foreground, type `location`, persistent Telugu notification with
  "go offline"), fused GPS 5 s on a trip / 10 s idle / 5 m, 200-point buffer, batched heartbeat
  with exponential backoff, `TrackingRepository` StateFlow for the UI.
- **Offers** arrive with the heartbeat: buzz + ringtone + spoken, full-screen notification
  (`ride_offers`) when in the background; Request screen uses the server's `secondsLeft`;
  accept / reject endpoints; 409 `offer_expired` / `offer_taken` → friendly message.
- **Trip**: OpenStreetMap maps (you + pickup / drop), 🧭 Google Maps to the real coordinates,
  arrived / start (wrong OTP message) / finish with the current position, parcel pickup photo,
  delivery photo + delivery OTP (`/trip/deliver`), collect with the server's commission line,
  captain cancel; the trip status drives navigation and is resumed after a restart
  (`GET /api/captain/trip`); the service keeps running if the UI is closed.
- **Earnings** from `GET /api/captain/earnings`; `CommissionConfig` now only holds what the
  server sends (`CaptainMe.commission`) — the hard-coded "0 % for 3 months, then 10 %" rule
  is gone.
- **Battery** helper for Xiaomi / Realme / Vivo: ignore-battery-optimisation dialog + maker
  auto-start screens (Home card while optimised, always in Help); 🚪 Log out in Help.
- New manifest entries: `TrackingService` (`foregroundServiceType="location"`),
  `USE_FULL_SCREEN_INTENT`, `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`, `ACCESS_NETWORK_STATE`,
  `networkSecurityConfig`, `launchMode="singleTop"`; notification icon `ic_stat_bandi`.
- ~65 new strings in all six languages (Telangana Telugu, polite ‑ండి forms); distances are
  now decimals ("1.8 కి.మీ"), so `km`, `request_away`, `request_trip_km`, `request_speech`
  and the commission strings take `%s`.
- Removed: `data/FakeDispatch.kt`, the demo OTP hint and the fake place names.
- Fixed: `CaptainViewModel` called `prefs.acceptTerms()`, which did not exist in the
  captain's `LocalePrefs` (would not have compiled).
- versionName 0.2.0 / versionCode 2.
