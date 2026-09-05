# BrightLoop Reading Room – Admin

A complete admin console for the BrightLoop reading room. Admins register students, assign seat numbers, track fees, and see at a glance whose subscription is due.

| Layer | Tech |
| --- | --- |
| Frontend | React 19 + Vite + React Router (hosted on **Netlify**) |
| Backend | ASP.NET Core 8 Web API, EF Core, JWT auth (Docker; Render / Railway / Azure / any host) |
| Database | PostgreSQL 16 |

## Features

- **Admin login** (JWT). A default admin is seeded on first run; change the password from Settings.
- **Branches** – one owner, many locations. Every branch has its own seats, students and expenses. The top-bar switcher shows all branches combined or one at a time; the dashboard shows per-branch cards in the combined view.
- **Seat layout per branch** – set a total directly ("this branch has 100 seats") or add floors / rooms / sections with a seat count each. Seat numbers are unique within a branch. Every seat is **AC or Non-AC** and can be labelled, moved between sections, or disabled.
- **Gender & women's reservation** – gender is mandatory at registration. A configurable share of each branch's seats (default 20%, overridable per branch) is reserved for women: women may take any free seat, men/others only the seats outside the reserved share.
- **Minimum monthly fee** – set in Settings; pre-fills the form and blocks lower amounts. Partial payments show the remainder as balance.
- **Expenses & net revenue** – record rent, electricity, salaries and other costs per branch; the dashboard and Expenses page show collected vs spent and the net, per month and per branch.
- **WhatsApp receipts** – after every payment a receipt template is sent automatically (can be switched off).
- **Register students** – mandatory: name, mobile. Optional: address, Aadhaar, study/course, months to join, amount per month, total paid, joining date, seat number, notes.
- **Seats** – admin sets how many seats the room has; the seat map shows free / occupied / due-soon / overdue seats. Seats can be labelled or disabled. Register a student directly from a free seat.
- **Dashboard** – every student with computed due date, balance and status, colour-coded:
  - 🟢 **Running** – more than *N* days left
  - 🟡 **Due soon** – due within the next *N* days (default 5, configurable)
  - 🔴 **Due today / Overdue** – due date has arrived or passed
  - ⚪ **Left** – deactivated (seat released, history kept)
- **Payments & renewals** – record payments (with history), extend the subscription by months, print list.
- **WhatsApp reminders** – automatic due-date messages through the WhatsApp Business API (N days before, on the day, and while overdue), a Reminders page with today's list and history, one-click manual sends, and a one-tap "Open WhatsApp" fallback.
- Stats: active students, overdue, due soon, seat occupancy, collected this month, outstanding balance.

## Project layout

```
backend/StudyRoom.Api   ASP.NET Core API (Controllers, Models, Data/Migrations)
backend/Dockerfile      Production image for the API
frontend/               React app (Vite)
netlify.toml            Netlify build config for the frontend
render.yaml             Optional one-click API + Postgres on Render
docker-compose.yml      Local Postgres + API
```

## Run locally

Prerequisites: .NET 8 SDK, Node 22, PostgreSQL (or Docker).

```bash
# 1. Database (either a local Postgres with db/user "studyroom"/"studyroom", or:)
docker compose up db -d

# 2. API  → http://localhost:5080  (Swagger UI at /swagger)
cd backend/StudyRoom.Api
dotnet run

# 3. Frontend → http://localhost:5173  (proxies /api to the API)
cd frontend
npm install
npm run dev
```

Login with **admin / admin123** (from `appsettings.json`), then go to **Seats** and set the number of seats.

