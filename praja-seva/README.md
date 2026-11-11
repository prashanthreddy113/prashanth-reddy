# Praja Seva — one app for citizens and the municipality

Praja Seva connects the people of a Telangana municipality (or corporation) with its departments and its elected head (Chairperson or Mayor). Citizens report problems and track them. Officers work a queue with deadlines. The Chairperson and Commissioner see the whole town on one dashboard.

It runs on plain Node.js (20 or later) and needs no packages to install. It works in English and Telugu, on phones and desktops, and can be installed as an app from the browser (PWA).

## What it does

**Citizens (mobile number + OTP login)**
- Report a problem in 17 categories: garbage, drains, water supply, streetlights, roads, stray dogs, encroachment, certificates and more. Each report can carry a photo, a GPS location and a ward.
- Get a complaint number (`PS-2026-000123`), a deadline, the assigned officer and a status timeline.
- Rate the work when it is resolved, or reopen it within 7 days if it was not fixed.
- Look up property tax by assessment number and pay it (demo payment; see Production below).
- Ask for a meeting with the Chairperson (Praja Vani).
- Read municipal notices for everyone or for their own ward.
- See the public service report: totals, open, resolved, the share resolved on time, and the average rating.

**Municipal staff (username + password)**

| Role | Sees | Can do |
| --- | --- | --- |
| Chairperson / Mayor | Everything | Dashboard, all complaints, action-plan tracker, Praja Vani meeting requests, notices, staff accounts, audit log, tax collection |
| Commissioner | Everything | Same as the Chairperson |
| Department officer | Complaints for their department | Assign within the department, start work, resolve, reject (with a remark) |
| Ward officer | Complaints in their ward | Assign, start work, resolve, reject |

- **Deadlines and escalation:** each category has a target time in hours, set in `server/config.js`. A complaint past its deadline counts as escalated to the Commissioner. Once it is late by a further full target period, it counts as escalated to the Chairperson. Escalated complaints sort to the top of the queue.
- **Action-plan tracker:** comes pre-loaded with the blueprint's 100-day, 1-year and 5-year items.
- **Audit log:** records every login, assignment, status change, payment and edit.

## Run it

```bash
cd praja-seva
npm run demo        # demo mode: OTP shown on screen, demo payments, staff password demo1234
```

Open http://localhost:8080. Demo staff usernames are `chairperson`, `commissioner`, `sanitation`, `engineering`, `electrical`, `townplanning`, `revenue`, `greenery`, `admin` and `ward1`. Demo assessment numbers run from `1000000001` to `1000000006`.

```bash
npm test            # API tests (Node's built-in test runner)
npm start           # production mode: random staff passwords, printed once and saved to data/initial-credentials.txt
```

### Configure for your town

| Variable | Example | Default |
| --- | --- | --- |
| `MUNICIPALITY_NAME` | `Jangaon Municipality` | Sample Municipality |
| `MUNICIPALITY_NAME_TE` | Telugu name | నమూనా పురపాలక సంఘం |
| `CONSTITUENCY` | `Jangaon Assembly Constituency` | Sample Assembly Constituency |
| `HEAD_TITLE` | `Chairperson` or `Mayor` | Chairperson |
| `WARD_COUNT` | `30` | 30 |
| `PORT` | `8080` | 8080 |
| `DATA_DIR` | `/data` | `./data` |
| `DEMO` | `1` for demo mode | off |

Categories, departments and deadline hours live in `server/config.js`.

### Docker

```bash
docker build -t praja-seva praja-seva
docker run -p 8080:8080 -v praja-data:/data -e MUNICIPALITY_NAME="Your Municipality" praja-seva
```

## Production checklist

Demo mode is for trying the app. Before real citizens use it:

1. **SMS OTP:** replace `defaultSms` in `server/api.js` with your SMS gateway. In India this needs a DLT-registered template.
2. **Payments:** connect a payment gateway. Record a payment only after the gateway's verified callback. Outside demo mode, the demo pay endpoint returns 501.
3. **Database:** the JSON file store suits one town's pilot. Move to PostgreSQL before scaling to many towns or heavy traffic.
4. **HTTPS:** run behind a TLS proxy such as Nginx, Caddy or a cloud load balancer.
5. **Change every staff password** after first login (Staff → Change password).
6. **Back up** `DATA_DIR` daily.
7. **Integrations:** link to existing state systems (TS-bPASS, CDMA property-tax and certificate portals) rather than duplicating them.

## Layout

```
praja-seva/
  server/config.js   categories, departments, deadline hours, town settings
  server/store.js    JSON store with atomic writes, password hashing, first-run seed
  server/api.js      REST API, roles, validation, escalation, statistics
  server/index.js    HTTP server, static files, security headers
  public/            single-page app (index.html, app.js, i18n.js, styles.css, sw.js)
  test/api.test.js   API tests
```
