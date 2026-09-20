# Mana Bandi — Screen‑by‑screen UX (rider app)

Everything below is written to be handed to a designer and a developer. Telugu strings are the primary copy; English is the developer's reference. Every screen has the 🔊 **speak** button in the top‑right, which reads the *Voice* line aloud.

## Global rules

| Rule | Value |
| --- | --- |
| Touch target | ≥ 64 dp; primary button 72 dp tall, full width |
| Text | Body 20 sp, label 22 sp, heading 28 sp, digits (fare, OTP, vehicle number) 40–56 sp |
| Fonts | Noto Sans Telugu / Noto Sans (Devanagari, Kannada, Urdu Nastaliq via Noto Nastaliq Urdu) |
| Colours | Green `#128A46` primary · Yellow `#FFC72C` bike · Orange `#E8641B` parcel · Red `#D32F2F` cancel/SOS · Surface `#FFFDF7` · Text `#1B1B1B` |
| Contrast | ≥ 4.5:1 everywhere; never yellow text on white |
| Icons | Emoji‑style illustrations of the real vehicle types seen in town; same illustration on posters and stickers |
| Motion | Only for "finding captain" pulse and "captain moving" on the map |
| Sound | Short chime + spoken line for: captain found, captain arrived, ride ended, parcel delivered |
| Back | Hardware back always goes one step back, never exits a booking without a confirm dialog with two big buttons |

## S0 · Splash
- Green background, **మ** monogram, tagline "పిలిస్తే చాలు, బండి వస్తుంది".
- 1.5 s, then S1 (first run) or S3.

## S1 · Language (భాష)
- 6 tiles, 2 columns, each tile in its own script: తెలుగు · English · हिंदी · ಕನ್ನಡ · मराठी · اردو.
- Tap → app speaks "నమస్తే! మన బండికి స్వాగతం" in that language → S2.
- Voice: "మీ భాష ఎంచుకోండి" (Choose your language).

## S2 · Phone & OTP (ఫోన్ నంబర్)
- One field, 32 sp digits, numeric keyboard, "+91" fixed prefix.
- Primary: **OTP పంపు** (Send OTP).
- OTP screen: 4 boxes, auto‑read SMS (SMS Retriever), secondary button **📞 కాల్ చేసి OTP చెప్పండి** (call me with OTP).
- Voice: "మీ ఫోన్ నంబర్ నొక్కండి" / "మెసేజ్‌లో వచ్చిన 4 అంకెలు నొక్కండి".

## S3 · Home (హోమ్)
```
నమస్తే, లక్ష్మి 🙏                           🔊
┌──────────────────────────────┐
│ 🏍️  బైక్                     │  yellow
│      ఒక్కరికి · ₹20 నుంచి     │
├──────────────────────────────┤
│ 🛺  ఆటో                      │  green
│      కుటుంబం · సామాను · ₹30 నుంచి │
├──────────────────────────────┤
│ 📦  పార్సెల్                  │  orange
│      వస్తువులు పంపండి · ₹30 నుంచి │
└──────────────────────────────┘
ఎక్కడికి?  🏠 ఇల్లు  🚌 బస్టాండ్  🏥 ఆసుపత్రి  🛒 సంత
👨‍👩‍👧 కుటుంబం కోసం బుక్ చెయ్యి
──────────────────────────────
🏠 హోమ్      🕒 నా రైడ్లు      📞 సహాయం
```
- Tapping a saved place chip *before* a vehicle opens S4 with the drop pre‑filled and the vehicle pre‑selected to Bike.
- Voice: "బైక్, ఆటో లేదా పార్సెల్ — ఒకటి నొక్కండి".

