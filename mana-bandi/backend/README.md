# Mana Bandi API (మన బండి)

ASP.NET Core 8 + EF Core + PostgreSQL backend for the rider app, captain app and owner portal.
The contract is `../docs/07-API.md`; the owner-portal admin endpoints mirror `../owner-web/src/lib/api.js` and return the same JSON shapes as its mock.

```
backend/
  ManaBandi.sln
  Dockerfile                    multi-stage; migrations run on start
  scripts/simulate.sh           end-to-end ride (bash + curl + jq)
  ManaBandi.Api/
    Program.cs                  DI, JWT, policies, rate limits, CORS, ProblemDetails, /healthz
    Data/                       AppDbContext, migrations, DbInitializer, SeedData (towns/commission/terms/templates from the owner-web mock)
    Models/Entities.cs          users, otp_codes, consents, towns, landmarks, captains, captain_kyc, captain_documents, files,
                                rides, ride_events, offers, location_points, commission_rules, settlements, sos_events,
                                audit_log, company_settings, terms_versions, message_templates
    Auth/                       TokenService (JWT + role claims), OtpService (hashed OTPs)
    Sms/                        ISmsSender: ConsoleSmsSender, Msg91SmsSender
    Services/                   DispatchService (hosted), TripService (state machine), RideService, AreaService (fares, service area),
                                CommissionResolver (port of resolveCommission), Kyc (IKycProvider, ManualKycProvider, port of buildChecks),
                                SettlementService, AdminStatsService, FileStorage, AuditService, Views (JSON shapes)
    Controllers/                Auth/Me, Rider, Rides, Captain, AdminCaptains, Towns, Admin (live, dashboard, settings…), Commission,
                                Files, PublicTrack (/t/{token} page + JSON)
  ManaBandi.Api.Tests/          xUnit + WebApplicationFactory against a throwaway Postgres DB per test
```

## Run locally

Requirements: .NET 8 SDK, PostgreSQL 14+ (PostGIS is **not** needed), `jq` for the simulation script.

```bash
# one-time database
sudo -u postgres psql -c "CREATE ROLE manabandi LOGIN PASSWORD 'manabandi' CREATEDB;"
sudo -u postgres createdb -O manabandi manabandi

cd mana-bandi/backend
dotnet run --project ManaBandi.Api --launch-profile http     # http://localhost:5080, Swagger at /swagger
./scripts/simulate.sh                                       # in another terminal
dotnet test                                                 # creates and drops manabandi_test_<guid> databases
```

`appsettings.Development.json` uses the local DB, `Otp:DevMode=true` (the OTP is returned as `devCode` and logged),
owner login `owner@manabandi.in` / `owner-dev-password`, and `Seed:DemoData=true` (10 verified demo captains in
Narayanakhed, phones `+919000000000`…`09`; 0–6 bikes, 7–9 autos). Android emulator base URL: `http://10.0.2.2:5080`.

Tests use `TEST_PG_HOST`, `TEST_PG_USER`, `TEST_PG_PASSWORD` (default `localhost` / `manabandi` / `manabandi`; the role needs `CREATEDB`).

## Configuration (environment variables)

| Variable | Default | Notes |
| --- | --- | --- |
| `ConnectionStrings__Default` | – | `Host=…;Database=…;Username=…;Password=…;SSL Mode=Require`. Alternatively `DATABASE_URL=postgres://user:pass@host:5432/db` (Render/Railway style; `DATABASE_SSL=false` to disable TLS). |
| `Jwt__Key` | random per start | **Required in production**, ≥ 32 chars. Changing it logs everyone out. |
| `Otp__DevMode` | `false` | `true` returns/logs the OTP. Never with real users. |
| `Otp__Provider` | `console` | `console` (logs, delivers nothing) or `msg91`. |
| `Msg91__AuthKey`, `Msg91__TemplateId` | – | MSG91 auth key and DLT-approved OTP template id. |
| `Msg91__FlowTemplates__sos_trusted_contact`, `Msg91__FlowTemplates__captain_reupload` | – | MSG91 Flow template ids for transactional SMS. |
| `Files__Root` | `data/files` (`/data/files` in Docker) | KYC and parcel photos. Must be a persistent disk. |
| `Public__BaseUrl` | `https://api.manabandi.in` | Used in share links `…/t/{token}`. |
| `Cors__AllowedOrigins` | none | Comma-separated owner-portal origins, e.g. `https://admin.manabandi.in`. Mobile apps don't need CORS. |
| `Seed__OwnerEmail`, `Seed__OwnerPassword` | `owner@manabandi.in`, generated | Used only when no owner exists. A generated password is printed **once** to the log. |
| `Seed__DemoData` | `false` | Demo captains for testing only. |
| `Dispatch__OfferSeconds`, `Dispatch__RadiiKm`, `Dispatch__MaxSearchSeconds` | `15`, `3,5,8`, `90` | Also `Dispatch__TickMs` (1000), `Dispatch__HeartbeatStaleSeconds` (60), `Dispatch__Enabled`. |
| `RateLimit__OtpPerMinute`, `RateLimit__LoginPerMinute` | `20`, `10` | Per client IP, on top of the per-phone OTP limit (3 per 10 min). Raise if many users share a carrier NAT. |
| `Proxy__TrustForwardedHeaders` | `true` | Uses `X-Forwarded-For/Proto` from the platform proxy (Render, Railway, Caddy). Set `false` if the app is exposed directly. |
| `Swagger__Enabled` | `false` | Swagger is on in Development only unless enabled. |
| `PORT` | – | Honoured automatically (Render/Railway). |

