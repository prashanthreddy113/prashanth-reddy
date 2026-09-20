# Mana Bandi (మన బండి) — Product Design

> **One line:** A Telugu‑first bike, auto and parcel app for small towns, starting in Narayanakhed and Zaheerabad, built so that a person who cannot read can still book a ride in three taps or one phone call.

## 1. The name

| | |
| --- | --- |
| **Product name** | **Mana Bandi** — తెలుగు: **మన బండి** |
| **Meaning** | *Mana* = "our" · *Bandi* = the everyday Telangana word for a bike / auto / any vehicle ("బండి తీసుకురా", "బండి ఎక్కు"). Kannada (ಬಂಡಿ) and Marathi (बंडी) speakers around Zaheerabad and Bidar know the word too. |
| **Tagline** | **"పిలిస్తే చాలు, బండి వస్తుంది"** — *Just call, the bandi comes.* |
| **Short forms** | App icon: **మ** on green. Spoken: "Mana Bandi ki call chey" / "మన బండి బుక్ చెయ్యి". |
| **Sub‑brands** | **Mana Bandi Bike**, **Mana Bandi Auto**, **Mana Bandi Parcel** (పార్సెల్). Same app, three colours. |
| **Domain / handles** | `manabandi.in`, `@manabandiapp`. Check the Trademark Registry (Class 39 – transport, Class 9 – software) and the Play Store before printing anything. |

Why this beats alternatives that were considered (Podam, Yela, Sawari, Oorlo, Bandi Bro): it is a word every customer already says daily, it needs no explanation to a captain or a shopkeeper, it works in Telugu, Kannada, Marathi and Deccani Urdu, and "our" makes it feel local rather than a Hyderabad company arriving in town.

## 2. Who it is for

| Persona | Reality in Narayanakhed / Zaheerabad | What they need |
| --- | --- | --- |
| **Lakshmi, 52, farmer's wife** | Goes to the Tuesday santha (market), the PHC, the bank. Cannot read Telugu well. Has a keypad or cheap Android phone that her son set up. | A picture she recognises, a voice that talks to her, cash payment, a person she can call. |
| **Ravi, 24, college student / job seeker** | Travels Narayanakhed → Zaheerabad → Sangareddy for coaching, exams, interviews. Uses UPI, WhatsApp, YouTube. | Fair fixed fare, no bargaining with autos, quick pick‑up at the bus stand. |
| **Shabana, 34, kirana / cloth shop owner (Zaheerabad)** | Sends 5–15 parcels a day to villages and to the Bidar road. Pays auto drivers per trip, no tracking. | Book a parcel in a minute, receiver pays, proof of delivery, monthly bill. |
| **Srinivas, 29, captain (driver)** | Owns a Splendor or a rented auto. Earns ₹400–700/day. Has never used a gig app. Worries about petrol, commission and "company cheating". | Big green Accept button, Telugu voice, daily cash settlement, transparent commission, insurance. |
| **Anjaneyulu, 63, elderly, son in Hyderabad** | Needs to reach the RTC bus stand or the hospital. Son wants to book for him. | "Book for family" — the son books from Hyderabad, the captain calls the father. |

Population reality to design for: mandal HQ towns of 20–60 k people, villages 3–25 km away, patchy 4G, many shared phones, strong WhatsApp usage, low reading confidence in any script, high trust in phone calls and known faces.

## 3. Services

| Service | Colour | Vehicle | Typical trip | Fare model (launch) |
| --- | --- | --- | --- | --- |
| 🏍️ **Bike** (బైక్) | Turmeric yellow `#FFC72C` | Captain's two‑wheeler | Within town, town ↔ nearby village (≤ 15 km) | ₹20 base + ₹8/km, min ₹20 |
| 🛺 **Auto** (ఆటో) | Auto green `#128A46` | 3‑seater auto | Family, luggage, elderly, night | ₹30 base + ₹12/km, min ₹30; "share auto" to fixed stops later |
| 📦 **Parcel** (పార్సెల్) | Orange `#E8641B` | Bike (small/medium) or auto (big) | Shop → home, village → town, medicines, tiffin, documents | ₹30 small / ₹50 medium / ₹80 big within 5 km, + ₹8/km beyond; receiver‑pays option |
| 🚗 **Car / Taxi** (phase 2) | Blue | Shared or full car | Zaheerabad ↔ Hyderabad / Bidar, hospital trips | Fixed route rates |
| 🚜 **Goods / Tractor** (phase 3) | Brown | Tractor, DCM, Bolero | Farm produce to market, cement, seeds | Quote by captain, app takes fixed fee |

