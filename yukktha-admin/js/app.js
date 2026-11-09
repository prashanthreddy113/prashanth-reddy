// Yukktha admin: login, shell, hash router.
import { CONFIG } from './config.js';
import { esc, toast, $, $$, errorBox } from './ui.js';
import dashboard from './pages/dashboard.js';
import billing from './pages/billing.js';
import orders from './pages/orders.js';
import customers from './pages/customers.js';
import sarees from './pages/sarees.js';
import inventory from './pages/inventory.js';
import discounts from './pages/discounts.js';
import reviews from './pages/reviews.js';
import banners from './pages/banners.js';
import employees from './pages/employees.js';
import access from './pages/access.js';
import payments from './pages/payments.js';
import expenses from './pages/expenses.js';
import reports from './pages/reports.js';
import settings from './pages/settings.js';

const PAGES = [dashboard, billing, orders, customers, sarees, inventory, discounts, reviews, banners, employees, expenses, payments, reports, access, settings];
const GROUPS = ['Overview', 'Sell', 'Catalogue', 'Team', 'Money', 'Store'];

const ICONS = {
  home: 'M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  bill: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6M9 16h3',
  box: 'M4 7l8-4 8 4v10l-8 4-8-4zM4 7l8 4 8-4M12 11v10',
  users: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21c.8-3.6 3.6-6 7-6s6.2 2.4 7 6M16 3.5a4 4 0 0 1 0 7.5M18 15c2 .8 3.4 2.9 4 6',
  saree: 'M5 3h9l5 5v13H5zM14 3v5h5M8 13c2-2 6 2 8 0M8 17c2-2 6 2 8 0',
  stock: 'M3 7h18v13H3zM3 7l3-4h12l3 4M9 11h6',
  flag: 'M5 21V4M5 4h11l-2 4 2 4H5',
  star: 'M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8L3.5 9.7l5.9-.8z',
  tag: 'M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9zM7.5 7.5h.01',
  staff: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c1-4 4.2-6 8-6s7 2 8 6',
  key: 'M14 10a4 4 0 1 0-3.5 4L9 15.5V18H6.5v2.5H4V18l6.5-6.5M15 8h.01',
  card: 'M3 6h18v12H3zM3 10h18M7 15h4',
  wallet: 'M4 6h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4zM4 6l11-3v3M16 13h.01',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-2.7-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3 14.3H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.1-2.7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 9.7 3.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1.3z'
};
export const icon = (name) => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="' + (ICONS[name] || ICONS.home) + '"/></svg>';

const LOGO = '<svg class="logo" viewBox="0 0 292 70" aria-label="Yukktha"><g fill="currentColor" stroke="currentColor"><g transform="translate(4,4) scale(0.52)" stroke-linecap="round" stroke-linejoin="round"><g fill="none" stroke-width="4.4"><path d="M70,78 C46,86 24,80 16,62"/><path d="M72,70 C48,70 26,60 22,42"/><path d="M75,63 C54,56 38,44 40,28"/><path d="M79,57 C64,46 56,32 62,16"/><path d="M84,52 C78,40 80,26 90,18"/></g><g stroke="none"><ellipse cx="16" cy="62" rx="6" ry="4.3" transform="rotate(-20 16 62)"/><ellipse cx="22" cy="42" rx="6" ry="4.3" transform="rotate(-35 22 42)"/><ellipse cx="40" cy="28" rx="6" ry="4.3" transform="rotate(-55 40 28)"/><ellipse cx="62" cy="16" rx="6" ry="4.3" transform="rotate(-70 62 16)"/><ellipse cx="90" cy="18" rx="6" ry="4.3" transform="rotate(-88 90 18)"/></g><path d="M16,62 C6,60 3,72 13,75 C21,77 22,66 15,66" fill="none" stroke-width="4"/><path d="M92,50 C80,47 71,57 74,71 C77,84 91,89 100,80 C107,73 107,59 100,52 C97,50 94,50 92,50 Z" stroke="none"/><path d="M97,52 C99,45 100,40 101,36" fill="none" stroke-width="5.6"/><circle cx="102" cy="34" r="9" stroke="none"/><path d="M108,31 L120,35 L108,39 Z" stroke="none"/><g stroke-width="3.2" fill="none"><path d="M98,29 L94,20"/><path d="M102,28 L102,17"/><path d="M106,29 L111,20"/></g><g stroke="none"><circle cx="93.5" cy="19" r="3.4"/><circle cx="102" cy="16" r="3.4"/><circle cx="111.5" cy="19" r="3.4"/></g></g><text x="82" y="42" stroke="none" font-family="\'Cormorant Garamond\', Georgia, serif" font-size="36" font-weight="500" letter-spacing="6">YUKKTHA</text><text x="84" y="58" stroke="none" class="logo-sub" font-family="\'Poppins\', Arial, sans-serif" font-size="9" font-weight="300" letter-spacing="2.5">TIMELESS ROYAL WEAVES</text></g></svg>';

