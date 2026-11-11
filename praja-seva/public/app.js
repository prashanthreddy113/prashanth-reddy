'use strict';
/* Praja Seva single-page app: citizen portal + municipal department console. */

// ---------- state ----------
const S = {
  cfg: null,
  token: load('ps_token'),
  user: JSON.parse(load('ps_user') || 'null'),
  lang: load('ps_lang') || 'en',
};

function load(k) { try { return localStorage.getItem(k); } catch { return null; } }
function keep(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* storage blocked */ } }
const t = (k) => (window.I18N[S.lang] && window.I18N[S.lang][k]) || window.I18N.en[k] || k;
const label = (o) => (o ? (S.lang === 'te' && o.te ? o.te : o.en) : '');
const cat = (id) => S.cfg.categories.find((c) => c.id === id);
const dept = (id) => S.cfg.departments.find((d) => d.id === id);
const fmt = (iso) => (iso ? new Date(iso).toLocaleString(S.lang === 'te' ? 'te-IN' : 'en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '');
const money = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');
const isStaff = () => S.user && S.user.role !== 'citizen';
const isLead = () => S.user && ['chairperson', 'commissioner'].includes(S.user.role);

// ---------- DOM helper (never uses innerHTML, so user text is always escaped) ----------
function el(tag, attrs, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else if (k === 'class') n.className = v;
    else if (k === 'value') n.value = v;
    else n.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    n.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return n;
}
const $app = () => document.getElementById('app');
function mount(...nodes) { const a = $app(); a.replaceChildren(...nodes); window.scrollTo(0, 0); }

function toast(msg, kind = 'ok') {
  document.querySelectorAll('.toast').forEach((x) => x.remove());
  const n = el('div', { class: `toast ${kind}`, role: 'status' }, msg);
  document.body.append(n);
  setTimeout(() => n.remove(), 3500);
}

// ---------- API ----------
async function api(path, opts = {}) {
  const res = await fetch(path, {
    method: opts.method || 'GET',
    headers: { 'Content-Type': 'application/json', ...(S.token ? { Authorization: `Bearer ${S.token}` } : {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && S.token) { setSession(null, null); go('#/'); }
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
  return data;
}

function setSession(token, user) {
  S.token = token; S.user = user;
  keep('ps_token', token); keep('ps_user', user ? JSON.stringify(user) : null);
}

// Runs an async action from a form/button, showing errors as a toast.
function act(fn) {
  return async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const btn = e && e.submitter ? e.submitter : e && e.currentTarget && e.currentTarget.tagName === 'BUTTON' ? e.currentTarget : null;
    if (btn) btn.disabled = true;
    try { await fn(e); } catch (err) { toast(err.message, 'err'); } finally { if (btn) btn.disabled = false; }
  };
}
const formData = (form) => Object.fromEntries(new FormData(form).entries());

// ---------- layout ----------
function header() {
  const nav = [];
  if (S.user && S.user.role === 'citizen') {
    nav.push(['#/c', t('home')], ['#/c/new', t('raise')], ['#/c/list', t('myComplaints')], ['#/c/tax', t('payTax')], ['#/c/meet', `${t('meet')} ${S.cfg.headTitle}`]);
  } else if (isStaff()) {
    nav.push(['#/s', t('dashboard')], ['#/s/queue', t('queue')], ['#/s/actions', t('actions')]);
    if (isLead()) nav.push(['#/s/meet', t('appointments')], ['#/s/notices', t('notices')], ['#/s/users', t('users')], ['#/s/audit', t('audit')]);
    nav.push(['#/s/tax', t('taxReport')]);
  }
  const here = location.hash || '#/';
  return el('header', { class: 'top' },
    el('div', { class: 'brand' },
      el('img', { src: '/icon.svg', alt: '', width: 32, height: 32 }),
      el('div', {},
        el('strong', {}, t('appName')),
        el('small', {}, S.lang === 'te' ? S.cfg.municipalityTe : S.cfg.municipality))),
    el('div', { class: 'top-actions' },
      el('button', { class: 'ghost', onclick: () => { S.lang = S.lang === 'en' ? 'te' : 'en'; keep('ps_lang', S.lang); document.documentElement.lang = S.lang; route(); } }, t('lang')),
      S.user ? el('button', { class: 'ghost', onclick: act(async () => { await api('/api/auth/logout', { method: 'POST' }).catch(() => {}); setSession(null, null); go('#/'); }) }, t('logout')) : null),
    nav.length ? el('nav', { class: 'tabs' }, nav.map(([h, l]) => el('a', { href: h, class: here === h || (h !== '#/s' && h !== '#/c' && here.startsWith(h)) ? 'active' : null }, l))) : null);
}

function page(...content) {
  mount(header(), el('main', {}, ...content),
    el('footer', {}, `${S.cfg.constituency} · ${S.cfg.municipality}`, S.cfg.demo ? el('span', { class: 'pill warn' }, 'DEMO') : null));
}

function statusPill(s) { return el('span', { class: `pill st-${s}` }, t('s_' + s)); }
function field(lbl, input, hint) { return el('label', { class: 'field' }, el('span', {}, lbl), input, hint ? el('small', {}, hint) : null); }
function wardSelect(name, value, allowAll) {
  return el('select', { name, required: !allowAll },
    allowAll ? el('option', { value: '' }, t('allWards')) : el('option', { value: '' }, '—'),
    S.cfg.wards.map((w) => el('option', { value: w, selected: Number(value) === w }, `${t('ward')} ${w}`)));
}
function stat(n, l, kind) { return el('div', { class: `stat ${kind || ''}` }, el('b', {}, n ?? '—'), el('span', {}, l)); }
function empty() { return el('p', { class: 'muted' }, t('none')); }
function bar(value, max) {
  const fill = el('i');
  fill.style.width = `${max ? Math.min(100, Math.round((value / max) * 100)) : 0}%`; // CSSOM, allowed by the CSP
  return el('div', { class: 'bar' }, fill);
}

// ---------- public pages ----------
async function viewLanding() {
  const [ann, st] = await Promise.all([api('/api/announcements'), api('/api/public/stats')]);
  page(
    el('section', { class: 'hero' },
      el('h1', {}, t('appName')),
      el('p', {}, t('tagline')),
      el('div', { class: 'row' },
        el('a', { class: 'btn', href: '#/login' }, t('citizen')),
        el('a', { class: 'btn secondary', href: '#/staff-login' }, t('staff')))),
    el('section', { class: 'card' }, el('h2', {}, t('transparency')),
      el('div', { class: 'stats' },
        stat(st.total, t('total')), stat(st.open, t('open')), stat(st.resolved, t('resolved')),
        stat(st.resolvedOnTimePct == null ? '—' : st.resolvedOnTimePct + '%', t('onTime')),
        stat(st.avgRating ?? '—', t('avgRating')))),
    noticesCard(ann));
}

function noticesCard(ann) {
  return el('section', { class: 'card' }, el('h2', {}, t('notices')),
    ann.length ? ann.map((a) => el('article', { class: 'notice' },
      el('h3', {}, S.lang === 'te' && a.titleTe ? a.titleTe : a.title),
      el('p', {}, a.body),
      el('small', { class: 'muted' }, `${a.ward ? `${t('ward')} ${a.ward}` : t('allWards')} · ${a.by} · ${fmt(a.createdAt)}`))) : empty());
}

function viewCitizenLogin() {
  let mobile = '';
  const otpBox = el('div', { hidden: true });
  const reqForm = el('form', {
    onsubmit: act(async (e) => {
      mobile = formData(e.target).mobile;
      const r = await api('/api/auth/otp/request', { method: 'POST', body: { mobile } });
      otpBox.hidden = false;
      otpBox.replaceChildren(otpForm(r.devOtp));
      toast('OTP sent');
    }),
  },
  field(t('mobile'), el('input', { name: 'mobile', type: 'tel', inputmode: 'numeric', autocomplete: 'tel', maxlength: 13, required: true, placeholder: '98xxxxxxxx' })),
  el('button', { class: 'btn' }, t('getOtp')));

  const otpForm = (devOtp) => el('form', {
    onsubmit: act(async (e) => {
      const f = formData(e.target);
      const r = await api('/api/auth/otp/verify', { method: 'POST', body: { mobile, otp: f.otp, name: f.name, ward: f.ward || undefined } });
      setSession(r.token, r.user);
      go('#/c');
    }),
  },
  devOtp ? el('p', { class: 'pill warn' }, `${t('demoOtp')}: ${devOtp}`) : null,
  field(t('otp'), el('input', { name: 'otp', inputmode: 'numeric', maxlength: 6, required: true, autocomplete: 'one-time-code', value: devOtp || '' })),
  field(t('yourName'), el('input', { name: 'name', maxlength: 80, autocomplete: 'name' }), 'First time only'),
  field(t('ward'), wardSelect('ward', null, true)),
  el('button', { class: 'btn' }, t('verify')));

  page(el('section', { class: 'card narrow' }, el('h2', {}, t('citizen')), reqForm, otpBox));
}

function viewStaffLogin() {
  page(el('section', { class: 'card narrow' }, el('h2', {}, t('staff')),
    el('form', {
      onsubmit: act(async (e) => {
        const r = await api('/api/auth/staff/login', { method: 'POST', body: formData(e.target) });
        setSession(r.token, r.user);
        go('#/s');
      }),
    },
    field(t('username'), el('input', { name: 'username', required: true, autocomplete: 'username' })),
    field(t('password'), el('input', { name: 'password', type: 'password', required: true, autocomplete: 'current-password' })),
    el('button', { class: 'btn' }, t('login'))),
    S.cfg.demo ? el('p', { class: 'muted small' }, 'Demo accounts: chairperson, commissioner, sanitation, engineering, electrical, townplanning, revenue, greenery, admin, ward1 — password demo1234') : null));
}

// ---------- citizen pages ----------
async function viewCitizenHome() {
  const [mine, ann] = await Promise.all([api('/api/grievances/mine'), api('/api/announcements')]);
  const open = mine.filter((g) => !['resolved', 'rejected'].includes(g.status)).length;
  const tile = (href, title, sub) => el('a', { class: 'tile', href }, el('b', {}, title), el('small', {}, sub));
  page(
    el('h1', {}, `${S.user.name}`),
    el('div', { class: 'tiles' },
      tile('#/c/new', t('raise'), 'Garbage, water, streetlight, roads…'),
      tile('#/c/list', t('myComplaints'), `${open} ${t('open')} / ${mine.length} ${t('total')}`),
      tile('#/c/tax', t('payTax'), t('assessmentNo')),
      tile('#/c/meet', `${t('meet')} ${S.cfg.headTitle}`, t('appointments'))),
    noticesCard(ann.filter((a) => !a.ward || a.ward === S.user.ward)));
}

function compressImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, 1280 / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', 0.72));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read that image')); };
    img.src = url;
  });
}

