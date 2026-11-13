'use strict';
/* Public municipal portal: information, live transparency data and links into the citizen app. */

const SITE = { info: null, overview: null };
const cat = (id) => SITE.info.categories.find((c) => c.id === id);
const dept = (id) => SITE.info.departments.find((d) => d.id === id);
const svc = (id) => SITE.info.services.find((s) => s.id === id);
const workType = (id) => SITE.info.workTypes.find((w) => w.id === id);
const pct = (v) => (v == null ? '—' : `${v}%`);

const NAV = [
  ['#/', 'navHome'], ['#/services', 'navServices'], ['#/track', 'navTrack'], ['#/works', 'navWorks'],
  ['#/dashboard', 'navDashboard'], ['#/council', 'navCouncil'], ['#/wards', 'navWards'],
  ['#/budget', 'navBudget'], ['#/vision', 'navVision'], ['#/notices', 'navNotices'], ['#/contact', 'navContact'],
];

function isActive(h) {
  const here = (location.hash || '#/').split('?')[0];
  return h === '#/' ? here === '#/' || here === '' : here === h || here.startsWith(h + '/');
}

function siteHeader() {
  const c = SITE.info.contact;
  return el('header', { class: 'site-head' },
    el('div', { class: 'utility' },
      el('div', { class: 'wrap row space' },
        el('span', {}, `${t('helpline')}: `, el('a', { href: `tel:${c.helpline.replace(/[^\d+]/g, '')}` }, c.helpline)),
        el('div', { class: 'row' },
          el('button', { class: 'ghost small', onclick: () => { setLang(S.lang === 'en' ? 'te' : 'en'); render(); } }, t('lang')),
          el('a', { class: 'btn small', href: '/app/' }, t('citizenLogin')),
          el('a', { class: 'btn secondary small light', href: '/office/' }, t('staffLogin'))))),
    el('div', { class: 'wrap brandbar' },
      el('a', { class: 'brand', href: '#/' },
        el('img', { src: '/icon.svg', alt: '', width: 48, height: 48 }),
        el('div', {},
          el('strong', {}, S.lang === 'te' ? SITE.info.municipalityTe : SITE.info.municipality),
          el('small', {}, S.lang === 'te' ? SITE.info.municipality : SITE.info.municipalityTe),
          el('small', { class: 'muted' }, SITE.info.constituency)))),
    el('nav', { class: 'site-nav' }, el('div', { class: 'wrap' },
      NAV.map(([h, k]) => el('a', { href: h, class: isActive(h) ? 'active' : null }, t(k))))));
}

function siteFooter() {
  const c = SITE.info.contact;
  return el('footer', { class: 'site-foot' }, el('div', { class: 'wrap foot-grid' },
    el('div', {}, el('b', {}, SITE.info.municipality), el('p', {}, c.address), el('p', {}, c.hours)),
    el('div', {}, el('b', {}, t('quickLinks')),
      el('p', {}, el('a', { href: '/app/#/c/new' }, t('raise'))), el('p', {}, el('a', { href: '#/track' }, t('navTrack'))),
      el('p', {}, el('a', { href: '/app/#/c/tax' }, t('payTax'))), el('p', {}, el('a', { href: '#/services' }, t('citizenCharter')))),
    el('div', {}, el('b', {}, t('navContact')), el('p', {}, `${t('helpline')}: ${c.helpline}`), el('p', {}, c.email), el('p', {}, `${t('prajaVani')}: ${c.prajaVani}`))),
  el('div', { class: 'wrap foot-note' }, `© ${new Date().getFullYear()} ${SITE.info.municipality} · ${t('poweredBy')}`,
    S.cfg && S.cfg.demo ? el('span', { class: 'pill warn' }, t('demoData')) : null));
}

function sitePage(...content) {
  document.getElementById('app').replaceChildren(siteHeader(), el('main', { class: 'site-main' }, ...content), siteFooter());
  window.scrollTo(0, 0);
}

function sectionHead(title, sub, link) {
  return el('div', { class: 'section-head' }, el('div', {}, el('h2', {}, title), sub ? el('p', { class: 'muted' }, sub) : null), link || null);
}

