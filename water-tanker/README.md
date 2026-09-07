# AquaProof – verified water tanker deliveries

Hyderabad's gated communities buy millions of litres of tanker water a month and have no way to know whether a "10,000 L" load was really 10,000 L, whether it was borewell or treated water, or whether it went to their sump at all. AquaProof puts a **sealed flow meter + TDS/turbidity sensor + GPS + 4G node** on the tanker's outlet, and every delivery is logged automatically: litres actually pumped, water quality, location, timestamp and a photo of the seal. Residents' associations (RWAs) see proof and pay against it; honest operators use it to win contracts.

| Layer | Tech |
| --- | --- |
| Device | ESP32 + SIM7600 4G, hall-effect flow meter, analog TDS + turbidity, GPS (PlatformIO / Arduino) – `firmware/` |
| API | ASP.NET Core 8 Web API, EF Core, PostgreSQL, JWT for people, per-device keys for nodes – `backend/` |
| Apps | React 19 + Vite, one app with operator, RWA and admin views – `frontend/` |
| Hosting | Frontend on Netlify, API + Postgres on Render/Azure/any Docker host (`render.yaml`, `docker-compose.yml`) |

## How a delivery becomes proof

```mermaid
flowchart LR
    subgraph Tanker["On the tanker (sealed node)"]
        FM[Flow meter pulses] --> ESP[ESP32]
        TDS[TDS + turbidity probes] --> ESP
        GPS[GPS fix] --> ESP
        TAMP[Lid tamper switch] --> ESP
        ESP -->|4G, JSON batches\nX-Device-Id / X-Device-Key| API
    end
    subgraph Cloud["AquaProof API (.NET)"]
        API[/POST /api/telemetry/] --> DS[DeliveryService]
        DS -->|flow ≥ 5 L/min| OPEN[Open delivery\nsessionKey]
        DS -->|"end" event or 3 min idle| FIN[Finalise]
        FIN --> Q[Grade quality\nIS 10500 TDS / NTU]
        FIN --> GEO[Geofence match\n→ community]
        FIN --> BK[Link booking]
        FIN --> PRICE[Price: booking → community → operator rate]
    end
    subgraph People
        DRV[Driver phone] -->|seal photo| DEL
        PRICE --> DEL[(Delivery record)]
        DEL --> RWA[RWA app: verify / dispute]
        DEL --> OPS[Operator app: fleet, disputes]
        RWA --> INV[Monthly invoice]
        OPS --> INV
        INV --> PAY[UPI / NEFT reference\nRazorpay later]
    end
```

### Delivery life-cycle

```mermaid
stateDiagram-v2
    [*] --> InProgress : first reading with flow ≥ 5 L/min\n(or firmware "start")
    InProgress --> InProgress : readings append\nlitres = counter − start counter
    InProgress --> Completed : firmware "end" / idle 3 min\nlitres ≥ 200
    InProgress --> Discarded : idle and litres < 200\n(flush or test run)
    Completed --> Verified : RWA verifies
    Completed --> Disputed : RWA raises dispute
    Verified --> Disputed : RWA raises dispute
    Disputed --> Completed : operator accepts (optionally corrects litres) or rejects
    Completed --> Invoiced : month-end statement
    Verified --> Invoiced : month-end statement
    Invoiced --> Paid : RWA records UPI/NEFT ref\nor operator marks paid
```

### Who does what

```mermaid
flowchart TB
    subgraph RWA["RWA / resident app"]
        R1[Book a tanker] --> R2[See delivery proof:\nlitres, quality, geofence, seal photo]
        R2 --> R3{Looks right?}
        R3 -->|yes| R4[Verify]
        R3 -->|no| R5[Raise dispute]
        R4 --> R6[Pay monthly statement]
    end
    subgraph OPS["Operator app"]
        O1[Register tankers] --> O2[Register device → one-time key]
        O2 --> O3[Fit + calibrate meter]
        O3 --> O4[Accept & dispatch bookings]
        O4 --> O5[Deliveries appear automatically]
        O5 --> O6[Fix unmatched community, add seal photo]
        O6 --> O7[Resolve disputes]
        O7 --> O8[Generate monthly statement]
    end
    subgraph ADMIN["Platform admin"]
        A1[Create operators & communities\nwith geofence + rates] --> A2[Create logins]
    end
    R1 --> O4
    O8 --> R6
```