function viewNewComplaint() {
  let gps = null, photo = null;
  const gpsNote = el('small', { class: 'muted' });
  const preview = el('div', { class: 'preview' });
  const byDept = S.cfg.departments.map((d) => el('optgroup', { label: label(d) },
    S.cfg.categories.filter((c) => c.dept === d.id).map((c) => el('option', { value: c.id }, label(c)))));
  page(el('section', { class: 'card' }, el('h2', {}, t('raise')),
    el('form', {
      onsubmit: act(async (e) => {
        const f = formData(e.target);
        const g = await api('/api/grievances', { method: 'POST', body: { ...f, photo, lat: gps && gps.lat, lng: gps && gps.lng } });
        toast(`${t('submitted')}: ${g.number}`);
        go(`#/c/g/${g.id}`);
      }),
    },
    field(t('category'), el('select', { name: 'category', required: true }, el('option', { value: '' }, '—'), byDept)),
    field(t('ward'), wardSelect('ward', S.user.ward)),
    field(t('location'), el('input', { name: 'location', required: true, maxlength: 300, placeholder: 'Street, colony, near…' })),
    el('div', { class: 'row' },
      el('button', {
        type: 'button', class: 'btn secondary',
        onclick: () => {
          if (!navigator.geolocation) return toast('GPS not available', 'err');
          navigator.geolocation.getCurrentPosition(
            (p) => { gps = { lat: +p.coords.latitude.toFixed(6), lng: +p.coords.longitude.toFixed(6) }; gpsNote.textContent = `${t('gpsSet')} (${gps.lat}, ${gps.lng})`; },
            () => toast('Could not get location', 'err'), { enableHighAccuracy: true, timeout: 10000 });
        },
      }, t('useGps')), gpsNote),
    field(t('description'), el('textarea', { name: 'description', required: true, minlength: 10, maxlength: 2000, rows: 4 })),
    field(t('photo'), el('input', {
      type: 'file', accept: 'image/*', capture: 'environment',
      onchange: act(async (e) => {
        const file = e.target.files[0];
        if (!file) { photo = null; preview.replaceChildren(); return; }
        photo = await compressImage(file);
        preview.replaceChildren(el('img', { src: photo, alt: 'preview' }));
      }),
    })),
    preview,
    el('button', { class: 'btn' }, t('submit')))));
}

