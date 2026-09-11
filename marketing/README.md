# Field Marketing Tool

A mobile-first app for a marketing team that visits shops and clients in the field.
Executives capture each shop on their phone (photos, GPS location, owner's mobile, how interested they are), log every follow-up, and the admin sees the whole pipeline, the team's activity and which follow-ups are slipping.

| Layer | Tech |
| --- | --- |
| Frontend | React 19 + Vite + React Router, mobile-first (hosted on **Netlify**) |
| Backend | ASP.NET Core 8 Web API, EF Core, JWT auth (Docker; Render / Railway / Azure / any host) |
| AI | Claude (Anthropic API, official C# SDK) – optional, switched on with an API key |
| Database | PostgreSQL 16 (photos and the company logo are stored in the database, so no file storage is needed) |

## What it does

### For the admin
- **Company profile** – company name, tagline and **logo** (shown on the login page, the sidebar and the phone header), currency, country code, time zone.
- **Projects / products** – create the things being marketed (e.g. *Solar Water Heater*, *Herbal Tea Range*), each with a colour and an optional lead target.
- **Marketing team** – create executive logins, assign **one or many projects** to each, reset passwords, deactivate (a deactivated executive is locked out immediately). Executives only ever see their own leads and can capture leads only for their assigned projects.
- **Dashboard** – visits today / this week / this month, new leads, hot leads, follow-ups due & overdue, conversions and rate, pipeline value; a 30-day visits-vs-leads chart; pipeline by status and interest; progress per project against its target; **executive leaderboard**; due follow-ups; live activity feed. Filter by project, executive and period.
- **All leads** – search by shop, contact, mobile, area; filter by status, project, executive, interest, follow-up state, city and date; reassign a lead to another executive; **export CSV** (with Google-Maps links).
- **Sample data** – one click loads 3 projects, 3 executives and 30 leads to explore; one click removes them.

### For the marketing executive (on the phone)
- **New lead** in under a minute: take **shop photos** with the camera (shrunk on the phone before upload), **GPS location** is captured automatically, pick the project, type shop name, owner and mobile, rate **interest 1–5 stars**, set the expected order value and the **next follow-up date** with one tap.
- **Duplicate check** – typing a mobile number that already exists shows the existing lead; saving the same number twice in the same project is blocked (you can open the existing lead instead).
- **Lead page** – Call, WhatsApp and Navigate buttons, status pipeline chips (New → Follow-up → Negotiation → Converted / Lost), photo gallery, and a timeline of every visit, call, WhatsApp, meeting and note. Logging a visit records the visit location too.
- **Follow-ups** – Overdue / Today / Next 7 days / Not planned, each with call and WhatsApp shortcuts. A visit or call logged on the due day clears the follow-up.
- **My dashboard** – the executive's own visits, hot leads, due follow-ups, cities and shop types.

### Smart bits
- Interest score + status give a "hot lead" flag (threshold configurable), highlighted everywhere.
- Follow-up states are computed in the company's time zone, so "today" is correct in India even though the server runs in UTC.
- Leads untouched for 7 days are counted on the dashboard so nothing goes stale.
- Autocomplete for city, area and shop type from what the team already typed.
- Works as a home-screen web app on Android and iPhone (add to home screen from the browser).

### AI assistant (Claude)
Switch it on once: Settings → **AI assistant** → paste an Anthropic API key (or set the `Anthropic__ApiKey` environment variable on the API). Pick the model there too (Claude Opus 5 by default; Sonnet 5 or Haiku 4.5 for lower cost). Usage (calls and tokens per month) is shown on the same card.

- **Smart fill** on the New lead form – the executive taps 🎤 and says what happened in English, Hindi, Telugu, Tamil, Kannada or Marathi (or types it). The AI reads the note **and the shop photos** (signboard → shop name, shop type, what is on display) and fills the form: shop, contact, mobile, area, interest score, status, expected value, next follow-up date and a clean note. Filled fields are highlighted so they can be checked before saving; the raw dictated note is kept in the lead history.
- **AI insight** on every lead – where it stands, the next best action, talking points, risks, and a ready-to-send **WhatsApp message** in English, Hinglish, Hindi, Telugu, Tamil or Kannada, for a follow-up, thank-you, offer, reminder or reconnect. One tap opens WhatsApp with the text.
- **Today's briefing** on the admin dashboard – how the team is doing, what needs attention and a prioritised action list with links to the leads.
- **Plan my day** on the executive dashboard – which shops to visit or call today and why, from their overdue follow-ups and hot leads.

Briefings are cached for an hour and insights until the lead changes, so repeat views cost nothing. Executives only ever get AI answers about their own leads. Photos sent to the AI are the same compressed images stored with the lead.

## Project layout

```
marketing/
  backend/Marketing.Api   ASP.NET Core API (Controllers, Models, Data/Migrations, Services)
  backend/Dockerfile      Production image for the API
  frontend/               React app (Vite)
  docker-compose.yml      Local Postgres + API
  render.yaml             Optional one-click API + Postgres on Render
  netlify.toml            Netlify build config for the frontend
```

## Run locally

Prerequisites: .NET 8 SDK, Node 22, PostgreSQL (or Docker).

```bash
# 1. Database (either a local Postgres with db/user "marketing"/"marketing", or:)
cd marketing && docker compose up db -d

# 2. API  → http://localhost:5090  (Swagger UI at /swagger)
cd marketing/backend/Marketing.Api
dotnet run

# 3. Frontend → http://localhost:5174  (proxies /api to the API)
cd marketing/frontend
npm install
npm run dev
```

Sign in with **admin / admin123** (from `appsettings.json`; change it in Settings after the first login).
Then: Settings → upload your logo and company name · Projects → add a product · Team → add an executive and tick their projects · give them the site URL and their login.

To try it with data first: Dashboard → **Load sample data** (executives `ravi.demo`, `priya.demo`, `arjun.demo`, password `demo123`).

### Configuration (environment variables)

| Variable | Purpose |
| --- | --- |
| `ConnectionStrings__Default` or `DATABASE_URL` | PostgreSQL connection (Render/Railway/Neon style `postgres://…` URLs are accepted) |
| `Jwt__Key` | Long random secret (≥ 32 chars) for login tokens – **required in production** |
| `Admin__Username`, `Admin__Password` | First admin, created only when the users table is empty |
| `Company__Name`, `Company__Tagline`, `Company__Currency`, `Company__DefaultCountryCode`, `Company__TimeZone` | Defaults for the company profile (editable in Settings later) |
| `Cors__AllowedOrigins` | Comma-separated frontend origins, e.g. `https://your-site.netlify.app`. Empty = any origin |
| `Anthropic__ApiKey`, `Anthropic__Model` | Optional. Anthropic key/model for the AI features; when unset the admin can enter them in Settings → AI assistant |
| `PORT` | Set automatically by Render/Railway; the API binds to it |

## Deploy

### API on Render (free tier)
1. Render → **New → Blueprint**, pick this repository, blueprint file `marketing/render.yaml`. It creates `marketing-api` and a Postgres database.
2. In the service's Environment tab set `Admin__Password` and `Cors__AllowedOrigins` (your Netlify URL).
3. Note the API URL, e.g. `https://marketing-api.onrender.com` – `/api/health` should answer `{"status":"ok"}`.

The database migrations run automatically on start-up. Photos live in Postgres; on the free Render database plan keep an eye on the 1 GB limit (a photo is ~150–300 KB after the phone shrinks it; roughly 4,000 photos).

### Frontend on Netlify
1. Netlify → **Add new site → Import an existing project**, choose this repository.
2. Base directory `marketing/frontend`, build command `npm ci && npm run build`, publish directory `marketing/frontend/dist` (or let `marketing/netlify.toml` set these).
3. Environment variable `VITE_API_URL` = the Render API URL (no trailing slash).
4. Deploy. Executives open the Netlify URL on their phone and add it to the home screen.

If the API URL changes later, the login page also has **Change API server**, which stores the URL in the browser without a rebuild.

### GitHub Actions
- `.github/workflows/marketing-build-api.yml` – compiles the API on every push touching `marketing/backend`.
- `.github/workflows/marketing-deploy-frontend.yml` – builds the frontend and deploys to Netlify when the `NETLIFY_AUTH_TOKEN` secret and `MARKETING_NETLIFY_SITE_ID` variable are set (optional `MARKETING_VITE_API_URL` variable).

## API overview

All endpoints except `POST /api/auth/login`, `GET /api/company` and `GET /api/company/logo` need `Authorization: Bearer <token>`.

| Area | Endpoints |
| --- | --- |
| Auth | `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/change-password` |
| Company | `GET /api/company` (public branding), `GET /api/company/logo`, `GET/PUT /api/settings`, `POST/DELETE /api/settings/logo` (admin) |
| Projects | `GET /api/projects` (executives get only their assigned active projects), `POST/PUT/DELETE /api/projects/{id}` (admin) |
| Team | `GET/POST /api/users`, `PUT /api/users/{id}`, `POST /api/users/{id}/reset-password`, `DELETE /api/users/{id}` (admin) |
| Leads | `GET /api/leads` (search & filters, paged), `GET /api/leads/{id}`, `POST /api/leads` (`?force=true` to override a duplicate), `PUT /api/leads/{id}`, `DELETE` (admin), `GET /api/leads/check-mobile`, `GET /api/leads/suggestions`, `GET /api/leads/export` (CSV, admin) |
| Activities & photos | `POST /api/leads/{id}/activities`, `DELETE /api/leads/{id}/activities/{aid}`, `POST /api/leads/{id}/assign` (admin), `POST /api/leads/{id}/photos`, `GET /api/leads/{id}/photos/{pid}?thumb=true`, `DELETE /api/leads/{id}/photos/{pid}` |
| Dashboard | `GET /api/dashboard?projectId&userId&days` |
| AI | `GET /api/ai/status`, `POST /api/ai/capture-assist` (note + photos → form fields), `GET /api/ai/leads/{id}/insight?language=`, `POST /api/ai/leads/{id}/message`, `GET /api/ai/briefing` |
| Sample data | `GET /api/demo`, `POST /api/demo/seed`, `DELETE /api/demo` (admin) |

Swagger UI with every request/response schema is at `/swagger` on the API.
