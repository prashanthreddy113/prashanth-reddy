# Mana Bandi — Captain verification (Aadhaar, DL, RC, selfie): what can be automated

> Short answer: **yes, almost all of it can be automated in India today**, through a KYC‑API provider that sits on top of DigiLocker (Aadhaar, DL, RC), the transport department databases (Sarathi for licences, Vahan for vehicles) and a face‑match/liveness engine. The only step that stays manual is police verification. This document explains what is legally possible, which APIs exist, the automated flow for Mana Bandi, the rules (including "captain drives someone else's vehicle"), costs, and what the owner portal shows.

## 1. The legal picture (India, 2026)

| Check | Can a private company do it? | How |
| --- | --- | --- |
| **Aadhaar** | Direct UIDAI e‑KYC/OTP is **only** for licensed entities (banks, telcos, regulated entities) after the 2018 Supreme Court ruling. A ride‑hailing startup is not one. | Two legal routes: **(a) DigiLocker** — the captain logs into DigiLocker and consents; we receive the government‑signed e‑Aadhaar (name, DOB, gender, photo, masked number, address). **(b) Offline Aadhaar (paperless e‑KYC XML / QR)** — the captain downloads the XML from myAadhaar with a share code; we verify UIDAI's digital signature. Both are consent‑based and DPDP‑Act compliant. |
| **Driving licence** | Yes | DigiLocker (Sarathi‑issued DL pulled by the captain) or a DL‑verification API that queries Sarathi/Parivahan by DL number + DOB and returns name, DOB, validity, vehicle classes (MCWG, LMV, 3W), status. |
| **Vehicle RC** | Yes | DigiLocker (Vahan‑issued RC) or an RC‑verification API by registration number: owner name, vehicle class, fuel, registration date, fitness validity, insurance validity, PUCC, hypothecation, blacklist/stolen status. |
| **Selfie ↔ ID photo** | Yes | Face‑match API (selfie vs Aadhaar photo from DigiLocker, or vs DL photo) returning a similarity score, plus **passive liveness** (blocks photos‑of‑photos and deepfakes). |
| **Name match across documents** | Yes | Fuzzy name‑match (handles "Srinivas Reddy K" vs "K. Srinivas Reddy", Telugu transliteration spelling variations). |
| **Police / criminal record** | Partially | Some providers offer court‑record searches; the formal police verification certificate is still a manual process at the local police station and should be done for every captain within 30 days of activation. |

## 2. Providers (all of these bundle Aadhaar‑via‑DigiLocker, DL, RC, face match, liveness, name match in one API account)

The sensible choice for a startup is **one aggregator**, not five government integrations. Shortlist to evaluate (in no particular order): **Setu (Pine Labs)**, **Cashfree Verification**, **Signzy**, **IDfy**, **HyperVerge**, **Digio**, **Surepass**, **AuthBridge**, **Gridlines**, **Eko/EPS**, **Sandbox.co.in**, **Protean (RISE)**. Going direct to **DigiLocker as a Requester** is free of API fees but needs MeitY/NeSL approval of the business use case and security setup, which takes weeks; most startups start with an aggregator (which is itself a DigiLocker partner) and move to a direct requester licence later.

Indicative per‑check costs quoted publicly by providers (confirm with vendors; excl. GST):

| Check | Typical price |
| --- | --- |
| Aadhaar via DigiLocker / offline XML | ₹2–₹10 |
| DL verification (Sarathi) | ₹3–₹10 |
| RC verification (Vahan, full) | ₹3–₹15 |
| Face match + liveness | ₹2–₹8 |
| Name match | ₹0.5–₹2 |
| **Total per captain** | **≈ ₹15–₹40** — negligible against a ₹1,200 kit |

What to ask each vendor: DigiLocker requester status, Sarathi/Vahan uptime and Telangana coverage, face‑match accuracy on low‑light Android Go selfies, data residency (India), DPDP consent artefacts, sandbox availability, and whether re‑checks (DL expiry, insurance expiry) can be scheduled.

## 3. The automated onboarding flow (captain app + backend)

```
Captain app (KycScreen)                       Backend (kyc service)                    Provider
──────────────────────                        ─────────────────────                    ────────
1. Tap "🪪 Aadhaar" ─────────────────────▶ create DigiLocker session ──────────────▶ OAuth URL
   opens DigiLocker in Custom Tab ◀────────  redirect URL                              
   captain logs in, consents (Aadhaar, DL, RC)                                          
   callback ─────────────────────────────▶ fetch e‑Aadhaar JSON + DL + RC ──────────▶ signed docs
2. "🤳 Selfie" with liveness prompt ──────▶ face match(selfie, aadhaar_photo) ──────▶ score, liveness
3. Vehicle type + number typed ───────────▶ RC verify(number) (if not from DigiLocker)▶ RC details
4. (if RC owner ≠ captain) "📄 Owner letter" photo ▶ stored for manual review
5. Backend runs the RULES below → status: auto_approved | needs_review | rejected
6. Owner portal shows the case; town manager approves needs_review ones; police verification tracked separately
```

If the captain has no DigiLocker account (common), the field executive helps create one at the office in 5 minutes with the captain's Aadhaar‑linked mobile. Fallback without DigiLocker: DL by number + DOB, RC by number, Aadhaar offline XML, selfie vs DL photo.

## 4. Verification rules

