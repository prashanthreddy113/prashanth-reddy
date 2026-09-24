# Mana Bandi (మన బండి) — Android rider app

Starter Android app (Kotlin + Jetpack Compose, Material 3) for **Mana Bandi**, a
Rapido-style bike / auto ride + parcel app for small Telangana towns
(Narayanakhed, Zaheerabad). It is designed for people who cannot read well:
big tiles, one primary action per screen, an emoji on every button, a 🔊 button
on every screen that reads the screen aloud, and a 🎤 mic wherever a place name
is needed.

Since v0.2.0 the app talks to the real backend (API contract v1,
`mana-bandi/docs/07-API.md`) and uses **real GPS**: OTP login, server fares,
real captains, live captain position on an OpenStreetMap map, ride history.
Nothing is faked any more (`data/FakeRides.kt` is gone).

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

No Retrofit, no Firebase. `buildConfig = true` (for `BuildConfig.API_BASE_URL`).

Package naming: the **applicationId is `in.manabandi.rider`** but the **Kotlin
package / namespace is `com.manabandi.rider`**, because `in` is a Kotlin keyword
and back-ticked package segments are fragile in tooling. Both are set in
`app/build.gradle.kts`.

## Open and run

1. Install Android Studio (Koala or newer) with the Android 35 SDK.
2. **Gradle wrapper jar**: the binary `gradle/wrapper/gradle-wrapper.jar` is
   intentionally not checked in. Generate it once, from this folder, with any
   locally installed Gradle (8.x):

   ```bash
   cd mana-bandi/android
   gradle wrapper --gradle-version 8.7
   ```

   After that, `./gradlew` works (and Android Studio will use it).
   Android Studio can also do this for you when it offers to "fix" the wrapper.
3. *File → Open* → select `mana-bandi/android`.
4. Let Gradle sync, then run the `app` configuration on an emulator or a phone
   (a real phone is better: speech recognition, TTS and the camera need Google
   apps that many emulator images lack).

Command line: `./gradlew :app:assembleDebug` then
`adb install app/build/outputs/apk/debug/app-debug.apk`.

## Point the app at a backend

`BuildConfig.API_BASE_URL` is set in `app/build.gradle.kts`:

| Build | Default | Notes |
|---|---|---|
| debug | `http://10.0.2.2:5080` | the backend on your laptop, seen from the **emulator** |
| release | `https://api.manabandi.in` | production, HTTPS only |

Override it without touching code, e.g. to test on a **real phone** on the same Wi‑Fi
as the laptop running the backend:

```properties
# android/local.properties (not committed)
manabandi.apiBaseUrl=http://192.168.1.20:5080
```

or `./gradlew :app:assembleDebug -Pmanabandi.apiBaseUrl=http://192.168.1.20:5080`.
(`adb reverse tcp:5080 tcp:5080` + `http://localhost:5080` also works over USB.)

Cleartext rules (`res/xml/network_security_config.xml`): **release = HTTPS only**. The debug
copy (`src/debug/res/xml/`) allows plain http, and `ApiClient.isCleartextAllowed()` then
only accepts the emulator host, localhost or a private LAN address (10.x, 192.168.x,
172.16–31.x) — network-security-config cannot express IP ranges itself.

To see OTP codes while testing, run the backend with `Otp__DevMode=true`: the code then
comes back in the response and the OTP screen shows it as a small grey "Test code" hint.

## How it talks to the server

| Screen / moment | Endpoint(s) |
|---|---|
| Phone → OTP | `POST /api/auth/otp/request` (sms; "📞 Call me" = `channel: call`), `POST /api/auth/otp/verify` |
| Terms "I agree" | `POST /api/me/terms {version}` (skipped when `user.termsVersionAccepted` is current) |
| Home | `GET /api/rides/active` (resume a running ride after a restart); landmark chips from the town |
| Book / parcel pickup | GPS fix → `GET /api/rider/towns/nearest` → pickup = nearest landmark ≤ 300 m, else "📍 where you are"; outside the area → friendly message + town support number |
| Fare card | `POST /api/rider/quote` on every pickup / drop / service / parcel-size change |
| Book | `POST /api/rides` with a UUID `clientId` kept for the whole booking, so a retry never creates a second ride; parcel photo → `POST /api/rides/{id}/parcel-photo` |
| Finding / ride | `GET /api/rides/{id}` every 3 s while the screen is open; `no_captain` → 📞 call support / 🔁 try again (new booking) |
| Ride | `POST /api/rides/{id}/cancel`, `POST /api/rides/{id}/sos {lat,lng}` (then the phone dials 112), share = server `trackUrl` |
| Done | `POST /api/rides/{id}/rate {stars, tip}` (😊 5 / 😐 3 / 😞 1, tip ₹10 / ₹20) |
| My rides | `GET /api/rides?mine=1&limit=20` |

