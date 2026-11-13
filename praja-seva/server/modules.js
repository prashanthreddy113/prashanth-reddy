'use strict';

// Routes for the governance modules: service applications, development works,
// council meetings, ward committees, field inspections, wards, budget, KPIs,
// public portal data, walk-in complaints, CSV export and the review report.

const cfg = require('./config');

const HOUR = 36e5;
const DAY = 24 * HOUR;

module.exports = function registerModules(ctx) {
  const { route, store, HttpError, bad, str, wardOf, oneOf, mobileOf, newId, enrich, stats, STAFF, LEAD } = ctx;
  const d = () => store.data;
  const now = () => new Date();
  const notFound = () => new HttpError(404, 'Not found');
  const money = (v, field) => {
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0 || n > 1e11) throw bad(`${field} must be a positive amount`);
    return Math.round(n);
  };
  const dateOf = (v, field, required = true) => {
    const s = str(v, field, { max: 25, required });
    if (s && Number.isNaN(Date.parse(s))) throw bad(`${field} is not a valid date`);
    return s;
  };
  const year = () => new Date().getFullYear();

  // ---------- helpers shared by public and staff views ----------
  function appView(a, t = Date.now()) {
    const open = cfg.APP_OPEN.includes(a.status);
    const overdueDays = open && t > Date.parse(a.dueAt) ? Math.floor((t - Date.parse(a.dueAt)) / DAY) : 0;
    return { ...a, overdue: overdueDays > 0, overdueDays };
  }
  const canSeeApp = (user, a) => {
    if (user.role === 'citizen') return a.citizenId === user.id;
    if (cfg.LEADERSHIP.includes(user.role)) return true;
    if (user.role === 'officer') return a.department === user.department;
    if (user.role === 'ward_officer') return a.ward === user.ward;
    return false;
  };
  const publicHistory = (h) => h.map((x) => ({ at: x.at, status: x.status, remark: x.remark, by: x.role === 'citizen' ? 'Citizen' : x.by }));

  function computedKpis() {
    const s = stats(d().grievances);
    const demand = d().properties.reduce((a, p) => a + p.annualTax + p.arrears, 0);
    const paid = d().properties.reduce((a, p) => a + p.payments.reduce((x, y) => x + y.amount, 0), 0);
    const held = d().meetings.filter((m) => m.status === 'held' && new Date(m.date).getFullYear() === year()).length;
    const auto = {
      complaints_on_time: s.resolvedOnTimePct,
      citizen_rating: s.avgRating,
      tax_collection: demand ? Math.round((paid / demand) * 100) : null,
      council_meetings: held,
    };
    return cfg.KPIS.map((k) => {
      let value = auto[k.id] ?? null, month = null, previous = null;
      if (k.source === 'manual') {
        const entries = d().kpiEntries.filter((e) => e.kpi === k.id).sort((a, b) => b.month.localeCompare(a.month));
        if (entries[0]) { value = entries[0].value; month = entries[0].month; }
        if (entries[1]) previous = entries[1].value;
      }
      // council_meetings is a yearly count: judge it against the share of the year gone.
      const target = k.id === 'council_meetings' ? Math.max(1, Math.ceil((k.target * (new Date().getMonth() + 1)) / 12)) : k.target;
      const ratio = value == null ? null : value / target;
      const rating = ratio == null ? 'none' : ratio >= 1 ? 'good' : ratio >= 0.85 ? 'warning' : 'critical';
      return { ...k, value, month, previous, targetToDate: target, rating };
    });
  }

  function worksSummary() {
    const w = d().works;
    return {
      total: w.length,
      inProgress: w.filter((x) => x.status === 'in_progress').length,
      completed: w.filter((x) => x.status === 'completed').length,
      stalled: w.filter((x) => x.status === 'stalled').length,
      sanctioned: w.reduce((a, x) => a + x.sanctioned, 0),
      spent: w.reduce((a, x) => a + x.spent, 0),
    };
  }

  function budgetSummary() {
    const b = d().budget;
    const allocated = b.reduce((a, x) => a + x.allocated, 0);
    const spent = b.reduce((a, x) => a + x.spent, 0);
    const green = b.filter((x) => x.green).reduce((a, x) => a + x.allocated, 0);
    return { heads: b, allocated, spent, green, greenPct: allocated ? Math.round((green / allocated) * 1000) / 10 : 0 };
  }

  function taxSummary() {
    const props = d().properties;
    const demand = props.reduce((a, p) => a + p.annualTax + p.arrears, 0);
    const collected = props.reduce((a, p) => a + p.payments.reduce((x, y) => x + y.amount, 0), 0);
    const byWard = {};
    for (const p of props) {
      const w = (byWard[p.ward] = byWard[p.ward] || { ward: p.ward, demand: 0, paid: 0 });
      w.demand += p.annualTax + p.arrears; w.paid += p.payments.reduce((x, y) => x + y.amount, 0);
    }
    return { demand, collected, pct: demand ? Math.round((collected / demand) * 100) : 0, byWard: Object.values(byWard).sort((a, b) => a.ward - b.ward) };
  }

  const actionsSummary = () => {
    const a = d().actions;
    const by = (h) => ({ total: a.filter((x) => x.horizon === h).length, done: a.filter((x) => x.horizon === h && x.status === 'done').length });
    return { total: a.length, done: a.filter((x) => x.status === 'done').length, inProgress: a.filter((x) => x.status === 'in_progress').length, '100-day': by('100-day'), '1-year': by('1-year'), '5-year': by('5-year') };
  };

  const wardView = (w) => {
    const officer = w.wardOfficerId ? d().users.find((u) => u.id === w.wardOfficerId) : null;
    const g = d().grievances.filter((x) => x.ward === w.ward);
    return {
      ward: w.ward, councillor: w.councillor, locality: w.locality, wardOfficer: officer ? officer.name : null,
      openComplaints: g.filter((x) => cfg.OPEN_STATUSES.includes(x.status)).length,
      resolvedComplaints: g.filter((x) => x.status === 'resolved').length,
      committeeMembers: d().committeeMembers.filter((m) => m.ward === w.ward).length,
      works: d().works.filter((x) => x.ward === w.ward).length,
    };
  };

  // ---------- public portal ----------
  route('GET', '/api/public/site', null, () => ({
    municipality: cfg.MUNICIPALITY_NAME, municipalityTe: cfg.MUNICIPALITY_NAME_TE, constituency: cfg.CONSTITUENCY,
    headTitle: cfg.HEAD_TITLE, contact: cfg.CONTACT, wards: cfg.WARDS.length,
    services: cfg.SERVICES, categories: cfg.CATEGORIES, departments: cfg.DEPARTMENTS, workTypes: cfg.WORK_TYPES,
    committeeTypes: cfg.COMMITTEE_TYPES,
  }));

  route('GET', '/api/public/overview', null, () => {
    const s = stats(d().grievances);
    const apps = d().applications;
    return {
      complaints: { total: s.total, open: s.open, resolved: s.resolved, overdue: s.overdue, onTimePct: s.resolvedOnTimePct, avgRating: s.avgRating, avgHours: s.avgResolutionHours, byDepartment: s.byDepartment, byWard: s.byWard },
      applications: { total: apps.length, open: apps.filter((a) => cfg.APP_OPEN.includes(a.status)).length, issued: apps.filter((a) => ['issued', 'approved'].includes(a.status)).length },
      tax: taxSummary(), works: worksSummary(), budget: budgetSummary(), actions: actionsSummary(), kpis: computedKpis(),
      meetings: { held: d().meetings.filter((m) => m.status === 'held').length, resolutions: d().meetings.reduce((a, m) => a + m.resolutions.length, 0) },
      updatedAt: now().toISOString(),
    };
  });

  route('GET', '/api/public/works', null, () => d().works.filter((w) => w.public)
    .map(({ contractor, ...w }) => ({ ...w, contractor: contractor || '' }))
    .sort((a, b) => WORK_ORDER(a) - WORK_ORDER(b) || b.updatedAt.localeCompare(a.updatedAt)));
  const WORK_ORDER = (w) => ['in_progress', 'stalled', 'tendered', 'sanctioned', 'proposed', 'completed'].indexOf(w.status);

  route('GET', '/api/public/meetings', null, () => d().meetings.filter((m) => m.published)
    .map(({ attendance, ...m }) => m).sort((a, b) => b.date.localeCompare(a.date)));

  route('GET', '/api/public/wards', null, () => d().wards.map(wardView));

  route('GET', '/api/public/wards/:n', null, ({ params }) => {
    const w = d().wards.find((x) => x.ward === Number(params.n));
    if (!w) throw notFound();
    return {
      ...wardView(w),
      committees: cfg.COMMITTEE_TYPES.map((t) => ({ ...t, members: d().committeeMembers.filter((m) => m.ward === w.ward && m.type === t.id).map((m) => m.name) })),
      committeeMeetings: d().committeeMeetings.filter((m) => m.ward === w.ward).sort((a, b) => b.date.localeCompare(a.date)).map(({ by, ...m }) => m),
      worksList: d().works.filter((x) => x.ward === w.ward && x.public),
      notices: d().announcements.filter((a) => a.ward === w.ward),
      stats: (() => { const s = stats(d().grievances.filter((g) => g.ward === w.ward)); return { total: s.total, open: s.open, resolved: s.resolved, onTimePct: s.resolvedOnTimePct, avgRating: s.avgRating, byCategory: s.byCategory }; })(),
    };
  });

  route('GET', '/api/public/budget', null, () => budgetSummary());
  route('GET', '/api/public/actions', null, () => d().actions);
  route('GET', '/api/public/kpis', null, () => computedKpis());

  // Track a complaint (PS-…) or service application (SR-…) by its number, without login.
  route('GET', '/api/public/track/:number', null, ({ params }) => {
    const no = params.number.trim().toUpperCase();
    const g = d().grievances.find((x) => x.number === no);
    if (g) {
      const e = enrich(g);
      return { kind: 'complaint', number: e.number, category: e.category, department: e.department, ward: e.ward, status: e.status, createdAt: e.createdAt, dueAt: e.dueAt, overdue: e.overdue, escalation: e.escalation, assignedName: e.assignedName, history: publicHistory(e.history) };
    }
    const a = d().applications.find((x) => x.number === no);
    if (a) {
      const v = appView(a);
      return { kind: 'application', number: v.number, service: v.service, department: v.department, ward: v.ward, status: v.status, createdAt: v.createdAt, dueAt: v.dueAt, overdue: v.overdue, history: publicHistory(v.history) };
    }
    throw new HttpError(404, 'No complaint or application found with that number');
  });

  // ---------- service applications ----------
  route('POST', '/api/applications', ['citizen'], ({ user, body }) => {
    const s = cfg.serviceById(body.service);
    if (!s || s.external) throw bad('Choose a service that can be applied for here');
    const t = now();
    const a = {
      id: newId(), number: `SR-${t.getFullYear()}-${String(store.nextSeq('application')).padStart(6, '0')}`,
      service: s.id, department: s.dept, citizenId: user.id, name: user.name, mobile: user.mobile, ward: wardOf(body.ward),
      details: str(body.details, 'Details', { min: 5, max: 2000 }), status: 'received',
      createdAt: t.toISOString(), updatedAt: t.toISOString(), dueAt: new Date(t.getTime() + s.slaDays * DAY).toISOString(),
      history: [{ at: t.toISOString(), by: user.name, role: 'citizen', status: 'received', remark: 'Application submitted online' }],
    };
    d().applications.push(a);
    store.audit(user, 'application.create', a.number);
    store.save();
    return appView(a);
  });

  route('GET', '/api/applications/mine', ['citizen'], ({ user }) =>
    d().applications.filter((a) => a.citizenId === user.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((a) => appView(a)));

  route('GET', '/api/applications/:id', [], ({ user, params }) => {
    const a = d().applications.find((x) => x.id === params.id || x.number === params.id);
    if (!a || !canSeeApp(user, a)) throw notFound();
    return appView(a);
  });

  route('GET', '/api/staff/applications', STAFF, ({ user, query }) => {
    let list = d().applications.filter((a) => canSeeApp(user, a)).map((a) => appView(a));
    if (query.status === 'open') list = list.filter((a) => cfg.APP_OPEN.includes(a.status));
    else if (query.status) list = list.filter((a) => a.status === query.status);
    if (query.service) list = list.filter((a) => a.service === query.service);
    return list.sort((a, b) => b.overdueDays - a.overdueDays || b.createdAt.localeCompare(a.createdAt));
  });

  route('POST', '/api/staff/applications/:id/status', STAFF, ({ user, params, body }) => {
    const a = d().applications.find((x) => x.id === params.id);
    if (!a || !canSeeApp(user, a)) throw notFound();
    if (!cfg.APP_OPEN.includes(a.status)) throw bad('Application is already closed');
    const status = oneOf(body.status, ['verification', 'approved', 'issued', 'rejected'], 'status');
    const remark = str(body.remark, 'Remark', { min: status === 'rejected' ? 5 : 0, max: 1000, required: status === 'rejected' });
    const t = now().toISOString();
    a.status = status; a.updatedAt = t;
    a.history.push({ at: t, by: user.name, role: user.role, status, remark: remark || ({ verification: 'Under field verification', approved: 'Approved', issued: 'Issued to applicant' })[status] });
    store.audit(user, `application.${status}`, a.number);
    store.save();
    return appView(a);
  });

  // ---------- walk-in / phone complaints (Praja Vani day, helpline) ----------
  route('POST', '/api/staff/grievances', STAFF, ({ user, body }) => {
    const c = cfg.categoryById(body.category);
    if (!c) throw bad('Choose a complaint type');
    const mobile = mobileOf(body.mobile);
    const name = str(body.name, 'Citizen name', { min: 2, max: 80 });
    let citizen = d().users.find((u) => u.role === 'citizen' && u.mobile === mobile);
    if (!citizen) {
      citizen = { id: newId(), role: 'citizen', name, mobile, ward: null, active: true, createdAt: now().toISOString() };
      d().users.push(citizen);
    }
    const ward = wardOf(body.ward);
    const t = now();
    const source = oneOf(body.source || 'praja_vani', ['praja_vani', 'helpline', 'field_visit', 'ward_committee'], 'source');
    const g = {
      id: newId(), number: `PS-${t.getFullYear()}-${String(store.nextSeq('grievance')).padStart(6, '0')}`,
      citizenId: citizen.id, citizenName: name, citizenMobile: mobile, category: c.id, department: c.dept, ward,
      location: str(body.location, 'Location', { min: 3, max: 300 }), lat: null, lng: null,
      description: str(body.description, 'Description', { min: 10, max: 2000 }), hasPhoto: false, source,
      status: 'submitted', assignedTo: null, createdAt: t.toISOString(), updatedAt: t.toISOString(),
      dueAt: new Date(t.getTime() + c.sla * HOUR).toISOString(), resolvedAt: null, feedback: null, reopenCount: 0,
      history: [{ at: t.toISOString(), by: user.name, role: user.role, status: 'submitted', remark: `Registered at ${source.replace('_', ' ')} on behalf of the citizen` }],
    };
    d().grievances.push(g);
    store.audit(user, 'grievance.walkin', g.number);
    store.save();
    return enrich(g);
  });

  // ---------- development works ----------
  const workFields = (body, w = {}) => {
    if (body.title !== undefined) w.title = str(body.title, 'Title', { min: 5, max: 200 });
    if (body.type !== undefined) w.type = oneOf(body.type, cfg.WORK_TYPES.map((x) => x.id), 'work type');
    if (body.ward !== undefined) w.ward = body.ward === '' || body.ward === null ? null : wardOf(body.ward);
    if (body.scheme !== undefined) w.scheme = oneOf(body.scheme, cfg.SCHEMES, 'scheme');
    if (body.sanctioned !== undefined) w.sanctioned = money(body.sanctioned, 'Sanctioned amount');
    if (body.spent !== undefined) w.spent = money(body.spent, 'Amount spent');
    if (body.status !== undefined) w.status = oneOf(body.status, cfg.WORK_STATUSES, 'status');
    if (body.progress !== undefined) {
      const p = Number(body.progress);
      if (!Number.isInteger(p) || p < 0 || p > 100) throw bad('Progress must be 0 to 100');
      w.progress = p;
    }
    if (body.contractor !== undefined) w.contractor = str(body.contractor, 'Contractor', { max: 120, required: false });
    if (body.startDate !== undefined) w.startDate = dateOf(body.startDate, 'Start date', false);
    if (body.targetDate !== undefined) w.targetDate = dateOf(body.targetDate, 'Target date', false);
    if (body.public !== undefined) w.public = Boolean(body.public);
    return w;
  };

  route('GET', '/api/staff/works', STAFF, () => d().works.slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));

  route('POST', '/api/staff/works', LEAD, ({ user, body }) => {
    const t = now().toISOString();
    const w = workFields({ type: 'roads', scheme: 'General funds', sanctioned: 0, spent: 0, status: 'proposed', progress: 0, contractor: '', startDate: '', targetDate: '', public: true, ...body });
    Object.assign(w, { id: newId(), ward: w.ward ?? null, updates: [{ at: t, by: user.name, note: 'Work added', progress: w.progress }], createdAt: t, updatedAt: t });
    d().works.push(w);
    store.audit(user, 'work.create', w.title);
    store.save();
    return w;
  });

  route('PATCH', '/api/staff/works/:id', ['chairperson', 'commissioner', 'officer'], ({ user, params, body }) => {
    const w = d().works.find((x) => x.id === params.id);
    if (!w) throw notFound();
    // Officers may update progress and status only; money and scope stay with leadership.
    const allowed = cfg.LEADERSHIP.includes(user.role) ? body : { status: body.status, progress: body.progress, note: body.note };
    for (const k of Object.keys(allowed)) if (allowed[k] === undefined) delete allowed[k];
    workFields(allowed, w);
    const note = str(body.note, 'Update note', { max: 500, required: false });
    w.updatedAt = now().toISOString();
    w.updates.push({ at: w.updatedAt, by: user.name, note: note || `Updated: ${w.status}, ${w.progress}%`, progress: w.progress });
    store.audit(user, 'work.update', `${w.title} -> ${w.status} ${w.progress}%`);
    store.save();
    return w;
  });

  // ---------- council meetings & resolutions ----------
  route('GET', '/api/staff/meetings', STAFF, () => d().meetings.slice().sort((a, b) => b.date.localeCompare(a.date)));

  route('POST', '/api/staff/meetings', LEAD, ({ user, body }) => {
    const agenda = String(body.agenda || '').split('\n').map((s) => s.trim()).filter(Boolean);
    if (!agenda.length) throw bad('Add at least one agenda item (one per line)');
    if (agenda.length > 40 || agenda.some((a) => a.length > 300)) throw bad('Agenda is too long');
    const m = {
      id: newId(), type: oneOf(body.type || 'council', ['council', 'special', 'standing'], 'meeting type'),
      date: dateOf(body.date, 'Date and time'), venue: str(body.venue, 'Venue', { max: 120, required: false }) || 'Council Hall',
      agenda, status: 'scheduled', minutes: '', resolutions: [], published: Boolean(body.published ?? true), createdAt: now().toISOString(),
    };
    d().meetings.push(m);
    store.audit(user, 'meeting.create', `${m.type} ${m.date}`);
    store.save();
    return m;
  });

  route('PATCH', '/api/staff/meetings/:id', LEAD, ({ user, params, body }) => {
    const m = d().meetings.find((x) => x.id === params.id);
    if (!m) throw notFound();
    if (body.status !== undefined) m.status = oneOf(body.status, ['scheduled', 'held', 'cancelled'], 'status');
    if (body.minutes !== undefined) m.minutes = str(body.minutes, 'Minutes', { max: 5000, required: false });
    if (body.published !== undefined) m.published = Boolean(body.published);
    store.audit(user, 'meeting.update', `${m.date} ${m.status}`);
    store.save();
    return m;
  });

  route('POST', '/api/staff/meetings/:id/resolutions', LEAD, ({ user, params, body }) => {
    const m = d().meetings.find((x) => x.id === params.id);
    if (!m) throw notFound();
    const r = {
      no: store.nextSeq('resolution'), subject: str(body.subject, 'Resolution', { min: 5, max: 500 }),
      decision: oneOf(body.decision || 'passed', ['passed', 'deferred', 'rejected'], 'decision'),
      notes: str(body.notes, 'Notes', { max: 500, required: false }),
    };
    m.resolutions.push(r);
    if (m.status === 'scheduled') m.status = 'held';
    store.audit(user, 'resolution.create', `No. ${r.no}`);
    store.save();
    return m;
  });

  // ---------- ward committees ----------
  const wardScope = (user, ward) => {
    if (user.role === 'ward_officer' && user.ward !== ward) throw new HttpError(403, 'You can manage only your own ward');
  };

  route('GET', '/api/staff/committees', STAFF, ({ user, query }) => {
    const ward = user.role === 'ward_officer' ? user.ward : query.ward ? wardOf(query.ward) : null;
    const members = d().committeeMembers.filter((m) => !ward || m.ward === ward);
    const meetings = d().committeeMeetings.filter((m) => !ward || m.ward === ward).sort((a, b) => b.date.localeCompare(a.date));
    const coverage = cfg.WARDS.map((w) => ({ ward: w, members: d().committeeMembers.filter((m) => m.ward === w).length, meetings: d().committeeMeetings.filter((m) => m.ward === w).length }));
    return { ward, members, meetings, coverage };
  });

  route('POST', '/api/staff/committees/members', ['chairperson', 'commissioner', 'ward_officer'], ({ user, body }) => {
    const ward = wardOf(body.ward);
    wardScope(user, ward);
    const type = oneOf(body.type, cfg.COMMITTEE_TYPES.map((t) => t.id), 'committee');
    const m = { id: newId(), ward, type, name: str(body.name, 'Name', { min: 2, max: 80 }), mobile: body.mobile ? mobileOf(body.mobile) : '', createdAt: now().toISOString() };
    d().committeeMembers.push(m);
    store.audit(user, 'committee.member.add', `Ward ${ward} ${type}`);
    store.save();
    return m;
  });

  route('DELETE', '/api/staff/committees/members/:id', ['chairperson', 'commissioner', 'ward_officer'], ({ user, params }) => {
    const i = d().committeeMembers.findIndex((m) => m.id === params.id);
    if (i < 0) throw notFound();
    wardScope(user, d().committeeMembers[i].ward);
    d().committeeMembers.splice(i, 1);
    store.audit(user, 'committee.member.remove', params.id);
    store.save();
    return { ok: true };
  });

  route('POST', '/api/staff/committees/meetings', ['chairperson', 'commissioner', 'ward_officer'], ({ user, body }) => {
    const ward = wardOf(body.ward);
    wardScope(user, ward);
    const attendees = Number(body.attendees);
    if (!Number.isInteger(attendees) || attendees < 1 || attendees > 1000) throw bad('Attendance must be a whole number');
    const m = {
      id: newId(), ward, date: dateOf(body.date, 'Date'), attendees,
      issues: str(body.issues, 'Issues raised', { min: 5, max: 2000 }), actions: str(body.actions, 'Actions agreed', { max: 2000, required: false }),
      by: user.name, createdAt: now().toISOString(),
    };
    d().committeeMeetings.push(m);
    store.audit(user, 'committee.meeting', `Ward ${ward}`);
    store.save();
    return m;
  });

  // ---------- field inspections ----------
  route('GET', '/api/staff/inspections', STAFF, ({ user }) =>
    d().inspections.filter((x) => user.role !== 'ward_officer' || x.ward === user.ward).sort((a, b) => b.date.localeCompare(a.date)));

  route('POST', '/api/staff/inspections', STAFF, ({ user, body }) => {
    const ward = wardOf(body.ward);
    wardScope(user, ward);
    const x = {
      id: newId(), ward, date: dateOf(body.date, 'Date'), location: str(body.location, 'Location', { min: 3, max: 200 }),
      findings: str(body.findings, 'Findings', { min: 5, max: 2000 }), severity: oneOf(body.severity || 'medium', ['low', 'medium', 'high'], 'severity'),
      by: user.name, byId: user.id, grievanceId: null, createdAt: now().toISOString(),
    };
    d().inspections.push(x);
    store.audit(user, 'inspection.create', `Ward ${ward}`);
    store.save();
    return x;
  });

  // Turn an inspection finding into a tracked complaint with a deadline.
  route('POST', '/api/staff/inspections/:id/complaint', STAFF, ({ user, params, body }) => {
    const x = d().inspections.find((i) => i.id === params.id);
    if (!x) throw notFound();
    if (x.grievanceId) throw bad('A complaint was already raised for this inspection');
    const c = cfg.categoryById(body.category);
    if (!c) throw bad('Choose a complaint type');
    const t = now();
    const g = {
      id: newId(), number: `PS-${t.getFullYear()}-${String(store.nextSeq('grievance')).padStart(6, '0')}`,
      citizenId: user.id, citizenName: `${user.name} (field inspection)`, citizenMobile: '', category: c.id, department: c.dept, ward: x.ward,
      location: x.location, lat: null, lng: null, description: x.findings, hasPhoto: false, source: 'field_visit',
      status: 'submitted', assignedTo: null, createdAt: t.toISOString(), updatedAt: t.toISOString(),
      dueAt: new Date(t.getTime() + c.sla * HOUR).toISOString(), resolvedAt: null, feedback: null, reopenCount: 0,
      history: [{ at: t.toISOString(), by: user.name, role: user.role, status: 'submitted', remark: 'Raised from field inspection' }],
    };
    d().grievances.push(g);
    x.grievanceId = g.id;
    store.audit(user, 'inspection.complaint', g.number);
    store.save();
    return enrich(g);
  });

  // ---------- wards & councillors ----------
  route('GET', '/api/staff/wards', STAFF, () => d().wards.map((w) => ({ ...wardView(w), wardOfficerId: w.wardOfficerId })));

  route('PATCH', '/api/staff/wards/:n', LEAD, ({ user, params, body }) => {
    const w = d().wards.find((x) => x.ward === Number(params.n));
    if (!w) throw notFound();
    if (body.councillor !== undefined) w.councillor = str(body.councillor, 'Councillor', { max: 80, required: false });
    if (body.locality !== undefined) w.locality = str(body.locality, 'Locality', { max: 120, required: false });
    if (body.wardOfficerId !== undefined) {
      if (body.wardOfficerId && !d().users.some((u) => u.id === body.wardOfficerId && u.role === 'ward_officer')) throw bad('Choose a ward officer');
      w.wardOfficerId = body.wardOfficerId || null;
    }
    store.audit(user, 'ward.update', `Ward ${w.ward}`);
    store.save();
    return wardView(w);
  });

  // ---------- budget ----------
  route('GET', '/api/staff/budget', STAFF, () => budgetSummary());

  route('PATCH', '/api/staff/budget/:id', LEAD, ({ user, params, body }) => {
    const b = d().budget.find((x) => x.id === params.id);
    if (!b) throw notFound();
    if (body.allocated !== undefined) b.allocated = money(body.allocated, 'Allocation');
    if (body.spent !== undefined) b.spent = money(body.spent, 'Spent');
    store.audit(user, 'budget.update', `${b.en}: ${b.allocated}/${b.spent}`);
    store.save();
    return budgetSummary();
  });

  // ---------- KPIs ----------
  route('GET', '/api/staff/kpis', STAFF, () => ({ kpis: computedKpis(), entries: d().kpiEntries.slice().sort((a, b) => b.month.localeCompare(a.month)) }));

  route('POST', '/api/staff/kpis', LEAD, ({ user, body }) => {
    const k = cfg.KPIS.find((x) => x.id === body.kpi && x.source === 'manual');
    if (!k) throw bad('Choose a KPI that is entered manually');
    const month = str(body.month, 'Month', { max: 7 });
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw bad('Month must look like 2026-11');
    const value = Number(body.value);
    if (!Number.isFinite(value) || value < 0 || value > (k.unit === '%' ? 100 : 24)) throw bad('Value is out of range');
    const existing = d().kpiEntries.find((e) => e.kpi === k.id && e.month === month);
    if (existing) { existing.value = value; existing.by = user.name; } else d().kpiEntries.push({ id: newId(), kpi: k.id, month, value, by: user.name });
    store.audit(user, 'kpi.entry', `${k.id} ${month} = ${value}`);
    store.save();
    return computedKpis();
  });

  // ---------- review report (one page for the CM / Collector review) ----------
  route('GET', '/api/staff/report', LEAD, () => {
    const all = d().grievances.map((g) => enrich(g));
    const s = stats(d().grievances);
    return {
      generatedAt: now().toISOString(), municipality: cfg.MUNICIPALITY_NAME, constituency: cfg.CONSTITUENCY, headTitle: cfg.HEAD_TITLE,
      complaints: s, kpis: computedKpis(), tax: taxSummary(), works: worksSummary(), budget: budgetSummary(), actions: actionsSummary(),
      topOverdue: all.filter((g) => g.overdue).sort((a, b) => b.overdueHours - a.overdueHours).slice(0, 8),
      stalledWorks: d().works.filter((w) => w.status === 'stalled'),
      recentResolutions: d().meetings.filter((m) => m.status === 'held').sort((a, b) => b.date.localeCompare(a.date)).slice(0, 2),
      applications: { total: d().applications.length, open: d().applications.filter((a) => cfg.APP_OPEN.includes(a.status)).length, overdue: d().applications.map((a) => appView(a)).filter((a) => a.overdue).length },
      committees: { wardsWithMembers: new Set(d().committeeMembers.map((m) => m.ward)).size, wards: cfg.WARDS.length, meetings: d().committeeMeetings.length },
      inspections: d().inspections.length,
    };
  });

  // ---------- CSV export ----------
  const csv = (rows) => rows.map((r) => r.map((v) => {
    let s = v === null || v === undefined ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // stop spreadsheet formula injection
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(',')).join('\r\n');

  route('GET', '/api/staff/export/:what', LEAD, ({ params }) => {
    let rows;
    if (params.what === 'complaints.csv') {
      rows = [['Number', 'Category', 'Department', 'Ward', 'Status', 'Created', 'Due', 'Resolved', 'Overdue hours', 'Rating', 'Location']]
        .concat(d().grievances.map((g) => enrich(g)).map((g) => [g.number, g.category, g.department, g.ward, g.status, g.createdAt, g.dueAt, g.resolvedAt, g.overdueHours, g.feedback ? g.feedback.rating : '', g.location]));
    } else if (params.what === 'works.csv') {
      rows = [['Title', 'Type', 'Ward', 'Scheme', 'Sanctioned (Rs)', 'Spent (Rs)', 'Status', 'Progress %', 'Start', 'Target']]
        .concat(d().works.map((w) => [w.title, w.type, w.ward ?? 'Town-wide', w.scheme, w.sanctioned, w.spent, w.status, w.progress, w.startDate, w.targetDate]));
    } else if (params.what === 'applications.csv') {
      rows = [['Number', 'Service', 'Ward', 'Status', 'Created', 'Due']].concat(d().applications.map((a) => [a.number, a.service, a.ward, a.status, a.createdAt, a.dueAt]));
    } else throw notFound();
    return { __raw: csv(rows), type: 'text/csv; charset=utf-8', filename: params.what };
  });
};