const root = $('#app');
let api = null; let session = null; let project = {};

async function backend(mode) {
  const m = mode === 'demo' ? await import('./backend/demo.js') : await import('./backend/firebase.js');
  return mode === 'demo' ? m.createDemoBackend() : m.createFirebaseBackend();
}

// ---------- login ----------
function loginView(msg) {
  root.innerHTML = '<div class="login"><div class="login-card">' + LOGO +
    '<h1>Store admin</h1><p class="muted">Sign in with your Yukktha admin account.</p>' +
    '<form id="loginForm" class="stack"><label class="field"><span>Email</span><input name="email" type="email" autocomplete="username" required></label>' +
    '<label class="field"><span>Password</span><input name="password" type="password" autocomplete="current-password" required minlength="6"></label>' +
    '<p class="form-err" id="loginErr"' + (msg ? '' : ' hidden') + '>' + esc(msg || '') + '</p>' +
    '<button class="btn primary block" id="loginBtn">Sign in</button></form>' +
    '<div class="login-links"><button class="link" id="forgot">Forgot password?</button><button class="link" id="signupLink">Invited? Create your password</button></div>' +
    '<div class="or"><span>or</span></div><button class="btn ghost block" id="demoBtn">Explore the demo</button>' +
    '<p class="tiny muted">Demo mode uses sample data saved only in this browser. Nothing changes on the website.</p></div></div>';
  let signup = false;
  const err = $('#loginErr'); const btn = $('#loginBtn');
  $('#signupLink').addEventListener('click', () => { signup = !signup; btn.textContent = signup ? 'Create account' : 'Sign in'; $('#signupLink').textContent = signup ? 'Back to sign in' : 'Invited? Create your password'; });
  $('#loginForm').addEventListener('submit', async (e) => {
    e.preventDefault(); err.hidden = true; btn.disabled = true;
    const f = new FormData(e.target);
    try {
      api = await backend('live');
      session = signup ? await api.signUp(String(f.get('email')).trim(), String(f.get('password'))) : await api.signIn(String(f.get('email')).trim(), String(f.get('password')));
      localStorage.setItem('yka_mode', 'live');
      await start();
    } catch (ex) {
      err.textContent = authMessage(ex); err.hidden = false; btn.disabled = false;
    }
  });
  $('#forgot').addEventListener('click', async () => {
    const email = $('#loginForm').email.value.trim();
    if (!email) { err.textContent = 'Type your email above first.'; err.hidden = false; return; }
    try { api = await backend('live'); await api.resetPassword(email); toast('Password reset email sent to ' + email); } catch (ex) { err.textContent = authMessage(ex); err.hidden = false; }
  });
  $('#demoBtn').addEventListener('click', async () => {
    api = await backend('demo'); session = await api.signIn(); localStorage.setItem('yka_mode', 'demo'); await start();
  });
}
function authMessage(ex) {
  const c = ex && ex.code || '';
  if (/invalid-credential|wrong-password|user-not-found|invalid-email/.test(c)) return 'Email or password is incorrect.';
  if (/too-many-requests/.test(c)) return 'Too many attempts. Wait a few minutes and try again.';
  if (/network/.test(c)) return 'No internet connection to Firebase.';
  if (/email-already-in-use/.test(c)) return 'An account already exists for this email — sign in instead.';
  if (/weak-password/.test(c)) return 'Choose a password with at least 6 characters.';
  return ex && ex.message || String(ex);
}