function complaintRow(g, base) {
  const c = cat(g.category);
  return el('a', { class: 'item', href: `${base}${g.id}` },
    el('div', { class: 'item-main' },
      el('b', {}, label(c)), el('small', { class: 'muted' }, `${g.number} · ${t('ward')} ${g.ward} · ${g.location}`)),
    el('div', { class: 'item-side' }, statusPill(g.status),
      g.overdue ? el('span', { class: 'pill bad' }, `${t('overdue')} ${g.overdueHours}h`) : null,
      g.escalation ? el('span', { class: 'pill warn' }, `${t('escalated')} ${g.escalation === 2 ? t('toChair') : t('toCommissioner')}`) : null));
}

async function viewMyComplaints() {
  const list = await api('/api/grievances/mine');
  page(el('section', { class: 'card' }, el('h2', {}, t('myComplaints')),
    list.length ? el('div', { class: 'list' }, list.map((g) => complaintRow(g, '#/c/g/'))) : empty(),
    el('a', { class: 'btn', href: '#/c/new' }, t('raise'))));
}

function timeline(g) {
  return el('ol', { class: 'timeline' }, g.history.slice().reverse().map((h) =>
    el('li', {}, statusPill(h.status), el('div', {}, el('p', {}, h.remark), el('small', { class: 'muted' }, `${h.by} · ${fmt(h.at)}`)))));
}