## Features

- **Automatic delivery detection** – no driver input needed. Flow starts → delivery opens; flow stops → delivery finalises with litres from the meter's cumulative counter (retries with the same session key never double count).
- **Water quality per load** – average and peak TDS and turbidity, graded Good / Acceptable / Poor against IS 10500 limits (configurable).
- **Geofenced attribution** – the delivery is matched to the community whose fence (default 150 m) the tanker was inside. Unmatched loads are flagged for the operator to assign.
- **Proof trail** – time, GPS, litres, quality, seal photo, tamper switch, sample count, all on one page with a flow/TDS chart.
- **Bookings** – RWA requests loads from its preferred operator; the operator accepts, assigns a tanker, dispatches; the metered delivery links to the booking automatically.
- **Verify / dispute** – the RWA confirms or disputes each load; the operator resolves with an optional litre correction that re-prices the load.
- **Monthly statements** – built only from completed/verified loads, per community per operator; RWA records the UPI/NEFT reference (online checkout plugs in later); operators can mark cash paid or cancel.
- **Fleet & devices** – tankers, drivers, device registration with one-time API keys, K-factor calibration, online/offline/tamper status, battery and signal, last known position.
- **Dashboards** – litres per day, quality mix, short loads (under 85% of tank capacity), disputes, outstanding money, devices online.
- **Demo data** – with `Demo:Seed=true` the first run seeds one operator, three tankers, two devices, three Manikonda/Gachibowli communities and two weeks of deliveries so every screen has content.

## Project layout

```
water-tanker/
  backend/WaterTanker.Api     ASP.NET Core API (Controllers, Models, Services, Data/Migrations)
  backend/Dockerfile          Production image for the API
  frontend/                   React app (Vite) – operator, RWA and admin views
  firmware/esp32-tanker-node  PlatformIO project for the tanker node (+ BOM)
  tools/simulate-device.mjs   Posts telemetry like a real node, for testing without hardware
  docker-compose.yml          Local Postgres + API
  render.yaml / netlify.toml  Hosting configs
```

## Run locally

Prerequisites: .NET 8 SDK, Node 22, PostgreSQL 16 (or Docker).

```bash
# 1. Database (a local Postgres with db/user "watertanker"/"watertanker", or:)
docker compose up db -d          # listens on 5433; adjust ConnectionStrings__Default accordingly

# 2. API → http://localhost:5090  (Swagger UI at /swagger)
cd backend/WaterTanker.Api
dotnet run

# 3. Frontend → http://localhost:5174  (proxies /api to the API)
cd frontend
npm install
npm run dev

# 4. Simulate a tanker pumping 9,800 L at Lanco Hills (no hardware needed)
node tools/simulate-device.mjs --api http://localhost:5090 --fast
```

Logins (demo seed): **operator@demo.local / demo123** (operator), **rwa@demo.local / demo123** (Lanco Hills RWA), **admin@aquaproof.local / admin123** (platform admin, from `appsettings.json`).

## Device API

Devices authenticate with two headers, `X-Device-Id` (device code) and `X-Device-Key` (issued once at registration). `GET /api/telemetry/whoami` checks credentials; `POST /api/telemetry` accepts:

```json
{
  "sessionKey": "AQ-0001-4f2a1c-7",
  "event": "start | reading | end | heartbeat",
  "firmware": "0.1.0",
  "readings": [
    { "t": "2026-09-07T04:12:30Z", "flowLpm": 410.5, "litres": 184320.5, "tds": 640, "ntu": 0.9,
      "tempC": 28.1, "lat": 17.40881, "lng": 78.37752, "batt": 4.02, "csq": 18, "tamper": false }
  ]
}
```