Errors come back as problem JSON; `ApiError` maps each `code` (`outside_area`,
`invalid_otp`, `terms_required`, …) to a class and every screen shows a short, spoken-style
message. A **401 clears the session and returns to the phone screen**.

## What is in the app

Single `MainActivity` (an `AppCompatActivity`, needed for per-app language on
Android 12 and below) hosting a Navigation Compose graph in `ManaBandiApp.kt`:

| Route | Screen | Notes |
|---|---|---|
| `language` | `LanguageScreen` | 6 tiles in native script; tapping speaks a greeting in that language and continues |
| `phone` | `PhoneScreen` | 10-digit number, 32sp; sends the OTP |
| `otp` | `OtpScreen` | 4 boxes, "📞 Call me with OTP" (voice OTP), grey test-code hint only in dev mode |
| `terms` | `TermsScreen` | six pictograph rules read aloud, "✅ I agree"; shown once per `LocalePrefs.TERMS_VERSION` (bump it to re‑ask everyone) |
| `home` | `HomeScreen` | 🏍️ Bike (yellow) / 🛺 Auto (green) / 📦 Parcel (orange) + the town's landmark chips (from the server) + bottom bar |
| `book/{service}` | `BookRideScreen` | location rationale → GPS pickup + small map, drop by landmark chip / 🎤 (matched to landmark names) / typing suggestions / tapping the map, server fare, 💵 Cash / 📱 UPI |
| `parcel` | `ParcelScreen` | 3-step wizard: pickup + receiver + drop → size + 📷 photo → who pays + server fare |
| `finding` | `FindingCaptainScreen` | pulsing circle while `searching`; `no_captain` → call support / try again |
| `ride` | `RideScreen` | live map (captain pin moves), ETA, captain + model + rating, huge vehicle number, ride OTP (parcel: pickup + delivery OTP), 📞 Call, 👨‍👩‍👧 Share trip (server `trackUrl`), ❌ Cancel (confirm), 🆘 SOS; on `finished`: fare + 😊😐😞 rating + tip |
| `rides` | `MyRidesScreen` | real history |
| `help` | `HelpScreen` | 📞 call, 💬 WhatsApp (`wa.me`), 🌐 change language, 3 pictograph "how to" rows |

Shared state for the in-progress booking lives in `RideViewModel` (Activity
scoped, so it survives the recreation that a language change causes).

### Code layout

```
app/src/main/java/com/manabandi/rider/
  MainActivity.kt            splash + edge-to-edge + start destination
  ManaBandiApplication.kt    creates LocalePrefs, SpeechHelper, SessionStore, RiderApi, LocationProvider; osmdroid config
  ManaBandiApp.kt            NavHost + Routes
  RideViewModel.kt           login, GPS pickup, booking, active ride (polling), history
  data/LocalePrefs.kt        DataStore (language, accepted terms) + locale helpers
  data/SessionStore.kt       DataStore: JWT + user; StateFlow the UI watches (401 → logout)
  data/Types.kt              Service / Payment / ParcelSize / Payer (+ contract values), place names, formatting
  data/api/ApiClient.kt      OkHttp + kotlinx.serialization, headers, timeouts, problem JSON → sealed ApiError
  data/api/Models.kt         @Serializable request / response classes = contract JSON field names
  data/api/RiderApi.kt       one suspend function per rider endpoint
  data/api/Jpeg.kt           photo → JPEG ≤ 1600 px, quality 85
  location/LocationProvider.kt  fused GPS (current fix with timeout, callbackFlow of updates),
                             permission helpers, rememberLocationPermissionLauncher
  speech/SpeechHelper.kt     TextToSpeech wrapper (queues until ready, silent if unsupported)
  ui/theme/                  Color.kt, Type.kt (20sp body / 28sp headings), Theme.kt
  ui/components/             SpeakTopBar (🔊), BigButton (72dp) / SecondaryButton / CallButton,
                             ServiceCard, PlaceChip + LandmarkChipsRow, MicButton, BottomBar,
                             OsmMap (osmdroid in Compose), PermissionRationale + LocationPermissionGate
  ui/screens/                one file per screen
```

### Design rules baked in

- Colours: primary green `#128A46`, turmeric yellow `#FFC72C` (bike), parcel orange
  `#E8641B`, danger red `#D32F2F`, surface `#FFFDF7`, text `#1B1B1B`.
- Minimum touch target 64dp, primary buttons 72dp, body 20sp, headings 28sp.
- One primary action per screen; every button = emoji + short label.
- Every screen has 🔊 in the top bar (`SpeakTopBar`) that reads the screen's
  purpose in the current app language.
- A big green 📞 Call button wherever a captain is involved (`CallButton`,
  uses `ACTION_DIAL`, so no `CALL_PHONE` permission).

