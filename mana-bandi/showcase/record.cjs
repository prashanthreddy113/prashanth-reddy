/**
 * Mana Bandi showcase videos — frame-accurate recorder.
 *
 *   node record.cjs customer   [wide|tall]
 *   node record.cjs captain    [wide|tall]
 *   node record.cjs owner      wide
 *
 * Needs: Playwright (Chromium), ffmpeg with libx264, the prototype served at PROTO_URL and the
 * owner-portal static build (VITE_BASE=./ VITE_ROUTER=hash) served at PORTAL_URL.
 *
 * How it works: the page runs on Playwright's fake clock. Every video frame we advance the clock by
 * 1/FPS s, pin every CSS animation/transition to the same virtual time, take a screenshot and pipe
 * it to ffmpeg. Timing is therefore identical on every run, and nothing depends on machine speed.
 */
const { chromium } = require(process.env.PLAYWRIGHT_PATH || '/opt/node22/lib/node_modules/playwright')
const { spawn } = require('child_process')
const path = require('path')

// ------------------------------------------------------------------ edit these before a public release
const CONFIG = {
  endLine1: { te: 'త్వరలో నారాయణఖేడ్, జహీరాబాద్‌లో', en: 'Coming soon to Narayanakhed & Zaheerabad' },
  // Put the real helpline / download line here once it exists (left empty = not shown).
  endContact: process.env.END_CONTACT || '',
  sampleNote: 'నమూనా వివరాలు · Sample data for demonstration',
}
const PROTO_URL = process.env.PROTO_URL || 'http://127.0.0.1:8090/index.html'
const PORTAL_URL = process.env.PORTAL_URL || 'http://127.0.0.1:8091/index.html'
const FPS = 25
const DT = 1000 / FPS