// ---------- shell ----------
const allowed = (p) => !p.ownerOnly || session.isOwner;

function shell() {
  const nav = GROUPS.map((g) => {
    const items = PAGES.filter((p) => p.group === g && allowed(p));
    if (!items.length) return '';
    return '<p class="nav-h">' + g + '</p>' + items.map((p) => '<a class="nav-a" href="#/' + p.id + '" data-page="' + p.id + '">' + icon(p.icon) + '<span>' + esc(p.title) + '</span></a>').join('');
  }).join('');
  root.innerHTML = '<div class="shell">' +
    '<aside class="side" id="side"><div class="side-top">' + LOGO + '<span class="side-sub">Admin</span></div><nav>' + nav + '</nav>' +
    '<div class="side-foot"><a class="nav-a" href="' + CONFIG.storefrontUrl + '" target="_blank" rel="noopener">' + icon('home') + '<span>View website ↗</span></a></div></aside>' +
    '<div class="scrim" id="scrim"></div>' +
    '<div class="main"><header class="top"><button class="icon-btn burger" id="burger" aria-label="Menu">☰</button><h2 id="pageTitle"></h2>' +
    (api.mode === 'demo' ? '<span class="demo-tag">Demo data</span>' : '') +
    '<div class="top-r"><span class="who"><strong>' + esc(session.email) + '</strong><small>' + esc(session.label) + '</small></span>' +
    (api.mode === 'demo' ? '<button class="btn ghost sm" id="resetDemo">Reset demo</button>' : '') +
    '<button class="btn ghost sm" id="logout">Sign out</button></div></header>' +
    '<main class="view" id="view"></main></div></div>';
  $('#logout').addEventListener('click', async () => { await api.signOut(); localStorage.removeItem('yka_mode'); location.hash = ''; loginView(); });
  const rd = $('#resetDemo'); if (rd) rd.addEventListener('click', async () => { await api.reset(); project = await api.getProject(); toast('Demo data reset'); route(); });
  const side = $('#side'); const scrim = $('#scrim');
  $('#burger').addEventListener('click', () => { side.classList.add('open'); scrim.classList.add('on'); });
  scrim.addEventListener('click', () => { side.classList.remove('open'); scrim.classList.remove('on'); });
  $$('.nav-a', side).forEach((a) => a.addEventListener('click', () => { side.classList.remove('open'); scrim.classList.remove('on'); }));
}

let renderToken = 0;
async function route() {
  const [id, ...rest] = (location.hash.replace(/^#\/?/, '') || 'dashboard').split('/');
  let page = PAGES.find((p) => p.id === id) || dashboard;
  if (!allowed(page)) page = dashboard;
  $$('.nav-a[data-page]').forEach((a) => a.classList.toggle('on', a.dataset.page === page.id));
  $('#pageTitle').textContent = page.title;
  document.title = page.title + ' · Yukktha Admin';
  const view = $('#view'); const token = ++renderToken;
  view.innerHTML = '<div class="loading">Loading…</div>';
  view.scrollTop = 0; window.scrollTo(0, 0);
  const ctx = {
    api, session, CONFIG, get project() { return project; },
    async reloadProject() { project = await api.getProject(); return project; },
    go: (h) => { location.hash = h; },
    param: rest.join('/'),
    stale: () => token !== renderToken,
    rerender: route
  };
  try { await page.render(view, ctx); } catch (e) { console.error(e); if (token === renderToken) view.innerHTML = errorBox(e); }
}

async function start() {
  try { project = await api.getProject(); } catch (e) { project = {}; toast(e.message, 'err'); }
  shell();
  window.removeEventListener('hashchange', route);
  window.addEventListener('hashchange', route);
  await route();
}

(async function boot() {
  const mode = localStorage.getItem('yka_mode');
  if (!mode) return loginView();
  try {
    api = await backend(mode);
    session = await api.restore();
    if (!session) return loginView();
    await start();
  } catch (e) { console.error(e); loginView(e.message); }
})();
