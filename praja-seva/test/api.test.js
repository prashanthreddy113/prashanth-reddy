'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createServer } = require('../server/index.js');

let server, base, dir;
const sms = [];

before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'praja-seva-test-'));
  server = createServer({ dataDir: dir, demo: true, quiet: true, sendSms: async (m, text) => sms.push({ m, text }) });
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
  return { status: res.status, body: await res.json().catch(() => null) };
}

async function citizen(mobile, name) {
  const r1 = await call('POST', '/api/auth/otp/request', { mobile });
  assert.equal(r1.status, 200);
  const r2 = await call('POST', '/api/auth/otp/verify', { mobile, otp: r1.body.devOtp, name, ward: 3 });
  assert.equal(r2.status, 200);
  return r2.body.token;
}

async function staff(username) {
  const r = await call('POST', '/api/auth/staff/login', { username, password: 'demo1234' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  return r.body.token;
}

test('public config and static app are served', async () => {
  const r = await call('GET', '/api/config');
  assert.equal(r.status, 200);
  assert.ok(r.body.categories.length > 10);
  const html = await fetch(base + '/');
  assert.equal(html.status, 200);
  assert.match(html.headers.get('content-security-policy'), /default-src 'self'/);
  const trav = await fetch(base + '/..%2f..%2fpackage.json');
  assert.notEqual(trav.status, 200);
});

test('OTP login rejects bad numbers and wrong codes', async () => {
  assert.equal((await call('POST', '/api/auth/otp/request', { mobile: '12345' })).status, 400);
  await call('POST', '/api/auth/otp/request', { mobile: '9000000001' });
  assert.equal((await call('POST', '/api/auth/otp/verify', { mobile: '9000000001', otp: '000000' })).status, 400);
  assert.equal((await call('POST', '/api/auth/otp/request', { mobile: '9000000001' })).status, 429, 'resend throttled');
});

test('full complaint lifecycle: citizen -> officer -> citizen feedback', async () => {
  const c = await citizen('9876543210', 'Ravi Kumar');
  const created = await call('POST', '/api/grievances', {
    category: 'streetlight', ward: 3, location: 'Gandhi Chowk, near temple', description: 'Three streetlights off for a week',
  }, c);
  assert.equal(created.status, 200, JSON.stringify(created.body));
  const g = created.body;
  assert.match(g.number, /^PS-\d{4}-\d{6}$/);
  assert.equal(g.department, 'electrical');
  assert.equal(g.status, 'submitted');

  // Another department's officer cannot see it.
  const san = await staff('sanitation');
  assert.equal((await call('GET', `/api/grievances/${g.id}`, null, san)).status, 404);

  // Another citizen cannot see it.
  const other = await citizen('9876500000', 'Other');
  assert.equal((await call('GET', `/api/grievances/${g.id}`, null, other)).status, 404);

  const ele = await staff('electrical');
  const queue = await call('GET', '/api/staff/grievances', null, ele);
  assert.ok(queue.body.some((x) => x.id === g.id));

  const officers = await call('GET', '/api/staff/officers', null, ele);
  const me = officers.body.find((o) => o.username === 'electrical');
  const eng = officers.body.find((o) => o.username === 'engineering');
  assert.equal((await call('POST', `/api/staff/grievances/${g.id}/assign`, { officerId: eng.id }, ele)).status, 403, 'cross-department assign blocked');
  assert.equal((await call('POST', `/api/staff/grievances/${g.id}/assign`, { officerId: me.id }, ele)).body.status, 'assigned');
  assert.equal((await call('POST', `/api/staff/grievances/${g.id}/status`, { status: 'in_progress' }, ele)).body.status, 'in_progress');
  assert.equal((await call('POST', `/api/staff/grievances/${g.id}/status`, { status: 'resolved' }, ele)).status, 400, 'remark required');
  const done = await call('POST', `/api/staff/grievances/${g.id}/status`, { status: 'resolved', remark: 'Replaced 3 LED fittings' }, ele);
  assert.equal(done.body.status, 'resolved');

  const fb = await call('POST', `/api/grievances/${g.id}/feedback`, { rating: 5, comment: 'Quick work' }, c);
  assert.equal(fb.body.feedback.rating, 5);

  const reopened = await call('POST', `/api/grievances/${g.id}/reopen`, { reason: 'One light is off again' }, c);
  assert.equal(reopened.body.status, 'reopened');
  assert.equal(reopened.body.reopenCount, 1);

  const pub = await call('GET', '/api/public/stats');
  assert.ok(pub.body.total >= 1);
  assert.equal(pub.body.byCategory, undefined);
});

test('role checks: citizens cannot use staff APIs, officers cannot use leadership APIs', async () => {
  const c = await citizen('9123456789');
  assert.equal((await call('GET', '/api/staff/grievances', null, c)).status, 403);
  assert.equal((await call('GET', '/api/staff/grievances')).status, 401);
  const rev = await staff('revenue');
  assert.equal((await call('POST', '/api/staff/announcements', { title: 'x', body: 'y' }, rev)).status, 403);
  assert.equal((await call('GET', '/api/staff/audit', null, rev)).status, 403);
  assert.equal((await call('POST', '/api/auth/staff/login', { username: 'revenue', password: 'wrong' })).status, 401);
});

test('validation rejects bad complaints and photos', async () => {
  const c = await citizen('9988776655');
  assert.equal((await call('POST', '/api/grievances', { category: 'nope', ward: 1, location: 'abc', description: 'long enough text' }, c)).status, 400);
  assert.equal((await call('POST', '/api/grievances', { category: 'garbage', ward: 999, location: 'abc', description: 'long enough text' }, c)).status, 400);
  assert.equal((await call('POST', '/api/grievances', { category: 'garbage', ward: 1, location: 'abc', description: 'long enough text', photo: 'data:text/html;base64,PHNjcmlwdD4=' }, c)).status, 400);
  const ok = await call('POST', '/api/grievances', { category: 'garbage', ward: 1, location: 'Main road', description: 'Garbage pile for 3 days', photo: 'data:image/png;base64,iVBORw0KGgo=' }, c);
  assert.equal(ok.status, 200);
  const photo = await call('GET', `/api/grievances/${ok.body.id}/photo`, null, c);
  assert.match(photo.body.photo, /^data:image\/png/);
});

test('chairperson tools: announcements, appointments, action tracker, staff accounts', async () => {
  const chair = await staff('chairperson');
  const a = await call('POST', '/api/staff/announcements', { title: 'Water supply shutdown', body: 'Ward 4, Sunday 6am-2pm', ward: 4 }, chair);
  assert.equal(a.status, 200);
  assert.ok((await call('GET', '/api/announcements')).body.some((x) => x.id === a.body.id));

  const c = await citizen('9012345678', 'Sita');
  const req = await call('POST', '/api/appointments', { purpose: 'Drainage problem in our colony', preferredDate: '2030-01-15' }, c);
  assert.equal(req.status, 200);
  const sch = await call('POST', `/api/staff/appointments/${req.body.id}`, { status: 'scheduled', slot: '2030-01-15 11:00' }, chair);
  assert.equal(sch.body.status, 'scheduled');
  assert.equal((await call('GET', '/api/appointments/mine', null, c)).body[0].slot, '2030-01-15 11:00');

  const actions = await call('GET', '/api/staff/actions', null, chair);
  assert.ok(actions.body.length >= 5);
  const upd = await call('PATCH', `/api/staff/actions/${actions.body[0].id}`, { status: 'done' }, chair);
  assert.equal(upd.body.status, 'done');

  const nu = await call('POST', '/api/staff/users', { name: 'SI Ward 5', username: 'si.ward5', password: 'longpassword', role: 'ward_officer', ward: 5 }, chair);
  assert.equal(nu.status, 200);
  const login = await call('POST', '/api/auth/staff/login', { username: 'si.ward5', password: 'longpassword' });
  assert.equal(login.status, 200);

  const dash = await call('GET', '/api/staff/dashboard', null, chair);
  assert.equal(dash.status, 200);
  assert.ok(dash.body.actions.done >= 1);
});

test('property tax lookup and demo payment', async () => {
  const c = await citizen('9555512345');
  const p = await call('GET', '/api/property/1000000002', null, c);
  assert.equal(p.status, 200);
  assert.equal((await call('POST', '/api/property/1000000002/pay', { amount: p.body.due + 1 }, c)).status, 400);
  const pay = await call('POST', '/api/property/1000000002/pay', { amount: 500 }, c);
  assert.match(pay.body.receipt.receiptNo, /^RCPT-/);
  assert.equal(pay.body.property.due, p.body.due - 500);
  assert.equal((await call('GET', '/api/property/0000', null, c)).status, 404);
});

test('data is persisted to disk', async () => {
  server.store.flush();
  const saved = JSON.parse(fs.readFileSync(path.join(dir, 'db.json'), 'utf8'));
  assert.ok(saved.grievances.length >= 2);
  assert.ok(saved.users.every((u) => !u.passHash || !u.passHash.includes('demo1234')));
});