function asOf() { return el('p', { class: 'muted small asof' }, `${t('liveData')} · ${fmt(SITE.overview.updatedAt)}`); }

// ---------- pages ----------
async function viewHome() {
  const [ann, works] = await Promise.all([api('/api/announcements'), api('/api/public/works')]);
  const o = SITE.overview;
  const c = SITE.info.contact;
  const quick = [
    ['/app/#/c/new', 'raise', 'raiseSub', 'q-complaint'], ['#/track', 'navTrack', 'trackSub', 'q-track'],
    ['/app/#/c/tax', 'payTax', 'payTaxSub', 'q-tax'], ['/app/#/c/apply', 'applyService', 'applyServiceSub', 'q-apply'],
    ['/app/#/c/meet', 'meetHead', 'meetHeadSub', 'q-meet'], ['#/works', 'navWorks', 'worksSub', 'q-works'],
  ];
  sitePage(
    el('section', { class: 'hero-band' }, el('div', { class: 'wrap hero-grid' },
      el('div', {},
        el('p', { class: 'eyebrow' }, t('appName')),
        el('h1', {}, t('heroTitle')),
        el('p', { class: 'lead' }, t('heroLead')),
        el('div', { class: 'row' },
          el('a', { class: 'btn big', href: '/app/#/c/new' }, t('raise')),
          el('a', { class: 'btn big secondary light', href: '#/dashboard' }, t('seeReport')))),
      el('div', { class: 'hero-stats' },
        heroStat(o.complaints.resolved, t('complaintsResolved')),
        heroStat(pct(o.complaints.onTimePct), t('onTime')),
        heroStat(o.complaints.avgRating ? `${o.complaints.avgRating}★` : '—', t('avgRating')),
        heroStat(`${o.works.inProgress + o.works.completed}`, t('worksUnderway'))))),
    el('div', { class: 'wrap' },
      el('section', { class: 'quick-grid' }, quick.map(([href, k, sub, icon]) => el('a', { class: 'quick', href },
        el('span', { class: `qi ${icon}`, 'aria-hidden': 'true' }), el('b', {}, t(k)), el('small', {}, t(sub))))),
      el('div', { class: 'two-col' },
        el('section', { class: 'card message' },
          el('h2', {}, t('headMessageTitle')),
          el('p', {}, t('headMessage')),
          el('p', { class: 'sign' }, el('b', {}, c.head), el('br'), `${SITE.info.headTitle}, ${SITE.info.municipality}`)),
        el('section', { class: 'card' },
          sectionHead(t('hundredDayPlan'), t('hundredDaySub'), el('a', { href: '#/vision' }, t('seeAll'))),
          progressBlock(o.actions['100-day'], t('hundredDayPlan')),
          progressBlock(o.actions['1-year'], t('oneYear')),
          progressBlock(o.actions['5-year'], t('fiveYear')),
          el('div', { class: 'mini-stats' },
            el('div', {}, el('b', {}, `${o.tax.pct}%`), el('small', {}, t('taxCollected'))),
            el('div', {}, el('b', {}, `${o.budget.greenPct}%`), el('small', {}, t('greenBudget'))),
            el('div', {}, el('b', {}, o.meetings.held), el('small', {}, t('councilMeetingsHeld')))))),
      el('section', { class: 'card' }, sectionHead(t('ongoingWorks'), null, el('a', { href: '#/works' }, t('seeAll'))),
        el('div', { class: 'works-grid' }, works.filter((w) => w.status !== 'completed').slice(0, 3).map(workCard))),
      el('section', { class: 'card' }, sectionHead(t('latestNotices'), null, el('a', { href: '#/notices' }, t('seeAll'))),
        ann.slice(0, 4).map(noticeItem))));
}

function heroStat(v, l) { return el('div', { class: 'hstat' }, el('b', {}, v), el('span', {}, l)); }

function progressBlock(p, name) {
  return el('div', { class: 'progress-block' },
    el('div', { class: 'row space' }, el('span', {}, name), el('b', {}, `${p.done} / ${p.total} ${t('done').toLowerCase()}`)),
    bar(p.done, p.total, 'good'));
}