function details(g) {
  const c = cat(g.category);
  return [
    el('div', { class: 'row space' }, el('h2', {}, label(c)), statusPill(g.status)),
    el('dl', { class: 'facts' },
      el('dt', {}, 'No.'), el('dd', {}, g.number),
      el('dt', {}, t('department')), el('dd', {}, label(dept(g.department))),
      el('dt', {}, t('ward')), el('dd', {}, String(g.ward)),
      el('dt', {}, t('location')), el('dd', {}, g.location,
        g.lat != null ? el('a', { href: `https://www.openstreetmap.org/?mlat=${g.lat}&mlon=${g.lng}#map=18/${g.lat}/${g.lng}`, target: '_blank', rel: 'noopener' }, ' (map)') : null),
      el('dt', {}, t('due')), el('dd', { class: g.overdue ? 'bad-text' : null }, fmt(g.dueAt), g.overdue ? ` · ${t('overdue')} ${g.overdueHours}h` : ''),
      el('dt', {}, t('assigned')), el('dd', {}, g.assignedName || '—')),
    el('p', { class: 'desc' }, g.description),
    g.hasPhoto ? photoBox(g.id) : null,
  ];
}

function photoBox(id) {
  const box = el('div', { class: 'preview' }, el('small', { class: 'muted' }, 'Loading photo…'));
  api(`/api/grievances/${id}/photo`).then((r) => box.replaceChildren(el('img', { src: r.photo, alt: 'complaint photo' }))).catch(() => box.replaceChildren());
  return box;
}

async function viewCitizenComplaint(id) {
  const g = await api(`/api/grievances/${id}`);
  const closed = ['resolved', 'rejected'].includes(g.status);
  page(el('section', { class: 'card' }, el('a', { href: '#/c/list' }, '← ' + t('back')),
    details(g),
    g.status === 'resolved' && !g.feedback ? el('form', {
      class: 'inline-form',
      onsubmit: act(async (e) => { await api(`/api/grievances/${id}/feedback`, { method: 'POST', body: { ...formData(e.target), rating: Number(formData(e.target).rating) } }); toast('Thank you'); route(); }),
    }, el('h3', {}, t('rate')),
    el('div', { class: 'stars' }, [1, 2, 3, 4, 5].map((n) => el('label', {}, el('input', { type: 'radio', name: 'rating', value: n, required: true }), `${n}★`))),
    el('input', { name: 'comment', maxlength: 500, placeholder: 'Comment (optional)' }),
    el('button', { class: 'btn' }, t('send'))) : null,
    g.feedback ? el('p', {}, `${t('rate')}: ${'★'.repeat(g.feedback.rating)} ${g.feedback.comment || ''}`) : null,
    closed ? el('form', {
      class: 'inline-form',
      onsubmit: act(async (e) => { await api(`/api/grievances/${id}/reopen`, { method: 'POST', body: formData(e.target) }); toast(t('s_reopened')); route(); }),
    }, el('h3', {}, t('reopen')), el('input', { name: 'reason', required: true, minlength: 5, maxlength: 500, placeholder: t('reason') }), el('button', { class: 'btn secondary' }, t('send'))) : null,
    el('h3', {}, t('history')), timeline(g)));
}

function viewTax() {
  const out = el('div');
  page(el('section', { class: 'card' }, el('h2', {}, t('payTax')),
    el('form', {
      class: 'row',
      onsubmit: act(async (e) => { const p = await api(`/api/property/${encodeURIComponent(formData(e.target).no)}`); showProperty(p, out); }),
    }, el('input', { name: 'no', required: true, placeholder: t('assessmentNo'), inputmode: 'numeric' }), el('button', { class: 'btn' }, t('search'))),
    S.cfg.demo ? el('p', { class: 'muted small' }, 'Demo assessment numbers: 1000000001 to 1000000006') : null,
    out));
}

function showProperty(p, out) {
  out.replaceChildren(el('div', { class: 'card inner' },
    el('dl', { class: 'facts' },
      el('dt', {}, t('assessmentNo')), el('dd', {}, p.assessmentNo),
      el('dt', {}, t('owner')), el('dd', {}, p.ownerName),
      el('dt', {}, t('ward')), el('dd', {}, String(p.ward)),
      el('dt', {}, 'Address'), el('dd', {}, p.address),
      el('dt', {}, t('demand')), el('dd', {}, `${money(p.demand)} (current ${money(p.annualTax)} + arrears ${money(p.arrears)})`),
      el('dt', {}, t('paid')), el('dd', {}, money(p.paid)),
      el('dt', {}, t('balance')), el('dd', { class: p.due ? 'bad-text' : null }, money(p.due))),
    p.due > 0 ? el('form', {
      class: 'row',
      onsubmit: act(async (e) => {
        const r = await api(`/api/property/${p.assessmentNo}/pay`, { method: 'POST', body: { amount: Number(formData(e.target).amount) } });
        toast(`${t('receipt')} ${r.receipt.receiptNo}: ${money(r.receipt.amount)}`);
        showProperty(r.property, out);
      }),
    }, el('input', { name: 'amount', type: 'number', min: 1, max: p.due, value: p.due, required: true }), el('button', { class: 'btn' }, t('pay'))) : null,
    p.payments.length ? el('table', {}, el('tr', {}, el('th', {}, t('receipt')), el('th', {}, t('amount')), el('th', {}, 'Date')),
      p.payments.map((x) => el('tr', {}, el('td', {}, x.receiptNo), el('td', {}, money(x.amount)), el('td', {}, fmt(x.at))))) : null));
}