Or run everything but the frontend with Docker: `docker compose up --build` (API on http://localhost:8080).

## Deploy

Netlify serves static sites and JavaScript functions only, so the React frontend goes to Netlify and the .NET API + PostgreSQL go to a container host. Any host that runs Docker works (Render, Railway, Fly.io, Azure Container Apps, AWS App Runner…). Free managed Postgres: Neon, Supabase, Render.

### 1. Deploy the API

**Render (easiest):** New → Blueprint → select this repo. `render.yaml` creates the API service and a Postgres database. In the service's environment set `Admin__Password` and `Cors__AllowedOrigins`.

**Any Docker host:** build `backend/Dockerfile` and set these environment variables:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` **or** `ConnectionStrings__Default` | `postgres://user:pass@host:5432/db` (Render/Neon/Supabase style) or an Npgsql connection string |
| `Jwt__Key` | Random secret, 32+ characters |
| `Admin__Username`, `Admin__Password` | First admin account (seeded only when no admin exists) |
| `Cors__AllowedOrigins` | Your Netlify site URL, e.g. `https://brightloop-reading-room.netlify.app` (empty = allow all) |
| `Room__Name` (default *BrightLoop Reading Room*), `Room__DueSoonDays`, `Room__TimeZone`, `Room__DefaultSeats` | Optional initial settings |
| `WhatsApp__PhoneNumberId`, `WhatsApp__AccessToken` | WhatsApp Business (Cloud) API credentials for automatic reminders (see below) |
| `WhatsApp__DefaultCountryCode` | Prefix for 10-digit mobiles (default `91`) |
| `Reminders__TriggerKey` | Secret for the external daily trigger `POST /api/reminders/run-external` |
| `PORT` | Injected by most hosts; the app binds to it automatically |

Migrations run automatically on startup. Verify with `https://<api-host>/api/health`.

### 2. Deploy the frontend to Netlify

The Netlify site **brightloop-reading-room** (https://brightloop-reading-room.netlify.app) already exists.

Pick either option:

**A. Link the repo in Netlify (recommended):** Netlify → project **brightloop-reading-room** → **Site configuration → Build & deploy → Link repository** → choose this repository and branch. Build settings are read from `netlify.toml` (base `frontend`, publish `dist`); every push then deploys automatically.

**B. GitHub Actions:** create a Netlify personal access token (User settings → Applications) and add it as the repository secret `NETLIFY_AUTH_TOKEN`. The workflow `.github/workflows/deploy-frontend.yml` builds and publishes the frontend on every push (set the repository variable `VITE_API_URL` to your API URL).

Then:
3. The API URL is set in `netlify.toml` (`VITE_API_URL = https://brightloop-api.onrender.com`). Override it with a `VITE_API_URL` environment variable in the Netlify dashboard if the API moves.
4. Deploy. Add the resulting Netlify URL to the API's `Cors__AllowedOrigins`.

CLI alternative:

```bash
cd frontend
VITE_API_URL=https://brightloop-api.onrender.com npm run build
npx netlify-cli deploy --prod --dir=dist
```

## WhatsApp due-date reminders

Reminders are sent through Meta's official **WhatsApp Business (Cloud) API** using an approved message template. Setup:

1. In [Meta for Developers](https://developers.facebook.com/) create an app with the WhatsApp product, add a phone number that is not already registered on regular WhatsApp, and create a **System User** token with `whatsapp_business_messaging` permission (a permanent token, not the 24-hour test token).
2. In WhatsApp Manager create two **Utility** templates (language `en`):

   `due_reminder` – four variables: student name, seat number, due date, pending balance.
   ```
   Hi {{1}}, your BrightLoop Reading Room subscription for seat {{2}} is due on {{3}}. Pending balance: {{4}}. Please renew to keep your seat. Reply here or call us.
   ```

   `payment_receipt` – five variables: student name, amount, date, receipt number, remaining balance. Sent automatically after each payment when "Send a WhatsApp receipt" is on in Settings.
   ```
   Hi {{1}}, we received {{2}} on {{3}} for your BrightLoop Reading Room subscription. Receipt no. {{4}}. Remaining balance: {{5}}. Thank you!
   ```

   Change the template names/language in Settings if you use different ones.
3. Set `WhatsApp__PhoneNumberId` and `WhatsApp__AccessToken` on the API host and restart it. The Reminders page shows "Connected" once they are picked up.
4. In **Settings → WhatsApp due-date reminders** switch reminders on and choose the rules: days before due (default `5,1`), remind on the due day, repeat every N days while overdue (default 3, stop after 30), and the send hour (default 09:00 in the room's time zone).

Every day at the send hour the API sends one reminder per matching student and records it in the history (a student is never messaged twice on the same day by the automatic job). Use **Send all now** on the Reminders page or **Send reminder** on a student's page for manual sends.

**If your API host sleeps when idle** (free tiers), the scheduled hour can be missed. Set `Reminders__TriggerKey` and have any external scheduler call the API once a day:

```bash
curl -X POST https://<api-host>/api/reminders/run-external -H "X-Reminder-Key: <Reminders__TriggerKey>"
```

The workflow `.github/workflows/daily-reminders.yml` does exactly this from GitHub Actions at 09:00 IST when the repository secrets `API_URL` and `REMINDER_TRIGGER_KEY` are set.

Costs: WhatsApp utility conversations in India cost a fraction of a rupee each, and the first 1,000 service conversations per month are free. Students must have opted in to receive business messages (ask at registration).

## API overview

All endpoints except login and health require `Authorization: Bearer <token>`. Full interactive docs at `/swagger`.

| Method | Route | Description |
| --- | --- | --- |
| POST | `/api/auth/login` | Get a JWT |
| POST | `/api/auth/change-password` | Change the admin password |
| GET | `/api/dashboard` | Stats + students with status (`?branchId=` for one branch; combined view includes per-branch cards) |
| GET / POST | `/api/students` | List (`?search=&status=&branchId=`) / register |
| GET / PUT / DELETE | `/api/students/{id}` | Read / update / delete |
| POST | `/api/students/{id}/payments` | Record a payment |
| POST | `/api/students/{id}/renew` | Extend by N months |
| POST | `/api/students/{id}/deactivate` · `/activate` | Mark as left / reactivate |
| GET | `/api/seats` | Seat map with occupants, section and AC flag (`?branchId=`) |
| PUT | `/api/seats/capacity` | Set total number of seats |
| PUT / DELETE | `/api/seats/{id}` | Label / enable / disable / remove |
| GET / POST / PUT / DELETE | `/api/branches` · `/api/branches/summary` | Branches and per-branch roll-up |
| PUT | `/api/seats/capacity` | Set a branch's total seats directly |
| GET / POST / PUT / DELETE | `/api/seats/sections` | Floor / room / section groups (add N seats, rename, AC toggle, remove) |
| GET / POST / PUT / DELETE | `/api/expenses` · `/api/expenses/summary` | Expenses and collected-vs-spent summary (`?branchId=&from=&to=`) |
| GET / PUT | `/api/settings` | Room name, due-soon days, time zone, currency, women's reservation %, minimum fee, reminder & receipt rules |
| GET | `/api/reminders/status` · `/preview` · `/logs` | Reminder configuration, today's candidates, history |
| POST | `/api/reminders/run` · `/send/{studentId}` | Send today's reminders / one manual reminder |
| POST | `/api/reminders/run-external` | Same as run, for external cron (header `X-Reminder-Key`) |

Due date = joining date + subscribed months. Status uses "today" in the configured time zone (default `Asia/Kolkata`).