`litres` is the node's cumulative counter since boot; the server diffs it against the counter at session start. Send `pulses` instead and the server converts using the device's stored K-factor. At scale the same payload can be routed through Azure IoT Hub → Event Grid → this endpoint without changing the firmware contract.

## Deploy

**API (Render):** New → Blueprint → this repo, root `water-tanker`. `render.yaml` creates the API, a Postgres database and a 1 GB disk for seal photos. Set `Admin__Password` and `Cors__AllowedOrigins` in the dashboard. Any Docker host works the same way with these variables:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` **or** `ConnectionStrings__Default` | `postgres://user:pass@host:5432/db` or an Npgsql connection string |
| `Jwt__Key` | Random secret, 32+ characters |
| `Admin__Email`, `Admin__Password` | First admin (seeded only when no admin exists) |
| `Demo__Seed` | `true` to seed demo data on an empty database |
| `Cors__AllowedOrigins` | Netlify site URL (empty = allow all) |
| `Photos__Directory` | Where seal photos are stored (mount a disk; swap `PhotoStorage` for Azure Blob in production) |
| `Delivery__FlowStartLpm`, `Delivery__IdleCloseMinutes`, `Delivery__MinLitresToKeep`, `Delivery__DefaultRatePerKl` | Delivery detection and pricing defaults |
| `Quality__TdsGoodMax`, `Quality__TdsAcceptableMax`, `Quality__TurbidityGoodMax`, `Quality__TurbidityAcceptableMax` | Grading thresholds (IS 10500 defaults) |

**Frontend (Netlify):** create a site from this repo with base directory `water-tanker/frontend` (the `netlify.toml` here sets it), and set `VITE_API_URL` to the API URL.

## Business model (from the pitch)

- Hardware sale or rental per tanker: ₹500–800/month (unit cost ≈ ₹5–6k, see `firmware/README.md` BOM).
- RWA subscription per community: ₹1–2k/month for verified deliveries and dispute-free billing (`Community.SubscriptionPerMonth`).
- Later: marketplace commission on bookings; the delivery data itself (groundwater TDS by area, delivery volumes) is sellable to builders and HMWSSB.

**Pilot:** 3–4 large gated communities in Manikonda and two tanker operators who supply them. The demo seed mirrors this setup.

## Market check (September 2026)

A quick search before committing, as the pitch suggested:

- **Booking platforms** exist: [Tankerwala](https://tankerwala.in/) (1,300+ tankers, live in Bengaluru, Chennai, Hyderabad, Mumbai) and [TankerTap](https://play.google.com/store/apps/details?id=com.tankertap&hl=en_IN) do booking, tracking and "verified suppliers", not metered proof at the outlet.
- **Receiving-side metering** exists: [WaterApp](https://waterapp.in/the-water-tanker-ecosystem/) and [KarIoT](https://www.karikala.in/) put a flow meter on the apartment's inlet so the RWA sees litres received; [ApnaComplex Water Monitor](https://www.deccanherald.com/city/water-monitor-that-tracks-tanker-misdeeds-consumption-patterns-505677.html) logs loads from a tablet at the gate. [WEGoT](https://www.wegot.in/) does in-building smart metering.
- **Municipal side:** [HMWSSB](https://hyderabadwater.gov.in/en/index.php/services/customers-services/book-water-tanker) books and [tracks](https://tanker.hyderabadwater.gov.in/TANKERTRACKING) its own tankers by token and vehicle number; private borewell tankers, which most of Manikonda relies on, are outside it.
- **Hyderabad IoT metering vendors:** [Kritsnam Dhaara](https://kritsnam.com/product/ultrasonic-water-flow-meter/) makes 4G ultrasonic meters locally, a possible off-the-shelf flow meter for a rugged v2.

**What is still open:** nobody found is doing *tanker-side* verification (the meter travels with the tanker, so one device covers every customer of that operator, plus water quality per load and a seal). The receiving-side products need every community to install and maintain a meter and say nothing about which tanker, which source, or what TDS. That is the wedge; the risk is that WaterApp or Tankerwala add an outlet meter once the idea is proven, so speed with the two pilot operators matters.
