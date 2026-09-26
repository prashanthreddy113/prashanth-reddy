# Bloom — pregnancy journal

A private, installable web app for tracking a pregnancy. No server and no sign-in: everything is saved in the browser on the device you use (reports go into IndexedDB).

## What it does

- **Today**: days left to delivery, weeks + days pregnant, month, trimester, a 40-week timeline, baby's size this week, today's tablets and habits, next appointment.
- **Due date**: set it from weeks-pregnant-today (defaults to 20 weeks / 5th month), last period (LMP), the doctor's EDD, or a **scan report**.
- **Reports**: upload photos or PDFs of scans and lab reports. Enter the gestational age or EDD printed on a scan and the countdown is corrected automatically. A checklist shows which tests are due for the current week (NT scan, anomaly scan, OGTT, growth scan…).
- **Habits**: water, fruit & veg, protein, walk, stretches, Kegels, breathing, bonding, side-sleeping, plus your own. Streaks and a 7-day view.
- **Tablets**: daily doses with "taken" ticks, browser notifications, and an `.ics` export so the phone's calendar rings every day until the due date.
- **Sleep**: nightly log, 14-night chart against the 7–9 h band, sleep tips.
- **Stretch & move**: 12 pregnancy-safe stretches, each with an animated demonstration that moves in time with breathing cues, step-by-step instructions, reps and safety notes, a link to real videos, a guided timed routine for the current trimester, and an activity log against 150 min/week.
- **Mind games**: memory match, baby word scramble, calm breathing and quick maths. Each has six levels (Beginner, Intermediate, Advanced, Expert, Pro, Master) that unlock as she completes rounds, plus a daily affirmation.
- **Care tools**: kick counter, contraction timer (5-1-1), weight chart, mood & symptom journal, appointments, hospital-bag checklist, baby names, warning signs and emergency contacts.
- **Settings**: profile, doctor/hospital numbers, light/dark theme, JSON backup and restore.

## Run it

It is plain HTML/CSS/JS. Serve the folder with any static server:

```bash
cd pregnancy-tracker
python3 -m http.server 8080   # then open http://localhost:8080
```

To put it online, drag the `pregnancy-tracker` folder onto https://app.netlify.com/drop (or any static host). Then open it on the phone and use **Add to Home screen**: it runs like an app, works offline, and can show tablet notifications.

Bloom is a personal journal, not medical advice.
