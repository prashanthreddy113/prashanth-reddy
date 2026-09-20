# Mana Bandi · Owner portal (`owner-web`)

Product-owner web portal for **Mana Bandi (మన బండి)** — the Telugu-first bike / auto / parcel app for small Telangana towns. React 19 + Vite + react-router v7, plain CSS, Leaflet (OpenStreetMap tiles) for maps, Recharts for charts. Everything runs on **mock data** today; the API layer is shaped for the ASP.NET Core backend described in `../docs/04-ARCHITECTURE.md`.

## Run

```bash
cd mana-bandi/owner-web
npm install
npm run dev        # http://localhost:5174
npm run build      # production bundle in dist/
```

### Mock credentials (any password)

| Email | Role | Sees |
| --- | --- | --- |
| `owner@manabandi.in` | owner | everything, all towns, Settings, editable Commission |
| `nkd@manabandi.in` | town_manager | Narayanakhed only, no Settings, Commission read-only |
| `zhb@manabandi.in` | town_manager | Zaheerabad only |

The OTP field is optional (4–6 digits if used). The token is kept in `localStorage` (`manabandi.token`); protected routes redirect to `/login`.

## Pages

| Route | What |
| --- | --- |
| `/login` | Email + password (+ optional OTP), mock auth, role shown in the top bar |
| `/` | Dashboard: 8 KPI tiles, 14-day rides vs parcels line, requests-by-hour bars, live requests table (refreshes every 5 s), "needs attention" list (pending KYC, SOS, unfulfilled, low-rated, long searches) |
| `/live` | Leaflet map centred on Narayanakhed (18.033, 77.755): online captains (yellow bike / green auto) with popups, pickup→drop lines for active trips; positions jitter every 3 s |
| `/areas` | **Service-area configuration**: town list, enable toggle, centre (draggable marker), service radius 2–40 km (slider + number), extended parcel radius, "accept only inside radius" toggle, night hours, support / missed-call numbers, fare table, landmarks (Telugu + English, add by clicking the map), Add town |
| `/captains` | Filterable table (town, vehicle, status incl. online, search) → `/captains/:id` detail with the **verification panel** (documents, extracted fields, pass / fail / needs-review chips, RC-owner consent-letter slot, police verification, Approve / Reject / Re-upload / Block) · `/captains/new` registration form with "Run automatic verification" (2 s simulated KYC call) |
| `/rides`, `/parcels` | Date range / status / town / service filters, CSV export, row → side drawer with timeline, fare, payment, masked phones, captain, rating; parcels add sender / receiver, size, photos, COD, pickup / delivery OTP |
| `/analytics` | 30-day rides & parcels, gross fares, service pie, town bars, fulfilment + median pickup trend, hour × weekday heatmap, captain leaderboard, top landmarks, new vs repeat riders per week, COD collected vs pending, CSV export |
| `/settlements` | Weekly captain settlement: cash, UPI, COD held, **commission from the commission rules**, incentive, payout due, "Mark paid" with UTR |
| `/commission` | Default rule (%, free months, % during free period, effective from), per-service overrides, per-town overrides (add / edit / delete, filtered by the town selector), preview calculator, "what captains see" note, audit lines. Owner edits; town managers read-only |
| `/settings` (owner) | Company & dispatch settings, commission summary tile → `/commission`, terms & conditions versions (Telugu + English publish), SMS / WhatsApp templates, users & roles (add town manager), audit log |

Town selector in the top bar (Narayanakhed / Zaheerabad / All towns) filters every page; town managers are pinned to their town.

## Where things live

```
src/
  main.jsx, App.jsx        routes, auth guard, owner-only guard for Settings
  styles.css               the whole design system (brand tokens at the top)
  lib/api.js               ALL data access — async functions, one REST endpoint noted per function
  lib/auth.jsx             session + role; lib/town.jsx global town selector; lib/toast.jsx; lib/format.js; lib/csv.js
  mock/                    seed data: towns.js (service areas, fares, landmarks), captains.js (KYC docs),
                           rides.js (45 days of rides + parcels, generated deterministically), settlements.js,
                           commission.js (rules), settings.js (company, terms, templates, users, audit, SOS),
                           store.js (module-level in-memory store — edits persist for the session, reload resets)
  components/              Layout, KpiTile, StatusPill, Drawer, Modal, CheckChip, DocCard, KycNote, Timeline, TripsTable, mapIcons
  pages/                   one file per route
```