## Languages

Strings live in `app/src/main/res/`:

| Folder | Language |
|---|---|
| `values/strings.xml` | English (resource default) |
| `values-te/` | Telugu — **the app's default language**. Spoken Telangana register, polite ‑ండి forms on every button ("పంపండి", "పిలవండి"), short words ("మధ్యది" not "మధ్యస్థం"). The system Noto Sans Telugu font is used on purpose: no decorative fonts, generous line height so vottu marks are never clipped. |
| `values-hi/` | Hindi |
| `values-kn/` | Kannada |
| `values-mr/` | Marathi |
| `values-ur/` | Urdu (RTL; `supportsRtl` is on) |

All six files contain exactly the same keys. Only `values/strings.xml` also
holds the `translatable="false"` config strings (support / WhatsApp / 112
numbers) — change them there.

The chosen language is stored in DataStore (`LocalePrefs`) and applied with
`AppCompatDelegate.setApplicationLocales`, so switching works on every API
level. `res/xml/locales_config.xml` (referenced by `android:localeConfig`) also
lists the languages so they appear in the Android 13+ per-app language setting.
Telugu is applied on first launch, before the user picks anything (from `ManaBandiApplication` on Android 12 and below, and again from `MainActivity` on Android 13+, where the call needs an attached Activity).

### Adding a language

1. Add `res/values-<tag>/strings.xml` with every key from `values/strings.xml`
   (except the `translatable="false"` ones).
2. Add `<locale android:name="<tag>" />` to `res/xml/locales_config.xml`.
3. Add the tag to `LocalePrefs.SUPPORTED` and, if speech-to-text needs a region,
   to `LocalePrefs.speechTag()`.
4. Add a tile to `languageOptions` in `ui/screens/LanguageScreen.kt` (native
   name + spoken greeting).

## Permissions and device features

- `ACCESS_FINE_LOCATION` + `ACCESS_COARSE_LOCATION`: the pickup is where the rider stands,
  and the town (landmarks, fares, support number) comes from that position. Asked only on
  the booking screens, **after** a Telugu-first rationale screen (big 📍, one sentence, 🔊
  reads it). If denied: a short explanation + "⚙️ Open settings". No background location.
- `INTERNET`, `ACCESS_NETWORK_STATE` (osmdroid checks the network before loading tiles).
- `RECORD_AUDIO` and `CAMERA` are declared. Speech-to-text uses the system
  `RecognizerIntent` (no runtime audio permission needed); the camera is
  requested at runtime before `TakePicturePreview` because a declared `CAMERA`
  permission must be granted before `ACTION_IMAGE_CAPTURE`.
- `<queries>` covers the speech recogniser, TTS engine and camera intents for
  Android 11+ package visibility.
- TTS quality depends on the installed engine. Google TTS ships Telugu, Hindi,
  Kannada and Marathi voices; Urdu may be missing, in which case the 🔊 button
  is simply silent for that language.

## Maps

OpenStreetMap through osmdroid (`ui/components/OsmMap.kt`) — no API key, no Google Maps
SDK. The user agent is the application id (OSM tile policy); tiles are cached in the app's
cache folder; "© OpenStreetMap" is shown on every map. Pins are emoji on a white disc
(🧍 pickup, 🏁 drop, 🏍️/🛺 captain) and glide when the captain moves. For a busy launch,
point osmdroid at your own tile server or a paid OSM tile provider (heavy use of
tile.openstreetmap.org is not allowed by its policy).

## Device test checklist

1. Start the backend (`Otp__DevMode=true`), seed a town whose centre is near you, set
   `manabandi.apiBaseUrl` to the laptop's LAN IP, install the debug APK on a **real phone**.
2. Language → phone → the grey test code appears → terms → Home.
3. Bike → rationale screen → allow → pickup shows a landmark (within 300 m) or
   "📍 మీరున్న చోటు"; the map shows 🧍.
4. Drop: tap a landmark chip, say a landmark name into 🎤, type part of a name, and tap the
   map — each gives a fare card from the server.
5. Deny location once, then "don't ask again": the explanation + "Open settings" shows.
6. Turn GPS off → "turn on location" card. Stand outside the town radius (or use a mock
   location app) → the friendly "not here yet" card with the town's number.
7. Book with the captain app online nearby → Finding → Ride: captain name, plate, OTP; the
   captain pin moves on the map (use a **mock location app** such as "Fake GPS location" on
   the captain phone with *Developer options → Select mock location app*).
8. Share trip → WhatsApp shows the server tracking link; open it in a browser.
9. SOS → the dialer opens with 112 (do not call); the owner dashboard shows the SOS.
10. Kill the app during a ride and reopen → it returns to the ride (`/api/rides/active`).
11. Nobody accepts for 90 s → "no captain" → Try again / Call support.
12. Parcel: receiver, drop, size, photo, who pays → the captain sees the parcel; delivery OTP
    shows on the rider's ride screen.
