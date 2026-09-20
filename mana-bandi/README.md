# మన బండి · Mana Bandi

**A Telugu‑first bike, auto and parcel app for small towns — starting in Narayanakhed and Zaheerabad, built for people who cannot read.**

Tagline: **పిలిస్తే చాలు, బండి వస్తుంది** — *Just call, the bandi comes.*

| | |
| --- | --- |
| 🏍️ **Bike** (turmeric yellow) | one person, in town and to nearby villages |
| 🛺 **Auto** (auto green) | family, luggage, elderly, night |
| 📦 **Parcel** (orange) | shop → home, village → town, receiver pays, OTP + photo proof |

## What is in this folder

```
mana-bandi/
  docs/01-PRODUCT.md        name, personas, services, fares, low‑literacy design principles, feature list, captain app, admin, money, metrics
  docs/02-UX-SCREENS.md     screen‑by‑screen spec with Telugu copy and what the app speaks on each screen
  docs/03-LAUNCH-PLAN.md    Narayanakhed pilot → Zaheerabad → Sangareddy district → Telangana & Andhra towns; team, cost, risks
  docs/04-ARCHITECTURE.md   apps, backend services, data model, dispatch / voice‑OTP / missed‑call / parcel COD flows
  prototype/index.html      clickable phone prototype (Telugu / English) with design notes — open in any browser
  android/                  Kotlin + Jetpack Compose starter for the rider app (te, en, hi, kn, mr, ur)
```

## The five rules the whole product follows

1. **Three taps to a ride** — vehicle picture → where (chip or speak) → book.
2. **The app talks and listens** — 🔊 on every screen reads it aloud; 🎤 fills the destination from speech.
3. **Digits are the only text people must read** — fare, OTP and vehicle number are huge; everything else is a picture plus one or two Telugu words.
4. **A person is always one tap away** — call the captain, call the town support desk, or give a missed call and we book for you.
5. **Cash is default, colours never lie** — yellow = bike, green = auto, orange = parcel, red only for cancel / SOS; the same colours are on jackets, stickers and wall paintings.

## Try the prototype

Open `prototype/index.html` in a browser (Chrome on Android gives Telugu speech and mic). Use the S0–S10 buttons to jump between screens.

## Run the Android starter

See `android/README.md`. It opens in Android Studio, defaults to Telugu, and contains every rider screen with fake data so the flows can be tested on a phone before the backend exists.

## Where the backend goes

`docs/04-ARCHITECTURE.md` reuses this repository's ASP.NET Core + PostgreSQL + WhatsApp patterns (see `../backend`) so one team can run both products.