// ------------------------------------------------------------------ stage (injected into the page)
const STAGE_CSS = `
  :root { --g:#128A46; --gd:#0B5E2F; --y:#FFC72C; --o:#E8641B; --cream:#FFFDF7; }
  html, body { background: radial-gradient(120% 90% at 70% 40%, #1a9d55 0%, #0B5E2F 55%, #073f20 100%) !important; overflow: hidden !important; }
  body.mb-stage .top, body.mb-stage .notes { display: none !important; }
  body.mb-stage .wrap { position: fixed; inset: 0; display: block; max-width: none; margin: 0; }
  body.mb-stage .phone { position: absolute; transform-origin: top left; box-shadow: 0 40px 90px rgba(0,0,0,.45); }
  body.wide .phone { left: 1180px; top: 38px; transform: scale(1.25); }
  body.tall .phone { left: 230px; top: 640px; transform: scale(1.55); }
  #mb-cap { position: fixed; z-index: 50; color: #fff; font-family: "Noto Sans Telugu","Noto Sans",sans-serif; }
  body.wide #mb-cap { left: 120px; top: 250px; width: 900px; }
  body.tall #mb-cap { left: 80px; top: 170px; width: 920px; text-align: center; }
  #mb-cap .k { display: inline-block; background: var(--y); color: #1B1B1B; font: 800 26px "Noto Sans",sans-serif; letter-spacing: .06em; text-transform: uppercase; padding: 6px 16px; border-radius: 999px; margin-bottom: 26px; }
  #mb-cap .te { font-weight: 800; font-size: 76px; line-height: 1.35; text-wrap: balance; }
  body.tall #mb-cap .te { font-size: 70px; }
  #mb-cap .en { font: 600 38px/1.35 "Noto Sans",sans-serif; opacity: .88; margin-top: 18px; text-wrap: balance; }
  .mb-in { animation: mbIn .55s cubic-bezier(.2,.7,.2,1) both; }
  @keyframes mbIn { from { opacity: 0; transform: translateY(26px); } to { opacity: 1; transform: none; } }
  #mb-brand { position: fixed; z-index: 50; display: flex; align-items: center; gap: 18px; color: #fff; font-family: "Noto Sans Telugu","Noto Sans",sans-serif; }
  body.wide #mb-brand { left: 120px; top: 70px; }
  body.tall #mb-brand { left: 50%; transform: translateX(-50%); top: 60px; }
  #mb-brand .m { width: 74px; height: 74px; border-radius: 20px; background: var(--y); color: var(--gd); display: grid; place-items: center; font-weight: 800; font-size: 44px; }
  #mb-brand b { font-size: 40px; font-weight: 800; display: block; line-height: 1.2; }
  #mb-brand span { font: 600 22px "Noto Sans",sans-serif; opacity: .8; }
  #mb-note { position: fixed; z-index: 50; bottom: 26px; color: rgba(255,255,255,.62); font: 500 20px "Noto Sans Telugu","Noto Sans",sans-serif; }
  body.wide #mb-note { left: 120px; } body.tall #mb-note { left: 0; right: 0; text-align: center; }
  #mb-card { position: fixed; inset: 0; z-index: 90; display: none; place-items: center; text-align: center; color: #fff;
    background: radial-gradient(120% 90% at 50% 35%, #1a9d55 0%, #0B5E2F 55%, #062e18 100%); font-family: "Noto Sans Telugu","Noto Sans",sans-serif; }
  #mb-card.on { display: grid; }
  #mb-card .logo { width: 200px; height: 200px; margin: 0 auto 40px; border-radius: 52px; background: var(--y); color: var(--gd); display: grid; place-items: center; font-size: 130px; font-weight: 800; box-shadow: 0 30px 80px rgba(0,0,0,.35); }
  #mb-card h1 { font-size: 118px; font-weight: 800; margin: 0; line-height: 1.25; }
  #mb-card .tag { font-size: 54px; font-weight: 700; margin-top: 18px; color: var(--y); }
  #mb-card .sub { font: 600 40px/1.4 "Noto Sans",sans-serif; margin-top: 30px; opacity: .92; }
  #mb-card .pill { display: inline-block; margin-top: 44px; padding: 14px 34px; border-radius: 999px; border: 3px solid rgba(255,255,255,.7); font: 700 34px "Noto Sans Telugu","Noto Sans",sans-serif; }
  #mb-card .icons { font-size: 84px; margin-top: 34px; letter-spacing: 30px; }
  .mb-card-in { animation: mbCard .8s ease both; } @keyframes mbCard { from { opacity: 0; transform: scale(.96); } to { opacity: 1; transform: none; } }
  .mb-tap { position: fixed; z-index: 80; width: 90px; height: 90px; margin: -45px 0 0 -45px; border-radius: 50%; pointer-events: none;
    background: rgba(255,199,44,.45); border: 5px solid #FFC72C; animation: mbTap .7s ease-out forwards; }
  @keyframes mbTap { from { transform: scale(.35); opacity: 1; } to { transform: scale(1.25); opacity: 0; } }
  #mb-cursor { position: fixed; z-index: 85; width: 34px; height: 34px; pointer-events: none; left: -100px; top: -100px; filter: drop-shadow(0 3px 6px rgba(0,0,0,.35)); }
`
// Portal videos: keep the real portal full-screen and put captions in a lower third.
const PORTAL_CSS = `
  #mb-lower { position: fixed; z-index: 60; left: 60px; right: 60px; bottom: 44px; padding: 26px 40px; border-radius: 26px; color: #fff;
    background: rgba(11,94,47,.94); box-shadow: 0 20px 60px rgba(0,0,0,.35); font-family: "Noto Sans Telugu","Noto Sans",sans-serif; display: flex; align-items: center; gap: 30px; }
  #mb-lower .m { flex: none; width: 70px; height: 70px; border-radius: 18px; background: #FFC72C; color: #0B5E2F; display: grid; place-items: center; font-weight: 800; font-size: 42px; }
  #mb-lower .te { font-weight: 800; font-size: 50px; line-height: 1.35; }
  #mb-lower .en { font: 600 30px/1.35 "Noto Sans",sans-serif; opacity: .9; }
  #mb-lower .note { margin-left: auto; align-self: flex-end; font: 500 17px "Noto Sans Telugu","Noto Sans",sans-serif; opacity: .6; white-space: nowrap; }
`
const CURSOR_SVG = `<svg viewBox="0 0 24 24" width="34" height="34"><path d="M3 2l7 19 2.6-7.4L20 11z" fill="#fff" stroke="#1B1B1B" stroke-width="1.6" stroke-linejoin="round"/></svg>`

