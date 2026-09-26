/* Bloom — pregnancy journal. All data stays in this browser (localStorage + IndexedDB for report files). */
(() => {
  'use strict';

  // ---------- Helpers ----------
  const KEY = 'bloom.v1';
  const DAY = 86400000;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const pad = n => String(n).padStart(2, '0');
  const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const todayISO = () => iso(new Date());
  const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
  const diffDays = (a, b) => Math.round((parse(b) - parse(a)) / DAY);
  const fmtDate = (s, opts) => parse(s).toLocaleDateString(undefined, opts || { day: 'numeric', month: 'short', year: 'numeric' });
  const fmtShort = s => fmtDate(s, { day: 'numeric', month: 'short' });
  const weekday = s => fmtDate(s, { weekday: 'short' });
  const nowHM = () => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const toMin = hm => { const [h, m] = hm.split(':').map(Number); return h * 60 + m; };
  const fmtTime = hm => { if (!hm) return ''; const [h, m] = hm.split(':').map(Number); const d = new Date(2000, 0, 1, h, m); return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }); };
  const fmtDur = ms => { const s = Math.max(0, Math.round(ms / 1000)); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return h ? `${h}:${pad(m)}:${pad(x)}` : `${m}:${pad(x)}`; };
  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  let inFrame = true;
  try { inFrame = window.self !== window.top; } catch (e) { inFrame = true; }

  // ---------- State ----------
  function fresh() {
    const t = todayISO();
    return {
      profile: {
        name: '', partner: '', doctor: '', doctorPhone: '', hospital: '', hospitalPhone: '',
        dueSource: 'estimate', estimate: { date: t, weeks: 20, days: 0 }, lmp: '', edd: '', reportId: null,
        notify: false, bedtime: '22:00', bedtimeReminder: true, waterReminder: false, theme: '',
      },
      onboarded: false,
      habits: DEFAULT_HABITS.map(h => ({ ...h })),
      habitLog: {},
      meds: DEFAULT_MEDS.map(m => ({ ...m, times: [...m.times], active: true, example: true })),
      medLog: {},
      sleep: [], exercise: [], weight: [], kicks: [], kickActive: null,
      contractions: [], contrActive: null,
      journal: {}, appts: [], bag: {}, names: [], reports: [], games: {}, notified: {},
    };
  }
  function migrate(s) {
    const f = fresh();
    for (const k in f) if (s[k] === undefined) s[k] = f[k];
    s.profile = { ...f.profile, ...s.profile };
    return s;
  }
  function load() {
    try { const raw = localStorage.getItem(KEY); if (raw) return migrate(JSON.parse(raw)); } catch (e) { /* storage unavailable */ }
    return fresh();
  }
  let S = load();
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast('Could not save on this device. Storage may be full or blocked.'); }
  }

  // ---------- File store (IndexedDB) ----------
  const Files = {
    db: null,
    open() {
      return new Promise((res, rej) => {
        if (this.db) return res(this.db);
        let r;
        try { r = indexedDB.open('bloom-files', 1); } catch (e) { return rej(e); }
        r.onupgradeneeded = () => r.result.createObjectStore('files');
        r.onsuccess = () => { this.db = r.result; res(this.db); };
        r.onerror = () => rej(r.error);
      });
    },
    async run(mode, fn) {
      const db = await this.open();
      return new Promise((res, rej) => {
        const tx = db.transaction('files', mode);
        const req = fn(tx.objectStore('files'));
        tx.oncomplete = () => res(req && req.result);
        tx.onerror = () => rej(tx.error);
      });
    },
    put(id, blob) { return this.run('readwrite', s => s.put(blob, id)); },
    get(id) { return this.run('readonly', s => s.get(id)); },
    del(id) { return this.run('readwrite', s => s.delete(id)); },
  };
  const urlCache = new Map();
  async function fileURL(id) {
    if (urlCache.has(id)) return urlCache.get(id);
    const blob = await Files.get(id);
    if (!blob) return null;
    const u = URL.createObjectURL(blob);
    urlCache.set(id, u);
    return u;
  }

  // ---------- Pregnancy maths ----------
  const catName = id => (REPORT_SCHEDULE.find(r => r.id === id) || {}).name || 'Other report';
  function reportEDD(r) {
    if (r.gaW !== '' && r.gaW != null && !isNaN(r.gaW)) return addDays(r.date, 280 - (Number(r.gaW) * 7 + Number(r.gaD || 0)));
    return r.edd || null;
  }
  function dueInfo() {
    const p = S.profile;
    let edd = null, source = '';
    if (p.dueSource === 'report') {
      const r = S.reports.find(x => x.id === p.reportId);
      const e = r && reportEDD(r);
      if (e) { edd = e; source = `${r.title || catName(r.cat)} (${fmtShort(r.date)})`; }
    }
    if (!edd && p.dueSource === 'lmp' && p.lmp) { edd = addDays(p.lmp, 280); source = 'your last period date'; }
    if (!edd && p.dueSource === 'edd' && p.edd) { edd = p.edd; source = 'the due date from your doctor'; }
    if (!edd) { const e = p.estimate; edd = addDays(e.date, 280 - (e.weeks * 7 + e.days)); source = `an estimate (${e.weeks} weeks on ${fmtShort(e.date)})`; }
    const left = diffDays(todayISO(), edd);
    const ga = clamp(280 - left, 0, 300);
    const weeks = Math.floor(ga / 7), days = ga % 7;
    const tri = weeks < 14 ? 1 : weeks < 28 ? 2 : 3;
    const month = Math.min(10, Math.floor(ga / 30.44) + 1);
    return { edd, left, ga, weeks, days, tri, month, source, estimated: p.dueSource === 'estimate' || source.startsWith('an estimate') };
  }
  const weekData = w => WEEKS.find(x => x[0] === clamp(w, 4, 40));
  function schedStatus(item, info) {
    if (S.reports.some(r => r.cat === item.id)) return 'done';
    if (info.weeks >= item.from && info.weeks <= item.to) return 'due';
    if (info.weeks > item.to) return 'missed';
    return 'upcoming';
  }

  // ---------- Habits & doses ----------
  const hv = (d, id) => (S.habitLog[d] || {})[id];
  function setHV(d, id, v) { (S.habitLog[d] = S.habitLog[d] || {})[id] = v; }
  const habitDone = (h, v) => h.type === 'check' ? !!v : (Number(v) || 0) >= (h.target || 1);
  function dayScore(d) {
    if (!S.habits.length) return 0;
    return S.habits.filter(h => habitDone(h, hv(d, h.id))).length / S.habits.length;
  }
  function streak(h) {
    let n = 0, d = todayISO();
    if (!habitDone(h, hv(d, h.id))) d = addDays(d, -1);
    while (habitDone(h, hv(d, h.id)) && n < 400) { n++; d = addDays(d, -1); }
    return n;
  }
  function markHabit(id) {
    const h = S.habits.find(x => x.id === id);
    if (h && h.type === 'check') setHV(todayISO(), id, true);
  }
  function dosesFor(d) {
    const out = [];
    for (const m of S.meds) if (m.active !== false) for (const t of m.times) {
      const key = m.id + '@' + t;
      out.push({ m, t, key, taken: (S.medLog[d] || {})[key] });
    }
    return out.sort((a, b) => a.t.localeCompare(b.t));
  }
  function doseState(dz, d) {
    if (dz.taken) return 'taken';
    if (d < todayISO()) return 'missed';
    if (d === todayISO() && toMin(nowHM()) >= toMin(dz.t)) return 'due';
    return 'later';
  }

  // ---------- UI primitives ----------
  let toastTimer;
  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg; el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 2600);
  }
  function openModal(html, wide) {
    const o = $('#overlay');
    o.innerHTML = `<div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true">${html}</div>`;
    o.hidden = false;
    const f = $('input, select, textarea, button', o); if (f) f.focus();
  }
  function closeModal() {
    const o = $('#overlay');
    o.hidden = true; o.innerHTML = '';
    stopRoutine();
  }
  const pct = v => `${Math.round(v * 100)}%`;

  function barChart(items, o) {
    const W = 560, H = 190, pl = 34, pr = 8, pt = 10, pb = 24;
    const max = o.max;
    const iw = W - pl - pr, ih = H - pt - pb, bw = iw / items.length;
    const y = v => pt + ih - (clamp(v, 0, max) / max) * ih;
    let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.label)}">`;
    if (o.band) s += `<rect class="band" x="${pl}" y="${y(o.band[1])}" width="${iw}" height="${y(o.band[0]) - y(o.band[1])}"></rect>`;
    for (const t of o.ticks) s += `<line class="grid-line" x1="${pl}" x2="${W - pr}" y1="${y(t)}" y2="${y(t)}"></line><text x="${pl - 6}" y="${y(t) + 4}" text-anchor="end">${t}${o.unit || ''}</text>`;
    items.forEach((it, i) => {
      const x = pl + i * bw + bw * 0.2, w = bw * 0.6;
      if (it.value > 0) s += `<rect class="barm ${it.low ? 'low' : ''}" x="${x.toFixed(1)}" y="${y(it.value).toFixed(1)}" width="${w.toFixed(1)}" height="${(pt + ih - y(it.value)).toFixed(1)}" rx="3"><title>${esc(it.title || '')}</title></rect>`;
      if (it.label) s += `<text x="${(x + w / 2).toFixed(1)}" y="${H - 6}" text-anchor="middle">${esc(it.label)}</text>`;
    });
    return s + '</svg>';
  }
  function lineChart(points, o) {
    const W = 560, H = 190, pl = 40, pr = 14, pt = 12, pb = 24;
    const vals = points.map(p => p.value);
    let lo = Math.min(...vals), hi = Math.max(...vals);
    if (hi - lo < 2) { lo -= 1; hi += 1; }
    lo = Math.floor(lo); hi = Math.ceil(hi);
    const iw = W - pl - pr, ih = H - pt - pb;
    const x = i => pl + (points.length === 1 ? iw / 2 : (i / (points.length - 1)) * iw);
    const y = v => pt + ih - ((v - lo) / (hi - lo)) * ih;
    const step = Math.max(1, Math.ceil((hi - lo) / 4));
    let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.label)}">`;
    for (let t = lo; t <= hi; t += step) s += `<line class="grid-line" x1="${pl}" x2="${W - pr}" y1="${y(t)}" y2="${y(t)}"></line><text x="${pl - 6}" y="${y(t) + 4}" text-anchor="end">${t}</text>`;
    const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
    if (points.length > 1) s += `<path class="area" d="${path} L${x(points.length - 1).toFixed(1)},${pt + ih} L${x(0).toFixed(1)},${pt + ih} Z"></path><path class="line" d="${path}"></path>`;
    const every = Math.ceil(points.length / 6);
    points.forEach((p, i) => {
      s += `<circle class="pt" cx="${x(i).toFixed(1)}" cy="${y(p.value).toFixed(1)}" r="${i === points.length - 1 ? 5 : 3.5}"><title>${esc(p.title || '')}</title></circle>`;
      if (i % every === 0 || i === points.length - 1) s += `<text x="${x(i).toFixed(1)}" y="${H - 6}" text-anchor="middle">${esc(p.label)}</text>`;
    });
    return s + '</svg>';
  }

  // ---------- Navigation ----------
  const ICON = {
    today: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    journey: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    reports: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>',
    habits: '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
    tablets: '<path d="M10.5 20.5a5 5 0 0 1-7-7l10-10a5 5 0 0 1 7 7z"/><path d="M8.5 8.5l7 7"/>',
    sleep: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
    move: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
    mind: '<path d="M12 3l2.5 5.5L20 11l-5.5 2.5L12 19l-2.5-5.5L4 11l5.5-2.5z"/>',
    care: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21.2l8.8-8.8a5.5 5.5 0 0 0 0-7.8z"/>',
    settings: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
  };
  const TABS = [
    ['today', 'Today'], ['journey', 'Week by week'], ['reports', 'Reports'], ['habits', 'Habits'], ['tablets', 'Tablets'],
    ['sleep', 'Sleep'], ['move', 'Stretch & move'], ['mind', 'Mind games'], ['care', 'Care tools'], ['settings', 'Settings'],
  ];
  let view = 'today';
  try { view = localStorage.getItem('bloom.view') || 'today'; } catch (e) { /* ignore */ }
  const hashView = (location.hash || '').slice(1);
  if (TABS.some(t => t[0] === hashView)) view = hashView;
  if (!TABS.some(t => t[0] === view)) view = 'today';

  function renderTabs() {
    const info = dueInfo();
    const dueReports = REPORT_SCHEDULE.filter(r => schedStatus(r, info) === 'due').length;
    const dueDoses = dosesFor(todayISO()).filter(d => doseState(d, todayISO()) === 'due').length;
    const badge = { reports: dueReports, tablets: dueDoses };
    $('#tabs').innerHTML = TABS.map(([id, label]) => `
      <button class="tab" role="tab" data-act="tab" data-id="${id}" aria-selected="${id === view}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[id]}</svg>
        ${label}${badge[id] ? `<span class="dot">${badge[id]}</span>` : ''}
      </button>`).join('');
  }
  function go(id) {
    view = id;
    try { localStorage.setItem('bloom.view', id); } catch (e) { /* ignore */ }
    render();
    window.scrollTo({ top: 0 });
    const t = $(`.tab[data-id="${id}"]`); if (t && t.scrollIntoView) t.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
  function render() {
    applyTheme();
    renderTabs();
    for (const sec of $$('.view')) { sec.hidden = sec.dataset.view !== view; if (sec.hidden) sec.innerHTML = ''; }
    const el = $(`#view-${view}`);
    el.innerHTML = VIEWS[view]();
    if (AFTER[view]) AFTER[view](el);
  }
  function applyTheme() {
    const t = S.profile.theme;
    if (t) document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme;
  }

  // ---------- Shared fragments ----------
  function habitRow(h, d) {
    const v = hv(d, h.id);
    if (h.type === 'check') {
      return `<div class="habit"><div><div class="habit-name">${esc(h.name)}</div>${streak(h) > 1 ? `<div class="tiny">${streak(h)}-day streak</div>` : ''}</div>
        <button class="tick" data-act="habit-toggle" data-id="${h.id}" data-day="${d}" aria-pressed="${!!v}" aria-label="Mark ${esc(h.name)} done">✓</button></div>`;
    }
    const n = Number(v) || 0;
    const drops = h.id === 'water' ? `<div class="water-drops" aria-hidden="true">${Array.from({ length: h.target }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</div>` : '';
    return `<div class="habit"><div class="stack" style="gap:4px"><div class="habit-name">${esc(h.name)} ${habitDone(h, n) ? '<span class="chip ok">Done</span>' : ''}</div>${drops}</div>
      <div class="counter">
        <button class="btn round" data-act="habit-dec" data-id="${h.id}" data-day="${d}" aria-label="Less">−</button>
        <span class="val">${n}/${h.target}<br><span class="tiny">${esc(h.unit || '')}</span></span>
        <button class="btn round" data-act="habit-inc" data-id="${h.id}" data-day="${d}" aria-label="More">+</button>
      </div></div>`;
  }
  function doseRow(dz, d) {
    const st = doseState(dz, d);
    const chip = { taken: `<span class="chip ok">Taken ${fmtTime(dz.taken)}</span>`, due: '<span class="chip accent">Due now</span>', missed: '<span class="chip danger">Missed</span>', later: '<span class="chip">Later</span>' }[st];
    return `<div class="dose ${st}">
      <span class="dose-time">${fmtTime(dz.t)}</span>
      <div><div class="dose-name"><b>${esc(dz.m.name)}</b></div><div class="tiny">${esc(dz.m.dose || '')}</div></div>
      <div class="row">${chip}<button class="tick" data-act="dose-toggle" data-key="${dz.key}" data-day="${d}" aria-pressed="${!!dz.taken}" aria-label="Mark ${esc(dz.m.name)} taken">✓</button></div>
    </div>`;
  }
  function timelineHTML(info) {
    const p = clamp(info.ga / 280, 0, 1);
    return `<div class="timeline" aria-label="${pct(p)} of pregnancy complete">
      <div class="timeline-track"><span></span><span></span><span></span>
        <div class="timeline-rest" style="left:${(p * 100).toFixed(2)}%"></div>
        <div class="timeline-marker" style="left:${(p * 100).toFixed(2)}%"></div>
      </div>
      <div class="timeline-labels"><span>1st · wk 1–13</span><span style="text-align:center">2nd · wk 14–27</span><span style="text-align:right">3rd · wk 28–40</span></div>
    </div>`;
  }
  function greeting() {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  }
  function dueDateForm(p) {
    return `<form data-form="dates" class="stack" style="gap:12px">${dueDateFields(p)}<div><button class="btn primary" type="submit">Save due date</button></div></form>`;
  }
  function dueDateFields(p) {
    return `
      <div class="stack">
        <label class="check"><input type="radio" name="src" value="estimate" ${p.dueSource === 'estimate' ? 'checked' : ''}> I know how many weeks pregnant I am today</label>
        <div class="form-grid" style="padding-left:26px">
          <label class="field">Weeks<input id="est-w" name="estW" type="number" min="1" max="42" value="${p.estimate.weeks}"></label>
          <label class="field">Days<input id="est-d" name="estD" type="number" min="0" max="6" value="${p.estimate.days}"></label>
        </div>
        <div class="tiny" style="padding-left:26px">5th month is about 18–22 weeks.</div>
      </div>
      <div class="stack">
        <label class="check"><input type="radio" name="src" value="lmp" ${p.dueSource === 'lmp' ? 'checked' : ''}> First day of my last period (LMP)</label>
        <div style="padding-left:26px"><input id="lmp" name="lmp" type="date" value="${esc(p.lmp)}" max="${todayISO()}" aria-label="Last period date"></div>
      </div>
      <div class="stack">
        <label class="check"><input type="radio" name="src" value="edd" ${p.dueSource === 'edd' ? 'checked' : ''}> My doctor gave me a due date (EDD)</label>
        <div style="padding-left:26px"><input id="edd" name="edd" type="date" value="${esc(p.edd)}" aria-label="Due date"></div>
      </div>
      ${S.reports.some(r => reportEDD(r)) ? `<div class="stack">
        <label class="check"><input type="radio" name="src" value="report" ${p.dueSource === 'report' ? 'checked' : ''}> Use a scan report</label>
        <div style="padding-left:26px"><select id="rep-src" name="reportId" aria-label="Report">${S.reports.filter(r => reportEDD(r)).map(r => `<option value="${r.id}" ${r.id === p.reportId ? 'selected' : ''}>${esc(r.title || catName(r.cat))} · ${fmtShort(r.date)} → due ${fmtShort(reportEDD(r))}</option>`).join('')}</select></div>
      </div>` : ''}`;
  }

  // ---------- Views ----------
  const VIEWS = {};
  const AFTER = {};

  VIEWS.today = () => {
    const info = dueInfo();
    const wd = weekData(info.weeks);
    const t = todayISO();
    const p = S.profile;
    const doses = dosesFor(t);
    const dueReports = REPORT_SCHEDULE.filter(r => ['due'].includes(schedStatus(r, info)));
    const lastSleep = S.sleep.slice().sort((a, b) => b.date.localeCompare(a.date))[0];
    const nextAppt = S.appts.filter(a => a.date >= t).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))[0];
    const score = dayScore(t);
    const affirm = AFFIRMATIONS[(parse(t).getTime() / DAY | 0) % AFFIRMATIONS.length];
    const countdown = info.left > 0
      ? `<span class="big">${info.left}</span><span class="lbl">days to go</span>`
      : info.left === 0 ? `<span class="big">Today</span><span class="lbl">is the due date</span>`
      : `<span class="big">+${-info.left}</span><span class="lbl">days past the due date</span>`;

    return `
    ${!S.onboarded ? `<div class="card">
      <div class="card-head"><div><div class="eyebrow">Welcome</div><h2>Let’s set up your journal</h2></div></div>
      <p class="muted">The countdown below assumes you are 20 weeks today (5th month). Add your name and the most accurate date you have. You can change it later or let a scan report set it.</p>
      <form data-form="onboard" class="stack" style="gap:12px">
        <label class="field" style="max-width:320px">Your name<input id="ob-name" name="name" type="text" placeholder="e.g. Anjali" value="${esc(p.name)}"></label>
        ${dueDateFields(p)}
        <div class="row"><button class="btn primary" type="submit">Start my journal</button><button class="btn ghost" type="button" data-act="onboard-skip">Skip for now</button></div>
      </form>
    </div>` : ''}

    <div class="hero">
      <div>
        <div class="hero-greet">${greeting()}${p.name ? ', ' + esc(p.name) : ''}</div>
        <h1>${info.weeks} weeks ${info.days} day${info.days === 1 ? '' : 's'} pregnant</h1>
        <div class="countdown">${countdown}</div>
        <div class="hero-meta">
          <span class="chip">Due ${fmtDate(info.edd, { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}</span>
          <span class="chip">Month ${info.month}</span>
          <span class="chip">Trimester ${info.tri}</span>
          <span class="chip">${pct(clamp(info.ga / 280, 0, 1))} of the way</span>
        </div>
        ${timelineHTML(info)}
      </div>
      <div class="baby-card">
        <div class="eyebrow">Baby this week</div>
        <div class="baby-fruit" aria-hidden="true">${wd[2]}</div>
        <div class="size">About the size of a ${esc(wd[1])}</div>
        <div class="stats"><div class="stat"><span>Length</span><b>${wd[3]}</b></div><div class="stat"><span>Weight</span><b>${wd[4]}</b></div></div>
        <p class="small muted">${esc(wd[5])}</p>
      </div>
    </div>

    ${info.estimated ? `<div class="notice">
      <div class="grow"><b>Your due date is an estimate.</b><span class="small">Based on ${esc(info.source)}. Upload a scan report or enter your LMP or doctor’s due date for an exact countdown.</span></div>
      <div class="row"><button class="btn sm primary" data-act="go" data-id="reports">Upload report</button><button class="btn sm" data-act="go" data-id="journey">Set dates</button></div>
    </div>` : `<p class="tiny">Due date from ${esc(info.source)}.</p>`}

    ${dueReports.length ? `<div class="notice info">
      <div class="grow"><b>Reports due around week ${info.weeks}</b>
        <span class="small">${dueReports.map(r => `${esc(r.name)} (weeks ${r.from}–${r.to})`).join(' · ')}. Upload them once done so your countdown and records stay up to date.</span></div>
      <button class="btn sm primary" data-act="upload-for" data-cat="${dueReports[0].id}">Upload</button>
    </div>` : ''}

    <div class="grid g3">
      <div class="card">
        <div class="card-head"><h3>Tablets today</h3><button class="btn sm ghost" data-act="go" data-id="tablets">Manage</button></div>
        ${doses.length ? `<div class="list">${doses.map(dz => doseRow(dz, t)).join('')}</div>` : '<div class="empty">No tablets added yet.</div>'}
      </div>
      <div class="card">
        <div class="card-head"><h3>Today’s habits</h3><span class="chip ${score === 1 ? 'ok' : ''}">${pct(score)}</span></div>
        <div class="bar sage"><span style="width:${pct(score)}"></span></div>
        <div class="list">${S.habits.slice(0, 5).map(h => habitRow(h, t)).join('')}</div>
        <button class="btn sm ghost" data-act="go" data-id="habits">All habits →</button>
      </div>
      <div class="stack" style="gap:16px">
        <div class="card">
          <div class="card-head"><h3>Sleep</h3><button class="btn sm ghost" data-act="go" data-id="sleep">Log sleep</button></div>
          ${lastSleep ? `<p><b class="num" style="font-size:24px">${sleepHours(lastSleep).toFixed(1)} h</b> <span class="muted small">night of ${fmtShort(lastSleep.date)}</span></p>` : '<p class="muted small">No sleep logged yet. Aim for 7–9 hours, on your side.</p>'}
        </div>
        <div class="card">
          <div class="card-head"><h3>Next appointment</h3><button class="btn sm ghost" data-act="go" data-id="care">Add</button></div>
          ${nextAppt ? `<p><b>${esc(nextAppt.title)}</b><br><span class="muted small">${fmtDate(nextAppt.date, { weekday: 'short', day: 'numeric', month: 'short' })}${nextAppt.time ? ' · ' + fmtTime(nextAppt.time) : ''}</span></p>` : '<p class="muted small">No upcoming appointments.</p>'}
        </div>
      </div>
    </div>

    <div class="grid g2">
      <div class="card">
        <div class="eyebrow">For you in week ${info.weeks}</div>
        <p>${esc(wd[6])}</p>
      </div>
      <div class="card">
        <div class="eyebrow">Today’s affirmation</div>
        <p class="affirm">${esc(affirm)}</p>
      </div>
    </div>`;
  };

  // Journey
  let selWeek = null;
  VIEWS.journey = () => {
    const info = dueInfo();
    const sw = selWeek || clamp(info.weeks, 4, 40);
    const wd = weekData(sw);
    const weekStart = addDays(info.edd, -280 + sw * 7);
    return `
    <div class="page-head"><div><h1>Week by week</h1><p>Tap a week to see how baby grows and what to expect.</p></div></div>
    <div class="card">
      <div class="weeks">${Array.from({ length: 40 }, (_, i) => i + 1).map(w => `<button class="wk ${w < info.weeks ? 'past' : ''} ${w === info.weeks ? 'now' : ''} ${w === sw ? 'sel' : ''}" data-act="week" data-w="${w}" aria-label="Week ${w}">${w}</button>`).join('')}</div>
      <div class="row tiny"><span class="chip accent">Completed</span><span class="chip" style="background:var(--accent);color:var(--accent-ink)">This week</span><span>You are ${info.weeks} weeks ${info.days} day${info.days === 1 ? '' : 's'} today.</span></div>
    </div>
    <div class="grid g2">
      <div class="card">
        <div class="eyebrow">${sw} weeks · ${fmtShort(weekStart)} to ${fmtShort(addDays(weekStart, 6))}</div>
        <div class="row"><span class="baby-fruit" aria-hidden="true">${wd[2]}</span><div><h2>Size of a ${esc(wd[1])}</h2><div class="stats"><div class="stat"><span>Length</span><b>${wd[3]}</b></div><div class="stat"><span>Weight</span><b>${wd[4]}</b></div></div></div></div>
        <p><b>Baby:</b> ${esc(wd[5])}</p>
        <p><b>You:</b> ${esc(wd[6])}</p>
        ${REPORT_SCHEDULE.filter(r => sw >= r.from && sw <= r.to).map(r => `<div class="notice info small"><div class="grow"><b>${esc(r.name)}</b><span>${esc(r.why)}</span></div></div>`).join('')}
      </div>
      <div class="card">
        <div class="card-head"><h3>Due date</h3><span class="chip accent">${fmtDate(info.edd)}</span></div>
        <p class="small muted">Currently based on ${esc(info.source)}. A due date is 280 days (40 weeks) from the first day of the last period. Early ultrasound scans are the most accurate way to date a pregnancy.</p>
        ${dueDateForm(S.profile)}
      </div>
    </div>`;
  };

  // Reports
  let reportPrefill = null;
  VIEWS.reports = () => {
    const info = dueInfo();
    const reps = S.reports.slice().sort((a, b) => b.date.localeCompare(a.date));
    const statusChip = st => ({ done: '<span class="chip ok">Uploaded</span>', due: '<span class="chip accent">Due now</span>', missed: '<span class="chip warn">Not uploaded</span>', upcoming: '<span class="chip">Upcoming</span>' }[st]);
    return `
    <div class="page-head"><div><h1>Reports & scans</h1><p>Upload scan and lab reports. If a scan lists baby’s gestational age or a due date, Bloom uses it to correct your countdown.</p></div></div>
    <div class="grid g2">
      <div class="card" id="upload-card">
        <h3>Upload a report</h3>
        <form data-form="report" class="stack" style="gap:12px">
          <label class="drop" id="drop" for="rep-file">
            <b>Choose a photo or PDF</b>
            <span class="tiny" id="drop-name">or drag it here · JPG, PNG, PDF</span>
          </label>
          <input id="rep-file" name="file" type="file" accept="image/*,application/pdf" hidden>
          <div class="form-grid">
            <label class="field">Report type<select id="rep-cat" name="cat">${REPORT_SCHEDULE.map(r => `<option value="${r.id}" ${reportPrefill === r.id ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}<option value="other" ${reportPrefill === 'other' ? 'selected' : ''}>Other report</option></select></label>
            <label class="field">Report date<input id="rep-date" name="date" type="date" value="${todayISO()}" max="${todayISO()}" required></label>
          </div>
          <label class="field">Title (optional)<input id="rep-title" name="title" type="text" placeholder="e.g. Anomaly scan – City Hospital"></label>
          <div class="stack" style="gap:6px">
            <div class="small"><b>Dates on the report</b> <span class="tiny">(fill one if the report has it)</span></div>
            <div class="form-grid">
              <label class="field">Gestational age: weeks<input id="rep-gaw" name="gaW" type="number" min="4" max="42" placeholder="e.g. 20"></label>
              <label class="field">+ days<input id="rep-gad" name="gaD" type="number" min="0" max="6" placeholder="0–6"></label>
              <label class="field">Or EDD on report<input id="rep-edd" name="edd" type="date"></label>
            </div>
            <label class="check"><input id="rep-use" name="use" type="checkbox" checked> Use this report to update my due date</label>
          </div>
          <label class="field">Notes<textarea id="rep-notes" name="notes" placeholder="Doctor’s comments, values like Hb 11.2, baby weight, placenta position…"></textarea></label>
          <div><button class="btn primary" type="submit">Save report</button></div>
        </form>
      </div>
      <div class="card">
        <div class="card-head"><h3>Suggested tests for your stage</h3><span class="chip accent">Week ${info.weeks}</span></div>
        <div class="list">${REPORT_SCHEDULE.map(r => {
          const st = schedStatus(r, info);
          return `<div class="sched"><span class="sched-wk">Wk ${r.from}–${r.to}</span><div><b class="small">${esc(r.name)}</b><div class="tiny">${esc(r.why)}</div></div><div class="row">${statusChip(st)}${st !== 'done' && st !== 'upcoming' ? `<button class="btn sm" data-act="upload-for" data-cat="${r.id}">Upload</button>` : ''}</div></div>`;
        }).join('')}</div>
        <p class="tiny">Typical schedule only. Your doctor may order different tests.</p>
      </div>
    </div>
    <div class="card">
      <div class="card-head"><h3>My reports</h3><span class="chip">${reps.length}</span></div>
      ${reps.length ? `<div class="list">${reps.map(r => {
        const e = reportEDD(r);
        const using = S.profile.dueSource === 'report' && S.profile.reportId === r.id;
        return `<div class="report">
          <button class="thumb" data-act="view-report" data-id="${r.id}" data-rid="${r.fileType && r.fileType.startsWith('image/') ? r.id : ''}" aria-label="Open ${esc(r.title || catName(r.cat))}">${r.fileType ? (r.fileType === 'application/pdf' ? 'PDF' : 'IMG') : 'NOTE'}</button>
          <div><b>${esc(r.title || catName(r.cat))}</b>
            <div class="tiny">${fmtDate(r.date)}${r.gaW !== '' && r.gaW != null ? ` · ${r.gaW}w ${r.gaD || 0}d at scan` : ''}${e ? ` · due ${fmtDate(e)}` : ''}</div>
            ${r.notes ? `<div class="small muted">${esc(r.notes)}</div>` : ''}
          </div>
          <div class="row">${using ? '<span class="chip accent">Sets due date</span>' : e ? `<button class="btn sm" data-act="use-report" data-id="${r.id}">Use for due date</button>` : ''}
            <button class="btn sm ghost danger" data-act="del-report" data-id="${r.id}">Delete</button></div>
        </div>`;
      }).join('')}</div>` : '<div class="empty">No reports yet. Your uploads are stored only on this device.</div>'}
      ${reps.filter(r => reportEDD(r)).length > 1 ? `<div class="tiny">Due dates from your scans: ${reps.filter(r => reportEDD(r)).map(r => `${fmtShort(r.date)} → ${fmtShort(reportEDD(r))}`).join(' · ')}</div>` : ''}
    </div>`;
  };
  AFTER.reports = el => {
    reportPrefill = null;
    const input = $('#rep-file', el), drop = $('#drop', el);
    const showName = () => { const f = input.files[0]; $('#drop-name', el).textContent = f ? `${f.name} · ${(f.size / 1024 / 1024).toFixed(1)} MB` : 'or drag it here · JPG, PNG, PDF'; };
    input.addEventListener('change', showName);
    drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('over'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('over'));
    drop.addEventListener('drop', e => {
      e.preventDefault(); drop.classList.remove('over');
      if (e.dataTransfer.files.length) { try { input.files = e.dataTransfer.files; } catch (err) { /* older browsers */ } showName(); }
    });
    $$('.thumb[data-rid]', el).forEach(async b => {
      if (!b.dataset.rid) return;
      try { const u = await fileURL(b.dataset.rid); if (u) b.innerHTML = `<img src="${u}" alt="">`; } catch (e) { /* ignore */ }
    });
  };

  // Habits
  let habitDay = todayISO();
  VIEWS.habits = () => {
    const d = habitDay, t = todayISO();
    const score = dayScore(d);
    const days = Array.from({ length: 7 }, (_, i) => addDays(t, i - 6));
    const doses = dosesFor(d), taken = doses.filter(x => x.taken).length;
    return `
    <div class="page-head"><div><h1>Daily habits</h1><p>Small, steady habits for you and baby. Tap to tick, use + and − for counts.</p></div></div>
    <div class="grid g2">
      <div class="card">
        <div class="card-head">
          <button class="btn sm" data-act="hday" data-n="-1" aria-label="Previous day">←</button>
          <b>${d === t ? 'Today' : fmtDate(d, { weekday: 'long', day: 'numeric', month: 'short' })}</b>
          <button class="btn sm" data-act="hday" data-n="1" ${d >= t ? 'disabled' : ''} aria-label="Next day">→</button>
        </div>
        <div class="row"><div class="bar sage" style="flex:1"><span style="width:${pct(score)}"></span></div><b class="num">${pct(score)}</b></div>
        <div class="list">
          ${S.habits.map(h => habitRow(h, d)).join('')}
          ${doses.length ? `<div class="habit"><div><div class="habit-name">Tablets</div><div class="tiny">From your tablet list</div></div><span class="chip ${taken === doses.length ? 'ok' : ''}">${taken}/${doses.length} taken</span></div>` : ''}
        </div>
      </div>
      <div class="stack" style="gap:16px">
        <div class="card">
          <h3>Last 7 days</h3>
          <div class="heat">${days.map(x => { const s = dayScore(x); return `<div><span>${weekday(x)}</span><button class="cell" style="background:color-mix(in srgb, var(--sage) ${Math.round(s * 85)}%, var(--surface-2)); border:0; cursor:pointer; ${s > .6 ? 'color:#fff' : ''}" data-act="hday-set" data-d="${x}" aria-label="${fmtShort(x)} ${pct(s)}">${Math.round(s * 100)}</button></div>`; }).join('')}</div>
          <div class="tiny">% of habits completed each day. Tap a day to edit it.</div>
        </div>
        <div class="card">
          <h3>Streaks</h3>
          <div class="list">${S.habits.map(h => `<div class="row"><span style="flex:1">${esc(h.name)}</span><b class="num">${streak(h)} day${streak(h) === 1 ? '' : 's'}</b><button class="btn sm ghost danger" data-act="del-habit" data-id="${h.id}" aria-label="Remove ${esc(h.name)}">Remove</button></div>`).join('')}</div>
        </div>
        <div class="card">
          <h3>Add a habit</h3>
          <form data-form="habit" class="form-grid">
            <label class="field" style="grid-column:1/-1">Habit<input id="nh-name" name="name" type="text" placeholder="e.g. Eat 2 dates, Coconut water" required></label>
            <label class="field">Type<select id="nh-type" name="type"><option value="check">Yes / no</option><option value="count">Count</option></select></label>
            <label class="field">Daily target<input id="nh-target" name="target" type="number" min="1" value="1"></label>
            <label class="field">Unit<input id="nh-unit" name="unit" type="text" placeholder="glasses"></label>
            <div style="align-self:end"><button class="btn primary" type="submit">Add</button></div>
          </form>
        </div>
      </div>
    </div>`;
  };

  // Tablets
  VIEWS.tablets = () => {
    const t = todayISO();
    const doses = dosesFor(t);
    const days = Array.from({ length: 7 }, (_, i) => addDays(t, i - 6));
    const perm = !('Notification' in window) ? 'unsupported' : Notification.permission;
    const hasExamples = S.meds.some(m => m.example);
    return `
    <div class="page-head"><div><h1>Tablets & reminders</h1><p>Your daily tablets, with reminders so no dose is missed.</p></div></div>
    ${hasExamples ? `<div class="notice"><div class="grow"><b>Two common supplements are filled in as examples.</b><span class="small">Edit them to match exactly what your doctor prescribed, or remove them.</span></div></div>` : ''}
    <div class="grid g2">
      <div class="card">
        <div class="card-head"><h3>Today</h3><span class="chip">${doses.filter(d => d.taken).length}/${doses.length} taken</span></div>
        ${doses.length ? `<div class="list">${doses.map(dz => doseRow(dz, t)).join('')}</div>` : '<div class="empty">Add your first tablet below.</div>'}
        <h3 style="margin-top:8px">Last 7 days</h3>
        <div class="heat">${days.map(x => { const ds = dosesFor(x); const s = ds.length ? ds.filter(d => d.taken).length / ds.length : 0; return `<div><span>${weekday(x)}</span><span class="cell" style="background:color-mix(in srgb, var(--accent) ${Math.round(s * 80)}%, var(--surface-2)); ${s > .6 ? 'color:#fff' : ''}">${ds.length ? Math.round(s * 100) : '–'}</span></div>`; }).join('')}</div>
      </div>
      <div class="card">
        <h3>Reminders</h3>
        ${perm === 'unsupported' ? '<p class="small muted">This browser does not support notifications. Use “Add to phone calendar” instead.</p>'
          : perm === 'denied' ? '<p class="small muted">Notifications are blocked for this site. Allow them in your browser’s site settings, or use “Add to phone calendar”.</p>'
          : `<label class="check"><input type="checkbox" data-act="notify-toggle" ${S.profile.notify && perm === 'granted' ? 'checked' : ''}> Show a notification when a tablet is due</label>`}
        <label class="check"><input type="checkbox" data-act="pref-toggle" data-key="bedtimeReminder" ${S.profile.bedtimeReminder ? 'checked' : ''}> Bedtime reminder at</label>
        <input id="bedtime" type="time" data-act="bedtime" value="${esc(S.profile.bedtime)}" style="max-width:160px" aria-label="Bedtime">
        <label class="check"><input type="checkbox" data-act="pref-toggle" data-key="waterReminder" ${S.profile.waterReminder ? 'checked' : ''}> Drink-water nudge every 2 hours (9 am – 9 pm)</label>
        <p class="tiny">Browser reminders work while Bloom is open or installed on the home screen. For reminders that always ring, add them to your phone’s calendar.</p>
        ${inFrame ? '' : '<div><button class="btn" data-act="ics">Add to phone calendar (.ics)</button></div>'}
      </div>
    </div>
    <div class="card">
      <div class="card-head"><h3>My tablets</h3></div>
      <div class="list">${S.meds.map(m => `<div class="row">
        <div style="flex:1;min-width:180px"><b>${esc(m.name)}</b> ${m.example ? '<span class="chip warn">Example</span>' : ''} ${m.active === false ? '<span class="chip">Paused</span>' : ''}<div class="tiny">${esc(m.dose || '')} · ${m.times.map(fmtTime).join(', ')}</div></div>
        <button class="btn sm" data-act="edit-med" data-id="${m.id}">Edit</button>
        <button class="btn sm ghost" data-act="pause-med" data-id="${m.id}">${m.active === false ? 'Resume' : 'Pause'}</button>
        <button class="btn sm ghost danger" data-act="del-med" data-id="${m.id}">Remove</button>
      </div>`).join('') || '<div class="empty">No tablets yet.</div>'}</div>
      <h3>Add a tablet</h3>
      ${medForm({})}
    </div>`;
  };
  function medForm(m) {
    const times = (m.times || ['']).concat(['', '']).slice(0, 3);
    return `<form data-form="med" data-id="${m.id || ''}" class="form-grid">
      <label class="field">Name<input name="name" type="text" value="${esc(m.name || '')}" placeholder="e.g. Iron + folic acid" required></label>
      <label class="field">Dose & instructions<input name="dose" type="text" value="${esc(m.dose || '')}" placeholder="1 tablet after breakfast"></label>
      ${times.map((tm, i) => `<label class="field">Time ${i + 1}${i ? ' (optional)' : ''}<input name="t${i}" type="time" value="${esc(tm)}" ${i ? '' : 'required'}></label>`).join('')}
      <div style="align-self:end"><button class="btn primary" type="submit">${m.id ? 'Save' : 'Add tablet'}</button></div>
    </form>`;
  }

  // Sleep
  const sleepHours = e => { let m = toMin(e.wake) - toMin(e.bed); if (m <= 0) m += 1440; return m / 60; };
  VIEWS.sleep = () => {
    const t = todayISO();
    const nights = Array.from({ length: 14 }, (_, i) => addDays(t, i - 14));
    const byDate = Object.fromEntries(S.sleep.map(e => [e.date, e]));
    const items = nights.map((d, i) => { const e = byDate[d]; const h = e ? sleepHours(e) : 0; return { value: h, low: e && h < 7, label: i % 2 === 1 ? String(parse(d).getDate()) : '', title: e ? `${fmtShort(d)}: ${h.toFixed(1)} h` : '' }; });
    const logged = items.filter(i => i.value > 0);
    const avg = logged.length ? logged.reduce((a, b) => a + b.value, 0) / logged.length : 0;
    const recent = S.sleep.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10);
    return `
    <div class="page-head"><div><h1>Sleep</h1><p>Most pregnant women need 7–9 hours. Log last night to see your pattern.</p></div></div>
    <div class="grid g2">
      <div class="card">
        <h3>Log a night</h3>
        <form data-form="sleep" class="form-grid">
          <label class="field">Night of<input id="sl-date" name="date" type="date" value="${addDays(t, -1)}" max="${t}" required></label>
          <label class="field">Went to bed<input id="sl-bed" name="bed" type="time" value="${esc(S.profile.bedtime || '22:00')}" required></label>
          <label class="field">Woke up<input id="sl-wake" name="wake" type="time" value="06:30" required></label>
          <label class="field">How did you sleep?<select id="sl-q" name="q"><option value="5">Very well</option><option value="4" selected>Well</option><option value="3">Okay</option><option value="2">Poorly</option><option value="1">Very poorly</option></select></label>
          <label class="field">Night wake-ups<input id="sl-wk" name="wakes" type="number" min="0" max="20" value="1"></label>
          <label class="field" style="grid-column:1/-1">Notes<input id="sl-note" name="note" type="text" placeholder="e.g. heartburn, leg cramps, bathroom trips"></label>
          <div><button class="btn primary" type="submit">Save night</button></div>
        </form>
      </div>
      <div class="card">
        <div class="card-head"><h3>Last 14 nights</h3>${logged.length ? `<span class="chip ${avg >= 7 ? 'ok' : 'warn'}">Average ${avg.toFixed(1)} h</span>` : ''}</div>
        ${barChart(items, { max: 12, ticks: [0, 4, 8, 12], unit: 'h', band: [7, 9], label: 'Hours slept per night' })}
        <div class="tiny">Green band = 7–9 hours. Orange bars are under 7 hours.</div>
      </div>
    </div>
    <div class="grid g2">
      <div class="card">
        <h3>Recent nights</h3>
        ${recent.length ? `<div class="table-wrap"><table><thead><tr><th>Night</th><th>Bed</th><th>Woke</th><th class="num">Hours</th><th>Quality</th><th></th></tr></thead><tbody>
          ${recent.map(e => `<tr><td>${fmtShort(e.date)}</td><td>${fmtTime(e.bed)}</td><td>${fmtTime(e.wake)}</td><td class="num">${sleepHours(e).toFixed(1)}</td><td>${'●'.repeat(e.q)}${'○'.repeat(5 - e.q)}</td><td><button class="btn sm ghost danger" data-act="del-sleep" data-d="${e.date}">Delete</button></td></tr>`).join('')}
        </tbody></table></div>` : '<div class="empty">No nights logged yet.</div>'}
      </div>
      <div class="card">
        <h3>Better sleep in pregnancy</h3>
        <ul class="warn-list small">
          <li>From 20 weeks, sleep on your side (left is best) to help blood flow to baby.</li>
          <li>Put a pillow between your knees and one under your bump.</li>
          <li>Eat dinner 2–3 hours before bed to reduce heartburn.</li>
          <li>Drink most of your water earlier in the day to cut night bathroom trips.</li>
          <li>Stretch your calves before bed to prevent leg cramps.</li>
          <li>Keep screens away for 30 minutes before sleep. Try the breathing exercise in Mind games.</li>
          <li>A 20–30 minute afternoon nap is fine.</li>
        </ul>
      </div>
    </div>`;
  };

  // Move
  VIEWS.move = () => {
    const info = dueInfo(), t = todayISO();
    const weekMins = S.exercise.filter(e => diffDays(e.date, t) < 7 && e.date <= t).reduce((a, b) => a + Number(b.min), 0);
    const suited = STRETCHES.filter(s => s.tri.includes(info.tri));
    const routineMins = Math.ceil(suited.reduce((a, s) => a + s.seconds, 0) / 60);
    const days = Array.from({ length: 7 }, (_, i) => addDays(t, i - 6));
    const items = days.map(d => ({ value: S.exercise.filter(e => e.date === d).reduce((a, b) => a + Number(b.min), 0), label: weekday(d), title: fmtShort(d) }));
    const max = Math.max(60, ...items.map(i => i.value));
    return `
    <div class="page-head"><div><h1>Stretch & move</h1><p>Gentle stretches chosen for trimester ${info.tri}. Move slowly, breathe, and stop if anything hurts.</p></div>
      <button class="btn primary" data-act="routine">Start ${routineMins}-minute routine</button></div>
    <div class="grid g2">
      <div class="card">
        <div class="card-head"><h3>Active minutes, last 7 days</h3><span class="chip ${weekMins >= 150 ? 'ok' : ''}">${weekMins} / 150 min</span></div>
        <div class="bar sage"><span style="width:${pct(clamp(weekMins / 150, 0, 1))}"></span></div>
        ${barChart(items, { max: Math.ceil(max / 30) * 30, ticks: [0, Math.ceil(max / 30) * 15, Math.ceil(max / 30) * 30], unit: 'm', label: 'Minutes of activity per day' })}
      </div>
      <div class="card">
        <h3>Log activity</h3>
        <form data-form="exercise" class="form-grid">
          <label class="field">Activity<select id="ex-type" name="type"><option>Walking</option><option>Prenatal yoga</option><option>Stretching</option><option>Swimming</option><option>Stationary cycling</option><option>Other</option></select></label>
          <label class="field">Minutes<input id="ex-min" name="min" type="number" min="1" max="300" value="20" required></label>
          <label class="field">Date<input id="ex-date" name="date" type="date" value="${t}" max="${t}"></label>
          <div style="align-self:end"><button class="btn primary" type="submit">Log</button></div>
        </form>
        <h3>Exercise safely</h3>
        <ul class="warn-list small">${EXERCISE_SAFETY.map(s => `<li>${esc(s)}</li>`).join('')}</ul>
      </div>
    </div>
    <div class="grid g3">${STRETCHES.map(s => `<div class="card stretch">
      <div class="card-head"><h3>${esc(s.name)}</h3><span class="chip ${s.tri.includes(info.tri) ? 'ok' : 'warn'}">${s.tri.includes(info.tri) ? esc(s.area) : 'Later trimesters'}</span></div>
      <p class="small muted">${esc(s.benefit)}</p>
      <ol>${s.steps.map(x => `<li>${esc(x)}</li>`).join('')}</ol>
      <div class="row"><button class="btn sm" data-act="stretch-one" data-id="${s.id}">Start · ${s.seconds}s</button>
        <a class="btn sm ghost" href="https://www.youtube.com/results?search_query=${encodeURIComponent('pregnancy ' + s.name + ' stretch')}" target="_blank" rel="noopener">Watch how ↗</a></div>
    </div>`).join('')}</div>`;
  };

  // Routine player
  let routine = null;
  function startRoutine(list) {
    routine = { list, i: 0, left: list[0].seconds, paused: false, total: list.reduce((a, s) => a + s.seconds, 0) };
    drawRoutine();
    routine.timer = setInterval(() => {
      if (!routine || routine.paused) return;
      routine.left--;
      if (routine.left <= 0) {
        beep();
        routine.i++;
        if (routine.i >= routine.list.length) return finishRoutine();
        routine.left = routine.list[routine.i].seconds;
        drawRoutine();
      } else {
        const el = $('#rt-left'); if (el) el.textContent = fmtDur(routine.left * 1000);
      }
    }, 1000);
  }
  function drawRoutine() {
    const s = routine.list[routine.i];
    openModal(`
      <div class="modal-head"><div class="eyebrow">Stretch ${routine.i + 1} of ${routine.list.length}</div><button class="btn sm ghost" data-act="close">Stop</button></div>
      <h2>${esc(s.name)}</h2>
      <div class="timer-big" id="rt-left">${fmtDur(routine.left * 1000)}</div>
      <ol class="small">${s.steps.map(x => `<li>${esc(x)}</li>`).join('')}</ol>
      <div class="bar"><span style="width:${pct(routine.i / routine.list.length)}"></span></div>
      <div class="row"><button class="btn" data-act="rt-pause">${routine.paused ? 'Resume' : 'Pause'}</button><button class="btn" data-act="rt-next">Next stretch</button>
      ${routine.list[routine.i + 1] ? `<span class="tiny">Up next: ${esc(routine.list[routine.i + 1].name)}</span>` : ''}</div>`);
  }
  function finishRoutine() {
    const mins = Math.max(1, Math.round(routine.total / 60));
    stopRoutine();
    S.exercise.push({ date: todayISO(), type: 'Stretching', min: mins });
    markHabit('stretch');
    save();
    openModal(`<h2>Well done!</h2><p>${mins} minutes of stretching logged and today’s stretch habit is ticked.</p><div><button class="btn primary" data-act="close">Close</button></div>`);
    render();
  }
  function stopRoutine() { if (routine) { clearInterval(routine.timer); routine = null; } }
  let audioCtx;
  function beep() {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.frequency.value = 660; g.gain.value = 0.08;
      o.connect(g); g.connect(audioCtx.destination);
      o.start(); o.stop(audioCtx.currentTime + 0.25);
    } catch (e) { /* sound not available */ }
  }

  // Mind games
  let game = 'memory';
  const G = { mem: null, scr: null, math: null, breath: null };
  VIEWS.mind = () => {
    const t = todayISO();
    const affirm = AFFIRMATIONS[(parse(t).getTime() / DAY | 0) % AFFIRMATIONS.length];
    const best = S.games;
    return `
    <div class="page-head"><div><h1>Mind games</h1><p>A few calm minutes for your brain. Finishing any game ticks today’s mind habit.</p></div></div>
    <div class="game-tabs">
      ${[['memory', 'Memory match'], ['scramble', 'Baby word scramble'], ['breath', 'Calm breathing'], ['math', 'Quick maths']].map(([id, l]) => `<button class="btn" data-act="game" data-id="${id}" aria-pressed="${game === id}">${l}</button>`).join('')}
    </div>
    <div class="grid g2">
      <div class="card" id="game-area"></div>
      <div class="stack" style="gap:16px">
        <div class="card"><div class="eyebrow">Affirmation</div><p class="affirm">${esc(affirm)}</p></div>
        <div class="card"><h3>Personal bests</h3>
          <div class="list small">
            <div class="row"><span style="flex:1">Memory match (fewest moves)</span><b class="num">${best.memory || '–'}</b></div>
            <div class="row"><span style="flex:1">Word scramble (best streak)</span><b class="num">${best.scramble || '–'}</b></div>
            <div class="row"><span style="flex:1">Quick maths (60 s score)</span><b class="num">${best.math || '–'}</b></div>
            <div class="row"><span style="flex:1">Breathing cycles today</span><b class="num">${(best.breathDay === t && best.breath) || 0}</b></div>
          </div>
        </div>
      </div>
    </div>`;
  };
  AFTER.mind = () => drawGame();
  function gameWon(kind, value, better) {
    const b = S.games[kind];
    if (value != null && (b == null || better(value, b))) S.games[kind] = value;
    markHabit('mind');
    save();
  }
  function drawGame() {
    const a = $('#game-area'); if (!a) return;
    clearInterval(G.math && G.math.timer); clearTimeout(G.breath && G.breath.timer);
    if (game === 'memory') {
      if (!G.mem) G.mem = { cards: shuffle(MEMORY_EMOJI.concat(MEMORY_EMOJI)).map(e => ({ e, open: false, done: false })), open: [], moves: 0, done: false };
      const m = G.mem;
      a.innerHTML = `<div class="card-head"><h3>Memory match</h3><span class="chip">Moves: <b class="num">${m.moves}</b></span></div>
        <p class="small muted">Find all 8 pairs with as few moves as you can.</p>
        <div class="mem">${m.cards.map((c, i) => `<button class="${c.open ? 'open' : ''} ${c.done ? 'done' : ''}" data-act="mem" data-i="${i}" aria-label="${c.open || c.done ? c.e : 'Hidden card'}">${c.e}</button>`).join('')}</div>
        <div><button class="btn sm" data-act="mem-new">New game</button></div>`;
    } else if (game === 'scramble') {
      if (!G.scr) G.scr = { streak: 0, hint: false };
      const s = G.scr;
      if (!s.word) { const [w, h] = SCRAMBLE_WORDS[Math.floor(Math.random() * SCRAMBLE_WORDS.length)]; let sc; do { sc = shuffle(w.split('')).join(''); } while (sc === w && w.length > 2); Object.assign(s, { word: w, clue: h, sc, hint: false }); }
      a.innerHTML = `<div class="card-head"><h3>Baby word scramble</h3><span class="chip">Streak: <b class="num">${s.streak}</b></span></div>
        <div class="scramble-word">${s.sc}</div>
        ${s.hint ? `<p class="small">Hint: ${esc(s.clue)} · starts with <b>${s.word[0]}</b></p>` : ''}
        <form data-form="scramble" class="row"><input id="scr-in" name="guess" type="text" autocomplete="off" placeholder="Your answer" style="max-width:220px" aria-label="Your answer"><button class="btn primary" type="submit">Check</button></form>
        <div class="row"><button class="btn sm" data-act="scr-hint">Hint</button><button class="btn sm ghost" data-act="scr-skip">Skip word</button></div>`;
    } else if (game === 'breath') {
      if (!G.breath) G.breath = { on: false, cycles: 0 };
      const b = G.breath;
      a.innerHTML = `<div class="card-head"><h3>Box breathing</h3><span class="chip">Cycles: <b class="num" id="br-c">${b.cycles}</b></span></div>
        <p class="small muted">Breathe in for 4, hold for 4, out for 4, hold for 4. Four cycles take about a minute and calm the nervous system.</p>
        <div class="breath"><div class="breath-stage"><div class="breath-circle" id="br-circle">Ready</div></div>
        <button class="btn primary" data-act="breath">${b.on ? 'Stop' : 'Start breathing'}</button></div>`;
      if (b.on) runBreath();
    } else if (game === 'math') {
      if (!G.math) G.math = { on: false, score: 0 };
      const m = G.math;
      a.innerHTML = `<div class="card-head"><h3>Quick maths</h3><span class="chip">Score: <b class="num" id="mt-s">${m.score}</b></span></div>
        <p class="small muted">Answer as many sums as you can in 60 seconds.</p>
        ${m.on ? `<div class="row"><span class="math-q" id="mt-q">${m.q}</span><span class="chip accent num" id="mt-t">${m.left}s</span></div>
          <form data-form="math" class="row"><input id="mt-in" name="a" type="number" inputmode="numeric" style="max-width:160px" aria-label="Answer" autocomplete="off"><button class="btn primary" type="submit">Enter</button></form>`
          : `<div><button class="btn primary" data-act="math-start">${m.score ? 'Play again' : 'Start'}</button></div>${m.score ? `<p>You scored <b>${m.score}</b>.</p>` : ''}`}`;
      if (m.on) { const inp = $('#mt-in'); if (inp) inp.focus(); mathTimer(); }
    }
  }
  function newSum() {
    const op = ['+', '−', '×'][Math.floor(Math.random() * 3)];
    let x, y, ans;
    if (op === '+') { x = 5 + Math.floor(Math.random() * 45); y = 2 + Math.floor(Math.random() * 45); ans = x + y; }
    else if (op === '−') { x = 10 + Math.floor(Math.random() * 60); y = 1 + Math.floor(Math.random() * x); ans = x - y; }
    else { x = 2 + Math.floor(Math.random() * 11); y = 2 + Math.floor(Math.random() * 9); ans = x * y; }
    return { q: `${x} ${op} ${y}`, ans };
  }
  function mathTimer() {
    const m = G.math;
    clearInterval(m.timer);
    m.timer = setInterval(() => {
      m.left--;
      const t = $('#mt-t'); if (t) t.textContent = m.left + 's';
      if (m.left <= 0) { clearInterval(m.timer); m.on = false; gameWon('math', m.score, (a, b) => a > b); drawGame(); }
    }, 1000);
  }
  function runBreath() {
    const b = G.breath;
    const phases = [['Breathe in', true], ['Hold', true], ['Breathe out', false], ['Hold', false]];
    let i = 0;
    const step = () => {
      const c = $('#br-circle');
      if (!c || !b.on) return;
      const [label, big] = phases[i % 4];
      c.textContent = label;
      c.classList.toggle('big', big);
      if (i > 0 && i % 4 === 0) {
        b.cycles++;
        const t = todayISO();
        if (S.games.breathDay !== t) { S.games.breathDay = t; S.games.breath = 0; }
        S.games.breath++;
        const cc = $('#br-c'); if (cc) cc.textContent = b.cycles;
        if (b.cycles === 4) gameWon('breathDone', null);
        else save();
      }
      i++;
      b.timer = setTimeout(step, 4000);
    };
    step();
  }

  // Care tools
  VIEWS.care = () => {
    const t = todayISO(), info = dueInfo();
    const ka = S.kickActive, ca = S.contrActive;
    const j = S.journal[t] || { mood: '', symptoms: [], note: '' };
    const weights = S.weight.slice().sort((a, b) => a.date.localeCompare(b.date));
    const gain = weights.length > 1 ? weights[weights.length - 1].kg - weights[0].kg : null;
    const contr = S.contractions.slice(-6).reverse();
    const upcoming = S.appts.slice().sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    const bagAll = Object.values(BAG_ITEMS).flat(), bagDone = bagAll.filter(i => S.bag[i]).length;
    const p = S.profile;
    return `
    <div class="page-head"><div><h1>Care tools</h1><p>Kick counter, contraction timer, weight, mood, appointments and your hospital bag.</p></div></div>
    <div class="grid g2">
      <div class="card">
        <div class="card-head"><h3>Kick counter</h3>${info.weeks < 28 ? '<span class="chip">Daily from week 28</span>' : '<span class="chip accent">Count daily</span>'}</div>
        <p class="small muted">Pick a time baby is usually active. Count every kick, roll or flutter until you reach 10.</p>
        ${ka ? `<button class="kick-btn" data-act="kick">${ka.count}</button>
          <div class="row" style="justify-content:center"><span class="chip num" data-live="kick">${fmtDur(Date.now() - ka.start)}</span><span class="tiny">Tap the circle for each movement</span></div>
          <div class="row" style="justify-content:center"><button class="btn" data-act="kick-end">Finish session</button><button class="btn ghost" data-act="kick-cancel">Cancel</button></div>`
          : `<div><button class="btn primary" data-act="kick-start">Start counting</button></div>`}
        ${S.kicks.length ? `<div class="list small">${S.kicks.slice(-5).reverse().map(k => `<div class="row"><span style="flex:1">${new Date(k.start).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</span><b>${k.count} kicks</b><span class="muted num">${fmtDur(k.end - k.start)}</span></div>`).join('')}</div>` : ''}
        <p class="tiny">If you feel fewer than 10 movements in 2 hours, or baby is moving less than usual, call your doctor or hospital straight away.</p>
      </div>
      <div class="card">
        <div class="card-head"><h3>Contraction timer</h3></div>
        <p class="small muted">Tap start when a contraction begins and stop when it ends. Call your hospital if contractions are 5 minutes apart, last 1 minute, for 1 hour (5-1-1), or earlier if before 37 weeks.</p>
        ${ca ? `<div class="timer-big" data-live="contr">${fmtDur(Date.now() - ca)}</div><div><button class="btn primary" data-act="contr-stop">Contraction ended</button></div>`
          : `<div class="row"><button class="btn primary" data-act="contr-start">Contraction started</button>${S.contractions.length ? '<button class="btn ghost" data-act="contr-clear">Clear history</button>' : ''}</div>`}
        ${contr.length ? `<div class="table-wrap"><table><thead><tr><th>Started</th><th class="num">Lasted</th><th class="num">Apart</th></tr></thead><tbody>${contr.map((c, i) => { const prev = contr[i + 1]; return `<tr><td>${new Date(c.start).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</td><td class="num">${fmtDur(c.end - c.start)}</td><td class="num">${prev ? fmtDur(c.start - prev.start) : '–'}</td></tr>`; }).join('')}</tbody></table></div>` : ''}
      </div>
    </div>

    <div class="grid g2">
      <div class="card">
        <div class="card-head"><h3>How are you today?</h3><span class="tiny">${fmtDate(t, { weekday: 'long', day: 'numeric', month: 'short' })}</span></div>
        <div class="mood-row">${MOODS.map(m => `<button data-act="mood" data-id="${m.id}" aria-pressed="${j.mood === m.id}"><span aria-hidden="true">${m.emoji}</span>${m.label}</button>`).join('')}</div>
        <div class="sym-row">${SYMPTOMS.map(s => `<button data-act="sym" data-id="${esc(s)}" aria-pressed="${(j.symptoms || []).includes(s)}">${esc(s)}</button>`).join('')}</div>
        <form data-form="journal" class="stack"><textarea id="jr-note" name="note" placeholder="A note for today: cravings, feelings, baby’s first kick…">${esc(j.note || '')}</textarea><div><button class="btn" type="submit">Save note</button></div></form>
        ${Object.keys(S.journal).filter(d => d !== t).length ? `<div class="list small">${Object.entries(S.journal).filter(([d]) => d !== t).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 5).map(([d, e]) => `<div><b>${fmtShort(d)}</b> ${(MOODS.find(m => m.id === e.mood) || {}).emoji || ''} <span class="muted">${esc((e.symptoms || []).join(', '))}${e.note ? ' · ' + esc(e.note) : ''}</span></div>`).join('')}</div>` : ''}
      </div>
      <div class="card">
        <div class="card-head"><h3>Weight</h3>${gain != null ? `<span class="chip">${gain >= 0 ? '+' : ''}${gain.toFixed(1)} kg since ${fmtShort(weights[0].date)}</span>` : ''}</div>
        <form data-form="weight" class="form-grid">
          <label class="field">Date<input id="wt-date" name="date" type="date" value="${t}" max="${t}"></label>
          <label class="field">Weight (kg)<input id="wt-kg" name="kg" type="number" step="0.1" min="30" max="200" placeholder="e.g. 62.5" required></label>
          <div style="align-self:end"><button class="btn primary" type="submit">Save</button></div>
        </form>
        ${weights.length ? lineChart(weights.slice(-20).map(w => ({ value: w.kg, label: fmtShort(w.date), title: `${fmtShort(w.date)}: ${w.kg} kg` })), { label: 'Weight over time' }) : '<div class="empty">Weigh yourself once a week, same time of day.</div>'}
        <p class="tiny">Typical total gain is 11–16 kg for a normal pre-pregnancy BMI, about 0.4 kg a week in the 2nd and 3rd trimesters. Your doctor will tell you what is right for you.</p>
      </div>
    </div>

    <div class="grid g2">
      <div class="card">
        <h3>Appointments</h3>
        <form data-form="appt" class="form-grid">
          <label class="field" style="grid-column:1/-1">What<input id="ap-title" name="title" type="text" placeholder="e.g. Monthly check-up, Growth scan" required></label>
          <label class="field">Date<input id="ap-date" name="date" type="date" value="${t}" required></label>
          <label class="field">Time<input id="ap-time" name="time" type="time"></label>
          <div style="align-self:end"><button class="btn primary" type="submit">Add</button></div>
        </form>
        ${upcoming.length ? `<div class="list">${upcoming.map(a => `<div class="row"><div style="flex:1"><b>${esc(a.title)}</b><div class="tiny">${fmtDate(a.date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}${a.time ? ' · ' + fmtTime(a.time) : ''}${a.date < t ? ' · done' : ''}</div></div><button class="btn sm ghost danger" data-act="del-appt" data-id="${a.id}">Remove</button></div>`).join('')}</div>` : '<div class="empty">No appointments yet.</div>'}
      </div>
      <div class="card">
        <div class="card-head"><h3>Hospital bag</h3><span class="chip ${bagDone === bagAll.length ? 'ok' : ''}">${bagDone}/${bagAll.length} packed</span></div>
        <div class="bar"><span style="width:${pct(bagDone / bagAll.length)}"></span></div>
        <p class="tiny">Have it ready by week 34–36.</p>
        ${Object.entries(BAG_ITEMS).map(([g, items]) => `<div class="stack"><div class="eyebrow">${esc(g)}</div>${items.map(i => `<label class="check"><input type="checkbox" data-act="bag" data-id="${esc(i)}" ${S.bag[i] ? 'checked' : ''}> ${esc(i)}</label>`).join('')}</div>`).join('')}
      </div>
    </div>

    <div class="grid g2">
      <div class="card">
        <h3>Call your doctor straight away if you have</h3>
        <ul class="warn-list small">${WARNING_SIGNS.map(w => `<li>${esc(w)}</li>`).join('')}</ul>
        <div class="notice danger small"><div class="grow">
          <b>Emergency contacts</b>
          <span>Doctor: ${p.doctor ? esc(p.doctor) : '—'} ${p.doctorPhone ? `· <b>${esc(p.doctorPhone)}</b>` : ''}</span>
          <span>Hospital: ${p.hospital ? esc(p.hospital) : '—'} ${p.hospitalPhone ? `· <b>${esc(p.hospitalPhone)}</b>` : ''}</span>
          ${p.doctorPhone || p.hospitalPhone ? '' : '<button class="btn sm" data-act="go" data-id="settings" style="justify-self:start">Add contacts</button>'}
        </div></div>
      </div>
      <div class="card">
        <h3>Baby name ideas</h3>
        <form data-form="name" class="row"><input id="bn-name" name="name" type="text" placeholder="Add a name" style="flex:1;min-width:140px" required aria-label="Baby name"><select id="bn-g" name="g" style="width:auto" aria-label="For"><option value="girl">Girl</option><option value="boy">Boy</option><option value="either">Either</option></select><button class="btn primary" type="submit">Add</button></form>
        ${S.names.length ? `<div class="list">${S.names.map((n, i) => `<div class="row"><b style="flex:1">${esc(n.name)}</b><span class="chip">${esc(n.g)}</span><button class="btn sm ghost" data-act="name-fav" data-i="${i}" aria-label="Favourite">${n.fav ? '♥' : '♡'}</button><button class="btn sm ghost danger" data-act="name-del" data-i="${i}">Remove</button></div>`).join('')}</div>` : '<div class="empty">Start a shortlist together.</div>'}
      </div>
    </div>`;
  };

  // Settings
  VIEWS.settings = () => {
    const p = S.profile;
    return `
    <div class="page-head"><div><h1>Settings</h1><p>Your details, due date, theme and backups.</p></div></div>
    <div class="grid g2">
      <div class="card">
        <h3>Profile & contacts</h3>
        <form data-form="profile" class="form-grid">
          <label class="field">Your name<input id="pf-name" name="name" type="text" value="${esc(p.name)}"></label>
          <label class="field">Partner’s name<input id="pf-partner" name="partner" type="text" value="${esc(p.partner)}"></label>
          <label class="field">Doctor<input id="pf-doc" name="doctor" type="text" value="${esc(p.doctor)}"></label>
          <label class="field">Doctor’s phone<input id="pf-docp" name="doctorPhone" type="text" inputmode="tel" value="${esc(p.doctorPhone)}"></label>
          <label class="field">Hospital<input id="pf-hosp" name="hospital" type="text" value="${esc(p.hospital)}"></label>
          <label class="field">Hospital phone<input id="pf-hospp" name="hospitalPhone" type="text" inputmode="tel" value="${esc(p.hospitalPhone)}"></label>
          <div><button class="btn primary" type="submit">Save</button></div>
        </form>
      </div>
      <div class="card">
        <h3>Due date</h3>
        ${dueDateForm(p)}
      </div>
    </div>
    <div class="grid g2">
      <div class="card">
        <h3>Appearance</h3>
        <div class="row">${[['', 'System'], ['light', 'Light'], ['dark', 'Dark']].map(([v, l]) => `<button class="btn ${p.theme === v ? 'primary' : ''}" data-act="theme" data-v="${v}">${l}</button>`).join('')}</div>
        <h3>Install on your phone</h3>
        <p class="small muted">Open this site in Chrome (Android) or Safari (iPhone), then choose “Add to Home screen”. Bloom then opens like an app and works offline.</p>
      </div>
      <div class="card">
        <h3>Backup</h3>
        <p class="small muted">Everything is saved only on this device. Download a backup now and then, or to move to a new phone. Report files are not included in the backup.</p>
        <div class="row">
          ${inFrame ? '' : '<button class="btn" data-act="export">Download backup</button>'}
          <label class="btn" for="import-file">Restore from backup</label>
          <input id="import-file" type="file" accept="application/json,.json" data-act="import" hidden>
        </div>
        <h3>Start over</h3>
        <div class="row">${resetArmed ? '<span class="small">This deletes all entries on this device.</span><button class="btn danger" data-act="reset-confirm">Yes, delete everything</button><button class="btn ghost" data-act="reset-cancel">Cancel</button>' : '<button class="btn ghost danger" data-act="reset">Delete all data</button>'}</div>
      </div>
    </div>`;
  };
  let resetArmed = false;

  // ---------- Actions ----------
  const A = {
    tab: el => go(el.dataset.id),
    go: el => go(el.dataset.id),
    close: () => closeModal(),
    'onboard-skip': () => { S.onboarded = true; save(); render(); },
    'upload-for': el => { reportPrefill = el.dataset.cat; go('reports'); const c = $('#upload-card'); if (c) c.scrollIntoView({ behavior: 'smooth' }); },
    'habit-toggle': el => { const { id, day } = el.dataset; setHV(day, id, !hv(day, id)); save(); render(); },
    'habit-inc': el => { const { id, day } = el.dataset; setHV(day, id, (Number(hv(day, id)) || 0) + 1); save(); render(); },
    'habit-dec': el => { const { id, day } = el.dataset; setHV(day, id, Math.max(0, (Number(hv(day, id)) || 0) - 1)); save(); render(); },
    hday: el => { habitDay = addDays(habitDay, Number(el.dataset.n)); if (habitDay > todayISO()) habitDay = todayISO(); render(); },
    'hday-set': el => { habitDay = el.dataset.d; render(); },
    'del-habit': el => { S.habits = S.habits.filter(h => h.id !== el.dataset.id); save(); render(); toast('Habit removed'); },
    'dose-toggle': el => {
      const { key, day } = el.dataset;
      const log = S.medLog[day] = S.medLog[day] || {};
      if (log[key]) delete log[key]; else log[key] = nowHM();
      save(); render();
    },
    'edit-med': el => {
      const m = S.meds.find(x => x.id === el.dataset.id);
      openModal(`<div class="modal-head"><h2>Edit tablet</h2><button class="btn sm ghost" data-act="close">Close</button></div>${medForm(m)}`);
    },
    'pause-med': el => { const m = S.meds.find(x => x.id === el.dataset.id); m.active = m.active === false; save(); render(); },
    'del-med': el => { S.meds = S.meds.filter(x => x.id !== el.dataset.id); save(); render(); toast('Tablet removed'); },
    ics: () => downloadICS(),
    week: el => { selWeek = Number(el.dataset.w); render(); },
    'view-report': async el => {
      const r = S.reports.find(x => x.id === el.dataset.id);
      let body = '';
      if (r.fileType) {
        try {
          const u = await fileURL(r.id);
          if (!u) body = '<div class="empty">The file for this report is no longer on this device.</div>';
          else if (r.fileType.startsWith('image/')) body = `<img class="viewer-img" src="${u}" alt="${esc(r.title || catName(r.cat))}">`;
          else body = `<iframe class="viewer" src="${u}" title="Report PDF"></iframe><a class="btn sm" href="${u}" target="_blank" rel="noopener">Open PDF in a new tab</a>`;
        } catch (e) { body = '<div class="empty">Could not open the file.</div>'; }
      }
      const e = reportEDD(r);
      openModal(`<div class="modal-head"><div><h2>${esc(r.title || catName(r.cat))}</h2><div class="tiny">${fmtDate(r.date)}${e ? ' · due date on report: ' + fmtDate(e) : ''}</div></div><button class="btn sm ghost" data-act="close">Close</button></div>
        ${r.notes ? `<p>${esc(r.notes)}</p>` : ''}${body}`, true);
    },
    'use-report': el => { S.profile.dueSource = 'report'; S.profile.reportId = el.dataset.id; save(); render(); toast(`Due date updated to ${fmtDate(dueInfo().edd)}`); },
    'del-report': async el => {
      const id = el.dataset.id;
      S.reports = S.reports.filter(r => r.id !== id);
      if (S.profile.reportId === id) { S.profile.reportId = null; if (S.profile.dueSource === 'report') S.profile.dueSource = 'estimate'; }
      save();
      try { await Files.del(id); } catch (e) { /* ignore */ }
      render(); toast('Report deleted');
    },
    'del-sleep': el => { S.sleep = S.sleep.filter(e => e.date !== el.dataset.d); save(); render(); },
    routine: () => { const tri = dueInfo().tri; startRoutine(STRETCHES.filter(s => s.tri.includes(tri))); },
    'stretch-one': el => startRoutine([STRETCHES.find(s => s.id === el.dataset.id)]),
    'rt-pause': () => { routine.paused = !routine.paused; drawRoutine(); },
    'rt-next': () => { routine.left = 1; },
    game: el => { game = el.dataset.id; if (G.breath) G.breath.on = false; if (G.math) G.math.on = false; render(); },
    mem: el => {
      const m = G.mem, i = Number(el.dataset.i), c = m.cards[i];
      if (c.open || c.done || m.open.length === 2) return;
      c.open = true; m.open.push(i);
      if (m.open.length === 2) {
        m.moves++;
        const [a, b] = m.open.map(k => m.cards[k]);
        if (a.e === b.e) {
          a.done = b.done = true; a.open = b.open = false; m.open = [];
          if (m.cards.every(x => x.done)) { m.done = true; gameWon('memory', m.moves, (x, y) => x < y); drawGame(); $('#game-area').insertAdjacentHTML('afterbegin', `<div class="notice info"><div class="grow"><b>All pairs found in ${m.moves} moves!</b></div></div>`); return; }
        } else {
          setTimeout(() => { a.open = b.open = false; m.open = []; drawGame(); }, 750);
        }
      }
      drawGame();
    },
    'mem-new': () => { G.mem = null; drawGame(); },
    'scr-hint': () => { G.scr.hint = true; drawGame(); },
    'scr-skip': () => { G.scr.word = null; G.scr.streak = 0; drawGame(); },
    breath: () => { const b = G.breath; b.on = !b.on; if (!b.on) clearTimeout(b.timer); drawGame(); },
    'math-start': () => { G.math = { on: true, score: 0, left: 60, ...newSum() }; drawGame(); },
    'kick-start': () => { S.kickActive = { start: Date.now(), count: 0 }; save(); render(); },
    kick: () => { S.kickActive.count++; save(); if (S.kickActive.count === 10) { beep(); toast('10 movements counted. Well done, baby!'); } render(); },
    'kick-end': () => { const k = S.kickActive; if (k.count) S.kicks.push({ start: k.start, end: Date.now(), count: k.count }); S.kickActive = null; save(); render(); },
    'kick-cancel': () => { S.kickActive = null; save(); render(); },
    'contr-start': () => { S.contrActive = Date.now(); save(); render(); },
    'contr-stop': () => { S.contractions.push({ start: S.contrActive, end: Date.now() }); S.contrActive = null; save(); render(); },
    'contr-clear': () => { S.contractions = []; save(); render(); },
    mood: el => { const t = todayISO(); const j = S.journal[t] = S.journal[t] || { symptoms: [] }; j.mood = j.mood === el.dataset.id ? '' : el.dataset.id; save(); render(); },
    sym: el => { const t = todayISO(); const j = S.journal[t] = S.journal[t] || { symptoms: [] }; j.symptoms = j.symptoms || []; const s = el.dataset.id; j.symptoms = j.symptoms.includes(s) ? j.symptoms.filter(x => x !== s) : j.symptoms.concat(s); save(); render(); },
    'del-appt': el => { S.appts = S.appts.filter(a => a.id !== el.dataset.id); save(); render(); },
    'name-fav': el => { const n = S.names[Number(el.dataset.i)]; n.fav = !n.fav; save(); render(); },
    'name-del': el => { S.names.splice(Number(el.dataset.i), 1); save(); render(); },
    theme: el => { S.profile.theme = el.dataset.v; save(); render(); },
    export: () => downloadFile(`bloom-backup-${todayISO()}.json`, JSON.stringify(S, null, 2), 'application/json'),
    reset: () => { resetArmed = true; render(); },
    'reset-cancel': () => { resetArmed = false; render(); },
    'reset-confirm': async () => {
      const ids = S.reports.map(r => r.id);
      S = fresh(); resetArmed = false; save();
      for (const id of ids) { try { await Files.del(id); } catch (e) { /* ignore */ } }
      go('today'); toast('All data deleted');
    },
  };
  // Checkbox / input change actions
  const CHANGE = {
    'notify-toggle': async el => {
      if (el.checked) {
        let perm = Notification.permission;
        if (perm !== 'granted') { try { perm = await Notification.requestPermission(); } catch (e) { perm = 'denied'; } }
        S.profile.notify = perm === 'granted';
        if (perm === 'granted') { notify('Reminders are on', 'Bloom will remind you when a tablet is due.'); }
        else toast('Notifications were not allowed. Use “Add to phone calendar” instead.');
      } else S.profile.notify = false;
      save(); render();
    },
    'pref-toggle': el => { S.profile[el.dataset.key] = el.checked; save(); },
    bedtime: el => { S.profile.bedtime = el.value; save(); },
    bag: el => { if (el.checked) S.bag[el.dataset.id] = true; else delete S.bag[el.dataset.id]; save(); render(); },
    import: el => {
      const f = el.files[0]; if (!f) return;
      const rd = new FileReader();
      rd.onload = () => {
        try { const data = JSON.parse(rd.result); if (!data.profile || !data.habits) throw new Error('bad'); S = migrate(data); save(); render(); toast('Backup restored'); }
        catch (e) { toast('That file is not a Bloom backup.'); }
      };
      rd.readAsText(f);
    },
  };

  // ---------- Forms ----------
  const F = {
    onboard: fd => { S.profile.name = (fd.get('name') || '').trim(); applyDates(fd); S.onboarded = true; toast('Your journal is ready'); },
    dates: fd => { applyDates(fd); toast(`Due date: ${fmtDate(dueInfo().edd)}`); },
    report: async (fd, form) => {
      const file = form.querySelector('#rep-file').files[0];
      const r = {
        id: uid(), cat: fd.get('cat'), date: fd.get('date'), title: (fd.get('title') || '').trim(),
        gaW: fd.get('gaW') === '' ? '' : clamp(Number(fd.get('gaW')), 1, 42), gaD: fd.get('gaD') === '' ? 0 : clamp(Number(fd.get('gaD')), 0, 6),
        edd: fd.get('edd') || '', notes: (fd.get('notes') || '').trim(),
        fileName: file ? file.name : '', fileType: file ? (file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg')) : '', size: file ? file.size : 0,
      };
      if (file) {
        try { await Files.put(r.id, file); }
        catch (e) { toast('Could not store the file on this device. The report details were saved without it.'); r.fileType = ''; }
      }
      S.reports.push(r);
      const e = reportEDD(r);
      if (fd.get('use') && e) {
        const before = dueInfo().edd;
        S.profile.dueSource = 'report'; S.profile.reportId = r.id;
        const shift = diffDays(before, e);
        toast(shift === 0 ? 'Report saved. Your due date is unchanged.' : `Report saved. Due date moved ${Math.abs(shift)} day${Math.abs(shift) === 1 ? '' : 's'} ${shift > 0 ? 'later' : 'earlier'} to ${fmtDate(e)}.`);
      } else toast('Report saved');
    },
    habit: fd => {
      const type = fd.get('type');
      S.habits.push({ id: 'h_' + uid(), name: fd.get('name').trim(), type, target: type === 'count' ? Math.max(1, Number(fd.get('target')) || 1) : 1, unit: (fd.get('unit') || '').trim() });
      toast('Habit added');
    },
    med: (fd, form) => {
      const times = [fd.get('t0'), fd.get('t1'), fd.get('t2')].filter(Boolean).sort();
      const data = { name: fd.get('name').trim(), dose: (fd.get('dose') || '').trim(), times: [...new Set(times)] };
      const id = form.dataset.id;
      if (id) { const m = S.meds.find(x => x.id === id); Object.assign(m, data); delete m.example; closeModal(); toast('Tablet updated'); }
      else { S.meds.push({ id: 'm_' + uid(), active: true, ...data }); toast('Tablet added'); }
    },
    sleep: fd => {
      const e = { date: fd.get('date'), bed: fd.get('bed'), wake: fd.get('wake'), q: Number(fd.get('q')), wakes: Number(fd.get('wakes')) || 0, note: (fd.get('note') || '').trim() };
      S.sleep = S.sleep.filter(x => x.date !== e.date).concat(e);
      toast(`${sleepHours(e).toFixed(1)} hours logged`);
    },
    exercise: fd => {
      const min = Number(fd.get('min'));
      S.exercise.push({ date: fd.get('date') || todayISO(), type: fd.get('type'), min });
      if (fd.get('type') === 'Walking' && min >= 20 && (fd.get('date') || todayISO()) === todayISO()) markHabit('walk');
      if (fd.get('type') === 'Stretching' && (fd.get('date') || todayISO()) === todayISO()) markHabit('stretch');
      toast(`${min} minutes logged`);
    },
    scramble: fd => {
      const s = G.scr, g = (fd.get('guess') || '').trim().toUpperCase();
      if (!g) return false;
      if (g === s.word) {
        s.streak++; s.word = null;
        gameWon('scramble', s.streak, (a, b) => a > b);
        toast('Correct!');
      } else toast('Not quite. Try again or take a hint.');
      drawGame();
      const inp = $('#scr-in'); if (inp) inp.focus();
      return false;
    },
    math: fd => {
      const m = G.math; if (!m.on) return false;
      if (Number(fd.get('a')) === m.ans) m.score++;
      Object.assign(m, newSum());
      $('#mt-q').textContent = m.q; $('#mt-s').textContent = m.score;
      const inp = $('#mt-in'); inp.value = ''; inp.focus();
      return false;
    },
    journal: fd => { const t = todayISO(); const j = S.journal[t] = S.journal[t] || { symptoms: [] }; j.note = (fd.get('note') || '').trim(); toast('Note saved'); },
    weight: fd => { const e = { date: fd.get('date') || todayISO(), kg: Number(fd.get('kg')) }; S.weight = S.weight.filter(w => w.date !== e.date).concat(e); toast('Weight saved'); },
    appt: fd => { S.appts.push({ id: uid(), title: fd.get('title').trim(), date: fd.get('date'), time: fd.get('time') || '' }); toast('Appointment added'); },
    name: fd => { S.names.push({ name: fd.get('name').trim(), g: fd.get('g'), fav: false }); },
    profile: fd => { for (const k of ['name', 'partner', 'doctor', 'doctorPhone', 'hospital', 'hospitalPhone']) S.profile[k] = (fd.get(k) || '').trim(); toast('Saved'); },
  };
  function applyDates(fd) {
    const src = fd.get('src') || 'estimate';
    const p = S.profile;
    if (src === 'lmp' && !fd.get('lmp')) { toast('Pick the date of your last period.'); return; }
    if (src === 'edd' && !fd.get('edd')) { toast('Pick the due date your doctor gave you.'); return; }
    p.dueSource = src;
    if (src === 'estimate') p.estimate = { date: todayISO(), weeks: clamp(Number(fd.get('estW')) || 20, 1, 42), days: clamp(Number(fd.get('estD')) || 0, 0, 6) };
    if (fd.get('lmp')) p.lmp = fd.get('lmp');
    if (fd.get('edd')) p.edd = fd.get('edd');
    if (src === 'report') p.reportId = fd.get('reportId');
  }

  // ---------- Files out ----------
  function downloadFile(name, text, type) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  function downloadICS() {
    const until = dueInfo().edd.replace(/-/g, '') + 'T235900';
    const start = todayISO().replace(/-/g, '');
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Bloom//Pregnancy Journal//EN', 'CALSCALE:GREGORIAN'];
    for (const m of S.meds.filter(x => x.active !== false)) for (const t of m.times) {
      lines.push('BEGIN:VEVENT', `UID:${m.id}-${t.replace(':', '')}@bloom`, `DTSTAMP:${stamp}`, `DTSTART:${start}T${t.replace(':', '')}00`, 'DURATION:PT10M',
        `RRULE:FREQ=DAILY;UNTIL=${until}`, `SUMMARY:Take ${m.name.replace(/[,;]/g, ' ')}`, `DESCRIPTION:${(m.dose || '').replace(/[,;]/g, ' ')}`,
        'BEGIN:VALARM', 'ACTION:DISPLAY', 'TRIGGER:PT0M', `DESCRIPTION:Take ${m.name.replace(/[,;]/g, ' ')}`, 'END:VALARM', 'END:VEVENT');
    }
    lines.push('END:VCALENDAR');
    downloadFile('bloom-tablet-reminders.ics', lines.join('\r\n'), 'text/calendar');
    toast('Open the downloaded file to add reminders to your calendar');
  }

  // ---------- Notifications ----------
  let swReg = null;
  async function notify(title, body) {
    try {
      if (swReg && swReg.showNotification) await swReg.showNotification(title, { body, icon: 'icon.svg', badge: 'icon.svg', tag: title });
      else new Notification(title, { body, icon: 'icon.svg' });
    } catch (e) { toast(title); }
  }
  function reminderTick() {
    const t = todayISO(), now = toMin(nowHM());
    let changed = false;
    // keep only today's sent-notification markers
    for (const d of Object.keys(S.notified)) if (d !== t) { delete S.notified[d]; changed = true; }
    const sent = S.notified[t] = S.notified[t] || {};
    const can = S.profile.notify && 'Notification' in window && Notification.permission === 'granted';
    const fire = (key, title, body) => { if (sent[key]) return; sent[key] = 1; changed = true; if (can) notify(title, body); else if (!document.hidden) toast(title); };
    for (const dz of dosesFor(t)) {
      const m = toMin(dz.t);
      if (!dz.taken && now >= m && now - m <= 90) fire(dz.key, `Time for ${dz.m.name}`, dz.m.dose || 'Tap to open Bloom and mark it taken.');
    }
    if (S.profile.bedtimeReminder && S.profile.bedtime) {
      const b = toMin(S.profile.bedtime);
      if (now >= b - 30 && now < b) fire('bed', 'Time to wind down', 'Screens off, sip water, and lie on your left side.');
    }
    if (S.profile.waterReminder) {
      const h = new Date().getHours();
      if (h >= 9 && h <= 21 && h % 2 === 1 && new Date().getMinutes() < 10) fire('water' + h, 'Drink a glass of water', 'Tap + on your water habit.');
    }
    if (changed) save();
    if (view === 'tablets' || view === 'today') renderTabs();
  }
  function liveTick() {
    if (S.kickActive) $$('[data-live="kick"]').forEach(e => { e.textContent = fmtDur(Date.now() - S.kickActive.start); });
    if (S.contrActive) $$('[data-live="contr"]').forEach(e => { e.textContent = fmtDur(Date.now() - S.contrActive); });
  }

  // ---------- Wiring ----------
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-act]');
    if (!el || el.tagName === 'INPUT') return;
    const fn = A[el.dataset.act];
    if (fn) { e.preventDefault(); fn(el); }
  });
  document.addEventListener('change', e => {
    const el = e.target.closest('[data-act]');
    if (el && CHANGE[el.dataset.act]) CHANGE[el.dataset.act](el);
  });
  document.addEventListener('submit', async e => {
    const form = e.target.closest('form[data-form]');
    if (!form) return;
    e.preventDefault();
    const fn = F[form.dataset.form];
    if (!fn) return;
    const res = await fn(new FormData(form), form);
    if (res === false) return;
    save(); render();
  });
  $('#overlay').addEventListener('click', e => { if (e.target.id === 'overlay') closeModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#overlay').hidden) closeModal(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { reminderTick(); if ((view === 'today' || view === 'tablets') && $('#overlay').hidden) render(); } });

  if (!inFrame && 'serviceWorker' in navigator && /^https?:/.test(location.protocol)) {
    navigator.serviceWorker.register('sw.js').then(r => { swReg = r; }).catch(() => { /* offline support unavailable */ });
  }

  render();
  reminderTick();
  setInterval(reminderTick, 30000);
  setInterval(liveTick, 1000);
})();
