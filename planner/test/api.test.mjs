import { test } from "node:test";
import assert from "node:assert/strict";
import { createApi } from "../lib/api-core.mjs";

function memoryStore() {
  const m = new Map();
  return {
    m,
    async get(k) { return m.has(k) ? JSON.parse(m.get(k)) : null; },
    async setJSON(k, v) { m.set(k, JSON.stringify(v)); },
    async delete(k) { m.delete(k); },
    async list({ prefix = "" } = {}) { return { blobs: [...m.keys()].filter(k => k.startsWith(prefix)).map(key => ({ key })) }; },
  };
}

function client(handle) {
  const jar = {};
  return async function call(method, path, body, who = "default") {
    const headers = { "content-type": "application/json" };
    if (jar[who]) headers.cookie = jar[who];
    const res = await handle(new Request("https://daybook.test/api" + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }));
    const set = res.headers.get("set-cookie");
    if (set) jar[who] = set.split(";")[0];
    return { status: res.status, body: await res.json() };
  };
}

function setup() {
  const store = memoryStore();
  const handle = createApi({ store, env: k => (k === "DAYBOOK_SETUP_CODE" ? "secret-code" : undefined) });
  return { store, call: client(handle) };
}

async function withOwner() {
  const s = setup();
  const r = await s.call("POST", "/setup", { code: "secret-code", username: "Prashanth", name: "Prashanth", password: "owner-pass-1" }, "owner");
  assert.equal(r.status, 201);
  return s;
}

test("owner setup needs the code and only works once", async () => {
  const { call } = setup();
  assert.deepEqual((await call("GET", "/setup")).body, { needsOwner: true, setupEnabled: true });
  assert.equal((await call("POST", "/setup", { code: "wrong", username: "boss", password: "long-enough" })).status, 403);
  assert.equal((await call("POST", "/setup", { code: "secret-code", username: "boss", password: "long-enough" })).status, 201);
  assert.equal((await call("GET", "/setup")).body.needsOwner, false);
  assert.equal((await call("POST", "/setup", { code: "secret-code", username: "boss2", password: "long-enough" })).status, 409);
});

test("owner creates a user who must change the temp password before using the app", async () => {
  const { call } = await withOwner();
  const c = await call("POST", "/admin/users", { username: "Ravi", name: "Ravi K" }, "owner");
  assert.equal(c.status, 201);
  assert.equal(c.body.user.username, "ravi");
  const temp = c.body.password;

  assert.equal((await call("POST", "/login", { username: "ravi", password: "nope-nope" }, "ravi")).status, 401);
  const l = await call("POST", "/login", { username: "RAVI", password: temp }, "ravi");
  assert.equal(l.status, 200);
  assert.equal(l.body.user.mustChange, true);
  assert.equal((await call("GET", "/data", undefined, "ravi")).status, 403);

  const p = await call("POST", "/password", { current: temp, next: "ravi-new-pass" }, "ravi");
  assert.equal(p.status, 200);
  assert.equal(p.body.user.mustChange, false);
  assert.equal((await call("GET", "/data", undefined, "ravi")).status, 200);
});

test("each user sees only their own data; owner sees counts, not content", async () => {
  const { call } = await withOwner();
  const { body } = await call("POST", "/admin/users", { username: "asha", password: "asha-pass-1" }, "owner");
  await call("POST", "/login", { username: "asha", password: body.password }, "asha");
  await call("POST", "/password", { current: "asha-pass-1", next: "asha-pass-2" }, "asha");

  const saved = await call("PUT", "/data", { data: { tasks: [{ title: "secret plan" }], notes: [{}, {}] } }, "asha");
  assert.equal(saved.status, 200);
  assert.equal((await call("GET", "/data", undefined, "asha")).body.data.tasks[0].title, "secret plan");
  assert.equal((await call("GET", "/data", undefined, "owner")).body.data, null);

  const list = await call("GET", "/admin/users", undefined, "owner");
  const asha = list.body.users.find(u => u.username === "asha");
  assert.deepEqual([asha.counts.tasks, asha.counts.notes], [1, 2]);
  assert.ok(!JSON.stringify(list.body).includes("secret plan"));
  assert.ok(!JSON.stringify(list.body).includes("hash"));
});

