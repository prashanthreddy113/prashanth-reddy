'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createServer } = require('../server/index.js');

let server, base, dir;

before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'praja-seva-mod-'));
  server = createServer({ dataDir: dir, demo: true, quiet: true, sendSms: async () => {} });
  await new Promise((r) => server.listen(0, r));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((r) => server.close(r));
  fs.rmSync(dir, { recursive: true, force: true });
});

async function call(method, p, body, token) {
  const res = await fetch(base + p, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* CSV or HTML */ }
  return { status: res.status, body: json, text, headers: res.headers };
}
const staff = async (u) => (await call('POST', '/api/auth/staff/login', { username: u, password: 'demo1234' })).body.token;
async function citizen(mobile) {
  const r1 = await call('POST', '/api/auth/otp/request', { mobile });
  return (await call('POST', '/api/auth/otp/verify', { mobile, otp: r1.body.devOtp, name: 'Test Citizen' })).body.token;
}

test('three sites are served: portal, citizen app, office console', async () => {
  for (const p of ['/', '/app/', '/office/', '/office/#/s', '/app/app.js', '/site.js', '/common.js']) {
    const r = await fetch(base + p);
    assert.equal(r.status, 200, p);
  }
  const portal = await (await fetch(base + '/')).text();
  assert.match(portal, /site\.js/);
  const office = await (await fetch(base + '/office/')).text();
  assert.match(office, /app\/app\.js/);
  const redirect = await fetch(base + '/office', { redirect: 'manual' });
  assert.equal(redirect.status, 301);
});

test('public portal data: overview, works, council, wards, budget, KPIs', async () => {
  const o = await call('GET', '/api/public/overview');
  assert.equal(o.status, 200);
  assert.ok(o.body.complaints.total > 20, 'demo complaints seeded');
  assert.equal(o.body.kpis.length, 10);
  assert.ok(o.body.budget.greenPct > 0);
  const works = await call('GET', '/api/public/works');
  assert.ok(works.body.length >= 5);
  const meetings = await call('GET', '/api/public/meetings');
  assert.ok(meetings.body.some((m) => m.resolutions.length));
  const wards = await call('GET', '/api/public/wards');
  assert.equal(wards.body.length, 30);
  const w1 = await call('GET', '/api/public/wards/1');
  assert.equal(w1.body.committees.length, 4);
  assert.ok(w1.body.committees.every((c) => c.members.every((m) => typeof m === 'string')), 'only names are public');
  assert.equal((await call('GET', '/api/public/wards/999')).status, 404);
});

test('service application lifecycle and public tracking', async () => {
  const c = await citizen('9811111111');
  assert.equal((await call('POST', '/api/applications', { service: 'building', ward: 2, details: 'Plan approval' }, c)).status, 400, 'external service cannot be applied here');
  const a = await call('POST', '/api/applications', { service: 'water_connection', ward: 2, details: 'New tap for H.No 4-12' }, c);
  assert.equal(a.status, 200);
  assert.match(a.body.number, /^SR-\d{4}-\d{6}$/);
  assert.equal(a.body.department, 'engineering');

  const san = await staff('sanitation');
  assert.equal((await call('POST', `/api/staff/applications/${a.body.id}/status`, { status: 'approved' }, san)).status, 404, 'other departments cannot act');
  const eng = await staff('engineering');
  assert.ok((await call('GET', '/api/staff/applications', null, eng)).body.some((x) => x.id === a.body.id));
  assert.equal((await call('POST', `/api/staff/applications/${a.body.id}/status`, { status: 'rejected' }, eng)).status, 400, 'rejection needs a reason');
  await call('POST', `/api/staff/applications/${a.body.id}/status`, { status: 'verification' }, eng);
  const issued = await call('POST', `/api/staff/applications/${a.body.id}/status`, { status: 'issued', remark: 'Connection given' }, eng);
  assert.equal(issued.body.status, 'issued');

  const tr = await call('GET', `/api/public/track/${a.body.number.toLowerCase()}`);
  assert.equal(tr.body.kind, 'application');
  assert.equal(tr.body.status, 'issued');
  assert.equal(tr.body.mobile, undefined, 'no personal data in public tracking');
  assert.ok(tr.body.history.every((h) => h.by !== 'Test Citizen'), 'citizen name hidden');
  assert.equal((await call('GET', '/api/public/track/PS-0000-000000')).status, 404);
});

