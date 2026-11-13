'use strict';

const crypto = require('node:crypto');
const cfg = require('./config');
const { hashPassword, verifyPassword, newId } = require('./store');

const HOUR = 36e5;
const SESSION_TTL = 7 * 24 * HOUR;
const OTP_TTL = 5 * 60 * 1000;
const MAX_PHOTO_CHARS = 1_500_000; // ~1.1 MB image after base64

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const bad = (msg) => new HttpError(400, msg);

// ---------- validation helpers ----------
function str(v, field, { min = 0, max = 500, required = true } = {}) {
  if (v === undefined || v === null || v === '') {
    if (required) throw bad(`${field} is required`);
    return '';
  }
  if (typeof v !== 'string') throw bad(`${field} must be text`);
  const s = v.trim();
  if (s.length < min) throw bad(`${field} is too short`);
  if (s.length > max) throw bad(`${field} is too long (max ${max})`);
  return s;
}
function mobileOf(v) {
  const m = String(v || '').replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '');
  if (!/^[6-9]\d{9}$/.test(m)) throw bad('Enter a valid 10-digit Indian mobile number');
  return m;
}
function wardOf(v) {
  const w = Number(v);
  if (!cfg.WARDS.includes(w)) throw bad('Choose a valid ward');
  return w;
}
function oneOf(v, list, field) {
  if (!list.includes(v)) throw bad(`Invalid ${field}`);
  return v;
}
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const mask = (m) => (m ? `${m.slice(0, 2)}xxxxxx${m.slice(-2)}` : '');

