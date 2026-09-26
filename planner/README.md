# Founder's Daybook

A planner for work, timetable, exercise, diet, startup progress and colourful notes, with **logins**. The owner creates an account for each person, and everyone's daybook is private to them and follows them to any device.

| Page | Who | What |
| --- | --- | --- |
| `/` | Everyone with a login | The daybook: Today, Tasks, Timetable, Exercise, Diet, Startup, Notepads, Account |
| `/owner` | The owner only | Create logins, reset passwords, turn accounts off/on, delete accounts, see who's active |

## How logins work

1. **First time only:** open `/owner`, enter the setup code (the `DAYBOOK_SETUP_CODE` environment variable in Netlify), and create the owner account. After that, setup is closed.
2. **Give someone access:** on `/owner`, type their name and click **Create login**. You get a username and a temporary password, plus a **Copy invite message** button to paste into WhatsApp or email.
3. **They sign in** at `/` and must choose their own password before they can use the daybook.
4. **Owner tools:** reset a forgotten password (gives a new temporary one), turn an account off (they're signed out and can't sign in), or delete it along with its data.

The owner sees each person's status, last activity and how many tasks, notes, workouts and meals they've saved. The owner can't read what they wrote.

Security details: passwords are hashed with scrypt. Sessions are random tokens in an HttpOnly, SameSite cookie and last 30 days. Changing or resetting a password signs out that account's other sessions. After 8 wrong passwords the account is locked for 15 minutes.

## Layout

- `public/`: static pages (`index.html` app, `owner.html` console, `styles.css`)
- `netlify/functions/api.mjs`: the `/api/*` endpoint on Netlify, storing data in Netlify Blobs
- `lib/api-core.mjs`: the API logic (accounts, sessions, data, owner endpoints), independent of Netlify
- `test/api.test.mjs`: API tests; `test/dev-server.mjs`: local server with in-memory storage

## Run locally

```sh
cd planner
npm install
npm test
DAYBOOK_SETUP_CODE=letmein node test/dev-server.mjs   # http://localhost:8888 and /owner
```

Local data is kept in memory and cleared when the server stops.

## Deploy on Netlify

The site is set up as the Netlify project **founders-daybook**. To deploy from GitHub, connect the repo in Netlify and set **Base directory** to `planner` (build settings come from `planner/netlify.toml`). Set the `DAYBOOK_SETUP_CODE` environment variable before the first visit to `/owner`.

Production data lives in the Blobs store `daybook`. Deploy previews use a separate `daybook-preview` store, so test accounts never mix with real ones.
