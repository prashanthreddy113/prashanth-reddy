# Mana Bandi — showcase videos

Demo videos for customers, captains and the owner, recorded frame by frame from the working prototypes (`../prototype` and `../owner-web`). They are silent with large Telugu + English captions; a timed voiceover script for a voice artist is in `VOICEOVER.md` and each video has a matching `.srt` subtitle file.

| File | Use |
| --- | --- |
| `mana-bandi-customer-16x9.mp4` | Customers: events, LED screens, YouTube, Facebook |
| `mana-bandi-customer-9x16.mp4` | Customers: WhatsApp status/groups, Instagram Reels, YouTube Shorts |
| `mana-bandi-captain-16x9.mp4` / `-9x16.mp4` | Captain recruitment at auto stands, WhatsApp groups |
| `mana-bandi-owner-16x9.mp4` | Owner / operations portal: officials, partners, investors |
| `mana-bandi-launch-film-16x9.mp4` | All three joined, for the launch event |
| `*.srt` | Subtitles (upload with the video on YouTube/Facebook; timing for the voiceover) |

## Before public release — change these in `record.cjs` (CONFIG at the top) and re-render
- `endContact`: the real helpline / missed‑call number or download line for the end card (empty = not shown). Or set `END_CONTACT="..."` when rendering.
- `endLine1`: the "coming soon" line.
- Any caption that promises something (for example "UPI paid next day", commission shown per ride) must match what you will actually offer on launch day.
- Screens use sample names and numbers; the footer says "Sample data for demonstration".
- Do not add the Telangana Government emblem, a minister's photo or a department's logo unless the department has approved it in writing.

## Re-render (any computer with Node 20+ and ffmpeg)
```bash
npm i -g playwright && npx playwright install chromium
python3 -m http.server 8090 --directory ../prototype &
( cd ../owner-web && npm ci && VITE_BASE=./ VITE_ROUTER=hash npx vite build --outDir dist-artifact )
python3 -m http.server 8091 --directory ../owner-web/dist-artifact &
PLAYWRIGHT_PATH=$(npm root -g)/playwright ./render-all.sh
```
On a normal internet connection the owner‑portal maps show real OpenStreetMap streets (drop `VITE_OFFLINE_MAP=1` from the build, as above). The copies rendered in the development environment show a plain grid because map tiles were blocked there.