## S4 · Book ride (బండి బుక్ చెయ్యి)
- Header coloured by service.
- **📍 ఎక్కడ నుంచి** — auto "ప్రస్తుత స్థలం · బస్టాండ్ దగ్గర" (nearest landmark from our town landmark table). Tap to change on a map with a single big pin.
- **🎯 ఎక్కడికి** — huge field with 🎤 mic on the right; below it the saved‑place chips; below that "📞 కెప్టెన్‌కి ఫోన్‌లో చెప్తా" (I'll tell the captain on the phone).
- Fare card: "₹ 45" in 48 sp · "6 కి.మీ · 12 నిమిషాలు" · night charge line when applicable.
- Payment: two tiles — **💵 క్యాష్** (selected by default) · **📱 UPI**.
- Primary: **బండి పిలువు** (Call the bandi).
- Voice: "ఎక్కడికి పోవాలో చెప్పండి లేదా మైక్ నొక్కి మాట్లాడండి".

## S5 · Finding captain (కెప్టెన్ వెతుకుతున్నాం)
- Pulsing green circle with the vehicle icon; text "దగ్గర్లో బండి వెతుకుతున్నాం…"; a counter of captains nearby.
- After 90 s without acceptance: "📞 సహాయానికి కాల్ చెయ్యండి" and "మళ్ళీ ప్రయత్నించు".
- ❌ cancel at bottom (grey, small, requires confirm).

## S6 · Ride (రైడ్)
```
కెప్టెన్ వస్తున్నారు · 3 నిమిషాలు                 🔊
[ map with captain marker moving ]
┌──────────────────────────────┐
│ 👤 శ్రీనివాస్   ⭐ 4.8          │
│ TS 32 A 1234    (48 sp)       │
│ OTP  4 7 2 9    (56 sp)       │  "కెప్టెన్‌కి ఈ నంబర్ చెప్పండి"
└──────────────────────────────┘
[ 📞 కాల్ చెయ్యి ]  (green, 72 dp, full width)
[ ❌ రద్దు ]     [ 🆘 ]
```
- States: వస్తున్నారు (coming) → వచ్చారు (arrived, phone vibrates + spoken) → ప్రయాణం (on trip) → పూర్తయింది (done).
- SOS: dials 112 and sends SMS with live location to the trusted contact.

## S7 · Ride complete (పూర్తయింది)
- "₹ 45" in 56 sp, "క్యాష్ ఇవ్వండి" / "UPI QR చూపించండి".
- Rating: three faces 😊 😐 😞 (one tap, optional). Tip: +₹10 +₹20.
- Primary: **సరే** (OK) → Home. Receipt goes to WhatsApp.

## S8 · Parcel wizard (పార్సెల్)
Progress row at the top: ①📍 → ②📦 → ③💵 with the current step filled orange.

1. **ఎక్కడికి పంపాలి?** — receiver phone (32 sp), drop with 🎤 and saved receivers ("శంకర్ కిరాణా, గంగాపూర్"). Pickup auto.
2. **ఏమి పంపుతున్నారు?** — three tiles with pictures: 🍱 చిన్నది (bag, < 5 kg) · 📦 మధ్యస్థం (box, < 15 kg) · 🧳 పెద్దది (sack, auto). "📷 ఫోటో తియ్యండి" — photo is shown to the captain and the receiver.
3. **డబ్బులు ఎవరు ఇస్తారు?** — 🙋 నేను · 🙍 అందుకునేవారు (receiver). Fare in 48 sp. Toggle "సామాను డబ్బులు కూడా వసూలు చెయ్యి" (collect goods money, phase 2).
- Confirm → S5 → S6 with **pickup OTP** for the sender and **delivery OTP** sent to the receiver by SMS/WhatsApp with a tracking link.

## S9 · My rides (నా రైడ్లు)
- List rows: service icon · date in Telugu ("ఈరోజు", "నిన్న", "12 ఆగస్టు") · drop name · fare. Tap = receipt with captain name and vehicle number.

## S10 · Help (సహాయం)
- **📞 సహాయానికి కాల్** (the town support number, 6 am–11 pm), **💬 WhatsApp**, **🌐 భాష మార్చు**, **▶️ ఎలా బుక్ చెయ్యాలి?** (60‑second Telugu video), **👨‍👩‍👧 కుటుంబం కోసం బుక్** (book for family).

## S11 · Book for family (కుటుంబం కోసం)
- Enter the rider's phone number + name/nickname, pick vehicle and drop, choose "వాళ్ళు క్యాష్ ఇస్తారు / నేను UPI ఇస్తా". The rider gets an SMS + captain call; the booker sees S6.

## Captain app — key screens

| Screen | What matters |
| --- | --- |
| Online toggle | Full‑screen green "ఆన్‌లైన్" / grey "ఆఫ్‌లైన్", earnings today in 40 sp |
| New request | Fullscreen, loud chime + spoken "కొత్త రైడ్: బస్టాండ్ నుంచి 2 కి.మీ, ₹45". Lower half = **✅ ఒప్పుకో** with a 15 s ring; small ❌ |
| To pickup | Map + **📞 రైడర్‌కి కాల్**, **🧭 దారి చూపు** (Google Maps intent), "వచ్చాను" button |
| OTP | Four 56 sp boxes; numeric keypad |
| On trip | Drop landmark, **slide to finish** |
| Collect | "₹45 క్యాష్ తీసుకోండి" or UPI QR; "తీసుకున్నాను ✔" |
| Earnings | Today / week / settlement due, in big digits, with a call‑to‑office button |

## Accessibility checklist
- TalkBack labels on every control in the app locale.
- All copy reviewed by a native Telangana Telugu speaker for spoken register (not textbook Telugu).
- Tested with: elderly non‑readers, bright sunlight (contrast), ₹6,000 Android Go phones (memory), one‑hand use, gloves off/on.