// In-page helpers: animation pinning, captions, cards, tap ripples, cursor.
const PAGE_HELPERS = `
  window.__vst = new WeakMap();
  window.__sync = (vt) => {
    for (const a of document.getAnimations()) {
      if (!__vst.has(a)) __vst.set(a, vt);
      try { a.pause(); a.currentTime = Math.max(0, vt - __vst.get(a)); } catch (e) {}
    }
  };
  window.__el = (id, html, parent) => { let e = document.getElementById(id); if (!e) { e = document.createElement('div'); e.id = id; (parent || document.body).appendChild(e); } if (html !== undefined) e.innerHTML = html; return e; };
  window.__caption = (k, te, en) => {
    const c = __el('mb-cap'); c.innerHTML = '';
    const d = document.createElement('div'); d.className = 'mb-in';
    d.innerHTML = (k ? '<div class="k">' + k + '</div>' : '') + '<div class="te">' + te + '</div>' + (en ? '<div class="en">' + en + '</div>' : '');
    c.appendChild(d);
  };
  window.__lower = (te, en, note) => {
    const c = __el('mb-lower'); c.innerHTML = '';
    c.style.display = te ? 'flex' : 'none'; if (!te) return;
    const m = document.createElement('div'); m.className = 'm'; m.textContent = 'మ';
    const d = document.createElement('div'); d.className = 'mb-in'; d.innerHTML = '<div class="te">' + te + '</div>' + (en ? '<div class="en">' + en + '</div>' : '');
    const n = document.createElement('div'); n.className = 'note'; n.textContent = note || '';
    c.append(m, d, n);
  };
  window.__card = (html) => {
    const c = __el('mb-card'); if (!html) { c.className = ''; c.innerHTML = ''; return; }
    c.className = 'on'; c.innerHTML = '<div class="mb-card-in">' + html + '</div>';
  };
  window.__tap = (x, y) => { const t = document.createElement('div'); t.className = 'mb-tap'; t.style.left = x + 'px'; t.style.top = y + 'px'; document.body.appendChild(t); setTimeout(() => t.remove(), 800); };
  window.__cursor = (x, y) => { const c = __el('mb-cursor'); if (!c.innerHTML) c.innerHTML = ${JSON.stringify(CURSOR_SVG)}; c.style.left = x + 'px'; c.style.top = y + 'px'; };
  // A fake speech recogniser so the 🎤 demo "hears" a village name instead of saying "no mic".
  window.webkitSpeechRecognition = function () { const r = this; r.start = () => setTimeout(() => r.onresult && r.onresult({ results: [[{ transcript: window.__heard || 'గంగాపూర్' }]] }), 1400); };
`