test('walk-in complaint and inspection-to-complaint', async () => {
  const chair = await staff('chairperson');
  const g = await call('POST', '/api/staff/grievances', { name: 'Walk-in Person', mobile: '9822222222', source: 'praja_vani', category: 'drain', ward: 5, location: 'Market road', description: 'Drain blocked since a week' }, chair);
  assert.equal(g.status, 200);
  assert.equal(g.body.source, 'praja_vani');
  const tr = await call('GET', `/api/public/track/${g.body.number}`);
  assert.equal(tr.body.kind, 'complaint');

  const ins = await call('POST', '/api/staff/inspections', { ward: 6, date: '2026-11-01', location: 'School junction', findings: 'Streetlights off near school', severity: 'high' }, chair);
  assert.equal(ins.status, 200);
  const raised = await call('POST', `/api/staff/inspections/${ins.body.id}/complaint`, { category: 'streetlight' }, chair);
  assert.equal(raised.body.department, 'electrical');
  assert.equal((await call('POST', `/api/staff/inspections/${ins.body.id}/complaint`, { category: 'streetlight' }, chair)).status, 400, 'only once');

  const ward1 = await staff('ward1');
  assert.equal((await call('POST', '/api/staff/inspections', { ward: 2, date: '2026-11-01', location: 'x road', findings: 'Something wrong here' }, ward1)).status, 403, 'ward officer limited to own ward');
});

test('development works: leadership edits money, officers update progress only', async () => {
  const chair = await staff('chairperson');
  const w = await call('POST', '/api/staff/works', { title: 'New park in Ward 3', type: 'greenery', ward: 3, scheme: 'General funds', sanctioned: 2500000 }, chair);
  assert.equal(w.status, 200);
  assert.equal(w.body.status, 'proposed');
  const eng = await staff('engineering');
  const upd = await call('PATCH', `/api/staff/works/${w.body.id}`, { status: 'in_progress', progress: 30, sanctioned: 1, note: 'Foundation done' }, eng);
  assert.equal(upd.body.progress, 30);
  assert.equal(upd.body.sanctioned, 2500000, 'officer cannot change the sanctioned amount');
  assert.equal((await call('PATCH', `/api/staff/works/${w.body.id}`, { progress: 130 }, chair)).status, 400);
  assert.equal((await call('POST', '/api/staff/works', { title: 'Officer work attempt', sanctioned: 1 }, eng)).status, 403);
  const ward1 = await staff('ward1');
  assert.equal((await call('PATCH', `/api/staff/works/${w.body.id}`, { progress: 50 }, ward1)).status, 403);
});

test('council meetings, resolutions and publishing', async () => {
  const chair = await staff('chairperson');
  assert.equal((await call('POST', '/api/staff/meetings', { date: '2026-12-01T10:30:00Z', agenda: '' }, chair)).status, 400);
  const m = await call('POST', '/api/staff/meetings', { type: 'special', date: '2026-12-01T10:30:00Z', agenda: 'Flood relief\nBudget revision', published: false }, chair);
  assert.deepEqual(m.body.agenda, ['Flood relief', 'Budget revision']);
  assert.ok(!(await call('GET', '/api/public/meetings')).body.some((x) => x.id === m.body.id), 'unpublished meetings hidden');
  const r = await call('POST', `/api/staff/meetings/${m.body.id}/resolutions`, { subject: 'Rs 10 lakh released for flood relief', decision: 'passed' }, chair);
  assert.equal(r.body.status, 'held');
  await call('PATCH', `/api/staff/meetings/${m.body.id}`, { published: true, minutes: 'All members present' }, chair);
  const pub = (await call('GET', '/api/public/meetings')).body.find((x) => x.id === m.body.id);
  assert.equal(pub.resolutions[0].decision, 'passed');
  const rev = await staff('revenue');
  assert.equal((await call('POST', '/api/staff/meetings', { date: '2026-12-01', agenda: 'x' }, rev)).status, 403);
});