## Plugging in the real API

Every page calls `api.*` from `src/lib/api.js` and never touches the mock store directly. To go live, replace the body of each function with a `fetch` to the endpoint named in its comment (send `Authorization: Bearer <token>` from `session.getToken()`), keep the return shapes, and delete `src/mock/`. `VITE_API_URL` (see `.env.example`) is already read as `BUILD_API_URL`; in dev the Vite proxy forwards `/api` to `http://localhost:5080`.

`resolveCommission()` and `buildChecks()` in `api.js` are the pure rule/chip logic; the backend must implement the same resolution so the preview calculator and the captain app agree.

## Endpoints the backend needs

**Auth**
- `POST /api/auth/login` `{ email, password, otp? }` → `{ token, user: { id, name, email, role: owner|town_manager, townId } }`

**Towns / service areas**
- `GET /api/towns` · `GET /api/towns/{id}` · `POST /api/towns` · `PUT /api/towns/{id}` (centre, `radiusKm`, `extendedRadiusKm`, `enforceRadius`, night hours, support phone, fares, landmarks)
- Enforcement: `POST /api/rides` rejects pickup outside `radiusKm` with `422 OUT_OF_AREA`; drop may be up to `extendedRadiusKm` for parcels.

**Captains / KYC**
- `GET /api/captains?town=&vehicle=&status=&q=` · `GET /api/captains/{id}` · `POST /api/captains` (multipart)
- `POST /api/captains/{id}/verify` → runs provider checks (Aadhaar OTP / DigiLocker, Sarathi DL, Vahan RC, face match + liveness) and returns the chips
- `POST /api/captains/{id}/approve` · `POST …/reject { reason }` · `POST …/block { reason }` · `POST …/unblock`
- `POST /api/captains/{id}/request-reupload { documents, note }` · `POST /api/captains/{id}/documents/consent-letter` · `PATCH /api/captains/{id}/police-verification { status }`

**Live**
- `GET /api/live/captains?town=` and `GET /api/live/requests?town=` (SignalR hub `live` in production)

**Dashboard / analytics**
- `GET /api/admin/dashboard?town=` → `{ kpis, series14d, byHourToday, attention }` (`kpis.revenueToday` = commission earned, `kpis.grossToday` = fares)
- `GET /api/admin/analytics?town=&days=30`

**Rides / parcels**
- `GET /api/rides?from=&to=&status=&town=&service=` · `GET /api/rides/{id}` (with `ride_events`)
- `GET /api/parcels?from=&to=&status=&town=` · `GET /api/parcels/{id}`

**Settlements**
- `GET /api/settlements?town=&period=` (commission column derived from the commission rules) · `POST /api/settlements/{id}/pay { utr }`

**Commission**
- `GET /api/config/commission` → `{ defaultRule, serviceOverrides, townOverrides }`
- `GET /api/config/commission?town=&service=&captainId=` → resolved `{ pct, rule, reason }` for one captain/trip — **the captain app calls this** to print the commission line on every ride and on Earnings
- `PUT /api/config/commission` `{ defaultRule, serviceOverrides }` (owner only; every change appends an audit line)
- `POST /api/config/commission/towns` · `PUT /api/config/commission/towns/{id}` · `DELETE /api/config/commission/towns/{id}`
- Resolution order: town + service → town "all" → service override → default; captains inside `joinedAt + freeMonths` pay `freePct`.

**Settings (owner)**
- `GET/PUT /api/admin/settings/company`
- `GET /api/admin/terms` · `POST /api/admin/terms { version, te, en }`
- `GET /api/admin/templates` · `PUT /api/admin/templates/{id}`
- `GET /api/admin/users` · `POST /api/admin/users` · `DELETE /api/admin/users/{id}`
- `GET /api/admin/audit?limit=100`

## Brand

Primary green `#128A46`, dark green `#0B5E2F` (sidebar), turmeric yellow `#FFC72C` (bike), orange `#E8641B` (parcel), red `#D32F2F` (alerts only), cream `#FFFDF7`, ink `#1B1B1B`. Chart series use CVD-safe re-steps of the brand hues (`CHART` in `src/lib/format.js`). Telugu text uses "Noto Sans Telugu" from Google Fonts.