Logs are JSON lines on stdout in production (one line per request: method, path, status, ms, user id, role, app version). OTP codes and share tokens are never logged outside DevMode.

## Deploy

The service is a single container + a managed PostgreSQL + a persistent disk for photos. Pick an **India (Mumbai, `ap-south-1`) region** for the database and the app (DPDP / latency).

**Render**: New → Web Service → Docker, root directory `mana-bandi/backend`. Region Singapore is the closest Render region today — if data must stay in India use Railway/AWS/a VM instead. Add a Render PostgreSQL (or an external Mumbai Postgres: AWS RDS `ap-south-1`, Neon `aws-ap-south-1`, Supabase Mumbai) and set `DATABASE_URL`. Add a Disk mounted at `/data/files`. Health check path `/healthz`.

**Railway**: New project → Deploy from repo, root `mana-bandi/backend` (Dockerfile detected) → add PostgreSQL plugin → set `DATABASE_URL=${{Postgres.DATABASE_URL}}`, `Jwt__Key`, OTP/MSG91 vars → add a Volume at `/data/files`.

**Any VM (e.g. AWS Lightsail/EC2 Mumbai, DigitalOcean Bangalore)**:

```bash
docker build -t manabandi-api .
docker run -d --name manabandi --restart unless-stopped -p 127.0.0.1:8080:8080 \
  -v /srv/manabandi/files:/data/files \
  -e ConnectionStrings__Default='Host=…;Database=manabandi;Username=…;Password=…;SSL Mode=Require' \
  -e Jwt__Key='…64 random chars…' -e Otp__Provider=msg91 -e Msg91__AuthKey=… -e Msg91__TemplateId=… \
  -e Public__BaseUrl=https://api.manabandi.in -e Cors__AllowedOrigins=https://admin.manabandi.in \
  manabandi-api
# HTTPS in front (automatic Let's Encrypt):  caddy reverse-proxy --from api.manabandi.in --to 127.0.0.1:8080
```

Migrations are applied automatically at start-up (`DbInitializer`), then launch data is seeded once per table. Run one instance
at first; more instances are safe (dispatch takes a Postgres advisory lock, accepts are conditional UPDATEs) but uploaded files then need shared storage.

### HTTPS is mandatory for the Android apps

Android 9+ blocks clear-text HTTP by default, and phone numbers, OTPs, locations and KYC photos must never travel unencrypted.
Serve the API only on `https://` (Render/Railway give TLS automatically; on a VM use Caddy or nginx + certbot) and point the
apps' release `BASE_URL` at it. `http://10.0.2.2:5080` is for the emulator only.

### Backups

