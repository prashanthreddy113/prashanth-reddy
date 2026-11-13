'use strict';

// Tiny JSON-file data store. Every write goes to a temp file first and is then
// renamed over the real file, so a crash never leaves a half-written database.
// Fine for one municipality's load; swap for PostgreSQL when scaling up.

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const cfg = require('./config');

const EMPTY = () => ({
  meta: { createdAt: new Date().toISOString(), seq: { grievance: 0, receipt: 0, application: 0, resolution: 0 } },
  users: [],
  grievances: [],
  announcements: [],
  properties: [],
  appointments: [],
  actions: [],
  audit: [],
  applications: [],
  works: [],
  meetings: [],
  committeeMembers: [],
  committeeMeetings: [],
  inspections: [],
  wards: [],
  budget: [],
  kpiEntries: [],
});

class Store {
  constructor(dir) {
    this.dir = dir;
    this.file = path.join(dir, 'db.json');
    this.photoDir = path.join(dir, 'photos');
    fs.mkdirSync(this.photoDir, { recursive: true });
    this.data = fs.existsSync(this.file) ? JSON.parse(fs.readFileSync(this.file, 'utf8')) : EMPTY();
    // Migrate data files created by older versions: add any missing collections.
    const blank = EMPTY();
    for (const k of Object.keys(blank)) if (this.data[k] === undefined) this.data[k] = blank[k];
    for (const k of Object.keys(blank.meta.seq)) if (this.data.meta.seq[k] === undefined) this.data.meta.seq[k] = 0;
    this.saveTimer = null;
  }

  save() {
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.flush(), 50);
  }

  flush() {
    clearTimeout(this.saveTimer);
    const tmp = `${this.file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.data));
    fs.renameSync(tmp, this.file);
  }

  nextSeq(name) {
    this.data.meta.seq[name] = (this.data.meta.seq[name] || 0) + 1;
    return this.data.meta.seq[name];
  }

  audit(user, action, detail) {
    this.data.audit.unshift({
      at: new Date().toISOString(),
      userId: user ? user.id : null,
      name: user ? user.name : 'system',
      role: user ? user.role : null,
      action,
      detail: String(detail || '').slice(0, 300),
    });
    if (this.data.audit.length > 2000) this.data.audit.length = 2000;
  }

  savePhoto(id, dataUrl) {
    fs.writeFileSync(path.join(this.photoDir, `${id}.txt`), dataUrl);
  }

  readPhoto(id) {
    const f = path.join(this.photoDir, `${id}.txt`);
    return fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null;
  }
}

// ---------- passwords ----------
function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(pw, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(pw, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [salt, hash] = stored.split(':');
  const test = crypto.scryptSync(String(pw), salt, 64);
  const known = Buffer.from(hash, 'hex');
  return known.length === test.length && crypto.timingSafeEqual(known, test);
}

const newId = () => crypto.randomUUID();

// ---------- first-run seed ----------
function seed(store, { demo }) {
  const d = store.data;
  if (d.users.length) return null;
  const now = new Date();
  const credentials = [];

  const staff = [
    { username: 'chairperson', role: 'chairperson', name: `${cfg.HEAD_TITLE} (demo)` },
    { username: 'commissioner', role: 'commissioner', name: 'Municipal Commissioner (demo)' },
    { username: 'sanitation', role: 'officer', department: 'sanitation', name: 'Sanitary Inspector (demo)' },
    { username: 'engineering', role: 'officer', department: 'engineering', name: 'Assistant Engineer (demo)' },
    { username: 'electrical', role: 'officer', department: 'electrical', name: 'Electrical AE (demo)' },
    { username: 'townplanning', role: 'officer', department: 'town_planning', name: 'Town Planning Officer (demo)' },
    { username: 'revenue', role: 'officer', department: 'revenue', name: 'Revenue Officer (demo)' },
    { username: 'greenery', role: 'officer', department: 'greenery', name: 'Greenery Officer (demo)' },
    { username: 'admin', role: 'officer', department: 'administration', name: 'Manager, Administration (demo)' },
    { username: 'ward1', role: 'ward_officer', ward: 1, name: 'Ward Officer, Ward 1 (demo)' },
  ];
  for (const s of staff) {
    const password = demo ? 'demo1234' : crypto.randomBytes(9).toString('base64url');
    credentials.push({ username: s.username, password, role: s.role });
    d.users.push({
      id: newId(), role: s.role, name: s.name, username: s.username,
      department: s.department || null, ward: s.ward || null,
      passHash: hashPassword(password), active: true, createdAt: now.toISOString(),
    });
  }

  d.announcements.push(
    {
      id: newId(), ward: null, by: 'Municipality', createdAt: now.toISOString(),
      title: 'Welcome to Praja Seva', titleTe: 'ప్రజా సేవకు స్వాగతం',
      body: 'Report civic problems with a photo and location, track them to resolution, pay property tax and request a meeting with the ' + cfg.HEAD_TITLE + '.',
    },
    {
      id: newId(), ward: null, by: 'Public Health', createdAt: now.toISOString(),
      title: 'Hand over wet and dry waste separately', titleTe: 'తడి, పొడి చెత్తను వేరుగా ఇవ్వండి',
      body: 'Please keep green (wet) and blue (dry) bins and hand them to the collection vehicle separately.',
    },
  );

  // Demo property assessments so the tax screen can be tried.
  const owners = ['K. Ramesh', 'S. Lakshmi', 'M. Srinivas', 'P. Anitha', 'G. Venkatesh', 'B. Sujatha'];
  owners.forEach((owner, i) => {
    d.properties.push({
      assessmentNo: `10${String(i + 1).padStart(8, '0')}`,
      ownerName: owner,
      ward: (i % cfg.WARDS.length) + 1,
      address: `H.No. ${i + 2}-${10 + i}, Ward ${(i % cfg.WARDS.length) + 1}`,
      annualTax: 1200 + i * 650,
      arrears: i % 2 ? 900 + i * 100 : 0,
      payments: [],
    });
  });

  // Chairperson's action tracker, seeded from the blueprint's first-100-days list.
  const due = (days) => new Date(now.getTime() + days * 864e5).toISOString().slice(0, 10);
  [
    ['Hold first council meeting; adopt 100-day agenda and Citizen Charter', '100-day', 'Chairperson', 15],
    ['Review every wing with the Commissioner; publish state-of-the-town note', '100-day', 'Commissioner', 30],
    ['Form ward committees in all wards', '100-day', 'Chairperson', 45],
    ['Map and clear the worst 20% of garbage black spots', '100-day', 'Sanitation', 60],
    ['Property-tax drive: add unassessed buildings', '100-day', 'Revenue', 90],
    ['Pre-monsoon drain desilting', '100-day', 'Engineering', 75],
    ['100% door-to-door collection with segregation', '1-year', 'Sanitation', 365],
    ['Raise property-tax collection above 85%', '1-year', 'Revenue', 365],
    ['Daily water supply in every ward', '5-year', 'Engineering', 1460],
  ].forEach(([title, horizon, owner, days]) => {
    d.actions.push({ id: newId(), title, horizon, owner, dueDate: due(days), status: 'not_started', note: '', updatedAt: now.toISOString() });
  });

  store.audit(null, 'seed', 'Initial data created');
  store.flush();
  return credentials;
}

module.exports = { Store, seed, hashPassword, verifyPassword, newId };
