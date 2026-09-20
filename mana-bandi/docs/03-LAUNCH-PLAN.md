# Mana Bandi — Launch plan: Narayanakhed → Zaheerabad → Telugu states

## Why start here

- **Narayanakhed** (Sangareddy district): mandal HQ, weekly santha, PHC/area hospital, degree college, RTC depot; villages 5–25 km away with no reliable transport after the last bus. Borders Karnataka — Kannada and Marathi speakers come in for the market.
- **Zaheerabad** (35 km away, on NH‑65): larger town, industrial belt (Mahindra plant), railway station, big cloth and kirana wholesale, strong Urdu/Deccani community, many parcels to Bidar and to villages.
- Neither town has Rapido/Ola/Uber reliably today; autos bargain, bikes are informal. That is the wedge: **fixed fare + a person you can call**.

## Phase 0 · Prepare (weeks 1–6)
1. Register the company (Pvt Ltd or LLP), GST, trademark filing for "Mana Bandi" (classes 9, 39), Play Store developer account, DLT registration for SMS sender ID (required in India), WhatsApp Business API number.
2. Legal: aggregator guidelines under the Motor Vehicle Aggregator Guidelines 2020 and the Telangana rules (obtain the state aggregator licence before scaling; bike taxi status varies by state — in Telangana it is tolerated but not licensed, so start with **auto + parcel as the licensed core** and treat bike as pilot while the licence is pursued. Get proper legal advice).
3. Insurance: group personal accident cover for captains and riders.
4. Build v1 (rider app, captain app, admin web) — 8–10 weeks with 2 Android devs, 1 backend dev, 1 designer, 1 Telugu content person.
5. Hire the **town team**: 1 town manager (local, speaks Telugu + Kannada/Urdu), 2 field executives, 1 support person on phones. Rent a small "Mana Bandi office" near the bus stand — a physical place builds trust.

## Phase 1 · Narayanakhed pilot (weeks 7–14)
- **Captains first.** Sign 30 captains before the public launch: existing auto stand drivers (approach the auto union with a 0% commission offer for 3 months and a daily incentive), young men with bikes who already do informal drops. Give kits: yellow/green jacket, helmet, phone stand, vehicle sticker with the app QR and the missed‑call number.
- **Seed places.** Ops enters 40–60 landmarks for the town (bus stand, PHC, courts, colleges, temples, mosques, banks, santha ground, each colony name) so voice and chips work on day one.
- **Launch day at the santha.** Stall with a big banner, live demo, free first ride (₹30 credit) and a printed card with the missed‑call number. Auto announcements ("రిక్షా‑మైక్") in Telugu for a week.
- **Missed‑call and WhatsApp booking** live from day one for people without the app: give a missed call → support calls back, books, and SMSes the captain's number.
- **Shops.** Visit the top 50 shops (medical, kirana, cloth, electronics, tiffin centres) for the parcel service; free parcels for the first week; monthly statements.
- **Measure** fulfilment, pickup time, voice usage, share of missed‑call bookings, cancellations.

## Phase 2 · Zaheerabad (weeks 15–24)
- Repeat the playbook with 40 captains; add Urdu to all printed material; hire an Urdu‑speaking support person.
- Start the **Narayanakhed ↔ Zaheerabad scheduled parcel** (two runs a day) and Zaheerabad ↔ Bidar road parcels.
- Corporate: Mahindra plant and industrial estate shift drops; railway station pickup point.

## Phase 3 · Sangareddy district & neighbours (months 7–12)
Sangareddy, Sadashivpet, Jogipet, Andole, Kohir, then Vikarabad and Tandur. Every new town = 1 town manager + 2 field staff + 30 captains, launched at the local santha with the same kit. The product must not need engineering changes per town — only ops data (landmarks, fares, support number).

## Phase 4 · Telangana and Andhra towns (year 2)
Target towns of 30 k–2 lakh people where the big apps are absent or unreliable: Siddipet, Kamareddy, Nirmal, Bhainsa, Jagtial, Bodhan, Gadwal, Wanaparthy, Nagarkurnool, Huzurnagar, Kodad; in AP: Madanapalle, Hindupur, Tadipatri, Palakollu, Amalapuram, Rayachoti, Markapur, Nuzvid. Add Andhra Telugu copy variants where words differ (e.g. "బండి" is fine everywhere; some place‑type words differ). Franchise model for town operations: a local partner runs the town under the brand with our app and playbook.

## Marketing that works in small towns
- Wall paintings and auto‑stand boards in the three brand colours.
- The **missed‑call number** on every sticker — it is the product for non‑readers.
- Local YouTube/Facebook Telugu shorts: "మన బండి ఎలా బుక్ చెయ్యాలి" (60 s).
- Referral by phone number: captain gets ₹50 for every rider they onboard who completes 3 rides.
- Temple/festival and school exam‑day specials; hospital partnership (free pickup for dialysis patients sponsored by a local business).

## Team and cost sketch (first 12 months, INR)

| Item | Approx. |
| --- | --- |
| Product build (v1, 4 people, 3 months) | 18–25 lakh (or 6–8 lakh with a small agency + this codebase as the base) |
| Cloud, maps, SMS/WhatsApp, TTS (per town per month) | 25–40 k |
| Town team (4 people) per town per month | 80 k–1.1 lakh |
| Launch marketing per town | 2–3 lakh |
| Captain kits (60 × ₹1,200) | 72 k |
| Legal, licence, insurance, trademark | 3–5 lakh |

## Risks and how we handle them
| Risk | Mitigation |
| --- | --- |
| Auto union resistance | Recruit union leaders as first captains, 0% commission, show them incoming demand from parcels and villages |
| Bike taxi legal status | Auto + parcel are the licensed core; keep bike as pilot with insurance; follow state notifications |
| Captains taking rides offline after the first booking | Fare is already fixed in‑app, so no gain; incentives tied to in‑app trips; parcels need OTP which forces the app |
| Low smartphone use among the oldest riders | Missed‑call and "book for family" flows |
| Safety incidents | KYC, SOS, insurance, trusted contact, women captains for women riders when available |
| Google Maps cost | Use Maps only for the captain's navigation intent; rider map via MapLibre with OpenStreetMap tiles; landmark table replaces geocoding for most trips |