function workCard(w) {
  return el('article', { class: 'work' },
    el('div', { class: 'row space' }, el('span', { class: 'tag' }, label(workType(w.type))), statusPill(w.status)),
    el('h3', {}, w.title),
    el('p', { class: 'muted small' }, `${w.ward ? t('ward') + ' ' + w.ward : t('townWide')} · ${w.scheme}`),
    bar(w.progress, 100, w.status === 'stalled' ? 'bad' : w.status === 'completed' ? 'good' : null),
    el('div', { class: 'row space small' }, el('span', {}, `${w.progress}% ${t('complete')}`), el('span', {}, `${inr(w.spent)} / ${inr(w.sanctioned)}`)),
    w.targetDate ? el('p', { class: 'muted small' }, `${t('targetDate')}: ${fmtDate(w.targetDate)}`) : null);
}

function noticeItem(a) {
  return el('article', { class: 'notice' },
    el('div', { class: 'row' }, el('span', { class: `pill nt-${a.type || 'notice'}` }, t('nt_' + (a.type || 'notice'))), el('small', { class: 'muted' }, `${a.ward ? t('ward') + ' ' + a.ward : t('allWards')} · ${fmtDate(a.createdAt)}`)),
    el('h3', {}, S.lang === 'te' && a.titleTe ? a.titleTe : a.title),
    el('p', {}, a.body));
}

function viewServices() {
  const services = SITE.info.services;
  sitePage(el('div', { class: 'wrap' },
    sectionHead(t('citizenCharter'), t('charterSub')),
    el('section', { class: 'card' }, el('h3', {}, t('onlineServices')),
      el('div', { class: 'table-wrap' }, el('table', {},
        el('tr', {}, el('th', {}, t('service')), el('th', {}, t('department')), el('th', {}, t('deadline')), el('th', {}, t('documents')), el('th', {}, '')),
        services.map((s) => el('tr', {},
          el('td', {}, el('b', {}, label(s))), el('td', {}, label(dept(s.dept))), el('td', {}, `${s.slaDays} ${t('days')}`), el('td', { class: 'small' }, s.docs),
          el('td', {}, s.external ? el('a', { class: 'btn small secondary', href: s.external, target: '_blank', rel: 'noopener' }, t('openPortal'))
            : el('a', { class: 'btn small', href: `/app/#/c/apply/${s.id}` }, t('apply')))))))),
    el('section', { class: 'card' }, el('h3', {}, t('complaintDeadlines')),
      el('p', { class: 'muted small' }, t('escalationRule')),
      el('div', { class: 'table-wrap' }, el('table', {},
        el('tr', {}, el('th', {}, t('category')), el('th', {}, t('department')), el('th', {}, t('resolveWithin'))),
        SITE.info.categories.map((c) => el('tr', {}, el('td', {}, label(c)), el('td', {}, label(dept(c.dept))), el('td', {}, c.sla < 48 ? `${c.sla} ${t('hours')}` : `${c.sla / 24} ${t('days')}`)))))),
    el('p', { class: 'muted small' }, t('charterNote'))));
}

function viewTrack() {
  const out = el('div');
  const q = new URLSearchParams((location.hash.split('?')[1] || ''));
  const form = el('form', {
    class: 'row track-form',
    onsubmit: act(async (e) => {
      const no = formData(e.target).no.trim();
      const r = await api(`/api/public/track/${encodeURIComponent(no)}`);
      const what = r.kind === 'complaint' ? label(cat(r.category)) : label(svc(r.service));
      out.replaceChildren(el('section', { class: 'card' },
        el('div', { class: 'row space' }, el('h3', {}, what), statusPill(r.status)),
        el('dl', { class: 'facts' },
          el('dt', {}, t('number')), el('dd', {}, r.number),
          el('dt', {}, t('department')), el('dd', {}, label(dept(r.department))),
          el('dt', {}, t('ward')), el('dd', {}, String(r.ward)),
          el('dt', {}, t('registered')), el('dd', {}, fmt(r.createdAt)),
          el('dt', {}, t('due')), el('dd', { class: r.overdue ? 'bad-text' : null }, fmt(r.dueAt), r.overdue ? ` · ${t('overdue')}` : ''),
          r.assignedName ? [el('dt', {}, t('assigned')), el('dd', {}, r.assignedName)] : null),
        r.escalation ? el('p', { class: 'pill warn' }, `${t('escalated')} ${r.escalation === 2 ? t('toChair') : t('toCommissioner')}`) : null,
        el('ol', { class: 'timeline' }, r.history.slice().reverse().map((x) => el('li', {}, statusPill(x.status), el('div', {}, el('p', {}, x.remark), el('small', { class: 'muted' }, `${x.by} · ${fmt(x.at)}`)))))));
    }),
  }, el('input', { name: 'no', required: true, placeholder: 'PS-2026-000001 / SR-2026-000001', value: q.get('no') || '' }), el('button', { class: 'btn' }, t('search')));
  sitePage(el('div', { class: 'wrap narrow-wrap' }, sectionHead(t('navTrack'), t('trackHint')), el('section', { class: 'card' }, form), out));
  if (q.get('no')) form.requestSubmit();
}

