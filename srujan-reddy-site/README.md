# Srujan Kumar Reddy Konda · Congress work organiser

A single-page, no-build website to organise the political work, day-to-day work status and
business dealings of **Srujan Kumar Reddy Konda**, Indian National Congress karyakarta and
Rahul Gandhi supporter.

## Run it

Open `index.html` in any browser, or serve the folder statically:

```bash
cd srujan-reddy-site
python3 -m http.server 8080   # then visit http://localhost:8080
```

To host on Netlify, create a site with *publish directory* `srujan-reddy-site` and no build command.

## What is inside

- **Header** – Rahul Gandhi and Srujan Kumar Reddy Konda photos in spinning tricolour frames,
  animated Congress hand emblem, glowing slogans, waving flag ribbon and a slogan ticker.
  Photos are read from `assets/` (see `assets/README.md`) or can be uploaded from the page.
- **Dashboard** – open counts per section, overdue and due-this-week, upcoming list, recent
  changes, a daily Rahul Gandhi quote, export/import/print tools.
- **Political Work** – meetings, rallies, membership drives, grievances with status, priority,
  date, category, person involved, progress bar and notes.
- **Work Status** – the same organiser for everyday tasks and follow-ups.
- **Business Dealings** – adds amount and money flow (receivable / payable) with a live summary
  of what is to be received, to be paid and the net position.
- **Rahul Gandhi Corner** – animated milestone timeline plus a free notes area.

All data is stored in the browser's `localStorage`. Use **Export JSON backup** regularly and
**Import backup** to restore or move to another device. Sample entries are marked and can be
removed in one click from the dashboard.