async function viewMeet() {
  const mine = await api('/api/appointments/mine');
  const tomorrow = new Date(Date.now() + 864e5).toISOString().slice(0, 10);
  page(el('section', { class: 'card' }, el('h2', {}, `${t('meet')} ${S.cfg.headTitle}`),
    el('form', {
      onsubmit: act(async (e) => { await api('/api/appointments', { method: 'POST', body: formData(e.target) }); toast('Request sent'); route(); }),
    },
    field(t('purpose'), el('textarea', { name: 'purpose', required: true, minlength: 10, maxlength: 1000, rows: 3 })),
    field(t('preferredDate'), el('input', { name: 'preferredDate', type: 'date', min: tomorrow, required: true })),
    el('button', { class: 'btn' }, t('request')))),
  el('section', { class: 'card' }, el('h2', {}, t('myRequests')),
    mine.length ? el('div', { class: 'list' }, mine.map((a) => el('div', { class: 'item' },
      el('div', { class: 'item-main' }, el('b', {}, a.purpose), el('small', { class: 'muted' }, `${t('preferredDate')}: ${a.preferredDate}${a.slot ? ' · ' + t('slot') + ': ' + a.slot : ''}${a.remark ? ' · ' + a.remark : ''}`)),
      el('div', { class: 'item-side' }, statusPill(a.status))))) : empty()));
}

// ---------- staff pages ----------
async function viewDashboard() {
  const s = await api('/api/staff/dashboard');
  const deptRows = Object.entries(s.byDepartment).sort((a, b) => b[1].open - a[1].open);
  const wardRows = Object.entries(s.byWard).sort((a, b) => b[1].open - a[1].open).slice(0, 10);
  const maxD = Math.max(1, ...deptRows.map(([, v]) => v.total));
  const maxW = Math.max(1, ...wardRows.map(([, v]) => v.total));
  page(
    el('h1', {}, `${S.user.name}`),
    el('div', { class: 'stats' },
      stat(s.open, t('open')), stat(s.overdue, t('overdue'), s.overdue ? 'bad' : ''),
      stat(s.escalatedToChair, `${t('escalated')} ${t('toChair')}`, s.escalatedToChair ? 'bad' : ''),
      stat(s.resolved, t('resolved')),
      stat(s.resolvedOnTimePct == null ? '—' : s.resolvedOnTimePct + '%', t('onTime')),
      stat(s.avgRating ?? '—', t('avgRating')), stat(s.avgResolutionHours ?? '—', t('avgHours'))),
    isLead() ? el('div', { class: 'stats' },
      stat(`${s.tax.pct}%`, `${t('taxReport')} (${money(s.tax.collected)} / ${money(s.tax.demand)})`),
      stat(`${s.actions.done}/${s.actions.total}`, `${t('actions')}: ${t('s_done')}`),
      stat(s.appointmentsPending, `${t('appointments')}: ${t('s_requested')}`)) : null,
    el('section', { class: 'card' }, el('h2', {}, `${t('department')}`),
      deptRows.length ? el('table', {}, el('tr', {}, el('th', {}, t('department')), el('th', {}, t('total')), el('th', {}, t('open')), el('th', {}, t('overdue')), el('th', {}, '')),
        deptRows.map(([k, v]) => el('tr', {}, el('td', {}, el('a', { href: `#/s/queue?department=${k}` }, label(dept(k)))), el('td', {}, v.total), el('td', {}, v.open), el('td', { class: v.overdue ? 'bad-text' : null }, v.overdue), el('td', { class: 'barcell' }, bar(v.total, maxD))))) : empty()),
    el('section', { class: 'card' }, el('h2', {}, `${t('ward')} (top 10 by ${t('open')})`),
      wardRows.length ? el('table', {}, el('tr', {}, el('th', {}, t('ward')), el('th', {}, t('total')), el('th', {}, t('open')), el('th', {}, t('overdue')), el('th', {}, '')),
        wardRows.map(([k, v]) => el('tr', {}, el('td', {}, el('a', { href: `#/s/queue?ward=${k}` }, `${t('ward')} ${k}`)), el('td', {}, v.total), el('td', {}, v.open), el('td', { class: v.overdue ? 'bad-text' : null }, v.overdue), el('td', { class: 'barcell' }, bar(v.total, maxW))))) : empty()));
}

function hashQuery() {
  const q = (location.hash.split('?')[1] || '');
  return Object.fromEntries(new URLSearchParams(q));
}