All fares are **shown before booking as a single big number in ₹**, no surge at launch (surge destroys trust in a small town), night charge +20% between 10 pm and 5 am shown as "రాత్రి ఛార్జి".

## 4. Design principles for people who cannot read

1. **Three taps to a ride.** Open → tap the vehicle picture → tap where (saved place or speak) → Book. Nothing else is mandatory.
2. **Pictures first, words second.** Every action is an icon or emoji plus one or two Telugu words. Vehicles are photos/illustrations of the real vehicles seen in town, not abstract icons.
3. **The app talks.** A 🔊 button on every screen reads the screen aloud (Android TextToSpeech in Telugu/Hindi/Kannada/Marathi/Urdu). Key moments (captain found, captain arrived, fare) are spoken automatically.
4. **The app listens.** Destination can be spoken: "బస్టాండ్‌కి" fills the drop field. Landmarks work ("పాత పోలీస్ స్టేషన్ దగ్గర", "సాయిబాబా గుడి").
5. **Big, few, fixed.** Minimum 64 dp touch targets, 20 sp text, one primary button per screen, buttons never move between screens.
6. **Colour means something.** Yellow = bike, green = auto, orange = parcel, red = cancel/SOS only. Same colours on the app, the captain's jacket, the sticker on the vehicle and the posters in town.
7. **A phone number is always one tap away.** Call the captain, call support (a real person in Narayanakhed who speaks Telugu), and a **missed‑call booking** line: give a missed call, we call back and book for you.
8. **Cash is default.** UPI is offered, never forced. No wallet at launch.
9. **Works when the network doesn't.** Booking retries in the background, last captain's number is cached, SMS fallback for the OTP and for "captain on the way".
10. **Someone else can book for you.** "కుటుంబం కోసం బుక్ చెయ్యి" — book for a family member with their phone number; the captain calls them, the booker sees the trip.
11. **No account walls.** Only a phone number and an OTP (which can be delivered by a voice call). Name is optional; "అమ్మ" is a fine name.
12. **Numbers are the only text people rely on.** Vehicle number, OTP and fare are shown in 40 sp+ digits because even non‑readers recognise digits.

## 5. Feature list — rider app (v1)

**Onboarding**
- Language picker in native scripts (తెలుగు default, English, हिंदी, ಕನ್ನಡ, मराठी, اردو) with a spoken greeting.
- Phone + 4‑digit OTP; "📞 Call me with OTP" for those who cannot read SMS.
- Optional: name, a photo, home location saved by "I am at home now".

**Home**
- Three giant service cards (Bike, Auto, Parcel).
- Saved places with icons: 🏠 Home, 🚌 Bus stand, 🏥 Hospital / PHC, 🛒 Market / Santha, 🏫 School / College, 🏛️ Mandal office, 🛕 Temple / Masjid / Church. Seeded per town by the ops team so they work on day one.
- "Book for family" entry point.

**Booking**
- Pickup auto‑filled from GPS with the nearest landmark name; "I am somewhere else" opens a simple map with big pins.
- Drop: saved place, spoken, typed, or "tell the captain on the phone" (captain calls after accept; fare then set by distance at end).
- Fare shown upfront; cash/UPI choice; night charge visible.
- Finding captain animation with sound; automatic re‑dispatch; if no captain in 90 s, offer "call support to arrange".

**During ride**
- Captain card: photo, name, vehicle number in huge digits, star rating, **📞 Call**, ❌ Cancel, 🆘 SOS (dials 112 and sends location to a trusted contact by SMS).
- Live location of the captain on a map, plus a spoken "captain is 2 minutes away".
- Ride OTP: 4 big digits the rider tells the captain (prevents wrong pickups).
- Share trip on WhatsApp.