- Database: use the provider's daily automated backups with point-in-time recovery (RDS/Neon/Supabase/Render paid plans) and keep ≥ 7 days. Add a nightly off-site dump: `pg_dump -Fc "$DATABASE_URL" > manabandi-$(date +%F).dump` to an India-region bucket (S3 `ap-south-1`) with encryption. Test a restore (`pg_restore -d newdb file.dump`) before launch.
- Photos (`/data/files`): nightly `rclone sync /srv/manabandi/files s3:manabandi-files-backup` (or the platform's volume snapshots). KYC photos are personal data: encrypted bucket, restricted IAM, retention per the terms.
- `location_points` grows fastest; archive/delete points older than 90 days once the retention policy is agreed.

### Switch OTP to MSG91

1. Create an MSG91 account, finish **DLT registration** (entity + sender id header + template) on a telco portal (e.g. Jio/Vi DLT), then add the approved OTP template in MSG91 → OTP → Templates. The template text must contain `##OTP##` (e.g. `మన బండి OTP: ##OTP##. Mana Bandi OTP ##OTP##. Valid 5 min.`).
2. Set `Otp__Provider=msg91`, `Msg91__AuthKey=<auth key>`, `Msg91__TemplateId=<OTP template id>`, `Otp__DevMode=false`.
3. For SOS and re-upload SMS create Flow templates and set `Msg91__FlowTemplates__sos_trusted_contact` / `__captain_reupload` (variables `name`, `link` / `docs`, `note`).
4. Restart and log in with a real phone. `channel=call` requests an additional voice OTP through MSG91's retry API. Failures return `502 sms_failed` and are logged with the phone masked.

The server generates the 4-digit code, stores only an HMAC of it, and sends it via the OTP API (`POST /api/v5/otp?template_id&mobile&otp`); MSG91's own verify endpoint is not used.

### KYC provider

`ManualKycProvider` computes the verification chips from fields typed by the office or captured from documents (docs/05 §4 rules, port of owner-web `buildChecks`, plus DL class, age, expiring-soon and duplicate-DL checks). To automate, implement `IKycProvider` with a DigiLocker aggregator (Setu, Cashfree, Signzy, IDfy, HyperVerge…): start a DigiLocker session, fetch e-Aadhaar/DL/RC, call face-match + liveness, fill `CaptainDocs` (Aadhaar **last 4 only**), then return `KycRules.BuildChecks(...)`. Register it in `Program.cs` in place of `ManualKycProvider`. Police verification stays manual (`PATCH /api/captains/{id}/police-verification`); approved captains without it are blocked from going online after 30 days.

## API notes beyond the contract

- `GET /api/me` returns the `user` object with a `captain` property for captains; users also carry `termsCurrentVersion` and `termsRequired`.
- `GET /api/terms/current?audience=&lang=` (public) for the apps' Terms screen.
- `POST /api/auth/password { currentPassword, newPassword }` for portal users. `POST /api/admin/users` returns `tempPassword` once (no e-mail service yet).
- Owner portal extras: `POST /api/captains/verify` (docs body, before the captain exists), `PUT /api/captains/{id}/docs`, `POST /api/captains/{id}/documents/{kind}` (office upload), `GET /api/admin/sos`, `POST /api/admin/sos/{id}/resolve`, `GET /api/settlements?period=current|previous|yyyy-MM-dd` (weeks are Monday–Sunday IST), `?days=` on analytics.
- Portal ride statuses use the mock vocabulary (`assigned`, `on_trip`, `unfulfilled`); the raw status is in `rideStatus`.
- Town managers are pinned to their town on every list; they can edit landmarks/support numbers of their own town but not fares, commission, settings, users or audit.
- Dispatch offers each searching ride to the nearest eligible captain within the largest radius (3 → 5 → 8 km); the radius grows per round, and an empty inner ring is skipped immediately rather than making the rider wait.
- Final fare uses the recorded GPS trail when it is longer than the straight line and shorter than twice it (GPS jumps > 0.5 km at > 150 km/h are ignored), otherwise the quote.
- Files: KYC images are served only to the owner and the captain's town manager; parcel/trip photos also to that ride's rider and captain.

## Go-live checklist

- [ ] Managed Postgres in Mumbai, automated backups + PITR on, restore tested; app in the same region.
- [ ] `Jwt__Key` set (64 random chars) and stored in the platform's secret store; `Otp__DevMode=false`; `Seed__DemoData=false`.
- [ ] Remove any demo captains if the DB was ever seeded with them: `DELETE FROM captain_kyc WHERE "CaptainId" LIKE 'c_demo_%'; DELETE FROM captains WHERE "IsDemo"; DELETE FROM users WHERE "IsDemo";` (only if they have no rides).
- [ ] HTTPS domain (`api.manabandi.in`) live; `Public__BaseUrl` points to it; apps built with that base URL.
- [ ] MSG91 DLT templates approved; `Otp__Provider=msg91`; real OTP received on Jio, Airtel, BSNL and Vi numbers; SOS SMS template set.
- [ ] Owner password: the generated one copied from the first-start log and changed via `POST /api/auth/password`; town managers added in Settings.
- [ ] Persistent volume mounted at `/data/files`, backed up; upload a KYC photo and view it in the portal.
- [ ] `Cors__AllowedOrigins` = the portal's exact origin.
- [ ] Towns: centre, radius, fares, night hours, support phones and landmarks reviewed in the portal; commission rules and terms version checked.
- [ ] Each launch captain onboarded: documents uploaded, checks green (or reviewed), approved, police verification tracked.
- [ ] Health check `/healthz` wired to the platform + an uptime monitor (e.g. UptimeRobot) with SMS/WhatsApp alerts.
- [ ] Dry run in the town: 2 captains + 2 riders do rides and a parcel end-to-end; share link opened on a family member's phone; SOS tested with a trusted contact.
- [ ] Log retention and access to the owner portal limited to staff; privacy policy/terms published at the URL the apps open.
