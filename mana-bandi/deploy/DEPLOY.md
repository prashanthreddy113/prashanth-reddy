# Mana Bandi — deploy and go live

Everything below is done once. Time needed: about 2 hours, plus waiting for DNS.

## 1. Accounts to create

| What | Where | Notes |
| --- | --- | --- |
| Domain `manabandi.in` | any registrar (GoDaddy, Hostinger, BigRock…) | ~₹700/yr |
| Cloud server + database | DigitalOcean (region **Bangalore, BLR1**) or AWS Lightsail Mumbai | card or UPI billing |
| Owner portal hosting | Netlify (free) | sign in with GitHub |
| SMS OTP | MSG91 + DLT registration (Jio/Vodafone/Airtel DLT portal) | DLT approval takes 2–7 days — **start first** |
| Uptime alerts | UptimeRobot (free) | SMS/email when the server is down |

## 2. Database (DigitalOcean → Databases → Create)

PostgreSQL 16, Bangalore, the smallest plan (1 GB). After it is ready: **Trusted sources → add the Droplet** (next step), and copy the connection details. Daily backups are included.
Cheaper alternative: skip this and run PostgreSQL on the server (`--profile localdb`, see `.env.example`) — then `backup-db.sh` is your only backup, so copy `/var/backups/manabandi` off the server weekly.

## 3. Server (DigitalOcean → Droplets → Create)

Ubuntu 24.04, Bangalore, **2 vCPU / 4 GB** (Basic, ~$24/mo), add your SSH key. Then:

```bash
ssh root@SERVER_IP
curl -fsSL https://get.docker.com | sh              # installs Docker + compose plugin
ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw --force enable
git clone https://github.com/prashanthreddy113/prashanth-reddy.git /opt/manabandi
cd /opt/manabandi && git checkout claude/telugu-transportation-app-0zww5h
cd mana-bandi/deploy && cp .env.example .env && nano .env   # fill every CHANGE_ME
```

## 4. DNS (at your domain registrar)

| Type | Name | Value |
| --- | --- | --- |
| A | `api` | the Droplet's IP |
| CNAME | `admin` | your Netlify site (`xxxx.netlify.app`) — after step 6 |

Wait until `ping api.manabandi.in` shows the Droplet IP.

## 5. Start the backend

```bash
cd /opt/manabandi/mana-bandi/deploy
docker compose up -d --build          # first build takes ~3 minutes
docker compose logs -f api            # wait for "Now listening on"; Ctrl+C to leave
curl https://api.manabandi.in/healthz # → {"status":"ok","db":"ok",…}
```
Caddy fetches the HTTPS certificate automatically on the first request. Database tables are created and the two towns, fares, landmarks, commission rules and terms are seeded on first start.

Backups: `crontab -e` and add `15 2 * * * /opt/manabandi/mana-bandi/deploy/backup-db.sh`.
Uptime: in UptimeRobot add an HTTPS monitor for `https://api.manabandi.in/healthz`.

**Update to a new version later:** `cd /opt/manabandi && git pull && cd mana-bandi/deploy && docker compose up -d --build`.

## 6. Owner portal (Netlify)

Add new site → Import from GitHub → this repo → branch `claude/telugu-transportation-app-0zww5h` (or `main` after merging) → **Base directory `mana-bandi/owner-web`** → Environment variable `VITE_API_URL=https://api.manabandi.in` → Deploy. Then Domain management → add `admin.manabandi.in`.
Sign in with `Seed__OwnerEmail` / `Seed__OwnerPassword` from `.env`. Check Service areas (radius, fares, landmarks, support phone for each town), Commission, Terms, and add town managers under Settings → Users.

## 7. Android apps (on your computer, Android Studio)

Release builds already use `https://api.manabandi.in`. For each app (`mana-bandi/android`, `mana-bandi/android-captain`): Build → Generate Signed App Bundle or APK → APK → create a keystore (**back it up with its passwords — you cannot update the app without it**) → release. Share the APKs on WhatsApp for the pilot; submit the same build to Google Play in parallel.

## 8. Before real customers (go‑live checklist)

- [ ] `https://api.manabandi.in/healthz` is OK and UptimeRobot is watching it
- [ ] `.env` has `Otp__DevMode=false`, `Otp__Provider=msg91`, real MSG91 keys (DLT template approved) — test a login with your own phone
- [ ] Owner password changed from the seed value; `.env` readable only by root (`chmod 600 .env`)
- [ ] Towns: radius, fares, night hours, landmarks and support phone checked in the portal
- [ ] Captains onboarded at the office, documents uploaded, approved in the portal; police verification requested
- [ ] One day of staff test rides: booking, dispatch, GPS on the rider's map, share link, parcel with delivery OTP, cash collection, settlements
- [ ] Terms published; privacy policy page live (needed by Google Play)
- [ ] Backups running (`ls /var/backups/manabandi`) and a restore tried once on a spare database
- [ ] Legal: aggregator licence application filed; bike rides off until the state permits them