function createApi(store, { demo = false, sendSms = defaultSms } = {}) {
  const d = () => store.data;
  const sessions = new Map(); // sha(token) -> { userId, exp }
  const otps = new Map(); // mobile -> { hash, exp, tries, sentAt }

  // ---------- grievance helpers ----------
  function enrich(g, now = Date.now()) {
    const open = cfg.OPEN_STATUSES.includes(g.status);
    const due = Date.parse(g.dueAt);
    const overdueHours = open && now > due ? Math.floor((now - due) / HOUR) : 0;
    const slaHours = cfg.categoryById(g.category).sla;
    // Escalation ladder: overdue -> Commissioner; overdue by a further full SLA -> Chairperson.
    const escalation = !overdueHours ? 0 : overdueHours >= slaHours ? 2 : 1;
    const officer = g.assignedTo ? d().users.find((u) => u.id === g.assignedTo) : null;
    return { ...g, overdue: overdueHours > 0, overdueHours, escalation, assignedName: officer ? officer.name : null };
  }

  function canSee(user, g) {
    if (user.role === 'citizen') return g.citizenId === user.id;
    if (cfg.LEADERSHIP.includes(user.role)) return true;
    if (user.role === 'officer') return g.department === user.department || g.assignedTo === user.id;
    if (user.role === 'ward_officer') return g.ward === user.ward || g.assignedTo === user.id;
    return false;
  }

  function publicUser(u) {
    return {
      id: u.id, role: u.role, name: u.name, username: u.username || null,
      mobile: u.role === 'citizen' ? u.mobile : null,
      department: u.department || null, ward: u.ward || null, active: u.active,
    };
  }

  function issueSession(user) {
    const token = crypto.randomBytes(32).toString('base64url');
    sessions.set(sha(token), { userId: user.id, exp: Date.now() + SESSION_TTL });
    return token;
  }

  function authUser(req) {
    const h = req.headers.authorization || '';
    const m = /^Bearer (.+)$/.exec(h);
    if (!m) return null;
    const s = sessions.get(sha(m[1]));
    if (!s || s.exp < Date.now()) return null;
    const u = d().users.find((x) => x.id === s.userId && x.active);
    return u || null;
  }

  function stats(list, now = Date.now()) {
    const all = list.map((g) => enrich(g, now));
    const closed = all.filter((g) => g.status === 'resolved');
    const onTime = closed.filter((g) => Date.parse(g.resolvedAt) <= Date.parse(g.dueAt));
    const rated = closed.filter((g) => g.feedback && g.feedback.rating);
    const hours = closed.map((g) => (Date.parse(g.resolvedAt) - Date.parse(g.createdAt)) / HOUR);
    const group = (key) => {
      const out = {};
      for (const g of all) {
        const k = g[key];
        out[k] = out[k] || { total: 0, open: 0, overdue: 0, resolved: 0 };
        out[k].total++;
        if (cfg.OPEN_STATUSES.includes(g.status)) out[k].open++;
        if (g.overdue) out[k].overdue++;
        if (g.status === 'resolved') out[k].resolved++;
      }
      return out;
    };
    return {
      total: all.length,
      open: all.filter((g) => cfg.OPEN_STATUSES.includes(g.status)).length,
      overdue: all.filter((g) => g.overdue).length,
      resolved: closed.length,
      rejected: all.filter((g) => g.status === 'rejected').length,
      resolvedOnTimePct: closed.length ? Math.round((onTime.length / closed.length) * 100) : null,
      avgResolutionHours: hours.length ? Math.round(hours.reduce((a, b) => a + b, 0) / hours.length) : null,
      avgRating: rated.length ? Math.round((rated.reduce((a, g) => a + g.feedback.rating, 0) / rated.length) * 10) / 10 : null,
      byDepartment: group('department'),
      byWard: group('ward'),
      byCategory: group('category'),
    };
  }

  // ---------- routes ----------
  const routes = [];
  const route = (method, pattern, roles, handler) => {
    const keys = [];
    const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '$');
    routes.push({ method, re, keys, roles, handler });
  };
  const STAFF = cfg.STAFF_ROLES;
  const LEAD = cfg.LEADERSHIP;

  // Public
  route('GET', '/api/config', null, () => ({
    municipality: cfg.MUNICIPALITY_NAME, municipalityTe: cfg.MUNICIPALITY_NAME_TE,
    constituency: cfg.CONSTITUENCY, headTitle: cfg.HEAD_TITLE, wards: cfg.WARDS,
    departments: cfg.DEPARTMENTS, categories: cfg.CATEGORIES, statuses: cfg.STATUSES, demo,
    services: cfg.SERVICES, appStatuses: cfg.APP_STATUSES, workTypes: cfg.WORK_TYPES, workStatuses: cfg.WORK_STATUSES,
    schemes: cfg.SCHEMES, committeeTypes: cfg.COMMITTEE_TYPES, kpis: cfg.KPIS, contact: cfg.CONTACT,
  }));

  route('GET', '/api/announcements', null, () =>
    d().announcements.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)));

  route('GET', '/api/public/stats', null, () => {
    const s = stats(d().grievances);
    return { ...s, byCategory: undefined };
  });

  // Citizen login by OTP. In production, sendSms posts to an SMS gateway.
  route('POST', '/api/auth/otp/request', null, async ({ body }) => {
    const mobile = mobileOf(body.mobile);
    const prev = otps.get(mobile);
    if (prev && Date.now() - prev.sentAt < 30_000) throw new HttpError(429, 'Please wait 30 seconds before asking for another OTP');
    const code = String(crypto.randomInt(100000, 1000000));
    otps.set(mobile, { hash: sha(mobile + code), exp: Date.now() + OTP_TTL, tries: 0, sentAt: Date.now() });
    await sendSms(mobile, `Your Praja Seva OTP is ${code}. Valid for 5 minutes.`);
    return { ok: true, ...(demo ? { devOtp: code } : {}) };
  });

  route('POST', '/api/auth/otp/verify', null, ({ body }) => {
    const mobile = mobileOf(body.mobile);
    const rec = otps.get(mobile);
    if (!rec || rec.exp < Date.now()) throw bad('OTP expired. Request a new one.');
    rec.tries++;
    if (rec.tries > 5) { otps.delete(mobile); throw new HttpError(429, 'Too many wrong attempts. Request a new OTP.'); }
    if (sha(mobile + String(body.otp || '').trim()) !== rec.hash) throw bad('Wrong OTP');
    otps.delete(mobile);
    let user = d().users.find((u) => u.role === 'citizen' && u.mobile === mobile);
    if (!user) {
      user = {
        id: newId(), role: 'citizen', mobile, active: true, createdAt: new Date().toISOString(),
        name: str(body.name, 'Name', { min: 2, max: 80, required: false }) || `Citizen ${mask(mobile)}`,
        ward: body.ward ? wardOf(body.ward) : null,
      };
      d().users.push(user);
      store.audit(user, 'citizen.register', mask(mobile));
      store.save();
    }
    if (!user.active) throw new HttpError(403, 'Account disabled');
    return { token: issueSession(user), user: publicUser(user) };
  });

  route('POST', '/api/auth/staff/login', null, ({ body }) => {
    const username = str(body.username, 'Username', { max: 40 }).toLowerCase();
    const user = d().users.find((u) => u.username === username && u.role !== 'citizen');
    if (!user || !user.active || !verifyPassword(body.password || '', user.passHash)) {
      throw new HttpError(401, 'Wrong username or password');
    }
    store.audit(user, 'staff.login', username);
    store.save();
    return { token: issueSession(user), user: publicUser(user) };
  });

  route('POST', '/api/auth/logout', [], ({ req }) => {
    const m = /^Bearer (.+)$/.exec(req.headers.authorization || '');
    if (m) sessions.delete(sha(m[1]));
    return { ok: true };
  });

  route('GET', '/api/me', [], ({ user }) => publicUser(user));

  route('PATCH', '/api/me', ['citizen'], ({ user, body }) => {
    if (body.name !== undefined) user.name = str(body.name, 'Name', { min: 2, max: 80 });
    if (body.ward !== undefined) user.ward = wardOf(body.ward);
    store.save();
    return publicUser(user);
  });

  route('POST', '/api/staff/password', STAFF, ({ user, body }) => {
    if (!verifyPassword(body.current || '', user.passHash)) throw bad('Current password is wrong');
    const next = str(body.next, 'New password', { min: 8, max: 100 });
    user.passHash = hashPassword(next);
    store.audit(user, 'staff.password', '');
    store.save();
    return { ok: true };
  });

  // ---------- grievances ----------
  route('POST', '/api/grievances', ['citizen'], ({ user, body }) => {
    const cat = cfg.categoryById(body.category);
    if (!cat) throw bad('Choose a complaint type');
    const ward = wardOf(body.ward);
    const description = str(body.description, 'Description', { min: 10, max: 2000 });
    const location = str(body.location, 'Location / landmark', { min: 3, max: 300 });
    let lat = null, lng = null;
    if (body.lat !== undefined && body.lat !== null && body.lat !== '') {
      lat = Number(body.lat); lng = Number(body.lng);
      if (!(Math.abs(lat) <= 90 && Math.abs(lng) <= 180)) throw bad('Invalid GPS location');
    }
    let hasPhoto = false;
    if (body.photo) {
      if (typeof body.photo !== 'string' || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(body.photo)) throw bad('Photo must be a JPEG, PNG or WebP image');
      if (body.photo.length > MAX_PHOTO_CHARS) throw bad('Photo is too large (max about 1 MB)');
      hasPhoto = true;
    }
    const now = new Date();
    const seq = store.nextSeq('grievance');
    const g = {
      id: newId(),
      number: `PS-${now.getFullYear()}-${String(seq).padStart(6, '0')}`,
      citizenId: user.id, citizenName: user.name, citizenMobile: user.mobile,
      category: cat.id, department: cat.dept, ward, location, lat, lng, description, hasPhoto,
      status: 'submitted', assignedTo: null,
      createdAt: now.toISOString(), updatedAt: now.toISOString(),
      dueAt: new Date(now.getTime() + cat.sla * HOUR).toISOString(),
      resolvedAt: null, feedback: null, reopenCount: 0,
      history: [{ at: now.toISOString(), by: user.name, role: 'citizen', status: 'submitted', remark: 'Complaint registered' }],
    };
    if (hasPhoto) store.savePhoto(g.id, body.photo);
    d().grievances.push(g);
    if (!user.ward) user.ward = ward;
    store.audit(user, 'grievance.create', g.number);
    store.save();
    return enrich(g);
  });

  route('GET', '/api/grievances/mine', ['citizen'], ({ user }) =>
    d().grievances.filter((g) => g.citizenId === user.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((g) => enrich(g)));

  const findG = (id) => {
    const g = d().grievances.find((x) => x.id === id || x.number === id);
    if (!g) throw new HttpError(404, 'Complaint not found');
    return g;
  };

  route('GET', '/api/grievances/:id', [], ({ user, params }) => {
    const g = findG(params.id);
    if (!canSee(user, g)) throw new HttpError(404, 'Complaint not found');
    return enrich(g);
  });

  route('GET', '/api/grievances/:id/photo', [], ({ user, params }) => {
    const g = findG(params.id);
    if (!canSee(user, g) || !g.hasPhoto) throw new HttpError(404, 'No photo');
    return { photo: store.readPhoto(g.id) };
  });

  route('POST', '/api/grievances/:id/feedback', ['citizen'], ({ user, params, body }) => {
    const g = findG(params.id);
    if (g.citizenId !== user.id) throw new HttpError(404, 'Complaint not found');
    if (g.status !== 'resolved') throw bad('You can rate only a resolved complaint');
    const rating = Number(body.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw bad('Rating must be 1 to 5');
    g.feedback = { rating, comment: str(body.comment, 'Comment', { max: 500, required: false }), at: new Date().toISOString() };
    store.audit(user, 'grievance.feedback', `${g.number} ${rating}/5`);
    store.save();
    return enrich(g);
  });

  route('POST', '/api/grievances/:id/reopen', ['citizen'], ({ user, params, body }) => {
    const g = findG(params.id);
    if (g.citizenId !== user.id) throw new HttpError(404, 'Complaint not found');
    if (!['resolved', 'rejected'].includes(g.status)) throw bad('Only a closed complaint can be reopened');
    const closedAt = Date.parse(g.resolvedAt || g.updatedAt);
    if (Date.now() - closedAt > 7 * 24 * HOUR) throw bad('Complaints can be reopened within 7 days of closing. Please file a new one.');
    const reason = str(body.reason, 'Reason', { min: 5, max: 500 });
    const now = new Date();
    g.status = 'reopened';
    g.reopenCount++;
    g.resolvedAt = null;
    g.feedback = null;
    g.dueAt = new Date(now.getTime() + cfg.categoryById(g.category).sla * HOUR).toISOString();
    g.updatedAt = now.toISOString();
    g.history.push({ at: now.toISOString(), by: user.name, role: 'citizen', status: 'reopened', remark: reason });
    store.audit(user, 'grievance.reopen', g.number);
    store.save();
    return enrich(g);
  });

  // Staff queue
  route('GET', '/api/staff/grievances', STAFF, ({ user, query }) => {
    let list = d().grievances.filter((g) => canSee(user, g)).map((g) => enrich(g));
    if (query.status === 'open') list = list.filter((g) => cfg.OPEN_STATUSES.includes(g.status));
    else if (query.status) list = list.filter((g) => g.status === query.status);
    if (query.department) list = list.filter((g) => g.department === query.department);
    if (query.ward) list = list.filter((g) => g.ward === Number(query.ward));
    if (query.overdue === '1') list = list.filter((g) => g.overdue);
    if (query.mine === '1') list = list.filter((g) => g.assignedTo === user.id);
    if (query.q) {
      const q = String(query.q).toLowerCase();
      list = list.filter((g) => [g.number, g.location, g.description, g.citizenName].some((s) => String(s).toLowerCase().includes(q)));
    }
    list.sort((a, b) => b.escalation - a.escalation || b.overdueHours - a.overdueHours || b.createdAt.localeCompare(a.createdAt));
    return list.slice(0, 500);
  });

  route('POST', '/api/staff/grievances/:id/assign', STAFF, ({ user, params, body }) => {
    const g = findG(params.id);
    if (!canSee(user, g)) throw new HttpError(404, 'Complaint not found');
    const officer = d().users.find((u) => u.id === body.officerId && u.role !== 'citizen' && u.active);
    if (!officer) throw bad('Choose an officer');
    if (!cfg.OPEN_STATUSES.includes(g.status)) throw bad('Complaint is already closed');
    // Department officers may only reassign inside their own department.
    if (user.role === 'officer' && officer.department !== user.department) throw new HttpError(403, 'You can assign only within your department');
    const now = new Date().toISOString();
    g.assignedTo = officer.id;
    if (['submitted', 'reopened'].includes(g.status)) g.status = 'assigned';
    g.updatedAt = now;
    g.history.push({ at: now, by: user.name, role: user.role, status: g.status, remark: `Assigned to ${officer.name}${body.remark ? ': ' + str(body.remark, 'Remark', { max: 500 }) : ''}` });
    store.audit(user, 'grievance.assign', `${g.number} -> ${officer.username}`);
    store.save();
    return enrich(g);
  });

  route('POST', '/api/staff/grievances/:id/status', STAFF, ({ user, params, body }) => {
    const g = findG(params.id);
    if (!canSee(user, g)) throw new HttpError(404, 'Complaint not found');
    const status = oneOf(body.status, ['in_progress', 'resolved', 'rejected'], 'status');
    if (!cfg.OPEN_STATUSES.includes(g.status)) throw bad('Complaint is already closed');
    const remark = str(body.remark, 'Remark', { min: status === 'in_progress' ? 0 : 5, max: 1000, required: status !== 'in_progress' });
    const now = new Date().toISOString();
    g.status = status;
    if (!g.assignedTo) g.assignedTo = user.id;
    if (status === 'resolved') g.resolvedAt = now;
    g.updatedAt = now;
    g.history.push({ at: now, by: user.name, role: user.role, status, remark: remark || 'Work started' });
    store.audit(user, `grievance.${status}`, g.number);
    store.save();
    return enrich(g);
  });

  route('GET', '/api/staff/officers', STAFF, () =>
    d().users.filter((u) => u.role !== 'citizen' && u.active).map(publicUser));

  route('GET', '/api/staff/dashboard', STAFF, ({ user }) => {
    const visible = d().grievances.filter((g) => canSee(user, g));
    const s = stats(visible);
    const props = d().properties;
    const demand = props.reduce((a, p) => a + p.annualTax + p.arrears, 0);
    const collected = props.reduce((a, p) => a + p.payments.reduce((x, y) => x + y.amount, 0), 0);
    return {
      ...s,
      escalatedToChair: visible.map((g) => enrich(g)).filter((g) => g.escalation === 2).length,
      appointmentsPending: d().appointments.filter((a) => a.status === 'requested').length,
      tax: { demand, collected, pct: demand ? Math.round((collected / demand) * 100) : 0 },
      actions: {
        total: d().actions.length,
        done: d().actions.filter((a) => a.status === 'done').length,
        inProgress: d().actions.filter((a) => a.status === 'in_progress').length,
      },
    };
  });

  // ---------- announcements ----------
  route('POST', '/api/staff/announcements', LEAD, ({ user, body }) => {
    const a = {
      id: newId(), by: user.name, createdAt: new Date().toISOString(),
      title: str(body.title, 'Title', { min: 3, max: 120 }),
      titleTe: str(body.titleTe, 'Telugu title', { max: 120, required: false }),
      body: str(body.body, 'Message', { min: 3, max: 2000 }),
      ward: body.ward ? wardOf(body.ward) : null,
      type: oneOf(body.type || 'notice', ['notice', 'tender', 'event'], 'type'),
    };
    d().announcements.push(a);
    store.audit(user, 'announcement.create', a.title);
    store.save();
    return a;
  });

  route('DELETE', '/api/staff/announcements/:id', LEAD, ({ user, params }) => {
    const i = d().announcements.findIndex((a) => a.id === params.id);
    if (i < 0) throw new HttpError(404, 'Not found');
    const [a] = d().announcements.splice(i, 1);
    store.audit(user, 'announcement.delete', a.title);
    store.save();
    return { ok: true };
  });

  // ---------- property tax ----------
  const findP = (no) => {
    const p = d().properties.find((x) => x.assessmentNo === String(no).trim());
    if (!p) throw new HttpError(404, 'No property found with that assessment number');
    return p;
  };
  const propView = (p) => {
    const paid = p.payments.reduce((a, x) => a + x.amount, 0);
    return { ...p, demand: p.annualTax + p.arrears, paid, due: Math.max(0, p.annualTax + p.arrears - paid) };
  };

  route('GET', '/api/property/:no', ['citizen', ...STAFF], ({ params }) => propView(findP(params.no)));

  // Payment is recorded directly here for the demo. In production, redirect to a
  // payment gateway and record the payment only on the gateway's verified callback.
  route('POST', '/api/property/:no/pay', ['citizen'], ({ user, params, body }) => {
    if (!demo) throw new HttpError(501, 'Online payment needs a payment gateway to be configured');
    const p = findP(params.no);
    const view = propView(p);
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount < 1 || amount > view.due) throw bad(`Amount must be between 1 and ${view.due}`);
    const receipt = {
      receiptNo: `RCPT-${String(store.nextSeq('receipt')).padStart(7, '0')}`,
      amount: Math.round(amount), at: new Date().toISOString(), paidBy: user.name, mode: 'online (demo)',
    };
    p.payments.push(receipt);
    store.audit(user, 'property.pay', `${p.assessmentNo} ${receipt.amount}`);
    store.save();
    return { receipt, property: propView(p) };
  });

  route('GET', '/api/staff/property', STAFF, () => {
    const byWard = {};
    for (const p of d().properties.map(propView)) {
      const w = (byWard[p.ward] = byWard[p.ward] || { ward: p.ward, count: 0, demand: 0, paid: 0 });
      w.count++; w.demand += p.demand; w.paid += p.paid;
    }
    return { properties: d().properties.map(propView), byWard: Object.values(byWard).sort((a, b) => a.ward - b.ward) };
  });

  // ---------- appointments with the Chairperson (Praja Vani) ----------
  route('POST', '/api/appointments', ['citizen'], ({ user, body }) => {
    const pref = str(body.preferredDate, 'Preferred date', { max: 10 });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(pref) || Number.isNaN(Date.parse(pref))) throw bad('Preferred date is invalid');
    const a = {
      id: newId(), citizenId: user.id, name: user.name, mobile: user.mobile,
      purpose: str(body.purpose, 'Purpose', { min: 10, max: 1000 }),
      preferredDate: pref, status: 'requested', slot: null, remark: '', createdAt: new Date().toISOString(),
    };
    d().appointments.push(a);
    store.audit(user, 'appointment.request', a.preferredDate);
    store.save();
    return a;
  });

  route('GET', '/api/appointments/mine', ['citizen'], ({ user }) =>
    d().appointments.filter((a) => a.citizenId === user.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));

  route('GET', '/api/staff/appointments', LEAD, () =>
    d().appointments.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)));

  route('POST', '/api/staff/appointments/:id', LEAD, ({ user, params, body }) => {
    const a = d().appointments.find((x) => x.id === params.id);
    if (!a) throw new HttpError(404, 'Not found');
    a.status = oneOf(body.status, ['scheduled', 'done', 'declined'], 'status');
    if (a.status === 'scheduled') a.slot = str(body.slot, 'Date and time', { min: 4, max: 60 });
    a.remark = str(body.remark, 'Remark', { max: 500, required: false });
    store.audit(user, `appointment.${a.status}`, a.name);
    store.save();
    return a;
  });

  // ---------- Chairperson's action-plan tracker ----------
  route('GET', '/api/staff/actions', STAFF, () => d().actions);

  route('POST', '/api/staff/actions', LEAD, ({ user, body }) => {
    const a = {
      id: newId(),
      title: str(body.title, 'Title', { min: 3, max: 200 }),
      horizon: oneOf(body.horizon, ['100-day', '1-year', '5-year'], 'horizon'),
      owner: str(body.owner, 'Owner', { max: 80, required: false }),
      dueDate: str(body.dueDate, 'Due date', { max: 10, required: false }),
      status: 'not_started', note: '', updatedAt: new Date().toISOString(),
    };
    d().actions.push(a);
    store.audit(user, 'action.create', a.title);
    store.save();
    return a;
  });

  route('PATCH', '/api/staff/actions/:id', LEAD, ({ user, params, body }) => {
    const a = d().actions.find((x) => x.id === params.id);
    if (!a) throw new HttpError(404, 'Not found');
    if (body.status !== undefined) a.status = oneOf(body.status, ['not_started', 'in_progress', 'done'], 'status');
    if (body.note !== undefined) a.note = str(body.note, 'Note', { max: 500, required: false });
    a.updatedAt = new Date().toISOString();
    store.audit(user, 'action.update', `${a.title} -> ${a.status}`);
    store.save();
    return a;
  });

  // ---------- staff accounts ----------
  route('GET', '/api/staff/users', LEAD, () => d().users.filter((u) => u.role !== 'citizen').map(publicUser));

  route('POST', '/api/staff/users', LEAD, ({ user, body }) => {
    const role = oneOf(body.role, ['commissioner', 'officer', 'ward_officer'], 'role');
    const username = str(body.username, 'Username', { min: 3, max: 40 }).toLowerCase();
    if (!/^[a-z0-9._-]+$/.test(username)) throw bad('Username may use letters, digits, dot, dash and underscore');
    if (d().users.some((u) => u.username === username)) throw bad('Username already taken');
    const nu = {
      id: newId(), role, username,
      name: str(body.name, 'Name', { min: 2, max: 80 }),
      department: role === 'officer' ? oneOf(body.department, cfg.DEPARTMENTS.map((x) => x.id), 'department') : null,
      ward: role === 'ward_officer' ? wardOf(body.ward) : null,
      passHash: hashPassword(str(body.password, 'Password', { min: 8, max: 100 })),
      active: true, createdAt: new Date().toISOString(),
    };
    d().users.push(nu);
    store.audit(user, 'staff.create', username);
    store.save();
    return publicUser(nu);
  });

  route('PATCH', '/api/staff/users/:id', LEAD, ({ user, params, body }) => {
    const u = d().users.find((x) => x.id === params.id && x.role !== 'citizen');
    if (!u) throw new HttpError(404, 'Not found');
    if (u.id === user.id) throw bad('You cannot change your own account here');
    if (typeof body.active === 'boolean') u.active = body.active;
    store.audit(user, 'staff.update', `${u.username} active=${u.active}`);
    store.save();
    return publicUser(u);
  });

  route('GET', '/api/staff/audit', LEAD, () => d().audit.slice(0, 300));

  require('./modules')({ route, store, HttpError, bad, str, wardOf, oneOf, mobileOf, newId, enrich, stats, canSee, publicUser, STAFF, LEAD, demo });

  // ---------- dispatcher ----------
  async function handle(req, res, url, body) {
    const r = routes.find((x) => x.method === req.method && x.re.test(url.pathname));
    if (!r) {
      const anyMethod = routes.some((x) => x.re.test(url.pathname));
      throw new HttpError(anyMethod ? 405 : 404, anyMethod ? 'Method not allowed' : 'Not found');
    }
    const m = r.re.exec(url.pathname);
    const params = {};
    r.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
    let user = null;
    if (r.roles) {
      user = authUser(req);
      if (!user) throw new HttpError(401, 'Please log in');
      if (r.roles.length && !r.roles.includes(user.role)) throw new HttpError(403, 'Not allowed for your role');
    }
    const query = Object.fromEntries(url.searchParams);
    return r.handler({ req, res, user, params, query, body: body || {} });
  }

  return { handle, HttpError, _sessions: sessions };
}

async function defaultSms(mobile, text) {
  // Plug an SMS gateway in here (DLT-registered template required in India).
  console.log(`[sms] to ${mask(mobile)}: ${text.replace(/\d{6}/, '******')}`);
}

module.exports = { createApi, HttpError };