async function viewWorks() {
  const works = await api('/api/public/works');
  const q = new URLSearchParams((location.hash.split('?')[1] || ''));
  const status = q.get('status') || '';
  const shown = works.filter((w) => !status || w.status === status);
  const o = SITE.overview.works;
  sitePage(el('div', { class: 'wrap' },
    sectionHead(t('navWorks'), t('worksIntro')),
    el('div', { class: 'stats' },
      stat(o.total, t('totalWorks')), stat(o.inProgress, t('s_in_progress')), stat(o.completed, t('s_completed')),
      stat(o.stalled, t('s_stalled'), o.stalled ? 'bad' : ''), stat(inr(o.sanctioned), t('sanctioned')), stat(inr(o.spent), t('spent'))),
    el('div', { class: 'chips' }, ['', 'in_progress', 'tendered', 'sanctioned', 'completed', 'stalled'].map((s) =>
      el('a', { class: `chip ${s === status ? 'active' : ''}`, href: s ? `#/works?status=${s}` : '#/works' }, s ? t('s_' + s) : t('all')))),
    shown.length ? el('div', { class: 'works-grid' }, shown.map(workCard)) : empty()));
}

async function viewDashboard() {
  const o = SITE.overview;
  const depts = Object.entries(o.complaints.byDepartment).sort((a, b) => b[1].total - a[1].total);
  const maxD = Math.max(1, ...depts.map(([, v]) => v.total));
  const wardMap = o.complaints.byWard;
  sitePage(el('div', { class: 'wrap' },
    sectionHead(t('navDashboard'), t('dashboardIntro')), asOf(),
    el('section', { class: 'card' }, el('h3', {}, t('scorecard')),
      el('div', { class: 'kpi-grid' }, o.kpis.map((k) => el('div', { class: `kpi ${k.rating}` },
        el('small', {}, label(k)), el('b', {}, kpiValue(k)),
        el('span', {}, `${t('target')}: ${k.targetToDate}${k.unit === '/5' ? ' / 5' : k.unit}`))))),
    el('div', { class: 'two-col' },
      el('section', { class: 'card' }, el('h3', {}, t('complaintsByDept')),
        depts.map(([k, v]) => el('div', { class: 'hbar' },
          el('div', { class: 'row space small' }, el('span', {}, label(dept(k))), el('span', {}, `${v.resolved}/${v.total} ${t('resolved').toLowerCase()}${v.overdue ? ` · ${v.overdue} ${t('overdue').toLowerCase()}` : ''}`)),
          bar(v.total, maxD)))),
      el('section', { class: 'card' }, el('h3', {}, t('openByWard')),
        el('div', { class: 'heat' }, SITE.info && Array.from({ length: SITE.info.wards }, (_, i) => i + 1).map((w) => {
          const v = wardMap[w] || { open: 0, total: 0 };
          const level = v.open === 0 ? 0 : v.open < 2 ? 1 : v.open < 4 ? 2 : 3;
          return el('a', { class: `heat-cell h${level}`, href: `#/wards/${w}`, title: `${t('ward')} ${w}: ${v.open} ${t('open')}` }, el('b', {}, w), el('small', {}, v.open));
        })),
        el('p', { class: 'muted small' }, t('heatLegend')))),
    el('div', { class: 'two-col' },
      el('section', { class: 'card' }, el('h3', {}, t('taxByWard')),
        el('p', { class: 'muted small' }, `${t('taxCollected')}: ${inr(o.tax.collected)} / ${inr(o.tax.demand)} (${o.tax.pct}%)`),
        el('div', { class: 'ward-bars' }, o.tax.byWard.map((w) => el('div', { class: 'hbar' }, el('div', { class: 'row space small' }, el('span', {}, `${t('ward')} ${w.ward}`), el('span', {}, `${w.demand ? Math.round((w.paid / w.demand) * 100) : 0}%`)), bar(w.paid, w.demand, 'good'))))),
      el('section', { class: 'card' }, el('h3', {}, t('serviceSummary')),
        el('div', { class: 'stats' },
          stat(o.complaints.total, t('complaintsReceived')), stat(o.complaints.open, t('open')), stat(o.complaints.overdue, t('overdue'), o.complaints.overdue ? 'bad' : ''),
          stat(o.complaints.avgHours ?? '—', t('avgHours')), stat(o.applications.total, t('applicationsReceived')), stat(o.applications.issued, t('applicationsIssued'))),
        el('a', { class: 'btn secondary', href: '#/budget' }, t('navBudget')), ' ', el('a', { class: 'btn secondary', href: '#/vision' }, t('navVision'))))));
}