test('ward committees: members, meetings and ward-officer scope', async () => {
  const ward1 = await staff('ward1');
  const add = await call('POST', '/api/staff/committees/members', { ward: 1, type: 'youth', name: 'New Member' }, ward1);
  assert.equal(add.status, 200);
  assert.equal((await call('POST', '/api/staff/committees/members', { ward: 2, type: 'youth', name: 'Other ward' }, ward1)).status, 403);
  const mt = await call('POST', '/api/staff/committees/meetings', { ward: 1, date: '2026-11-10', attendees: 22, issues: 'Water timings irregular' }, ward1);
  assert.equal(mt.status, 200);
  const list = await call('GET', '/api/staff/committees', null, ward1);
  assert.equal(list.body.ward, 1);
  assert.ok(list.body.members.some((x) => x.name === 'New Member'));
  assert.equal((await call('DELETE', `/api/staff/committees/members/${add.body.id}`, null, ward1)).status, 200);
});

test('wards, budget, KPIs, review report and CSV export', async () => {
  const chair = await staff('chairperson');
  const w = await call('PATCH', '/api/staff/wards/4', { councillor: 'Test Councillor', locality: 'Station Road' }, chair);
  assert.equal(w.body.councillor, 'Test Councillor');
  assert.equal((await call('GET', '/api/public/wards/4')).body.councillor, 'Test Councillor');

  const b = await call('GET', '/api/staff/budget', null, chair);
  const green = b.body.heads.find((h) => h.green);
  const nb = await call('PATCH', `/api/staff/budget/${green.id}`, { allocated: green.allocated * 2 }, chair);
  assert.ok(nb.body.greenPct > b.body.greenPct);
  assert.equal((await call('PATCH', `/api/staff/budget/${green.id}`, { allocated: -5 }, chair)).status, 400);

  assert.equal((await call('POST', '/api/staff/kpis', { kpi: 'complaints_on_time', month: '2026-11', value: 50 }, chair)).status, 400, 'auto KPIs cannot be typed in');
  assert.equal((await call('POST', '/api/staff/kpis', { kpi: 'segregation', month: '2026-13', value: 50 }, chair)).status, 400);
  const k = await call('POST', '/api/staff/kpis', { kpi: 'segregation', month: '2099-01', value: 81 }, chair);
  const seg = k.body.find((x) => x.id === 'segregation');
  assert.equal(seg.value, 81);
  assert.equal(seg.rating, 'good');

  const rep = await call('GET', '/api/staff/report', null, chair);
  assert.equal(rep.status, 200);
  assert.ok(Array.isArray(rep.body.topOverdue));
  assert.equal((await call('GET', '/api/staff/report', null, await staff('revenue'))).status, 403);

  // CSV: formula-looking cells are neutralised.
  const c = await citizen('9833333333');
  await call('POST', '/api/grievances', { category: 'garbage', ward: 1, location: '=HYPERLINK("http://x")', description: 'Garbage everywhere here' }, c);
  const csv = await call('GET', '/api/staff/export/complaints.csv', null, chair);
  assert.equal(csv.status, 200);
  assert.match(csv.headers.get('content-type'), /text\/csv/);
  assert.match(csv.text, /'=HYPERLINK/);
  assert.equal((await call('GET', '/api/staff/export/secret.csv', null, chair)).status, 404);
});

test('an old data file without the new collections is migrated on start', async () => {
  const old = fs.mkdtempSync(path.join(os.tmpdir(), 'praja-seva-old-'));
  fs.writeFileSync(path.join(old, 'db.json'), JSON.stringify({ meta: { seq: { grievance: 5, receipt: 0 } }, users: [{ id: 'x', role: 'chairperson', name: 'C', username: 'c', passHash: 'a:b', active: true }], grievances: [], announcements: [], properties: [], appointments: [], actions: [], audit: [] }));
  const s2 = createServer({ dataDir: old, demo: false, quiet: true });
  assert.ok(Array.isArray(s2.store.data.works));
  assert.equal(s2.store.data.wards.length, 30);
  assert.equal(s2.store.data.meta.seq.grievance, 5);
  assert.equal(s2.store.data.grievances.length, 0, 'no demo data outside demo mode');
  fs.rmSync(old, { recursive: true, force: true });
});