// ------------------------------------------------------------------ engine
class Recorder {
  constructor(page, out, size) {
    this.page = page; this.vt = 0; this.frames = 0; this.cues = []; this.out = out
    this.ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-r', String(FPS), out], { stdio: ['pipe', 'inherit', 'inherit'] })
    this.done = new Promise((res, rej) => this.ff.on('close', (c) => (c === 0 ? res() : rej(new Error('ffmpeg exit ' + c)))))
  }
  async frame() {
    await this.page.clock.runFor(DT); this.vt += DT
    await this.page.evaluate((vt) => window.__sync && window.__sync(vt), this.vt)
    const buf = await this.page.screenshot({ type: 'jpeg', quality: 92 })
    if (!this.ff.stdin.write(buf)) await new Promise((r) => this.ff.stdin.once('drain', r))
    this.frames++
  }
  async hold(ms) { for (let i = 0; i < Math.round(ms / DT); i++) await this.frame() }
  async finish() {
    this.ff.stdin.end(); await this.done
    const total = this.frames / FPS
    const cues = this.cues.filter((c) => c.te)
    const ts = (x) => { const ms = Math.round(x * 1000), h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60; return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}` }
    const srt = cues.map((c, i) => `${i + 1}\n${ts(c.t)} --> ${ts(i + 1 < cues.length ? this.cues[this.cues.indexOf(c) + 1].t : total)}\n${c.te}\n${c.en || ''}\n`).join('\n')
    require('fs').writeFileSync(this.out.replace(/\.mp4$/, '.srt'), srt)
    return total
  }
  // helpers
  ev(fn, ...a) { return this.page.evaluate(fn, ...a) }
  cue(te, en) { this.cues.push({ t: this.vt / 1000, te, en }) }
  async caption(k, te, en) { this.cue(te, en); await this.ev(([k, te, en]) => __caption(k, te, en), [k, te, en]) }
  async lower(te, en) { this.cue(te, en); await this.ev(([te, en, n]) => __lower(te, en, n), [te, en, CONFIG.sampleNote]) }
  async card(html, ms) { this.cue(html.includes('Coming soon') ? CONFIG.endLine1.te : 'మన బండి — పిలిస్తే చాలు, బండి వస్తుంది', html.includes('Coming soon') ? CONFIG.endLine1.en : 'Mana Bandi — just call, the bandi comes'); await this.ev((h) => __card(h), html); await this.hold(ms); await this.ev(() => __card('')) }
  /** Tap a visible element (ripple + click), or dispatch a click on a hidden one. */
  async tap(sel, { after = 900, nth = 0 } = {}) {
    const loc = this.page.locator(sel).nth(nth)
    const box = await loc.boundingBox().catch(() => null)
    if (box && box.width > 0) {
      await this.ev(([x, y]) => __tap(x, y), [box.x + box.width / 2, box.y + box.height / 2])
      await this.hold(220)
      await loc.click({ force: true, noWaitAfter: true, timeout: 5000 })
    } else {
      await this.ev(([s, n]) => document.querySelectorAll(s)[n].click(), [sel, nth])
    }
    await this.hold(after)
  }
  /** Type into a field without focusing it (focus would make the browser scroll the phone screen). */
  async typeInto(sel, text, perChar = 110) {
    for (let i = 1; i <= text.length; i++) {
      await this.ev(([s, v]) => { const el = document.querySelector(s); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); document.querySelectorAll('.screen, .body').forEach((e) => { e.scrollLeft = 0 }) }, [sel, text.slice(0, i)])
      await this.hold(perChar)
    }
  }
  /** Portal: glide the fake cursor to an element, then click it. */
  async point(sel, { click = true, after = 900, frames = 14 } = {}) {
    const box = await this.page.locator(sel).first().boundingBox()
    if (!box) throw new Error('not found: ' + sel)
    const tx = box.x + Math.min(box.width / 2, 60), ty = box.y + box.height / 2
    const from = this.cursor || { x: 960, y: 700 }
    for (let i = 1; i <= frames; i++) {
      const p = i / frames, e = p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2
      await this.ev(([x, y]) => __cursor(x, y), [from.x + (tx - from.x) * e, from.y + (ty - from.y) * e]); await this.frame()
    }
    this.cursor = { x: tx, y: ty }
    if (click) { await this.ev(([x, y]) => __tap(x, y), [tx, ty]); await this.hold(160); await this.page.locator(sel).first().click({ force: true, noWaitAfter: true }) }
    await this.hold(after)
  }
  async scrollTo(y, ms = 1200) {
    const start = await this.ev(() => window.scrollY || document.scrollingElement.scrollTop)
    const n = Math.round(ms / DT)
    for (let i = 1; i <= n; i++) { const p = i / n, e = p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2; await this.ev((v) => window.scrollTo(0, v), start + (y - start) * e); await this.frame() }
  }
  async setRange(sel, from, to, ms = 1600) {
    const n = Math.round(ms / DT)
    for (let i = 0; i <= n; i++) {
      const v = Math.round(from + (to - from) * (i / n))
      await this.ev(([s, v]) => { const el = document.querySelector(s); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })) }, [sel, v])
      await this.frame()
    }
  }
}

const titleCard = (kicker, sub) => `<div class="logo">మ</div><h1>మన బండి</h1><div class="tag">పిలిస్తే చాలు, బండి వస్తుంది</div>
  <div class="sub">${kicker}</div>${sub ? `<div class="pill">${sub}</div>` : ''}`
const endCard = () => `<div class="logo">మ</div><h1>మన బండి</h1><div class="tag">పిలిస్తే చాలు, బండి వస్తుంది</div>
  <div class="icons">🏍️🛺📦</div><div class="sub">${CONFIG.endLine1.te}<br>${CONFIG.endLine1.en}</div>
  ${CONFIG.endContact ? `<div class="pill">${CONFIG.endContact}</div>` : ''}`

// ------------------------------------------------------------------ scripts
async function customer(r) {
  await r.card(titleCard('Customer app · కస్టమర్ యాప్', 'బైక్ · ఆటో · పార్సెల్'), 3600)
  await r.caption('1 · భాష', 'మీ భాషలోనే', 'Telugu, Hindi, Kannada, Marathi, Urdu or English')
  await r.hold(900); await r.tap('.splash', { after: 1300 })
  await r.tap('[data-lang="te"]', { after: 1200 })
  await r.caption('2 · లాగిన్', 'ఫోన్ నంబర్ చాలు', 'Just a phone number and a 4-digit OTP')
  await r.typeInto('#phone', '9876543210'); await r.hold(500)
  await r.tap('[data-go="otp"]', { after: 1400 }); await r.tap('[data-go="home"]', { after: 900 })
  await r.caption('3 · బుకింగ్', 'బైక్, ఆటో, పార్సెల్ — ఒక్క నొక్కుతో', 'Big pictures, few words — easy for everyone')
  await r.hold(2600)
  await r.caption('4 · వినండి', 'చదవలేకపోయినా పర్వాలేదు — యాప్ మాట్లాడుతుంది', 'Every screen reads itself aloud in Telugu')
  await r.tap('.bar [data-say]', { after: 2800 })
  await r.caption('5 · ధర', 'ఎక్కే ముందే ధర తెలుస్తుంది', 'Fixed fare before you ride — no bargaining')
  await r.tap('.chips [data-chip]', { nth: 1, after: 2600 })
  await r.caption('6 · చెల్లింపు', 'క్యాష్ లేదా UPI — మీ ఇష్టం', 'Cash is default. UPI if you like.')
  await r.tap('[data-pay="upi"]', { after: 900 }); await r.tap('[data-pay="cash"]', { after: 1100 })
  await r.caption('7 · కెప్టెన్', 'దగ్గర్లో బండి — నిమిషాల్లో', 'The nearest captain is found in seconds')
  await r.tap('[data-go="finding"]', { after: 3400 })
  await r.caption('8 · భద్రత', 'కెప్టెన్ పేరు, బండి నంబర్, OTP', 'Captain name, vehicle number and a ride OTP — every time')
  await r.hold(3200)
  await r.caption('9 · సాయం', '📞 కాల్, 🆘 SOS — ఒక్క నొక్కుతో', 'Call the captain or press SOS instantly')
  await r.tap('.big.danger', { after: 2400 })
  await r.tap('[data-go="done"]', { after: 900 })
  await r.caption('10 · పూర్తి', 'చూపిన ధరే — ఒక్క రూపాయి ఎక్కువ కాదు', 'Pay exactly the fare shown. Rate with one tap.')
  await r.tap('[data-face="😊"]', { after: 2200 })
  await r.tap('[data-go="home"]', { after: 700 })
  await r.caption('11 · పార్సెల్', 'పార్సెల్ పంపండి — ఊరికైనా, దుకాణానికైనా', 'Send parcels to any village or shop')
  await r.tap('[data-svc="parcel"]', { after: 700 })
  await r.typeInto('#rphone', '9123456780', 80)
  await r.caption('11 · పార్సెల్', 'ఊరి పేరు చెప్పండి చాలు 🎤', 'Just say the place name — the app listens')
  await r.tap('[data-mic]', { after: 2600 })
  await r.tap('[data-pstep="2"]', { after: 800 })
  await r.caption('12 · సైజు', 'బ్యాగ్, డబ్బా, బస్తా — ఫోటోతో', 'Pick a size and add a photo')
  await r.tap('[data-size="m"]', { after: 600 }); await r.tap('[data-photo="1"]', { after: 1000 }); await r.tap('[data-pstep="3"]', { after: 800 })
  await r.caption('13 · ఎవరు ఇస్తారు', 'అందుకునేవారు కూడా డబ్బులు ఇవ్వొచ్చు', 'The receiver can pay on delivery')
  await r.tap('[data-payer="rx"]', { after: 1400 })
  await r.tap('[data-go="finding"]', { after: 3500 })
  await r.caption('14 · ట్రాకింగ్', 'కుటుంబానికి, అందుకునేవారికి లైవ్ ట్రాకింగ్', 'Live tracking link on WhatsApp, delivery OTP for safety')
  await r.hold(3600)
  await r.card(endCard(), 4200)
}

async function captain(r) {
  await r.card(titleCard('Captain app · కెప్టెన్ యాప్', 'మీ బండి — మీ సంపాదన'), 3600)
  await r.ev(() => document.querySelector('[data-jump="ckyc"]').click()); await r.hold(200)
  await r.caption('1 · నమోదు', '10 నిమిషాల్లో నమోదు', 'Register in 10 minutes — no paper forms')
  await r.hold(2400)
  await r.caption('2 · డిజిలాకర్', 'ఆధార్, లైసెన్స్, RC — డిజిలాకర్ నుంచి', 'Aadhaar, licence and RC fetched from DigiLocker with your consent')
  await r.tap('[data-go="cdigi"]', { after: 2200 }); await r.tap('[data-go="cdigiotp"]', { after: 1000 })
  await r.tap('[data-dkey="4"]', { after: 3300 })
  await r.caption('3 · బండి', 'వేరే వాళ్ళ బండి అయినా సరే', "Driving someone else's vehicle? Just add the owner's letter")
  await r.hold(2400); await r.tap('[data-letter]', { after: 1800 })
  await r.caption('4 · సెల్ఫీ', 'సెల్ఫీతో మీరే అని నిర్ధారణ', 'A live selfie is matched with your Aadhaar photo')
  await r.tap('[data-go="cselfie"]', { after: 5900 })
  await r.caption('5 · చెక్', 'ఆటోమేటిక్ చెక్ — వెంటనే ఆమోదం', 'Checks run automatically — approved in minutes')
  await r.tap('[data-go="cchecks"]', { after: 6400 })
  await r.caption('6 · ఆన్‌లైన్', 'ఒక్క బటన్ — ఆన్‌లైన్', 'One big button to go online')
  await r.tap('[data-approve]', { after: 4400 })
  await r.caption('7 · రైడ్', 'రైడ్ వస్తే ఫోన్ మోగుతుంది, చెప్తుంది', 'New ride? The phone rings and reads it aloud')
  await r.hold(3000)
  await r.tap('.accept', { after: 1400 })
  await r.caption('8 · పికప్', 'దారి, కాల్ — అన్నీ ఒక్క చోట', 'Navigation and a call button to reach the rider')
  await r.hold(2400)
  await r.tap('[data-go="cotp"]', { after: 900 })
  await r.caption('9 · OTP', 'రైడర్ చెప్పే OTP — సరైన వ్యక్తికే రైడ్', "The rider's OTP makes sure you pick up the right person")
  await r.tap('[data-key="4"]', { after: 1100 }); await r.tap('[data-go="ctrip"]', { after: 1400 })
  await r.caption('10 · ప్రయాణం', 'చేరాక జరపండి — పొరపాటున ఆగదు', 'Slide to finish — no accidental taps on bumpy roads')
  await r.hold(1200)
  for (let v = 0; v <= 96; v += 4) { await r.ev((val) => { const el = document.querySelector('#slide'); if (el && !el.disabled) { el.value = val; el.dispatchEvent(new Event('input', { bubbles: true })) } }, v); await r.frame() }
  await r.hold(900)
  await r.caption('11 · డబ్బులు', 'క్యాష్ మీ చేతికే', 'Cash stays with you. UPI is paid next day.')
  await r.hold(2200); await r.tap('[data-ccollect]', { after: 1800 })
  await r.caption('12 · సంపాదన', 'ఈరోజు సంపాదన ఒక్క చూపులో', "Today's earnings at a glance, commission shown on every ride")
  await r.tap('.nav [data-go="cearn"]', { after: 3600 })
  await r.card(endCard(), 4200)
}

async function owner(r) {
  const p = r.page
  await r.card(titleCard('Owner portal · యజమాని పోర్టల్', 'వెబ్‌సైట్‌లో — యాప్ అక్కర్లేదు'), 3600)
  await r.lower('సురక్షిత లాగిన్', 'Secure web login for the owner and town managers')
  await p.fill('input[type=password]', 'demo'); await r.hold(900)
  await r.point('form button', { after: 2200 })
  await r.lower('ఈరోజు వ్యాపారం — ఒక్క చూపులో', 'Rides, parcels, revenue, captains online and service quality, live')
  await r.hold(3800)
  await r.scrollTo(560, 1600); await r.hold(2600); await r.scrollTo(0, 900)
  await r.lower('ప్రత్యక్ష మ్యాప్', 'Every online captain and every trip on a live map')
  await r.ev(() => { location.hash = '#/live' }); await r.hold(4200)
  await r.lower('ఎక్కడ పని చెయ్యాలో మీరే నిర్ణయించండి', 'Set each town\'s service radius, fares and landmarks')
  await r.ev(() => { location.hash = '#/areas' }); await r.hold(2200)
  const range = await p.$('input[type=range]')
  if (range) { await r.point('input[type=range]', { click: false, after: 300 }); await r.setRange('input[type=range]', 12, 18, 1800); await r.hold(900); await r.setRange('input[type=range]', 18, 12, 1200) }
  await r.hold(1600)
  await r.lower('కెప్టెన్ పత్రాలు — ఆటోమేటిక్ చెక్', 'Aadhaar, licence, RC and selfie checks for every captain')
  await r.ev(() => { location.hash = '#/captains' }); await r.hold(1600)
  await r.point('tbody tr:has-text("Pending")', { after: 2600 })
  await r.scrollTo(260, 1200); await r.hold(2600); await r.scrollTo(0, 700)
  await r.lower('కమీషన్ మీ చేతుల్లో', 'Commission by town and service, free months for new captains')
  await r.ev(() => { location.hash = '#/commission' }); await r.hold(4200)
  await r.lower('వివరమైన విశ్లేషణ', 'Analytics: growth, busy hours, top places, repeat customers')
  await r.ev(() => { location.hash = '#/analytics' }); await r.hold(2600); await r.scrollTo(700, 1800); await r.hold(1800); await r.scrollTo(0, 700)
  await r.lower('కెప్టెన్లకు సెటిల్‌మెంట్', 'Weekly captain settlements with UPI reference')
  await r.ev(() => { location.hash = '#/settlements' }); await r.hold(3400)
  await r.lower('')
  await r.card(endCard(), 4200)
}

// ------------------------------------------------------------------ main
;(async () => {
  const which = process.argv[2] || 'customer'
  const layout = process.argv[3] || 'wide'
  const size = layout === 'tall' ? { width: 1080, height: 1920 } : { width: 1920, height: 1080 }
  const out = path.join(__dirname, 'out', `mana-bandi-${which}-${layout === 'tall' ? '9x16' : '16x9'}.mp4`)
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: size, deviceScaleFactor: 1, locale: 'te-IN' })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => console.error('PAGE ERROR', e.message))
  await page.clock.install({ time: new Date('2026-09-25T09:41:00+05:30') })
  await page.addInitScript(PAGE_HELPERS)
  if (which === 'owner') {
    await page.goto(PORTAL_URL + '#/login')
    await page.addStyleTag({ content: STAGE_CSS.replace(/html, body \{[^}]*\}/, '') + PORTAL_CSS })
  } else {
    await page.goto(PROTO_URL)
    await page.addStyleTag({ content: STAGE_CSS })
    await page.evaluate(([layout, note]) => {
      document.body.classList.add('mb-stage', layout)
      __el('mb-brand', '<div class="m">మ</div><div><b>మన బండి</b><span>Mana Bandi</span></div>')
      __el('mb-note', note)
    }, [layout, CONFIG.sampleNote])
  }
  await page.clock.runFor(1500)
  await page.evaluate(() => document.fonts.ready)
  const r = new Recorder(page, out, size)
  const t0 = Date.now()
  await ({ customer, captain, owner })[which](r)
  const secs = await r.finish()
  await browser.close()
  console.log(`${path.basename(out)}  ${secs.toFixed(1)} s  (rendered in ${((Date.now() - t0) / 1000).toFixed(0)} s)`)
})().catch((e) => { console.error(e); process.exit(1) })
