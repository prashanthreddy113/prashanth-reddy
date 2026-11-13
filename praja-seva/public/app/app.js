'use strict';
/* Praja Seva single-page app: citizen portal + municipal department console. */

// Helpers in /common.js: S, t, label, fmt, money, el, toast, api, act, formData, ...
const OFFICE = location.pathname.startsWith('/office');
const cat = (id) => S.cfg.categories.find((c) => c.id === id);
const dept = (id) => S.cfg.departments.find((d) => d.id === id);
const svc = (id) => S.cfg.services.find((s) => s.id === id);
const isStaff = () => S.user && S.user.role !== 'citizen';
const isLead = () => S.user && ['chairperson', 'commissioner'].includes(S.user.role);
const $app = () => document.getElementById('app');
function mount(...nodes) { const a = $app(); a.replaceChildren(...nodes); window.scrollTo(0, 0); }
window.onAuthLost = () => go('#/');


// ---------- layout ----------
// Office console navigation, grouped. Each entry: [hash, label key, roles allowed (null = all staff)].
const LEAD_ROLES = ['chairperson', 'commissioner'];
const OFFICE_NAV = [
  ['overview', [['#/s', 'dashboard'], ['#/s/report', 'reviewReport', LEAD_ROLES], ['#/s/kpis', 'kpis']]],
  ['citizenServices', [['#/s/queue', 'queue'], ['#/s/walkin', 'walkin'], ['#/s/apps', 'serviceRequests'], ['#/s/meet', 'appointments', LEAD_ROLES]]],
  ['fieldWork', [['#/s/inspections', 'inspections'], ['#/s/works', 'works']]],
  ['governance', [['#/s/council', 'council'], ['#/s/committees', 'wardCommittees'], ['#/s/wards', 'wardsCouncillors'], ['#/s/actions', 'actions']]],
  ['finance', [['#/s/budget', 'budget'], ['#/s/tax', 'taxReport']]],
  ['admin', [['#/s/notices', 'notices', LEAD_ROLES], ['#/s/users', 'users', LEAD_ROLES], ['#/s/audit', 'audit', LEAD_ROLES], ['#/s/account', 'myAccount']]],
];

function isActive(h) {
  const here = (location.hash || '#/').split('?')[0];
  return here === h || (h !== '#/s' && h !== '#/c' && here.startsWith(h + '/'));
}

function langButton() {
  return el('button', { class: 'ghost', onclick: () => { setLang(S.lang === 'en' ? 'te' : 'en'); route(); } }, t('lang'));
}

function logoutButton() {
  return el('button', { class: 'ghost', onclick: act(async () => { await api('/api/auth/logout', { method: 'POST' }).catch(() => {}); setSession(null, null); go('#/'); }) }, t('logout'));
}

function header() {
  const nav = [];
  if (S.user && S.user.role === 'citizen') {
    nav.push(['#/c', t('home')], ['#/c/new', t('raise')], ['#/c/list', t('myComplaints')], ['#/c/apply', t('applyService')], ['#/c/apps', t('myApplications')], ['#/c/tax', t('payTax')], ['#/c/meet', `${t('meet')} ${S.cfg.headTitle}`]);
  }
  return el('header', { class: 'top' },
    el('a', { class: 'brand', href: '/' },
      el('img', { src: '/icon.svg', alt: '', width: 32, height: 32 }),
      el('div', {},
        el('strong', {}, OFFICE ? t('officeName') : t('appName')),
        el('small', {}, S.lang === 'te' ? S.cfg.municipalityTe : S.cfg.municipality))),
    el('div', { class: 'top-actions' },
      S.user && isStaff() ? el('span', { class: 'who' }, `${S.user.name}`) : null,
      langButton(), S.user ? logoutButton() : null),
    nav.length ? el('nav', { class: 'tabs' }, nav.map(([h, l]) => el('a', { href: h, class: isActive(h) ? 'active' : null }, l))) : null);
}

function sidebar() {
  return el('aside', { class: 'side' },
    OFFICE_NAV.map(([group, items]) => {
      const visible = items.filter(([, , roles]) => !roles || roles.includes(S.user.role));
      if (!visible.length) return null;
      return el('div', { class: 'side-group' }, el('small', {}, t(group)),
        visible.map(([h, k]) => el('a', { href: h, class: isActive(h) ? 'active' : null }, t(k))));
    }));
}

function page(...content) {
  const foot = el('footer', {},
    el('a', { href: '/' }, t('portal')), ' · ', `${S.cfg.constituency} · ${S.cfg.municipality}`,
    S.cfg.demo ? el('span', { class: 'pill warn' }, t('demoData')) : null);
  if (OFFICE && isStaff()) {
    mount(header(), el('div', { class: 'office' }, sidebar(), el('main', {}, ...content)), foot);
  } else {
    mount(header(), el('main', {}, ...content), foot);
  }
}