async function viewQueue() {
  const q = { status: 'open', ...hashQuery() };
  const list = await api('/api/staff/grievances?' + new URLSearchParams(q));
  const apply = (e) => {
    const f = formData(e.currentTarget.form || e.currentTarget);
    if (!f.overdue) delete f.overdue;
    if (!f.mine) delete f.mine;
    for (const k of Object.keys(f)) if (f[k] === '') delete f[k];
    go('#/s/queue?' + new URLSearchParams(f));
  };
  page(el('section', { class: 'card' }, el('h2', {}, `${t('queue')} (${list.length})`),
    el('form', { class: 'filters', onsubmit: (e) => { e.preventDefault(); apply(e); }, onchange: apply },
      el('select', { name: 'status' },
        el('option', { value: 'open', selected: q.status === 'open' }, t('open')),
        el('option', { value: '', selected: q.status === '' }, t('all')),
        S.cfg.statuses.map((s) => el('option', { value: s, selected: q.status === s }, t('s_' + s)))),
      ['chairperson', 'commissioner', 'ward_officer'].includes(S.user.role) ? el('select', { name: 'department' }, el('option', { value: '' }, t('department') + ': ' + t('all')),
        S.cfg.departments.map((d) => el('option', { value: d.id, selected: q.department === d.id }, label(d)))) : null,
      S.user.role !== 'ward_officer' ? wardSelect('ward', q.ward, true) : null,
      el('label', { class: 'check' }, el('input', { type: 'checkbox', name: 'overdue', value: '1', checked: q.overdue === '1' }), t('onlyOverdue')),
      el('label', { class: 'check' }, el('input', { type: 'checkbox', name: 'mine', value: '1', checked: q.mine === '1' }), t('assignedToMe')),
      el('input', { name: 'q', value: q.q || '', placeholder: t('search') + '…' })),
    list.length ? el('div', { class: 'list' }, list.map((g) => complaintRow(g, '#/s/g/'))) : empty()));
}

async function viewStaffComplaint(id) {
  const [g, officers] = await Promise.all([api(`/api/grievances/${id}`), api('/api/staff/officers')]);
  const open = !['resolved', 'rejected'].includes(g.status);
  const pool = S.user.role === 'officer' ? officers.filter((o) => o.department === S.user.department) : officers;
  const suggested = (o) => o.department === g.department || (o.role === 'ward_officer' && o.ward === g.ward);
  const post = (path, body) => act(async () => { await api(path, { method: 'POST', body }); toast('Saved'); route(); });
  page(el('section', { class: 'card' }, el('a', { href: '#/s/queue' }, '← ' + t('back')),
    details(g),
    el('p', { class: 'muted small' }, `${g.citizenName} · ${g.citizenMobile} · ${fmt(g.createdAt)}`),
    open ? el('div', { class: 'actions-box' },
      el('form', {
        class: 'row',
        onsubmit: act(async (e) => { await api(`/api/staff/grievances/${id}/assign`, { method: 'POST', body: formData(e.target) }); toast('Assigned'); route(); }),
      },
      el('select', { name: 'officerId', required: true }, el('option', { value: '' }, t('assign') + '…'),
        pool.slice().sort((a, b) => suggested(b) - suggested(a)).map((o) => el('option', { value: o.id, selected: o.id === g.assignedTo }, `${suggested(o) ? '★ ' : ''}${o.name}`))),
      el('button', { class: 'btn secondary' }, t('assign'))),
      g.status !== 'in_progress' ? el('button', { class: 'btn secondary', onclick: post(`/api/staff/grievances/${id}/status`, { status: 'in_progress' }) }, t('startWork')) : null,
      el('form', {
        class: 'inline-form',
        onsubmit: act(async (e) => {
          const f = formData(e.target);
          await api(`/api/staff/grievances/${id}/status`, { method: 'POST', body: { status: e.submitter.value, remark: f.remark } });
          toast('Saved'); route();
        }),
      },
      el('textarea', { name: 'remark', required: true, minlength: 5, maxlength: 1000, rows: 2, placeholder: t('remark') + ' (what was done)' }),
      el('div', { class: 'row' },
        el('button', { class: 'btn', value: 'resolved' }, t('markResolved')),
        el('button', { class: 'btn danger', value: 'rejected' }, t('reject'))))) : null,
    g.feedback ? el('p', {}, `${t('rate')}: ${'★'.repeat(g.feedback.rating)} ${g.feedback.comment || ''}`) : null,
    el('h3', {}, t('history')), timeline(g)));
}

async function viewActions() {
  const list = await api('/api/staff/actions');
  const groups = ['100-day', '1-year', '5-year'];
  page(
    groups.map((h) => el('section', { class: 'card' }, el('h2', {}, `${t('actions')}: ${h}`),
      el('table', {}, el('tr', {}, el('th', {}, t('title')), el('th', {}, t('owner')), el('th', {}, t('due')), el('th', {}, t('status'))),
        list.filter((a) => a.horizon === h).map((a) => el('tr', {},
          el('td', {}, a.title, a.note ? el('small', { class: 'muted block' }, a.note) : null),
          el('td', {}, a.owner), el('td', {}, a.dueDate),
          el('td', {}, isLead() ? el('select', {
            onchange: act(async (e) => { await api(`/api/staff/actions/${a.id}`, { method: 'PATCH', body: { status: e.target.value } }); toast('Saved'); }),
          }, ['not_started', 'in_progress', 'done'].map((s) => el('option', { value: s, selected: a.status === s }, t('s_' + s)))) : statusPill(a.status))))))),
    isLead() ? el('section', { class: 'card' }, el('h2', {}, `${t('add')}`),
      el('form', {
        class: 'filters',
        onsubmit: act(async (e) => { await api('/api/staff/actions', { method: 'POST', body: formData(e.target) }); toast('Added'); route(); }),
      },
      el('input', { name: 'title', required: true, placeholder: t('title'), maxlength: 200 }),
      el('select', { name: 'horizon' }, groups.map((h) => el('option', { value: h }, h))),
      el('input', { name: 'owner', placeholder: t('owner'), maxlength: 80 }),
      el('input', { name: 'dueDate', type: 'date' }),
      el('button', { class: 'btn' }, t('add')))) : null);
}