**After ride**
- Fare in big digits, "paid cash ✔" tap for the captain, optional 1‑tap rating (😊 😐 😞), tip in ₹10 steps.
- Ride history with icons and dates; receipt on WhatsApp.

**Parcel**
- 3‑step wizard: Where (receiver phone + drop, mic supported) → What (Small 🍱 / Medium 📦 / Big 🧳, photo) → Who pays (me / receiver).
- Pickup OTP and delivery OTP; photo proof at delivery; receiver gets a WhatsApp/SMS link with live tracking and captain number.
- Cash on delivery: receiver pays fare (and optionally the goods value up to ₹2,000 to the shop — phase 2, needs escrow).
- Shop mode: bulk booking list, monthly statement, favourite receivers.
- Town‑to‑town parcel (Narayanakhed ↔ Zaheerabad ↔ Sangareddy ↔ Hyderabad): batched on scheduled captains twice a day, tracked with the same OTP flow.

**Help**
- 📞 Call support (local number, 6 am–11 pm), 💬 WhatsApp support, language change, 3 pictograph rows on "how to book", and a "teach me" mode that talks through a demo booking.

## 6. Captain (driver) app — v1

- Same design language, dark green header, Telugu voice for every event ("కొత్త రైడ్ వచ్చింది").
- Onboarding in person at the town hub: Aadhaar, DL, RC, photo, bank/UPI; ops team registers them in 10 minutes.
- **Go online** toggle; request screen shows pickup landmark, distance to pickup, fare, and a 15‑second **✅ Accept** button that fills the whole lower half.
- Navigation via Google Maps intent; rider phone one tap.
- Enter rider OTP (4 huge digits) to start; slide to end; collect cash / show UPI QR.
- Earnings today / this week in big digits; daily settlement (cash trips reduce what we owe; UPI trips paid out T+1).
- Commission: **0% for the first 3 months in a town, then 10%**, shown per trip. Incentives: ₹100 for 8 trips/day in the first months.
- Safety: SOS, insurance (personal accident cover through a group policy), helmet & jacket kit at joining.
- Parcel mode: photo at pickup and delivery, delivery OTP, COD collection reminder.

## 7. Operations / admin (web, v1)

- Town dashboard: online captains, open requests, fulfilment rate, average pickup time, cancellations.
- Manual dispatch console for the support person: create a booking from a phone call, assign a captain, send the SMS.
- Captain KYC & documents, blocking, incentives, settlements.
- Fare tables per town; saved places per town; promo codes; broadcast messages (WhatsApp templates).
- Parcel board: all parcels, status, COD collected, disputes.
- Reuses the pattern of the existing BrightLoop admin (React + .NET) in this repo so the team has one backend style.

## 8. Monetisation

| Stream | When |
| --- | --- |
| Commission per ride/parcel — **set by the owner in the portal** (default 10%, 0% free months for new captains, overridable per town, per service or per captain, with an effective date; shown to captains on every trip) | Month 4 in each town |
| Parcel B2B: shop subscription ₹499/month for unlimited bookings + statement | Month 3 |
| Captain kit (jacket, sticker, helmet) at cost | Day 1 |
| Town‑to‑town scheduled parcel: fixed ₹60–150 per parcel | Month 3 |
| Ads on receipts/WhatsApp for local shops, hospitals, coaching centres | Month 6 |
| Phase 2: intercity car pooling to Hyderabad, goods vehicles | Year 2 |

## 9. What v1 deliberately leaves out

Surge pricing, wallets, in‑app chat (phone calls instead), food delivery, rider‑to‑rider referrals, a web booking site, iOS. Each of these either breaks trust in a small town or costs more than it earns before 5,000 monthly rides.

## 10. Success metrics for the first 90 days (Narayanakhed + Zaheerabad)

| Metric | Target |
| --- | --- |
| Registered captains | 60 (40 bike, 20 auto) |
| Daily rides + parcels | 300 by day 90 |
| Fulfilment (request → captain accepted) | > 85% |
| Median pickup time | < 6 minutes in town |
| Bookings by voice or missed call | > 25% (tells us non‑readers are using it) |
| Repeat customers (2+ rides in 30 days) | > 40% |
| Rider rating | > 4.6 / 5 |