function wardSelect(name, value, allowAll) {
  return el('select', { name, required: !allowAll },
    allowAll ? el('option', { value: '' }, t('allWards')) : el('option', { value: '' }, '—'),
    S.cfg.wards.map((w) => el('option', { value: w, selected: Number(value) === w }, `${t('ward')} ${w}`)));
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
      tile('#/c/apply', t('applyService'), t('applyServiceSub')),
      tile('#/c/apps', t('myApplications'), t('trackApplications')),
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

// ---------- citizen: service applications ----------
function viewApplyList() {
  page(el('section', { class: 'card' }, el('h2', {}, t('applyService')),
    el('p', { class: 'muted' }, t('applyIntro')),
    el('div', { class: 'svc-grid' }, S.cfg.services.map((s) => el('article', { class: 'svc' },
      el('h3', {}, label(s)),
      el('p', { class: 'muted small' }, `${t('department')}: ${label(dept(s.dept))}`),
      el('p', { class: 'small' }, el('b', {}, `${t('documents')}: `), s.docs),
      el('div', { class: 'row space' },
        el('span', { class: 'pill' }, `${s.slaDays} ${t('days')}`),
        s.external
          ? el('a', { class: 'btn secondary small', href: s.external, target: '_blank', rel: 'noopener' }, t('openPortal'))
          : el('a', { class: 'btn small', href: `#/c/apply/${s.id}` }, t('apply'))))))));
}

function viewApplyForm(id) {
  const s = svc(id);
  if (!s || s.external) return go('#/c/apply');
  page(el('section', { class: 'card narrow-wide' }, el('a', { href: '#/c/apply' }, '← ' + t('back')),
    el('h2', {}, label(s)),
    el('p', { class: 'muted' }, `${t('documents')}: ${s.docs} · ${t('deadline')}: ${s.slaDays} ${t('days')}`),
    el('form', {
      onsubmit: act(async (e) => {
        const a = await api('/api/applications', { method: 'POST', body: { ...formData(e.target), service: s.id } });
        toast(`${t('applicationNo')}: ${a.number}`);
        go(`#/c/app/${a.id}`);
      }),
    },
    field(t('ward'), wardSelect('ward', S.user.ward)),
    field(t('details'), el('textarea', { name: 'details', required: true, minlength: 5, maxlength: 2000, rows: 4, placeholder: t('detailsHint') })),
    el('p', { class: 'muted small' }, t('docsAtVerification')),
    el('button', { class: 'btn' }, t('submit')))));
}

function appRow(a, base) {
  return el('a', { class: 'item', href: `${base}${a.id}` },
    el('div', { class: 'item-main' }, el('b', {}, label(svc(a.service))), el('small', { class: 'muted' }, `${a.number} · ${t('ward')} ${a.ward} · ${fmt(a.createdAt)}`)),
    el('div', { class: 'item-side' }, statusPill(a.status), a.overdue ? el('span', { class: 'pill bad' }, `${t('overdue')} ${a.overdueDays}d`) : null));
}

async function viewMyApps() {
  const list = await api('/api/applications/mine');
  page(el('section', { class: 'card' }, el('h2', {}, t('myApplications')),
    list.length ? el('div', { class: 'list' }, list.map((a) => appRow(a, '#/c/app/'))) : empty(),
    el('a', { class: 'btn', href: '#/c/apply' }, t('applyService'))));
}

function appDetails(a) {
  return [
    el('div', { class: 'row space' }, el('h2', {}, label(svc(a.service))), statusPill(a.status)),
    el('dl', { class: 'facts' },
      el('dt', {}, 'No.'), el('dd', {}, a.number),
      el('dt', {}, t('department')), el('dd', {}, label(dept(a.department))),
      el('dt', {}, t('ward')), el('dd', {}, String(a.ward)),
      el('dt', {}, t('due')), el('dd', { class: a.overdue ? 'bad-text' : null }, fmt(a.dueAt), a.overdue ? ` · ${t('overdue')} ${a.overdueDays}d` : '')),
    el('p', { class: 'desc' }, a.details),
  ];
}

async function viewCitizenApp(id) {
  const a = await api(`/api/applications/${id}`);
  page(el('section', { class: 'card' }, el('a', { href: '#/c/apps' }, '← ' + t('back')), appDetails(a), el('h3', {}, t('history')), timeline(a)));
}

// ---------- public tracking (no login) ----------
function viewTrack() {
  const out = el('div');
  page(el('section', { class: 'card narrow-wide' }, el('h2', {}, t('track')),
    el('p', { class: 'muted' }, t('trackHint')),
    el('form', {
      class: 'row',
      onsubmit: act(async (e) => {
        const r = await api(`/api/public/track/${encodeURIComponent(formData(e.target).no.trim())}`);
        const what = r.kind === 'complaint' ? label(cat(r.category)) : label(svc(r.service));
        out.replaceChildren(el('div', { class: 'card inner' },
          el('div', { class: 'row space' }, el('h3', {}, what), statusPill(r.status)),
          el('dl', { class: 'facts' },
            el('dt', {}, 'No.'), el('dd', {}, r.number),
            el('dt', {}, t('department')), el('dd', {}, label(dept(r.department))),
            el('dt', {}, t('ward')), el('dd', {}, String(r.ward)),
            el('dt', {}, t('due')), el('dd', { class: r.overdue ? 'bad-text' : null }, fmt(r.dueAt), r.overdue ? ` · ${t('overdue')}` : '')),
          timeline(r)));
      }),
    },
    el('input', { name: 'no', required: true, placeholder: 'PS-2026-000001 / SR-2026-000001', value: hashQuery().no || '' }),
    el('button', { class: 'btn' }, t('search'))),
    out));
  if (hashQuery().no) out.closest('section').querySelector('form').requestSubmit();
}

// ---------- staff: walk-in / phone complaints ----------
function viewWalkin() {
  const byDept = S.cfg.departments.map((d) => el('optgroup', { label: label(d) },
    S.cfg.categories.filter((c) => c.dept === d.id).map((c) => el('option', { value: c.id }, label(c)))));
  page(el('section', { class: 'card narrow-wide' }, el('h2', {}, t('walkin')),
    el('p', { class: 'muted' }, t('walkinHint')),
    el('form', {
      onsubmit: act(async (e) => {
        const g = await api('/api/staff/grievances', { method: 'POST', body: formData(e.target) });
        toast(`${t('submitted')}: ${g.number}`);
        go(`#/s/g/${g.id}`);
      }),
    },
    el('div', { class: 'grid2' },
      field(t('citizenName'), el('input', { name: 'name', required: true, maxlength: 80 })),
      field(t('mobile'), el('input', { name: 'mobile', type: 'tel', required: true, maxlength: 13 })),
      field(t('source'), el('select', { name: 'source' }, ['praja_vani', 'helpline', 'ward_committee', 'field_visit'].map((x) => el('option', { value: x }, t('src_' + x))))),
      field(t('category'), el('select', { name: 'category', required: true }, el('option', { value: '' }, '—'), byDept)),
      field(t('ward'), wardSelect('ward', S.user.ward)),
      field(t('location'), el('input', { name: 'location', required: true, maxlength: 300 }))),
    field(t('description'), el('textarea', { name: 'description', required: true, minlength: 10, maxlength: 2000, rows: 3 })),
    el('button', { class: 'btn' }, t('register')))));
}

// ---------- staff: service applications queue ----------
async function viewApps() {
  const q = { status: 'open', ...hashQuery() };
  const list = await api('/api/staff/applications?' + new URLSearchParams(q));
  page(el('section', { class: 'card' }, el('div', { class: 'row space' }, el('h2', {}, `${t('serviceRequests')} (${list.length})`),
    isLead() ? el('button', { class: 'btn secondary small', onclick: act(() => downloadCsv('/api/staff/export/applications.csv', 'applications.csv')) }, t('exportCsv')) : null),
  el('form', { class: 'filters', onchange: (e) => { const f = formData(e.currentTarget); for (const k of Object.keys(f)) if (!f[k]) delete f[k]; go('#/s/apps?' + new URLSearchParams(f)); } },
    el('select', { name: 'status' },
      el('option', { value: 'open', selected: q.status === 'open' }, t('open')),
      el('option', { value: '', selected: q.status === '' }, t('all')),
      S.cfg.appStatuses.map((s) => el('option', { value: s, selected: q.status === s }, t('s_' + s)))),
    el('select', { name: 'service' }, el('option', { value: '' }, t('allServices')),
      S.cfg.services.filter((s) => !s.external).map((s) => el('option', { value: s.id, selected: q.service === s.id }, label(s))))),
  list.length ? el('div', { class: 'list' }, list.map((a) => appRow(a, '#/s/app/'))) : empty()));
}

async function viewStaffApp(id) {
  const a = await api(`/api/applications/${id}`);
  const open = ['received', 'verification', 'approved'].includes(a.status);
  page(el('section', { class: 'card' }, el('a', { href: '#/s/apps' }, '← ' + t('back')),
    appDetails(a),
    el('p', { class: 'muted small' }, `${a.name} · ${a.mobile} · ${fmt(a.createdAt)}`),
    open ? el('form', {
      class: 'inline-form actions-box',
      onsubmit: act(async (e) => {
        await api(`/api/staff/applications/${id}/status`, { method: 'POST', body: { status: e.submitter.value, remark: formData(e.target).remark } });
        toast(t('saved')); route();
      }),
    },
    el('textarea', { name: 'remark', rows: 2, maxlength: 1000, placeholder: t('remark') }),
    el('div', { class: 'row' },
      a.status === 'received' ? el('button', { class: 'btn secondary', value: 'verification' }, t('s_verification')) : null,
      a.status !== 'approved' ? el('button', { class: 'btn secondary', value: 'approved' }, t('approve')) : null,
      el('button', { class: 'btn', value: 'issued' }, t('issue')),
      el('button', { class: 'btn danger', value: 'rejected' }, t('reject')))) : null,
    el('h3', {}, t('history')), timeline(a)));
}

// ---------- staff: field inspections ----------
async function viewInspections() {
  const list = await api('/api/staff/inspections');
  const catSelect = () => el('select', { name: 'category', required: true }, el('option', { value: '' }, t('category') + '…'),
    S.cfg.categories.map((c) => el('option', { value: c.id }, label(c))));
  const today = new Date().toISOString().slice(0, 10);
  page(
    el('section', { class: 'card' }, el('h2', {}, t('logInspection')),
      el('p', { class: 'muted' }, t('inspectionHint')),
      el('form', {
        onsubmit: act(async (e) => { await api('/api/staff/inspections', { method: 'POST', body: formData(e.target) }); toast(t('saved')); route(); }),
      },
      el('div', { class: 'grid2' },
        field(t('ward'), wardSelect('ward', S.user.ward)),
        field(t('date'), el('input', { name: 'date', type: 'date', value: today, max: today, required: true })),
        field(t('location'), el('input', { name: 'location', required: true, maxlength: 200 })),
        field(t('severity'), el('select', { name: 'severity' }, ['low', 'medium', 'high'].map((s) => el('option', { value: s, selected: s === 'medium' }, t('sev_' + s)))))),
      field(t('findings'), el('textarea', { name: 'findings', required: true, minlength: 5, maxlength: 2000, rows: 3 })),
      el('button', { class: 'btn' }, t('save')))),
    el('section', { class: 'card' }, el('h2', {}, `${t('inspections')} (${list.length})`),
      list.length ? el('div', { class: 'list' }, list.map((x) => el('div', { class: 'item col' },
        el('div', { class: 'row space' }, el('b', {}, `${t('ward')} ${x.ward} · ${x.location}`), el('span', { class: `pill sev-${x.severity}` }, t('sev_' + x.severity))),
        el('p', {}, x.findings),
        el('small', { class: 'muted' }, `${fmtDate(x.date)} · ${x.by}`),
        x.grievanceId
          ? el('a', { href: `#/s/g/${x.grievanceId}` }, t('viewComplaint'))
          : el('form', {
            class: 'filters',
            onsubmit: act(async (e) => { const g = await api(`/api/staff/inspections/${x.id}/complaint`, { method: 'POST', body: formData(e.target) }); toast(`${t('submitted')}: ${g.number}`); route(); }),
          }, catSelect(), el('button', { class: 'btn small' }, t('raiseComplaint')))))) : empty()));
}

// ---------- staff: development works ----------
function workTypeLabel(id) { return label(S.cfg.workTypes.find((w) => w.id === id)); }

function workRow(w, href) {
  return el('a', { class: 'item', href },
    el('div', { class: 'item-main' }, el('b', {}, w.title),
      el('small', { class: 'muted' }, `${workTypeLabel(w.type)} · ${w.ward ? t('ward') + ' ' + w.ward : t('townWide')} · ${w.scheme} · ${inr(w.sanctioned)}`),
      bar(w.progress, 100, w.status === 'stalled' ? 'bad' : w.status === 'completed' ? 'good' : null)),
    el('div', { class: 'item-side' }, statusPill(w.status), el('small', {}, `${w.progress}%`)));
}

async function viewWorks() {
  const list = await api('/api/staff/works');
  const sum = (k) => list.reduce((a, w) => a + w[k], 0);
  page(
    el('div', { class: 'stats' },
      stat(list.length, t('totalWorks')), stat(list.filter((w) => w.status === 'in_progress').length, t('s_in_progress')),
      stat(list.filter((w) => w.status === 'completed').length, t('s_completed')),
      stat(list.filter((w) => w.status === 'stalled').length, t('s_stalled'), list.some((w) => w.status === 'stalled') ? 'bad' : ''),
      stat(inr(sum('sanctioned')), t('sanctioned')), stat(inr(sum('spent')), t('spent'))),
    el('section', { class: 'card' }, el('div', { class: 'row space' }, el('h2', {}, t('works')),
      isLead() ? el('button', { class: 'btn secondary small', onclick: act(() => downloadCsv('/api/staff/export/works.csv', 'works.csv')) }, t('exportCsv')) : null),
    list.length ? el('div', { class: 'list' }, list.map((w) => workRow(w, `#/s/work/${w.id}`))) : empty()),
    isLead() ? el('section', { class: 'card' }, el('h2', {}, t('addWork')),
      el('form', {
        onsubmit: act(async (e) => {
          const f = formData(e.target);
          await api('/api/staff/works', { method: 'POST', body: { ...f, sanctioned: Number(f.sanctioned || 0) * 1e5, public: true } });
          toast(t('saved')); route();
        }),
      },
      field(t('title'), el('input', { name: 'title', required: true, minlength: 5, maxlength: 200 })),
      el('div', { class: 'grid2' },
        field(t('workType'), el('select', { name: 'type' }, S.cfg.workTypes.map((w) => el('option', { value: w.id }, label(w))))),
        field(t('ward'), wardSelect('ward', null, true), t('blankTownWide')),
        field(t('scheme'), el('select', { name: 'scheme' }, S.cfg.schemes.map((s) => el('option', { value: s }, s)))),
        field(`${t('sanctioned')} (₹ ${t('lakh')})`, el('input', { name: 'sanctioned', type: 'number', min: 0, step: '0.01', required: true })),
        field(t('startDate'), el('input', { name: 'startDate', type: 'date' })),
        field(t('targetDate'), el('input', { name: 'targetDate', type: 'date' }))),
      el('button', { class: 'btn' }, t('add')))) : null);
}

async function viewWork(id) {
  const list = await api('/api/staff/works');
  const w = list.find((x) => x.id === id);
  if (!w) throw new Error('Work not found');
  const canEdit = isLead() || S.user.role === 'officer';
  page(el('section', { class: 'card' }, el('a', { href: '#/s/works' }, '← ' + t('back')),
    el('div', { class: 'row space' }, el('h2', {}, w.title), statusPill(w.status)),
    bar(w.progress, 100, w.status === 'stalled' ? 'bad' : w.status === 'completed' ? 'good' : null),
    el('dl', { class: 'facts' },
      el('dt', {}, t('workType')), el('dd', {}, workTypeLabel(w.type)),
      el('dt', {}, t('ward')), el('dd', {}, w.ward ? String(w.ward) : t('townWide')),
      el('dt', {}, t('scheme')), el('dd', {}, w.scheme),
      el('dt', {}, t('sanctioned')), el('dd', {}, inr(w.sanctioned)),
      el('dt', {}, t('spent')), el('dd', {}, `${inr(w.spent)} (${w.sanctioned ? Math.round((w.spent / w.sanctioned) * 100) : 0}%)`),
      el('dt', {}, t('progress')), el('dd', {}, `${w.progress}%`),
      el('dt', {}, t('contractor')), el('dd', {}, w.contractor || '—'),
      el('dt', {}, t('startDate')), el('dd', {}, fmtDate(w.startDate) || '—'),
      el('dt', {}, t('targetDate')), el('dd', {}, fmtDate(w.targetDate) || '—')),
    canEdit ? el('form', {
      class: 'actions-box',
      onsubmit: act(async (e) => {
        const f = formData(e.target);
        const body = { status: f.status, progress: Number(f.progress), note: f.note };
        if (isLead()) { body.spent = Math.round(Number(f.spent) * 1e5); body.contractor = f.contractor; }
        await api(`/api/staff/works/${id}`, { method: 'PATCH', body });
        toast(t('saved')); route();
      }),
    },
    el('h3', {}, t('updateProgress')),
    el('div', { class: 'grid2' },
      field(t('status'), el('select', { name: 'status' }, S.cfg.workStatuses.map((s) => el('option', { value: s, selected: s === w.status }, t('s_' + s))))),
      field(`${t('progress')} (%)`, el('input', { name: 'progress', type: 'number', min: 0, max: 100, value: w.progress, required: true })),
      isLead() ? field(`${t('spent')} (₹ ${t('lakh')})`, el('input', { name: 'spent', type: 'number', min: 0, step: '0.01', value: (w.spent / 1e5).toFixed(2) })) : null,
      isLead() ? field(t('contractor'), el('input', { name: 'contractor', maxlength: 120, value: w.contractor })) : null),
    field(t('note'), el('input', { name: 'note', maxlength: 500, placeholder: t('noteHint') })),
    el('button', { class: 'btn' }, t('save'))) : null,
    el('h3', {}, t('history')),
    el('ol', { class: 'timeline' }, w.updates.slice().reverse().map((u) => el('li', {}, el('span', { class: 'pill' }, `${u.progress}%`), el('div', {}, el('p', {}, u.note), el('small', { class: 'muted' }, `${u.by} · ${fmt(u.at)}`)))))));
}

// ---------- staff: council meetings & resolutions ----------
function meetingCard(m, editable) {
  const upcoming = m.status === 'scheduled';
  return el('article', { class: 'card meeting' },
    el('div', { class: 'row space' },
      el('h3', {}, `${t('mt_' + m.type)} · ${fmt(m.date)}`),
      el('div', { class: 'row' }, statusPill(m.status), m.published ? null : el('span', { class: 'pill warn' }, t('notPublished')))),
    el('p', { class: 'muted small' }, m.venue),
    el('h4', {}, t('agenda')), el('ol', {}, m.agenda.map((a) => el('li', {}, a))),
    m.minutes ? [el('h4', {}, t('minutes')), el('p', { class: 'desc' }, m.minutes)] : null,
    m.resolutions.length ? [el('h4', {}, t('resolutions')),
      el('table', {}, el('tr', {}, el('th', {}, 'No.'), el('th', {}, t('subject')), el('th', {}, t('decision'))),
        m.resolutions.map((r) => el('tr', {}, el('td', {}, r.no), el('td', {}, r.subject), el('td', {}, statusPill(r.decision)))))] : null,
    editable ? el('details', { class: 'edit-box' }, el('summary', {}, t('recordOutcome')),
      el('form', {
        class: 'filters',
        onsubmit: act(async (e) => { await api(`/api/staff/meetings/${m.id}/resolutions`, { method: 'POST', body: formData(e.target) }); toast(t('saved')); route(); }),
      },
      el('input', { name: 'subject', required: true, minlength: 5, maxlength: 500, placeholder: t('resolutionText') }),
      el('select', { name: 'decision' }, ['passed', 'deferred', 'rejected'].map((x) => el('option', { value: x }, t('s_' + x)))),
      el('button', { class: 'btn small' }, t('addResolution'))),
      el('form', {
        onsubmit: act(async (e) => {
          const f = formData(e.target);
          await api(`/api/staff/meetings/${m.id}`, { method: 'PATCH', body: { minutes: f.minutes, status: e.submitter.value || m.status, published: f.published === 'on' } });
          toast(t('saved')); route();
        }),
      },
      field(t('minutes'), el('textarea', { name: 'minutes', rows: 3, maxlength: 5000, value: m.minutes })),
      el('label', { class: 'check' }, el('input', { type: 'checkbox', name: 'published', checked: m.published }), t('publishOnPortal')),
      el('div', { class: 'row' },
        el('button', { class: 'btn small', value: upcoming ? 'held' : m.status }, upcoming ? t('markHeld') : t('save')),
        upcoming ? el('button', { class: 'btn danger small', value: 'cancelled' }, t('cancelMeeting')) : null))) : null);
}

async function viewCouncil() {
  const list = await api('/api/staff/meetings');
  const upcoming = list.filter((m) => m.status === 'scheduled').sort((a, b) => a.date.localeCompare(b.date));
  const past = list.filter((m) => m.status !== 'scheduled');
  page(
    el('div', { class: 'stats' },
      stat(list.filter((m) => m.status === 'held' && new Date(m.date).getFullYear() === new Date().getFullYear()).length, t('meetingsThisYear')),
      stat(list.reduce((a, m) => a + m.resolutions.length, 0), t('resolutions')),
      stat(upcoming.length, t('upcoming'))),
    isLead() ? el('section', { class: 'card' }, el('h2', {}, t('scheduleMeeting')),
      el('form', {
        onsubmit: act(async (e) => { const f = formData(e.target); await api('/api/staff/meetings', { method: 'POST', body: { ...f, date: new Date(f.date).toISOString() } }); toast(t('saved')); route(); }),
      },
      el('div', { class: 'grid2' },
        field(t('meetingType'), el('select', { name: 'type' }, ['council', 'special', 'standing'].map((x) => el('option', { value: x }, t('mt_' + x))))),
        field(t('dateTime'), el('input', { name: 'date', type: 'datetime-local', required: true })),
        field(t('venue'), el('input', { name: 'venue', value: 'Council Hall', maxlength: 120 }))),
      field(t('agenda'), el('textarea', { name: 'agenda', rows: 4, required: true, placeholder: t('agendaHint') })),
      el('button', { class: 'btn' }, t('scheduleMeeting')))) : null,
    el('h2', { class: 'section-title' }, t('upcoming')), upcoming.length ? upcoming.map((m) => meetingCard(m, isLead())) : el('section', { class: 'card' }, empty()),
    el('h2', { class: 'section-title' }, t('pastMeetings')), past.length ? past.map((m) => meetingCard(m, isLead())) : el('section', { class: 'card' }, empty()));
}

// ---------- staff: ward committees ----------
async function viewCommittees() {
  const q = hashQuery();
  const data = await api('/api/staff/committees' + (q.ward ? `?ward=${encodeURIComponent(q.ward)}` : ''));
  const ward = data.ward;
  const canEdit = ['chairperson', 'commissioner', 'ward_officer'].includes(S.user.role);
  const formed = data.coverage.filter((c) => c.members > 0).length;
  const coverage = el('section', { class: 'card' }, el('h2', {}, `${t('wardCommittees')}: ${formed} / ${data.coverage.length} ${t('wardsFormed')}`),
    el('div', { class: 'ward-grid' }, data.coverage.map((c) => el('a', { href: `#/s/committees?ward=${c.ward}`, class: `ward-chip ${c.members ? 'ok' : 'todo'} ${c.ward === ward ? 'active' : ''}` },
      el('b', {}, c.ward), el('small', {}, `${c.members} · ${c.meetings}`)))),
    el('p', { class: 'muted small' }, t('wardChipLegend')));
  if (!ward) return page(coverage);
  const today = new Date().toISOString().slice(0, 10);
  page(
    S.user.role === 'ward_officer' ? null : coverage,
    el('section', { class: 'card' }, el('h2', {}, `${t('ward')} ${ward}: ${t('members')}`),
      el('div', { class: 'committee-grid' }, S.cfg.committeeTypes.map((ct) => el('div', { class: 'committee' },
        el('h3', {}, label(ct)),
        el('ul', {}, data.members.filter((m) => m.type === ct.id).map((m) => el('li', {}, m.name,
          canEdit ? el('button', { class: 'link-btn', title: t('delete'), onclick: act(async () => { if (!confirm(t('confirmDelete'))) return; await api(`/api/staff/committees/members/${m.id}`, { method: 'DELETE' }); route(); }) }, '×') : null))),
        canEdit ? el('form', {
          class: 'row',
          onsubmit: act(async (e) => { await api('/api/staff/committees/members', { method: 'POST', body: { ...formData(e.target), ward, type: ct.id } }); route(); }),
        }, el('input', { name: 'name', required: true, minlength: 2, maxlength: 80, placeholder: t('memberName') }), el('button', { class: 'btn small' }, t('add'))) : null)))),
    canEdit ? el('section', { class: 'card' }, el('h2', {}, t('logCommitteeMeeting')),
      el('form', {
        onsubmit: act(async (e) => { await api('/api/staff/committees/meetings', { method: 'POST', body: { ...formData(e.target), ward } }); toast(t('saved')); route(); }),
      },
      el('div', { class: 'grid2' },
        field(t('date'), el('input', { name: 'date', type: 'date', value: today, max: today, required: true })),
        field(t('attendees'), el('input', { name: 'attendees', type: 'number', min: 1, required: true }))),
      field(t('issues'), el('textarea', { name: 'issues', rows: 2, required: true, maxlength: 2000 })),
      field(t('actionsAgreed'), el('textarea', { name: 'actions', rows: 2, maxlength: 2000 })),
      el('button', { class: 'btn' }, t('save')))) : null,
    el('section', { class: 'card' }, el('h2', {}, t('committeeMeetings')),
      data.meetings.length ? el('div', { class: 'list' }, data.meetings.map((m) => el('div', { class: 'item col' },
        el('b', {}, `${fmtDate(m.date)} · ${m.attendees} ${t('attendees').toLowerCase()}`),
        el('p', {}, `${t('issues')}: ${m.issues}`), m.actions ? el('p', {}, `${t('actionsAgreed')}: ${m.actions}`) : null))) : empty()));
}

// ---------- staff: wards & councillors ----------
async function viewWards() {
  const [wards, officers] = await Promise.all([api('/api/staff/wards'), api('/api/staff/officers')]);
  const wardOfficers = officers.filter((o) => o.role === 'ward_officer');
  page(el('section', { class: 'card' }, el('h2', {}, t('wardsCouncillors')),
    el('div', { class: 'list' }, wards.map((w) => el('div', { class: 'item col' },
      el('div', { class: 'row space' },
        el('b', {}, `${t('ward')} ${w.ward}${w.locality ? ' · ' + w.locality : ''}`),
        el('small', { class: 'muted' }, `${w.openComplaints} ${t('open')} · ${w.resolvedComplaints} ${t('resolved')} · ${w.committeeMembers} ${t('members').toLowerCase()} · ${w.works} ${t('works').toLowerCase()}`)),
      isLead() ? el('form', {
        class: 'filters',
        onsubmit: act(async (e) => { await api(`/api/staff/wards/${w.ward}`, { method: 'PATCH', body: formData(e.target) }); toast(t('saved')); }),
      },
      el('input', { name: 'councillor', value: w.councillor, maxlength: 80, placeholder: t('councillor') }),
      el('input', { name: 'locality', value: w.locality, maxlength: 120, placeholder: t('locality') }),
      el('select', { name: 'wardOfficerId' }, el('option', { value: '' }, `${t('wardOfficer')}: —`),
        wardOfficers.map((o) => el('option', { value: o.id, selected: o.id === w.wardOfficerId }, o.name))),
      el('button', { class: 'btn small' }, t('save')))
        : el('small', {}, `${t('councillor')}: ${w.councillor || '—'} · ${t('wardOfficer')}: ${w.wardOfficer || '—'}`))))));
}

// ---------- staff: budget ----------
async function viewBudget() {
  const b = await api('/api/staff/budget');
  page(
    el('div', { class: 'stats' },
      stat(inr(b.allocated), t('allocated')), stat(inr(b.spent), t('spent')),
      stat(`${b.allocated ? Math.round((b.spent / b.allocated) * 100) : 0}%`, t('utilisation')),
      stat(`${b.greenPct}%`, t('greenBudget'), b.greenPct >= 10 ? 'good' : 'bad')),
    el('section', { class: 'card' }, el('h2', {}, t('budgetHeads')),
      el('p', { class: 'muted small' }, t('greenBudgetNote')),
      el('div', { class: 'list' }, b.heads.map((h) => el('div', { class: 'item col' },
        el('div', { class: 'row space' }, el('b', {}, label(h), h.green ? el('span', { class: 'pill good' }, t('green')) : null),
          el('small', {}, `${inr(h.spent)} / ${inr(h.allocated)}`)),
        bar(h.spent, h.allocated, h.green ? 'good' : null),
        isLead() ? el('form', {
          class: 'filters',
          onsubmit: act(async (e) => { const f = formData(e.target); await api(`/api/staff/budget/${h.id}`, { method: 'PATCH', body: { allocated: Number(f.allocated) * 1e5, spent: Number(f.spent) * 1e5 } }); toast(t('saved')); route(); }),
        },
        el('label', { class: 'mini' }, `${t('allocated')} (${t('lakh')})`, el('input', { name: 'allocated', type: 'number', min: 0, step: '0.01', value: (h.allocated / 1e5).toFixed(2) })),
        el('label', { class: 'mini' }, `${t('spent')} (${t('lakh')})`, el('input', { name: 'spent', type: 'number', min: 0, step: '0.01', value: (h.spent / 1e5).toFixed(2) })),
        el('button', { class: 'btn small' }, t('save'))) : null)))));
}

// ---------- staff: KPI scorecard ----------
function kpiCard(k) {
  return el('div', { class: `kpi ${k.rating}` },
    el('small', {}, label(k)),
    el('b', {}, kpiValue(k)),
    el('span', {}, `${t('target')}: ${k.targetToDate}${k.unit === '/5' ? ' / 5' : k.unit}${k.month ? ' · ' + k.month : ''}${k.source === 'auto' ? ' · ' + t('live') : ''}`));
}

async function viewKpis() {
  const data = await api('/api/staff/kpis');
  const manual = S.cfg.kpis.filter((k) => k.source === 'manual');
  const thisMonth = new Date().toISOString().slice(0, 7);
  page(
    el('section', { class: 'card' }, el('h2', {}, t('kpis')), el('p', { class: 'muted small' }, t('kpiNote')),
      el('div', { class: 'kpi-grid' }, data.kpis.map(kpiCard))),
    isLead() ? el('section', { class: 'card' }, el('h2', {}, t('enterKpi')),
      el('form', {
        class: 'filters',
        onsubmit: act(async (e) => { await api('/api/staff/kpis', { method: 'POST', body: formData(e.target) }); toast(t('saved')); route(); }),
      },
      el('select', { name: 'kpi' }, manual.map((k) => el('option', { value: k.id }, label(k)))),
      el('input', { name: 'month', type: 'month', value: thisMonth, required: true }),
      el('input', { name: 'value', type: 'number', step: '0.1', min: 0, required: true, placeholder: t('value') }),
      el('button', { class: 'btn' }, t('save')))) : null,
    el('section', { class: 'card' }, el('h2', {}, t('kpiHistory')),
      data.entries.length ? el('table', {}, el('tr', {}, el('th', {}, t('month')), el('th', {}, 'KPI'), el('th', {}, t('value')), el('th', {}, t('enteredBy'))),
        data.entries.map((e) => el('tr', {}, el('td', {}, e.month), el('td', {}, label(S.cfg.kpis.find((k) => k.id === e.kpi))), el('td', {}, e.value), el('td', {}, e.by)))) : empty()));
}

// ---------- staff: printable review report ----------
async function viewReport() {
  const r = await api('/api/staff/report');
  const c = r.complaints;
  page(el('section', { class: 'card report' },
    el('div', { class: 'row space no-print' },
      el('span', { class: 'muted' }, t('reportHint')),
      el('div', { class: 'row' },
        el('button', { class: 'btn secondary small', onclick: act(() => downloadCsv('/api/staff/export/complaints.csv', 'complaints.csv')) }, t('exportCsv')),
        el('button', { class: 'btn small', onclick: () => window.print() }, t('print')))),
    el('header', { class: 'report-head' },
      el('h1', {}, `${r.municipality}: ${t('reviewReport')}`),
      el('p', { class: 'muted' }, `${r.constituency} · ${t('generated')} ${fmt(r.generatedAt)}`)),
    el('h2', {}, t('kpis')), el('div', { class: 'kpi-grid' }, r.kpis.map(kpiCard)),
    el('h2', {}, t('atAGlance')),
    el('div', { class: 'stats' },
      stat(c.total, t('complaintsReceived')), stat(c.resolved, t('resolved')), stat(c.open, t('open')), stat(c.overdue, t('overdue'), c.overdue ? 'bad' : ''),
      stat(`${r.tax.pct}%`, t('taxCollected')), stat(`${r.actions['100-day'].done}/${r.actions['100-day'].total}`, t('hundredDayDone')),
      stat(`${r.works.completed}/${r.works.total}`, t('worksCompleted')), stat(`${r.committees.wardsWithMembers}/${r.committees.wards}`, t('wardsFormed')),
      stat(`${r.budget.greenPct}%`, t('greenBudget')), stat(r.applications.open, t('applicationsPending')), stat(r.inspections, t('inspections'))),
    el('h2', {}, t('complaintsByDept')),
    el('table', {}, el('tr', {}, el('th', {}, t('department')), el('th', {}, t('total')), el('th', {}, t('open')), el('th', {}, t('overdue')), el('th', {}, t('resolved'))),
      Object.entries(c.byDepartment).map(([k, v]) => el('tr', {}, el('td', {}, label(dept(k))), el('td', {}, v.total), el('td', {}, v.open), el('td', { class: v.overdue ? 'bad-text' : null }, v.overdue), el('td', {}, v.resolved)))),
    el('h2', {}, t('needsAttention')),
    r.topOverdue.length ? el('table', {}, el('tr', {}, el('th', {}, 'No.'), el('th', {}, t('category')), el('th', {}, t('ward')), el('th', {}, t('overdue'))),
      r.topOverdue.map((g) => el('tr', {}, el('td', {}, el('a', { href: `#/s/g/${g.id}` }, g.number)), el('td', {}, label(cat(g.category))), el('td', {}, g.ward), el('td', { class: 'bad-text' }, `${g.overdueHours} h`)))) : el('p', {}, t('noOverdue')),
    r.stalledWorks.length ? [el('h3', {}, t('stalledWorks')), el('ul', {}, r.stalledWorks.map((w) => el('li', {}, `${w.title} (${w.progress}%, ${inr(w.sanctioned)})`)))] : null,
    el('h2', {}, t('recentResolutions')),
    r.recentResolutions.length ? el('ul', {}, r.recentResolutions.flatMap((m) => m.resolutions.map((x) => el('li', {}, `${fmtDate(m.date)} · No. ${x.no}: ${x.subject} (${t('s_' + x.decision)})`)))) : empty()));
}

function viewAccount() {
  page(el('section', { class: 'card' }, el('h2', {}, t('myAccount')),
    el('dl', { class: 'facts' },
      el('dt', {}, t('username')), el('dd', {}, S.user.username || '—'),
      el('dt', {}, 'Role'), el('dd', {}, S.user.role),
      S.user.department ? [el('dt', {}, t('department')), el('dd', {}, label(dept(S.user.department)))] : null,
      S.user.ward ? [el('dt', {}, t('ward')), el('dd', {}, String(S.user.ward))] : null)),
  passwordCard());
}

// ---------- router ----------
function go(hash) { if (location.hash === hash) route(); else location.hash = hash; }

async function route() {
  const h = (location.hash || '#/').split('?')[0];
  const m = (re) => re.exec(h);
  const area = (p) => h === p || h.startsWith(p + '/');
  try {
    // Each person lands on their own site: citizens on /app/, staff on /office/.
    if (OFFICE && S.user && S.user.role === 'citizen') { location.href = '/app/'; return; }
    if (!OFFICE && isStaff()) { location.href = '/office/'; return; }
    if (!S.user && (area('#/c') || area('#/s'))) return go('#/');
    let r;
    if (h === '#/' || h === '') {
      if (S.user) return go(isStaff() ? '#/s' : '#/c');
      return OFFICE ? viewStaffLogin() : viewCitizenLogin();
    }
    if (h === '#/track') return viewTrack();
    if (!OFFICE) {
      if (h === '#/c') return await viewCitizenHome();
      if (h === '#/c/new') return viewNewComplaint();
      if (h === '#/c/list') return await viewMyComplaints();
      if ((r = m(/^#\/c\/g\/([\w-]+)$/))) return await viewCitizenComplaint(r[1]);
      if (h === '#/c/apply') return viewApplyList();
      if ((r = m(/^#\/c\/apply\/([\w-]+)$/))) return viewApplyForm(r[1]);
      if (h === '#/c/apps') return await viewMyApps();
      if ((r = m(/^#\/c\/app\/([\w-]+)$/))) return await viewCitizenApp(r[1]);
      if (h === '#/c/tax') return viewTax();
      if (h === '#/c/meet') return await viewMeet();
    } else {
      if (h === '#/s') return await viewDashboard();
      if (h === '#/s/queue') return await viewQueue();
      if ((r = m(/^#\/s\/g\/([\w-]+)$/))) return await viewStaffComplaint(r[1]);
      if (h === '#/s/walkin') return viewWalkin();
      if (h === '#/s/apps') return await viewApps();
      if ((r = m(/^#\/s\/app\/([\w-]+)$/))) return await viewStaffApp(r[1]);
      if (h === '#/s/inspections') return await viewInspections();
      if (h === '#/s/works') return await viewWorks();
      if ((r = m(/^#\/s\/work\/([\w-]+)$/))) return await viewWork(r[1]);
      if (h === '#/s/council') return await viewCouncil();
      if (h === '#/s/committees') return await viewCommittees();
      if (h === '#/s/wards') return await viewWards();
      if (h === '#/s/budget') return await viewBudget();
      if (h === '#/s/kpis') return await viewKpis();
      if (h === '#/s/report') return await viewReport();
      if (h === '#/s/account') return viewAccount();
      if (h === '#/s/actions') return await viewActions();
      if (h === '#/s/meet') return await viewAppointments();
      if (h === '#/s/notices') return await viewStaffNotices();
      if (h === '#/s/users') return await viewUsers();
      if (h === '#/s/audit') return await viewAudit();
      if (h === '#/s/tax') return await viewTaxReport();
    }
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
  document.title = `${OFFICE ? t('officeName') : t('appName')} · ${S.cfg.municipality}`;
  window.addEventListener('hashchange', route);
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
  route();
})();
