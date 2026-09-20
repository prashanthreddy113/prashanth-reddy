# Mana Bandi (మన బండి) — Android captain (driver) app

Starter Android app (Kotlin + Jetpack Compose, Material 3) for the **captains**
(bike / auto drivers) of **Mana Bandi**, the Rapido-style ride + parcel app for
small Telangana towns (Narayanakhed, Zaheerabad). It is the sibling of the rider
app in `../android` and follows the same rules: big tiles, one primary action
per screen, an emoji on every button, a 🔊 button on every screen that reads the
screen aloud, Telugu by default. The header is **dark green** (`#0B5E2F`) and the
launcher icon background is dark green too, so a captain who has both apps can
tell them apart at a glance.

Everything here is a **UI demo with fake data** — there is no backend, any OTP is
accepted, ride requests are invented by `FakeDispatch`, photos stay in memory and
nothing is uploaded. It is meant to be the base to build on.

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

Identical to the rider app on purpose (same `gradle/libs.versions.toml`).

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
| `phone` | `PhoneScreen` | 10-digit number, 32sp |
| `otp` | `OtpScreen` | 4 boxes, "📞 Call me with OTP" stub, any code works |
| `kyc` | `KycScreen` | "Register at the office": 🪪 Aadhaar, 🚗 licence, 📄 RC, 📷 photo, 🏦 bank/UPI rows, each with 📷 Take photo (✅ when taken); 🏍️/🛺 vehicle type; vehicle number (uppercase, 32sp); 📞 Call office; ✅ Done marks KYC as submitted in DataStore |
| `home` | `HomeScreen` | giant 🔴 OFFLINE / 🟢 ONLINE toggle card (pulsing ring when online), today's earnings in 48sp, trips, 💰 Earnings / 📞 Office, bottom bar. **Demo:** 4 s after going online a fake request arrives (8 s after each finished trip): the phone buzzes, the request is spoken ("కొత్త రైడ్: బస్టాండ్ నుంచి 2 కి.మీ, 45 రూపాయలు") and the request screen opens |
| `request` | `RequestScreen` | full screen tinted by service (yellow bike / green auto / orange parcel): pickup + distance in 34sp, drop, ₹ fare in 56sp, 💵/📱; giant **✅ ఒప్పుకోండి** (120dp) with a 15 s countdown bar; small ❌. Timeout → home |
| `to_pickup` | `ToPickupScreen` | fake map box, rider name + phone, **📞 Call rider**, **🧭 Show the way** (Google Maps navigation intent → `geo:` fallback → toast), **✅ I have arrived** |
| `enter_otp` | `EnterOtpScreen` | "Enter the 4 digits the rider says": four 56sp boxes + numeric keyboard; parcel: pickup OTP + 📷 parcel photo. Any code works |
| `on_trip` | `OnTripScreen` | drop landmark in 40sp, distance, 🧭 navigate, **slide-to-finish** (plain `draggable`, fires past 80 %), 🆘 SOS (dials 112) |
| `collect` | `CollectScreen` | "₹45 క్యాష్ తీసుకోండి 💵" in 64sp, or 📱 QR (placeholder drawn with `Canvas`); parcel: 📷 delivery photo + delivery OTP first; **✅ తీసుకున్నాను** adds the fare to today's earnings and returns home (still online) |
| `earnings` | `EarningsScreen` | today / this week / office owes you in 40sp, today's trips (emoji, time, fare), "కమీషన్ 0% (మొదటి 3 నెలలు)", 📞 Call office |
| `help` | `HelpScreen` | 📞 call office, 💬 WhatsApp (`wa.me`), 🌐 change language, 3 pictograph "how it works" rows |

Trip steps replace each other above `home` (`navigateStep`), so hardware Back
during a trip returns to Home, never to a finished step.

Shared state lives in `CaptainViewModel` (Activity scoped, so it survives the
recreation that a language change causes): online flag, current `RideRequest`,
earnings / trips today, settlement due (UPI fares the office still pays out),
trip log, KYC photos + vehicle. `data/FakeDispatch.kt` rotates through three
fixed requests (bike from the bus stand, auto from the hospital, parcel from the
market) with Narayanakhed-area coordinates (~18.03, 77.75).

### Code layout

```
app/src/main/java/com/manabandi/captain/
  MainActivity.kt                 splash + edge-to-edge + start destination
  ManaBandiCaptainApplication.kt  creates LocalePrefs + SpeechHelper, applies saved locale
  ManaBandiCaptainApp.kt          NavHost + Routes
  CaptainViewModel.kt             online / request / earnings / KYC state shared by screens
  data/LocalePrefs.kt             DataStore (language, login, KYC done, vehicle) + locale helpers
  data/FakeDispatch.kt            Service, Payment, VehicleType, KycDoc, RideRequest, TripLogEntry, fake requests
  speech/SpeechHelper.kt          TextToSpeech wrapper (queues until ready, silent if unsupported)
  ui/theme/                       Color.kt, Type.kt (20sp body / 28sp headings), Theme.kt
  ui/components/                  SpeakTopBar (🔊, dark green), BigButton (72dp) / SecondaryButton / CallButton,
                                  BottomBar (🏠 💰 📞), OtpEntry (4 boxes + hidden field), PhotoButton (camera
                                  permission + TakePicturePreview), SlideToFinish, FakeQrBox, Navigate
                                  (NavigateButton + openNavigation), Vibrate (vibrateNewRequest)
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
- `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`, `FOREGROUND_SERVICE`,
  `FOREGROUND_SERVICE_LOCATION` and `POST_NOTIFICATIONS` are declared **for a
  later step**: the "captain is online" location foreground service is not
  implemented, no service is declared and no location permission is requested
  at runtime yet.
- `<queries>` covers the speech recogniser, TTS engine, camera intent, the
  Google Maps package and `geo:` handlers for Android 11+ package visibility.
- 🧭 "Show the way" tries `google.navigation:q=lat,lng` in Google Maps, then any
  `geo:` app, then shows a toast.
- TTS quality depends on the installed engine. Google TTS ships Telugu, Hindi,
  Kannada and Marathi voices; Urdu may be missing, in which case the 🔊 button
  is simply silent for that language.

## Not built here — known risks

This scaffold was written without an Android SDK available, so it has **not
been compiled**. The dependency set is the same as the rider app. If the first
sync or build complains, look here first:

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

### Shared code is duplicated for now

`SpeechHelper`, `LocalePrefs` (minus the KYC keys), `ui/theme/*`,
`SpeakTopBar`, `BigButton`, `LanguageScreen`, `PhoneScreen` and the launcher
drawables are copies of the rider app's files with only the package renamed
(and `CallButton` gained a `contentColor` parameter). Once both apps compile,
move them into a `core` Gradle module (`:core`, Android library, package
`com.manabandi.core`) that both `android/app` and `android-captain/app` depend
on, and keep only the per-app colour defaults (header green vs dark green) in
each app.