async function viewCouncil() {
  const meetings = await api('/api/public/meetings');
  const upcoming = meetings.filter((m) => m.status === 'scheduled').sort((a, b) => a.date.localeCompare(b.date));
  const past = meetings.filter((m) => m.status !== 'scheduled');
  const card = (m) => el('article', { class: 'card meeting' },
    el('div', { class: 'row space' }, el('h3', {}, `${t('mt_' + m.type)} · ${fmt(m.date)}`), statusPill(m.status)),
    el('p', { class: 'muted small' }, m.venue),
    el('h4', {}, t('agenda')), el('ol', {}, m.agenda.map((a) => el('li', {}, a))),
    m.minutes ? [el('h4', {}, t('minutes')), el('p', {}, m.minutes)] : null,
    m.resolutions.length ? [el('h4', {}, t('resolutions')), el('div', { class: 'table-wrap' }, el('table', {},
      el('tr', {}, el('th', {}, 'No.'), el('th', {}, t('subject')), el('th', {}, t('decision'))),
      m.resolutions.map((r) => el('tr', {}, el('td', {}, r.no), el('td', {}, r.subject), el('td', {}, statusPill(r.decision))))))] : null);
  sitePage(el('div', { class: 'wrap' },
    sectionHead(t('navCouncil'), t('councilIntro')),
    el('h2', { class: 'section-title' }, t('upcoming')), upcoming.length ? upcoming.map(card) : el('section', { class: 'card' }, empty()),
    el('h2', { class: 'section-title' }, t('pastMeetings')), past.length ? past.map(card) : el('section', { class: 'card' }, empty())));
}

async function viewWards() {
  const wards = await api('/api/public/wards');
  sitePage(el('div', { class: 'wrap' },
    sectionHead(t('navWards'), t('wardsIntro')),
    el('div', { class: 'ward-cards' }, wards.map((w) => el('a', { class: 'ward-card', href: `#/wards/${w.ward}` },
      el('div', { class: 'row space' }, el('b', {}, `${t('ward')} ${w.ward}`), w.openComplaints ? el('span', { class: 'pill warn' }, `${w.openComplaints} ${t('open')}`) : el('span', { class: 'pill st-resolved' }, t('allClear'))),
      el('small', { class: 'muted' }, w.locality || ''),
      el('span', {}, `${t('councillor')}: ${w.councillor || t('toBeUpdated')}`),
      el('small', {}, `${w.committeeMembers} ${t('committeeMembersShort')} · ${w.works} ${t('works').toLowerCase()}`))))));
}

