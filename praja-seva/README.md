# Praja Seva: municipal websites for citizens and the municipality

Praja Seva gives a Telangana municipality (or corporation) three connected websites served from one Node.js server. It needs no packages to install, works in English and Telugu, and works on phones and desktops.

| Website | Address | For | What it does |
| --- | --- | --- | --- |
| **Municipal portal** | `/` | Everyone, no login | Home page with live numbers, the Citizen Charter with deadlines, tracking by number, development works, the live service report (KPI scorecard and ward heat map), council meetings and resolutions, ward pages with councillors and committees, the budget with its green-budget share, the vision and 100-day plan, notices and tenders, and contacts |
| **Citizen services** | `/app/` | Citizens (mobile + OTP) | Report a problem with a photo and GPS, apply for 10 online services, track complaints and applications, rate or reopen work, pay property tax, request a meeting with the Chairperson |
| **Municipal office** | `/office/` | Chairperson/Mayor, Commissioner, officers, ward officers | The department console, described below |

**Municipal office modules**

| Area | Modules |
| --- | --- |
| Overview | Dashboard; printable **review report** (one page for CM, Minister or Collector reviews); KPI scorecard against the blueprint's targets |
| Citizen services | Complaint queue with assignment, deadlines and escalation; walk-in complaint registration (Praja Vani, helpline, ward committee); service-application queue (verify, approve, issue, reject); Praja Vani appointments |
| Field work | Field inspections, which can be turned into tracked complaints in one click; development works with scheme, sanctioned amount, spending, progress and update history |
| Governance | Council meetings (schedule, agenda, minutes, resolutions, publish to the portal); ward committees (members by youth, women, senior and eminent citizens, meeting log, coverage map); wards and councillors; 100-day / 1-year / 5-year action plan |
| Finance | Budget heads with allocation, spending and green-budget share; property-tax collection by ward |
| Administration | Notices, tenders and events; staff accounts; audit log; CSV export of complaints, works and applications; own password |

Roles are enforced on the server:
- The Chairperson and Commissioner see and manage everything.
- Department officers see their own department's complaints and applications. They can update a work's progress, but not its money.
- Ward officers manage only their own ward's complaints, committees and inspections.

**Escalation:** each complaint type has a target time in hours, set in `server/config.js`. A complaint past its deadline counts as escalated to the Commissioner. Once it is late by a further full target period, it counts as escalated to the Chairperson. Escalated complaints sort to the top of the queue.

**Audit log:** records every login, assignment, status change, payment and edit.

## Run it

```bash
cd praja-seva
npm run demo        # demo mode: OTP shown on screen, demo payments, staff password demo1234
```

Open http://localhost:8080 for the portal, http://localhost:8080/app/ for citizen services and http://localhost:8080/office/ for the municipal office. Demo mode also loads sample activity so every page has data to review: 64 complaints, 8 works, 3 council meetings, ward committees, inspections, budget figures, KPI entries and 60 tax assessments. Set `NO_DEMO_DATA=1` to skip it. Demo staff usernames are `chairperson`, `commissioner`, `sanitation`, `engineering`, `electrical`, `townplanning`, `revenue`, `greenery`, `admin` and `ward1`. Demo assessment numbers run from `1000000001` to `1000000006`.

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
| `HEAD_NAME`, `COMMISSIONER_NAME` | Names shown on the portal | "to be updated" |
| `HELPLINE`, `CONTACT_EMAIL`, `OFFICE_ADDRESS`, `OFFICE_HOURS`, `PRAJA_VANI` | Portal contact details | placeholders |

Categories, departments, deadline hours, online services, work types, schemes and KPI targets live in `server/config.js`.

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
  server/config.js     categories, services, departments, deadlines, KPIs, town settings
  server/store.js      JSON store with atomic writes and migration, password hashing, first-run seed
  server/seed-demo.js  wards and budget heads; sample activity in demo mode
  server/api.js        auth, complaints, tax, appointments, notices, staff, roles
  server/modules.js    portal data, applications, works, council, committees, inspections, budget, KPIs, report, CSV
  server/index.js      HTTP server, three sites, security headers
  public/              portal (index.html, site.js, site.css), shared (common.js, i18n.js, styles.css, sw.js)
  public/app/          citizen services and municipal office (one app; /office/ shows the staff console)
  test/                API tests for every module
```