async function viewAppointments() {
  const list = await api('/api/staff/appointments');
  page(el('section', { class: 'card' }, el('h2', {}, t('appointments')),
    list.length ? el('div', { class: 'list' }, list.map((a) => el('div', { class: 'item col' },
      el('div', { class: 'row space' }, el('b', {}, `${a.name} · ${a.mobile}`), statusPill(a.status)),
      el('p', {}, a.purpose),
      el('small', { class: 'muted' }, `${t('preferredDate')}: ${a.preferredDate}${a.slot ? ' · ' + a.slot : ''}${a.remark ? ' · ' + a.remark : ''}`),
      ['requested', 'scheduled'].includes(a.status) ? el('form', {
        class: 'filters',
        onsubmit: act(async (e) => {
          await api(`/api/staff/appointments/${a.id}`, { method: 'POST', body: { ...formData(e.target), status: e.submitter.value } });
          toast('Saved'); route();
        }),
      },
      el('input', { name: 'slot', placeholder: t('slot'), value: a.slot || `${a.preferredDate} 11:00` }),
      el('input', { name: 'remark', placeholder: t('remark') }),
      el('button', { class: 'btn', value: 'scheduled' }, t('schedule')),
      el('button', { class: 'btn secondary', value: 'done' }, t('done')),
      el('button', { class: 'btn danger', value: 'declined' }, t('decline'))) : null))) : empty()));
}

async function viewStaffNotices() {
  const ann = await api('/api/announcements');
  page(el('section', { class: 'card' }, el('h2', {}, `${t('notices')}: ${t('add')}`),
    el('form', {
      onsubmit: act(async (e) => { await api('/api/staff/announcements', { method: 'POST', body: formData(e.target) }); toast('Published'); route(); }),
    },
    field(t('title'), el('input', { name: 'title', required: true, maxlength: 120 })),
    field(`${t('title')} (తెలుగు)`, el('input', { name: 'titleTe', maxlength: 120 })),
    field(t('message'), el('textarea', { name: 'body', required: true, maxlength: 2000, rows: 3 })),
    field(t('ward'), wardSelect('ward', null, true)),
    el('button', { class: 'btn' }, t('add')))),
  el('section', { class: 'card' }, el('h2', {}, t('notices')),
    ann.map((a) => el('div', { class: 'item' },
      el('div', { class: 'item-main' }, el('b', {}, a.title), el('small', { class: 'muted' }, `${a.ward ? t('ward') + ' ' + a.ward : t('allWards')} · ${fmt(a.createdAt)}`)),
      el('button', { class: 'btn danger small', onclick: act(async () => { if (!confirm('Delete?')) return; await api(`/api/staff/announcements/${a.id}`, { method: 'DELETE' }); route(); }) }, t('delete'))))));
}

async function viewUsers() {
  const users = await api('/api/staff/users');
  const roleSel = el('select', { name: 'role' }, ['officer', 'ward_officer', 'commissioner'].map((r) => el('option', { value: r }, r)));
  page(el('section', { class: 'card' }, el('h2', {}, t('users')),
    el('table', {}, el('tr', {}, el('th', {}, t('username')), el('th', {}, 'Name'), el('th', {}, 'Role'), el('th', {}, t('department') + ' / ' + t('ward')), el('th', {}, '')),
      users.map((u) => el('tr', { class: u.active ? null : 'muted' },
        el('td', {}, u.username), el('td', {}, u.name), el('td', {}, u.role),
        el('td', {}, u.department ? label(dept(u.department)) : u.ward ? `${t('ward')} ${u.ward}` : ''),
        el('td', {}, u.id === S.user.id ? '' : el('button', {
          class: 'btn small secondary',
          onclick: act(async () => { await api(`/api/staff/users/${u.id}`, { method: 'PATCH', body: { active: !u.active } }); route(); }),
        }, u.active ? 'Disable' : 'Enable')))))),
  el('section', { class: 'card' }, el('h2', {}, `${t('users')}: ${t('add')}`),
    el('form', {
      class: 'filters',
      onsubmit: act(async (e) => { await api('/api/staff/users', { method: 'POST', body: formData(e.target) }); toast('Created'); route(); }),
    },
    el('input', { name: 'name', required: true, placeholder: 'Name' }),
    el('input', { name: 'username', required: true, placeholder: t('username') }),
    el('input', { name: 'password', type: 'password', required: true, minlength: 8, placeholder: t('password') + ' (8+)', autocomplete: 'new-password' }),
    roleSel,
    el('select', { name: 'department' }, S.cfg.departments.map((d) => el('option', { value: d.id }, label(d)))),
    wardSelect('ward', null, true),
    el('button', { class: 'btn' }, t('add')))),
  passwordCard());
}

