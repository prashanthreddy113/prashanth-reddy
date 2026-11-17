# Suraj Real Estates – Hyderabad

A complete real-estate application for **Suraj Real Estates**: a colourful public website that promotes **residential and commercial** spaces, plus a staff console that runs day-to-day sales, CRM, collections and leasing.

React 19 + Vite + React Router, no other runtime dependencies. All charts and property artwork are hand-built SVG, so the app needs no image hosting.

## Brand

The logo (`src/components/Logo.jsx`, `public/favicon.svg`) plays on the name: *Suraj* means "sun". It shows a rising sun with rays behind a skyline of homes and offices, in a round dawn-sky badge (violet → pink → orange). The wordmark reads **SURAJ / REAL ESTATES**. The same sunrise gradient runs through the whole UI and the printed receipts and letters.

Head office: 8-2-299/82/W/83, Durga Bhavani Nagar, Women's Welfare Housing Society, Jubilee Hills, Hyderabad, Telangana 500034. Phone, WhatsApp and email are still placeholders; edit them in Admin → Settings → Company profile.

## Public website

| Page | What it does |
| --- | --- |
| **Home** | Animated hero with a property search (Residential / Commercial / Plots, type, budget), featured projects, residential and commercial promos, Narsingi location map with drive times, amenities, construction updates, testimonials and a call-back form |
| **Residential** / **Commercial** | Landing pages for each segment, with offers, benefits, projects, available configurations and lease availability (commercial) |
| **Projects** → **Project page** | RERA number, key facts, tabs for overview, payment plan, prices, **live unit availability** (tower/floor grid), amenities, location and construction timeline. Clicking any available unit opens its exact **cost sheet** (floor rise, PLC, parking, GST, stamp duty, registration), an EMI calculator, and either *Block this unit* or, for commercial units, *Lease* terms (rent, deposit, escalation) |
| **Search** | Filter by category, type, budget, status, availability and lease, then sort |
| **Shortlist & compare** | ♡ any listing and compare up to 4 side by side |
| **Resale & rentals** | Verified owner listings for sale, rent and commercial lease. Owners can post a property, which goes to admin approval |
| **Calculators** | EMI, loan eligibility, stamp duty + GST (Telangana), rental yield |
| **Customer portal** | Sign in with booking ID + mobile to see the payment schedule, receipts, construction progress, allotment letter, and to raise service requests |
| **Channel partners** | Broker registration, which goes to admin approval |
| About (with NRI desk), Contact, floating WhatsApp and call buttons, site-visit booking modal on every page |

Every enquiry, site-visit request, unit-block request, lease request and owner-contact request lands in the CRM as a lead. Repeat enquiries from the same mobile number are added as notes on the existing lead.

## Staff console (`/admin`)

| Module | Features |
| --- | --- |
| **Dashboard** | Bookings, collections, overdue, leads, inventory sold, unsold value, rent roll, visits; charts for sales vs collections over 12 months, inventory status, lead funnel, lead sources and project-wise sales; lists of follow-ups due, today's visits and top overdue accounts |
| **Leads & CRM** | Kanban board (drag between stages) and table view; filters; lead drawer with call / WhatsApp, stage bar, follow-up date, activity notes, schedule visit, **convert to booking** |
| **Site visits** | Week calendar, upcoming/past lists, WhatsApp reminders, outcome and feedback (moves the lead forward automatically) |
| **Bookings** | New-booking wizard (unit → customer → discount, partner, loan → live cost sheet). Booking page shows the payment schedule (construction-linked, ready-to-move or plot plan), editable due dates, demand letters, payment recording, printable **receipts** and **allotment letter**, home-loan tracking, partner commission, and status changes (registered / handed over / cancelled, which releases the unit) |
| **Customers** | Units, value, paid and overdue per customer |
| **Projects** | Edit details, pricing (base rate, floor rise, PLC, parking, club, maintenance, lease rate), website content, amenities, photo URL; bulk-add units; post construction updates (these appear on the website and the customer portal) |
| **Inventory** | Unit grid per tower with status counts and unsold value; edit any unit; book or lease from the grid |
| **Collections** | Overdue and next-30-days instalments, WhatsApp reminders, demand letters, receipts, monthly chart |
| **Leasing & rent** | Leases with yearly escalation, lock-in and deposit; monthly rent dues; collect rent; end a lease; create a lease from vacant units |
| **Channel partners** | Approve brokers, commission rates, commission earned / paid / payable |
| **Marketplace** | Approve or reject owner listings |
| **Service requests** | Reply to customer tickets and set their status |
| **Settings** | Company profile shown on the site, GST / stamp duty / registration rates, team, admin login, JSON backup and restore, reset to demo data |

Demo login: `admin@surajrealestates.in` / `suraj@123` (change it in Settings).

## Run

```bash
cd suraj-real-estates
npm install
npm run dev      # http://localhost:5174
npm run build    # production build in dist/
```

## Deploy (Netlify)

Create a new Netlify site from this repository with **Base directory = `suraj-real-estates`**. The included `netlify.toml` sets the build command, publish folder and SPA redirect.

## Before going live

- **Data is stored in the browser (localStorage).** That is fine for a demo or a single office machine, but each browser has its own copy and the admin login is client-side only. Use a backend before you put real customer data online. `src/lib/store.jsx` is the single place to swap in API calls.
- Everything in `src/lib/seed.js` is **sample content**: project names, RERA numbers (marked `SAMPLE`), prices, customers, partners and testimonials. Replace it with real data, or use Settings → Reset and edit through the admin.
- Tax defaults (GST 5% residential / 12% commercial; stamp 5.5% + transfer 1.5% + registration 0.5%) are indicative Telangana rates. Confirm them with your auditor in Settings.
- Add real renders by putting a **Photo URL** on each project (Admin → Projects → Edit → Website content).
