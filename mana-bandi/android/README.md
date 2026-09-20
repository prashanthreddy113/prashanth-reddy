# Mana Bandi (మన బండి) — Android rider app

Starter Android app (Kotlin + Jetpack Compose, Material 3) for **Mana Bandi**, a
Rapido-style bike / auto ride + parcel app for small Telangana towns
(Narayanakhed, Zaheerabad). It is designed for people who cannot read well:
big tiles, one primary action per screen, an emoji on every button, a 🔊 button
on every screen that reads the screen aloud, and a 🎤 mic wherever a place name
is needed.

Everything here is a **UI demo with fake data** — there is no backend, any OTP is
accepted and the captain is invented. It is meant to be the base to build on.

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

## What is in the app

Single `MainActivity` (an `AppCompatActivity`, needed for per-app language on
Android 12 and below) hosting a Navigation Compose graph in `ManaBandiApp.kt`:

| Route | Screen | Notes |
|---|---|---|
| `language` | `LanguageScreen` | 6 tiles in native script; tapping speaks a greeting in that language and continues |
| `phone` | `PhoneScreen` | 10-digit number, 32sp |
| `otp` | `OtpScreen` | 4 boxes, "📞 Call me with OTP" stub, any code works |
| `terms` | `TermsScreen` | six pictograph rules read aloud, "✅ I agree"; shown once per `LocalePrefs.TERMS_VERSION` (bump it to re‑ask everyone) |
| `home` | `HomeScreen` | 🏍️ Bike (yellow) / 🛺 Auto (green) / 📦 Parcel (orange) + saved-place chips + bottom bar |
| `book/{service}` | `BookRideScreen` | pickup auto-filled, drop with 🎤 mic, fare card, 💵 Cash / 📱 UPI |
| `parcel` | `ParcelScreen` | 3-step wizard: where → what (size + 📷 photo) → who pays |
| `finding` | `FindingCaptainScreen` | pulsing circle, 3 s, then ride |
| `ride` | `RideScreen` | captain, huge vehicle number, 4-digit OTP, 📞 Call, 👨‍👩‍👧 Share trip with family (system share sheet → WhatsApp/SMS with captain, vehicle, drop, tracking link), ❌ Cancel / 🆘 SOS (dials 112) |
| `rides` | `MyRidesScreen` | 3 fake past rides |
| `help` | `HelpScreen` | 📞 call, 💬 WhatsApp (`wa.me`), 🌐 change language, 3 pictograph "how to" rows |

Shared state for the in-progress booking lives in `RideViewModel` (Activity
scoped, so it survives the recreation that a language change causes).

### Code layout

```
app/src/main/java/com/manabandi/rider/
  MainActivity.kt            splash + edge-to-edge + start destination
  ManaBandiApplication.kt    creates LocalePrefs + SpeechHelper, applies saved locale
  ManaBandiApp.kt            NavHost + Routes
  RideViewModel.kt           booking state shared by screens
  data/LocalePrefs.kt        DataStore (language, login) + locale helpers
  data/FakeRides.kt          demo data, fake fare model (₹20 + ₹8/km bike, ₹30 + ₹12/km auto)
  speech/SpeechHelper.kt     TextToSpeech wrapper (queues until ready, silent if unsupported)
  ui/theme/                  Color.kt, Type.kt (20sp body / 28sp headings), Theme.kt
  ui/components/             SpeakTopBar (🔊), BigButton (72dp) / SecondaryButton / CallButton,
                             ServiceCard, PlaceChip + SavedPlacesRow, MicButton, BottomBar
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

- `RECORD_AUDIO` and `CAMERA` are declared. Speech-to-text uses the system
  `RecognizerIntent` (no runtime audio permission needed); the camera is
  requested at runtime before `TakePicturePreview` because a declared `CAMERA`
  permission must be granted before `ACTION_IMAGE_CAPTURE`.
- `<queries>` covers the speech recogniser, TTS engine and camera intents for
  Android 11+ package visibility.
- TTS quality depends on the installed engine. Google TTS ships Telugu, Hindi,
  Kannada and Marathi voices; Urdu may be missing, in which case the 🔊 button
  is simply silent for that language.

## Not built here — known risks

This scaffold was written without an Android SDK available, so it has **not
been compiled**. The dependency set is a standard, widely used combination.
If the first sync or build complains, look here first:

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