function passwordCard() {
  return el('section', { class: 'card' }, el('h2', {}, t('changePassword')),
    el('form', {
      class: 'filters',
      onsubmit: act(async (e) => { await api('/api/staff/password', { method: 'POST', body: formData(e.target) }); e.target.reset(); toast('Password changed'); }),
    },
    el('input', { name: 'current', type: 'password', required: true, placeholder: t('current'), autocomplete: 'current-password' }),
    el('input', { name: 'next', type: 'password', required: true, minlength: 8, placeholder: t('newPw'), autocomplete: 'new-password' }),
    el('button', { class: 'btn' }, t('changePassword'))));
}

async function viewAudit() {
  const rows = await api('/api/staff/audit');
  page(el('section', { class: 'card' }, el('h2', {}, t('audit')),
    el('table', {}, el('tr', {}, el('th', {}, 'When'), el('th', {}, 'Who'), el('th', {}, 'Action'), el('th', {}, 'Detail')),
      rows.map((r) => el('tr', {}, el('td', {}, fmt(r.at)), el('td', {}, r.name), el('td', {}, r.action), el('td', {}, r.detail))))));
}

async function viewTaxReport() {
  const r = await api('/api/staff/property');
  page(el('section', { class: 'card' }, el('h2', {}, t('taxReport')),
    el('table', {}, el('tr', {}, el('th', {}, t('ward')), el('th', {}, 'Properties'), el('th', {}, t('demand')), el('th', {}, t('paid')), el('th', {}, '%'), el('th', {}, '')),
      r.byWard.map((w) => el('tr', {}, el('td', {}, w.ward), el('td', {}, w.count), el('td', {}, money(w.demand)), el('td', {}, money(w.paid)),
        el('td', {}, w.demand ? Math.round((w.paid / w.demand) * 100) + '%' : '—'), el('td', { class: 'barcell' }, bar(w.paid, w.demand)))))),
  el('section', { class: 'card' }, el('h2', {}, t('assessmentNo')),
    el('table', {}, el('tr', {}, el('th', {}, t('assessmentNo')), el('th', {}, t('owner')), el('th', {}, t('ward')), el('th', {}, t('demand')), el('th', {}, t('balance'))),
      r.properties.map((p) => el('tr', {}, el('td', {}, p.assessmentNo), el('td', {}, p.ownerName), el('td', {}, p.ward), el('td', {}, money(p.demand)), el('td', { class: p.due ? 'bad-text' : null }, money(p.due)))))),
  isStaff() && !isLead() ? passwordCard() : null);
}

// ---------- router ----------
function go(hash) { if (location.hash === hash) route(); else location.hash = hash; }

async function route() {
  const h = (location.hash || '#/').split('?')[0];
  const m = (re) => re.exec(h);
  const area = (p) => h === p || h.startsWith(p + '/'); // '#/s' area, but not '#/staff-login'
  try {
    if (S.user && S.user.role === 'citizen' && area('#/s')) return go('#/c');
    if (isStaff() && area('#/c')) return go('#/s');
    if (!S.user && (area('#/c') || area('#/s'))) return go('#/');
    let r;
    if (h === '#/' || h === '') return S.user ? go(isStaff() ? '#/s' : '#/c') : await viewLanding();
    if (h === '#/login') return viewCitizenLogin();
    if (h === '#/staff-login') return viewStaffLogin();
    if (h === '#/c') return await viewCitizenHome();
    if (h === '#/c/new') return viewNewComplaint();
    if (h === '#/c/list') return await viewMyComplaints();
    if ((r = m(/^#\/c\/g\/([\w-]+)$/))) return await viewCitizenComplaint(r[1]);
    if (h === '#/c/tax') return viewTax();
    if (h === '#/c/meet') return await viewMeet();
    if (h === '#/s') return await viewDashboard();
    if (h === '#/s/queue') return await viewQueue();
    if ((r = m(/^#\/s\/g\/([\w-]+)$/))) return await viewStaffComplaint(r[1]);
    if (h === '#/s/actions') return await viewActions();
    if (h === '#/s/meet') return await viewAppointments();
    if (h === '#/s/notices') return await viewStaffNotices();
    if (h === '#/s/users') return await viewUsers();
    if (h === '#/s/audit') return await viewAudit();
    if (h === '#/s/tax') return await viewTaxReport();
    return go('#/');
  } catch (err) {
    page(el('section', { class: 'card' }, el('p', { class: 'bad-text' }, err.message), el('a', { href: '#/' }, t('home'))));
  }
}

(async function start() {
  try {
    S.cfg = await api('/api/config');
  } catch {
    mount(el('p', { class: 'card' }, 'Cannot reach the server. Check your connection and reload.'));
    return;
  }
  document.documentElement.lang = S.lang;
  window.addEventListener('hashchange', route);
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
  route();
})();