async function viewWard(n) {
  const w = await api(`/api/public/wards/${n}`);
  sitePage(el('div', { class: 'wrap' },
    el('a', { href: '#/wards' }, '← ' + t('navWards')),
    sectionHead(`${t('ward')} ${w.ward}${w.locality ? ' · ' + w.locality : ''}`, `${t('councillor')}: ${w.councillor || t('toBeUpdated')} · ${t('wardOfficer')}: ${w.wardOfficer || t('toBeUpdated')}`,
      el('a', { class: 'btn', href: '/app/#/c/new' }, t('raise'))),
    el('div', { class: 'stats' }, stat(w.stats.total, t('complaintsReceived')), stat(w.stats.open, t('open')), stat(w.stats.resolved, t('resolved')),
      stat(pct(w.stats.onTimePct), t('onTime')), stat(w.stats.avgRating ?? '—', t('avgRating'))),
    el('section', { class: 'card' }, el('h3', {}, t('wardCommittees')),
      el('div', { class: 'committee-grid' }, w.committees.map((c) => el('div', { class: 'committee' }, el('h4', {}, label(c)),
        c.members.length ? el('ul', {}, c.members.map((m) => el('li', {}, m))) : el('p', { class: 'muted small' }, t('notFormedYet'))))),
      w.committeeMeetings.length ? [el('h4', {}, t('committeeMeetings')), w.committeeMeetings.map((m) => el('p', { class: 'small' }, el('b', {}, `${fmtDate(m.date)} (${m.attendees}): `), `${m.issues}${m.actions ? ' → ' + m.actions : ''}`))] : null),
    w.worksList.length ? el('section', { class: 'card' }, el('h3', {}, t('navWorks')), el('div', { class: 'works-grid' }, w.worksList.map(workCard))) : null,
    w.notices.length ? el('section', { class: 'card' }, el('h3', {}, t('navNotices')), w.notices.map(noticeItem)) : null));
}

async function viewBudget() {
  const b = await api('/api/public/budget');
  const max = Math.max(1, ...b.heads.map((h) => h.allocated));
  sitePage(el('div', { class: 'wrap' },
    sectionHead(t('navBudget'), t('budgetIntro')),
    el('div', { class: 'stats' }, stat(inr(b.allocated), t('allocated')), stat(inr(b.spent), t('spent')),
      stat(`${b.allocated ? Math.round((b.spent / b.allocated) * 100) : 0}%`, t('utilisation')), stat(`${b.greenPct}%`, t('greenBudget'), b.greenPct >= 10 ? 'good' : 'bad')),
    el('section', { class: 'card' }, el('h3', {}, t('budgetHeads')),
      b.heads.map((h) => el('div', { class: 'budget-row' },
        el('div', { class: 'row space small' }, el('span', {}, label(h), h.green ? el('span', { class: 'pill good' }, t('green')) : null), el('span', {}, `${inr(h.spent)} ${t('of')} ${inr(h.allocated)}`)),
        el('div', { class: 'stack' }, (() => { const a = el('i', { class: `alloc ${h.green ? 'g' : ''}` }); a.style.width = `${(h.allocated / max) * 100}%`; const s = el('i', { class: 'spent' }); s.style.width = `${h.allocated ? (h.spent / h.allocated) * 100 : 0}%`; a.append(s); return a; })()))),
      el('p', { class: 'muted small' }, t('budgetLegend')))));
}

async function viewVision() {
  const actions = await api('/api/public/actions');
  const groups = [['100-day', 'hundredDayPlan'], ['1-year', 'oneYear'], ['5-year', 'fiveYear']];
  sitePage(el('div', { class: 'wrap' },
    sectionHead(t('navVision'), t('visionIntro')),
    el('div', { class: 'pillars' }, [['p1', 'pillar1', 'pillar1Sub'], ['p2', 'pillar2', 'pillar2Sub'], ['p3', 'pillar3', 'pillar3Sub'], ['p4', 'pillar4', 'pillar4Sub']].map(([c, k, s]) =>
      el('div', { class: `pillar ${c}` }, el('b', {}, t(k)), el('small', {}, t(s))))),
    groups.map(([h, k]) => {
      const items = actions.filter((a) => a.horizon === h);
      return el('section', { class: 'card' },
        el('div', { class: 'row space' }, el('h3', {}, t(k)), el('span', { class: 'muted' }, `${items.filter((a) => a.status === 'done').length} / ${items.length} ${t('done').toLowerCase()}`)),
        bar(items.filter((a) => a.status === 'done').length, items.length, 'good'),
        el('ul', { class: 'checklist' }, items.map((a) => el('li', { class: a.status },
          el('span', { class: 'tick', 'aria-hidden': 'true' }), el('div', {}, el('b', {}, a.title), el('small', { class: 'muted' }, `${a.owner} · ${t('due')} ${fmtDate(a.dueDate)}`)), statusPill(a.status)))));
    })));
}

