# BrightLoop Reading Room – Admin

A complete admin console for the BrightLoop reading room. Admins register students, assign seat numbers, track fees, and see at a glance whose subscription is due.

| Layer | Tech |
| --- | --- |
| Frontend | React 19 + Vite + React Router (hosted on **Netlify**) |
| Backend | ASP.NET Core 8 Web API, EF Core, JWT auth (Docker; Render / Railway / Azure / any host) |
| Database | PostgreSQL 16 |

## Features

- **Admin login** (JWT). A default admin is seeded on first run; change the password from Settings.
- **Register students** – mandatory: name, mobile. Optional: address, Aadhaar, study/course, months to join, amount per month, total paid, joining date, seat number, notes.
- **Seats** – admin sets how many seats the room has; the seat map shows free / occupied / due-soon / overdue seats. Seats can be labelled or disabled. Register a student directly from a free seat.
- **Dashboard** – every student with computed due date, balance and status, colour-coded:
  - 🟢 **Running** – more than *N* days left
  - 🟡 **Due soon** – due within the next *N* days (default 5, configurable)
  - 🔴 **Due today / Overdue** – due date has arrived or passed
  - ⚪ **Left** – deactivated (seat released, history kept)
- **Payments & renewals** – record payments (with history), extend the subscription by months, WhatsApp reminder link, print list.
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
| `PORT` | Injected by most hosts; the app binds to it automatically |

Migrations run automatically on startup. Verify with `https://<api-host>/api/health`.

### 2. Deploy the frontend to Netlify

The Netlify site **brightloop-reading-room** (https://brightloop-reading-room.netlify.app) already exists.

1. Netlify → project **brightloop-reading-room** → **Site configuration → Build & deploy → Link repository** → choose this repository and branch.
2. Build settings are read from `netlify.toml` (base `frontend`, publish `dist`).
3. Add the environment variable **`VITE_API_URL`** = your API URL (no trailing slash), e.g. `https://brightloop-api.onrender.com`.
4. Deploy. Add the resulting Netlify URL to the API's `Cors__AllowedOrigins`.

CLI alternative:

```bash
cd frontend
VITE_API_URL=https://brightloop-api.onrender.com npm run build
npx netlify-cli deploy --prod --dir=dist
```

## API overview

All endpoints except login and health require `Authorization: Bearer <token>`. Full interactive docs at `/swagger`.

| Method | Route | Description |
| --- | --- | --- |
| POST | `/api/auth/login` | Get a JWT |
| POST | `/api/auth/change-password` | Change the admin password |
| GET | `/api/dashboard` | Stats + all students with status |
| GET / POST | `/api/students` | List (`?search=&status=`) / register |
| GET / PUT / DELETE | `/api/students/{id}` | Read / update / delete |
| POST | `/api/students/{id}/payments` | Record a payment |
| POST | `/api/students/{id}/renew` | Extend by N months |
| POST | `/api/students/{id}/deactivate` · `/activate` | Mark as left / reactivate |
| GET | `/api/seats` | Seat map with occupants |
| PUT | `/api/seats/capacity` | Set total number of seats |
| PUT / DELETE | `/api/seats/{id}` | Label / enable / disable / remove |
| GET / PUT | `/api/settings` | Room name, due-soon days, time zone, currency |

Due date = joining date + subscribed months. Status uses "today" in the configured time zone (default `Asia/Kolkata`).