| Rule | Pass | Needs review | Reject |
| --- | --- | --- | --- |
| Aadhaar document | Signed e‑Aadhaar or offline XML, signature valid | — | Unsigned/scanned image only |
| Age | 18–65 (auto ≥ 20 for bike, ≥ 21 for auto by policy) | 18–19 | < 18 |
| DL status | Active, not expired, class includes **MCWG** (bike) or **LMV/3W‑T** (auto, transport endorsement for commercial auto) | Expiring < 60 days | Expired, suspended, wrong class |
| DL name ↔ Aadhaar name | fuzzy score ≥ 85 and DOB equal | 70–84 or DOB differs by typo | < 70 |
| Selfie ↔ Aadhaar/DL photo | match ≥ 80 **and** liveness pass | 65–79 | < 65 or liveness fail |
| RC | Valid, not blacklisted/stolen, fitness and **insurance valid**, vehicle class matches chosen service | Insurance/fitness expiring < 30 days, hypothecation | Blacklisted, expired fitness, no insurance |
| **RC owner ≠ captain** | Allowed, if: RC valid **and** a signed **owner consent letter / NOC** photo is uploaded, owner phone is recorded and gets an SMS "your vehicle TS32… is registered with Mana Bandi by <name>; reply STOP to object" | Always needs_review the first time; owner letter checked by town manager | Owner objects, or vehicle already assigned to another captain |
| One vehicle ↔ many captains | A vehicle can be linked to at most 2 captains (shift sharing is common); both must pass all checks | 3+ | — |
| Duplicate identity | Aadhaar reference / DL number not already used by another captain account | — | Duplicate → merge or reject |
| Police verification | Certificate uploaded within 30 days; captain can start earning meanwhile with a "provisional" badge | Missing after 30 days → auto offline until uploaded | Adverse report |
| Re‑verification | Automatic re‑check of DL expiry, insurance expiry, fitness every 30 days; captain sees a warning 30 days before; auto offline on expiry | | |

Name matching should be **transliteration‑aware**: the same person appears as "Srinivas", "Sreenivas", "Srinivasulu" across documents. Use the provider's name‑match, then a town manager decides the 70–84 band.

## 5. Data protection (DPDP Act 2023)

- Store only what is needed: masked Aadhaar (last 4), name, DOB, gender, photo; DL number and validity; RC number, owner name, insurance/fitness dates. Never store the full Aadhaar number or the XML beyond verification.
- Explicit consent screen in Telugu before DigiLocker ("మీ ఆధార్, లైసెన్స్, RC వివరాలు చూసేందుకు ఒప్పుకుంటున్నారా?"), with a consent record (time, IP, app version, terms version).
- Encrypt documents at rest (S3/Blob with KMS), India region, access logged; deletion on captain exit after the legal retention period.
- Riders never see captain documents; they see name, photo, vehicle number, rating.

## 6. What the owner portal shows (see `owner-web/`)

- **Captains → Verification panel**: each document with extracted fields, each rule as a green/amber/red chip with the score, RC‑owner mismatch handling with the consent‑letter slot, Approve / Reject (reason) / Request re‑upload / Block, and the police‑verification tracker.
- **Add captain** from the office: same form; "Run automatic verification" triggers the provider calls; most captains are auto‑approved in under two minutes.
- **Re‑verification alerts** (DL/insurance/fitness expiring) on the dashboard's "needs attention" list.

## 7. Backend additions (extends `04-ARCHITECTURE.md`)

```
captain_kyc(id, captain_id, provider, aadhaar_ref_masked, aadhaar_name, aadhaar_dob, aadhaar_photo_url,
            dl_number, dl_name, dl_valid_till, dl_classes[], rc_number, rc_owner_name, rc_vehicle_class,
            rc_insurance_till, rc_fitness_till, rc_blacklisted, owner_consent_url, owner_phone,
            name_match_score, face_match_score, liveness_pass, police_cert_url, police_cert_date,
            status[auto_approved|needs_review|rejected|blocked], decided_by, decided_at, notes)
consents(id, user_id, kind[terms_rider|terms_captain|digilocker|location_sharing], version, at, ip, app_version)
vehicles(id, rc_number, owner_name, owner_phone, captain_ids[], insurance_till, fitness_till)
POST /kyc/{captainId}/digilocker/start → url        GET /kyc/digilocker/callback
POST /kyc/{captainId}/selfie                          POST /kyc/{captainId}/rc {number}
POST /kyc/{captainId}/owner-consent                   POST /kyc/{captainId}/decide {status, reason}
GET  /kyc/queue?town=&status=needs_review             cron: /kyc/recheck (daily)
```

## 8. Sources consulted
- Supreme Court 2018 restriction on private Aadhaar e‑KYC and the offline/DigiLocker alternatives: Perfios blog on DigiLocker‑issued Aadhaar; Vigiliq "Top 10 Aadhaar API providers in India (2026)"; IncorpX on India Stack for startups (DigiLocker requester approval via MeitY/NeSL, no API fee).
- DL verification against Sarathi/Parivahan: Surepass, AuthBridge, Protean articles; Road and Transport Mission Mode Project (Sarathi/Vahan) on Wikipedia.
- RC/Vahan verification fields and pricing (₹3+ per check at Eko): Surepass, Eko/EPS, AuthBridge, IDSPay, HyperVerge.
- Face match and liveness: HyperVerge, Gridlines, Meon, IDSPay, Befisc (RBI V‑CIP guidance on passive liveness).
- DigiLocker Authorized Partner API (OAuth, MeitY onboarding, Aadhaar/DL/RC fetch): Cashfree docs, Setu docs, Jentic spec summary, AuthBridge.