13. Airplane mode during a ride → "weak network" banner, recovers by itself.
14. Revoke the token on the server (or wait for expiry) → next call returns 401 → phone screen.

## Not built here — known risks

This app was written without an Android SDK (Google Maven is not reachable from the
build machine), so it has **not been built with Gradle/AGP**. What was checked instead:
the API layer (`data/api/*`) was compiled with Kotlin 2.0.20 + the serialization plugin
and run against a MockWebServer with backend-shaped JSON; every Kotlin file was
type-checked with the Compose compiler plugin against JetBrains Compose 1.7 / Material3 1.3
(the same API level as BOM 2024.09.03) plus signature stubs for Android, AndroidX,
Play services and osmdroid. If the first sync or build complains, look here first:

- `kotlinOptions { }` in `app/build.gradle.kts` prints a deprecation warning
  with Kotlin 2.0 — harmless. (Switch to `kotlin { compilerOptions { } }` if
  you prefer.)
- `mipmap-anydpi/ic_launcher.xml` is a `<layer-list>` fallback icon for API
  24-25 (no PNGs are checked in). If AAPT or lint objects, replace it with
  PNGs from Android Studio's *Image Asset* tool.
- `LocalePrefs.applyLocale` is called from `Application.onCreate`. AppCompat
  documents this as unnecessary when `autoStoreLocales` is on (the manifest
  enables it), but it is what guarantees Telugu on the very first launch.
- The launch-time `runBlocking` reads of DataStore in `ManaBandiApplication`
  and `MainActivity` are tiny but synchronous; move to a splash-held state if
  they ever show up in startup traces.
- Android / Play-services / osmdroid calls were checked against stubs written from their
  documented signatures, not the real jars. The ones most worth a glance on first build:
  osmdroid `BoundingBox.contains(lat, lon)`, `MapView.setMinZoomLevel(Double)`,
  `IConfigurationProvider.osmdroidBasePath / osmdroidTileCache / userAgentValue`,
  fused `getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, token)` and
  `LocationRequest.Builder(...).setMinUpdateDistanceMeters(...)`.
- ProGuard/R8 is still off (`isMinifyEnabled = false`). Before turning it on add the
  kotlinx.serialization and OkHttp keep rules.

## CHANGES

### 0.2.0 — real backend + real GPS

- **Backend**: every screen now uses API contract v1 (`docs/07-API.md`) through
  `data/api/ApiClient.kt` (OkHttp 4.12 + kotlinx.serialization, `ignoreUnknownKeys`,
  `explicitNulls = false`, 15 s timeouts, `Authorization` / `X-App-Version` /
  `Accept-Language` headers, problem-JSON `code` → sealed `ApiError`).
- **Login**: real OTP request / verify (SMS or 📞 voice call), dev-mode code shown as a grey
  hint, JWT + user in `SessionStore` (DataStore); a 401 anywhere logs out to the phone screen.
  Terms acceptance is recorded with `POST /api/me/terms`.
- **GPS pickup**: rationale screen → permission → fused high-accuracy fix → nearest town →
  nearest landmark within 300 m, else "📍 మీరున్న చోటు"; friendly "not here yet" card with the
  town's support number; "turn on GPS" card.
- **Drop**: landmark chips from the town (no more hard-coded Home / Bus stand / Hospital /
  Market chips), 🎤 speech matched to landmark names, typed suggestions, or a tap on the map.
- **Fares** from `POST /api/rider/quote` (🌙 night fare, captain ETA when known).
- **Booking** with an idempotent UUID `clientId`; parcel fields + photo upload.
- **Finding** polls every 3 s; `no_captain` → call support / try again.
- **Ride**: live OpenStreetMap map with the captain moving, ETA, real captain / vehicle /
  OTP, delivery OTP for parcels, share with the server's `trackUrl`, cancel with a confirm
  dialog, SOS posts the location then dials 112, rating (😊 😐 😞) + tip on finish.
- **Resume** a running ride after the app was closed (`GET /api/rides/active`).
- **My rides** from `GET /api/rides?mine=1`.
- New: `BuildConfig.API_BASE_URL` (+ `manabandi.apiBaseUrl` override), network security
  config (release HTTPS only), `ACCESS_FINE/COARSE_LOCATION`, `ACCESS_NETWORK_STATE`,
  osmdroid maps, ~60 new strings in all six languages (Telangana Telugu, polite ‑ండి forms).
- Removed: `data/FakeRides.kt`, the demo OTP hint and the fixed saved-place strings.
- Fixed: `MicButton.kt` used `stringResource` without importing it (would not have compiled).
- versionName 0.2.0 / versionCode 2.