async function viewNotices() {
  const ann = await api('/api/announcements');
  sitePage(el('div', { class: 'wrap narrow-wrap' }, sectionHead(t('navNotices'), t('noticesIntro')), el('section', { class: 'card' }, ann.length ? ann.map(noticeItem) : empty())));
}

function viewContact() {
  const c = SITE.info.contact;
  sitePage(el('div', { class: 'wrap' },
    sectionHead(t('navContact'), null),
    el('div', { class: 'two-col' },
      el('section', { class: 'card' }, el('h3', {}, t('municipalOffice')),
        el('dl', { class: 'facts' },
          el('dt', {}, t('address')), el('dd', {}, c.address),
          el('dt', {}, t('officeHours')), el('dd', {}, c.hours),
          el('dt', {}, t('helpline')), el('dd', {}, el('a', { href: `tel:${c.helpline.replace(/[^\d+]/g, '')}` }, c.helpline)),
          el('dt', {}, 'Email'), el('dd', {}, el('a', { href: `mailto:${c.email}` }, c.email)),
          el('dt', {}, t('prajaVani')), el('dd', {}, c.prajaVani))),
      el('section', { class: 'card' }, el('h3', {}, t('whoToContact')),
        el('dl', { class: 'facts' },
          el('dt', {}, SITE.info.headTitle), el('dd', {}, c.head),
          el('dt', {}, t('commissioner')), el('dd', {}, c.commissioner)),
        el('p', {}, t('contactHint')),
        el('a', { class: 'btn', href: '/app/#/c/meet' }, t('meetHead')))),
    el('section', { class: 'card' }, el('h3', {}, t('departments')),
      el('div', { class: 'dept-grid' }, SITE.info.departments.map((d) => el('div', { class: 'dept' }, el('b', {}, label(d)),
        el('small', { class: 'muted' }, SITE.info.categories.filter((x) => x.dept === d.id).map((x) => label(x)).join(', '))))))));
}

// ---------- router ----------
async function render() {
  const h = (location.hash || '#/').split('?')[0];
  let r;
  try {
    SITE.overview = await api('/api/public/overview');
    if (h === '#/' || h === '') return await viewHome();
    if (h === '#/services') return viewServices();
    if (h === '#/track') return viewTrack();
    if (h === '#/works') return await viewWorks();
    if (h === '#/dashboard') return await viewDashboard();
    if (h === '#/council') return await viewCouncil();
    if (h === '#/wards') return await viewWards();
    if ((r = /^#\/wards\/(\d+)$/.exec(h))) return await viewWard(r[1]);
    if (h === '#/budget') return await viewBudget();
    if (h === '#/vision') return await viewVision();
    if (h === '#/notices') return await viewNotices();
    if (h === '#/contact') return viewContact();
    location.hash = '#/';
  } catch (err) {
    sitePage(el('div', { class: 'wrap' }, el('section', { class: 'card' }, el('p', { class: 'bad-text' }, err.message), el('a', { href: '#/' }, t('navHome')))));
  }
}

(async function start() {
  try {
    [SITE.info, S.cfg] = await Promise.all([api('/api/public/site'), api('/api/config')]);
  } catch {
    document.getElementById('app').replaceChildren(el('p', { class: 'card' }, 'Cannot reach the server. Check your connection and reload.'));
    return;
  }
  document.documentElement.lang = S.lang;
  document.title = `${SITE.info.municipality} · ${t('appName')}`;
  window.addEventListener('hashchange', render);
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
  render();
})();