test("non-owners can't use owner endpoints", async () => {
  const { call } = await withOwner();
  await call("POST", "/admin/users", { username: "sam", password: "sam-pass-11" }, "owner");
  await call("POST", "/login", { username: "sam", password: "sam-pass-11" }, "sam");
  await call("POST", "/password", { current: "sam-pass-11", next: "sam-pass-22" }, "sam");
  assert.equal((await call("GET", "/admin/users", undefined, "sam")).status, 403);
  assert.equal((await call("DELETE", "/admin/users/prashanth", undefined, "sam")).status, 403);
  assert.equal((await call("GET", "/admin/users", undefined, "nobody")).status, 401);
});

test("disable, reset password and delete", async () => {
  const { call, store } = await withOwner();
  await call("POST", "/admin/users", { username: "neha", password: "neha-pass-1" }, "owner");
  await call("POST", "/login", { username: "neha", password: "neha-pass-1" }, "neha");
  assert.equal((await call("GET", "/me", undefined, "neha")).status, 200);

  await call("PATCH", "/admin/users/neha", { disabled: true }, "owner");
  assert.equal((await call("GET", "/me", undefined, "neha")).status, 401);
  assert.equal((await call("POST", "/login", { username: "neha", password: "neha-pass-1" }, "neha")).status, 403);
  await call("PATCH", "/admin/users/neha", { disabled: false }, "owner");

  const r = await call("PATCH", "/admin/users/neha", { resetPassword: true }, "owner");
  assert.ok(r.body.password);
  assert.equal((await call("POST", "/login", { username: "neha", password: "neha-pass-1" }, "neha")).status, 401);
  assert.equal((await call("POST", "/login", { username: "neha", password: r.body.password }, "neha")).status, 200);

  assert.equal((await call("DELETE", "/admin/users/prashanth", undefined, "owner")).status, 400);
  assert.equal((await call("DELETE", "/admin/users/neha", undefined, "owner")).status, 200);
  assert.equal(await store.get("users/neha"), null);
  assert.equal((await call("GET", "/me", undefined, "neha")).status, 401);
});

test("changing a password signs out other sessions", async () => {
  const { call } = await withOwner();
  await call("POST", "/login", { username: "prashanth", password: "owner-pass-1" }, "phone");
  assert.equal((await call("GET", "/me", undefined, "phone")).status, 200);
  // Sessions are timestamped in ms; make sure the change lands later.
  await new Promise(r => setTimeout(r, 1100));
  assert.equal((await call("POST", "/password", { current: "owner-pass-1", next: "owner-pass-2" }, "owner")).status, 200);
  assert.equal((await call("GET", "/me", undefined, "owner")).status, 200);
  assert.equal((await call("GET", "/me", undefined, "phone")).status, 401);
});

test("repeated wrong passwords lock the account for a while", async () => {
  const { call } = await withOwner();
  for (let i = 0; i < 8; i++) await call("POST", "/login", { username: "prashanth", password: "bad-guess" }, "x");
  const r = await call("POST", "/login", { username: "prashanth", password: "owner-pass-1" }, "x");
  assert.equal(r.status, 429);
});

test("rejects bad usernames, short passwords and non-JSON posts", async () => {
  const { call } = await withOwner();
  assert.equal((await call("POST", "/admin/users", { username: "a b", password: "long-enough" }, "owner")).status, 400);
  assert.equal((await call("POST", "/admin/users", { username: "okname", password: "short" }, "owner")).status, 400);
  assert.equal((await call("POST", "/admin/users", { username: "prashanth" }, "owner")).status, 409);
});
