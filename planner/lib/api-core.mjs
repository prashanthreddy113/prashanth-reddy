// Founder's Daybook API: accounts, sessions, per-user data and owner tools.
// Storage-agnostic: `store` needs get(key, {type:"json"}), setJSON, delete and list({prefix}).
import { randomBytes, scrypt as scryptCb, timingSafeEqual, createHash } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb);
const COOKIE = "db_session";
const SESSION_DAYS = 30;
const MAX_BODY = 2_000_000;
const MAX_FAILS = 8;
const LOCK_MINUTES = 15;
const USERNAME_RE = /^[a-z0-9._-]{3,32}$/;

const json = (status, body, headers = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store", ...headers } });
const fail = (status, error) => json(status, { error });
const now = () => Date.now();
const sha = s => createHash("sha256").update(s).digest("hex");

async function hashPassword(password, salt = randomBytes(16).toString("hex")) {
  const buf = await scrypt(password, salt, 64);
  return { salt, hash: buf.toString("hex") };
}
async function checkPassword(password, user) {
  const { hash } = await hashPassword(password, user.salt);
  const a = Buffer.from(hash, "hex"), b = Buffer.from(user.hash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}
export function tempPassword() {
  // Readable: no 0/O/1/l/I.
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(10);
  let s = "";
  for (const b of bytes) s += chars[b % chars.length];
  return s.slice(0, 5) + "-" + s.slice(5);
}

function publicUser(u) {
  return { username: u.username, name: u.name, role: u.role, mustChange: !!u.mustChange };
}
function ownerView(u) {
  return {
    username: u.username, name: u.name, role: u.role, disabled: !!u.disabled, mustChange: !!u.mustChange,
    createdAt: u.createdAt, lastLogin: u.lastLogin || null, lastSeen: u.lastSeen || null,
    dataUpdated: u.dataUpdated || null, counts: u.counts || null,
  };
}
function cookieFrom(req) {
  const raw = req.headers.get("cookie") || "";
  for (const part of raw.split(/;\s*/)) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i) === COOKIE) return part.slice(i + 1);
  }
  return null;
}
function sessionCookie(token, secure) {
  const maxAge = token ? SESSION_DAYS * 86400 : 0;
  return `${COOKIE}=${token || ""}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? "; Secure" : ""}`;
}
async function readBody(req) {
  const type = req.headers.get("content-type") || "";
  if (!type.includes("application/json")) throw new HttpError(415, "Send JSON.");
  const text = await req.text();
  if (text.length > MAX_BODY) throw new HttpError(413, "That's too much data to save at once.");
  try { return JSON.parse(text || "{}"); } catch { throw new HttpError(400, "Invalid JSON."); }
}
class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }

const cleanName = s => String(s || "").trim().slice(0, 60);
function checkNewPassword(p) {
  if (typeof p !== "string" || p.length < 8) throw new HttpError(400, "Use a password of at least 8 characters.");
  if (p.length > 200) throw new HttpError(400, "That password is too long.");
}
function countsOf(data) {
  const n = k => (Array.isArray(data?.[k]) ? data[k].length : 0);
  return { tasks: n("tasks"), notes: n("notes"), workouts: n("workouts"), meals: n("meals"), blocks: n("blocks"), milestones: n("milestones") };
}

export function createApi({ store, env = () => undefined }) {
  const getUser = u => store.get(`users/${u}`, { type: "json" });
  const putUser = u => store.setJSON(`users/${u.username}`, u);

  async function listUsers() {
    const { blobs } = await store.list({ prefix: "users/" });
    const users = await Promise.all(blobs.map(b => store.get(b.key, { type: "json" })));
    return users.filter(Boolean);
  }
  async function ownerExists() {
    return (await listUsers()).some(u => u.role === "owner");
  }
  async function startSession(user, secure) {
    const token = randomBytes(32).toString("base64url");
    await store.setJSON(`sessions/${sha(token)}`, { username: user.username, exp: now() + SESSION_DAYS * 86400e3 });
    return sessionCookie(token, secure);
  }
  async function currentUser(req) {
    const token = cookieFrom(req);
    if (!token) return null;
    const s = await store.get(`sessions/${sha(token)}`, { type: "json" });
    if (!s || s.exp < now()) return null;
    const u = await getUser(s.username);
    if (!u || u.disabled) return null;
    // Sessions from before the last password change are invalid.
    if (u.pwChangedAt && s.exp - SESSION_DAYS * 86400e3 < u.pwChangedAt - 1000) return null;
    if (!u.lastSeen || now() - u.lastSeen > 10 * 60e3) { u.lastSeen = now(); await putUser(u); }
    return u;
  }
  async function newAccount({ username, name, role, password }) {
    username = String(username || "").trim().toLowerCase();
    if (!USERNAME_RE.test(username)) throw new HttpError(400, "Usernames are 3–32 characters: letters, numbers, dot, dash or underscore.");
    if (await getUser(username)) throw new HttpError(409, `The username "${username}" is already taken.`);
    const { salt, hash } = await hashPassword(password);
    const u = { username, name: cleanName(name) || username, role, salt, hash, createdAt: now(), pwChangedAt: now(), mustChange: role !== "owner" };
    await putUser(u);
    return u;
  }

  const routes = {
    "GET /setup": async () => json(200, { needsOwner: !(await ownerExists()), setupEnabled: !!env("DAYBOOK_SETUP_CODE") }),

    "POST /setup": async (req, secure) => {
      const b = await readBody(req);
      const code = env("DAYBOOK_SETUP_CODE");
      if (!code) throw new HttpError(503, "Owner setup is switched off. Set DAYBOOK_SETUP_CODE in Netlify first.");
      if (await ownerExists()) throw new HttpError(409, "This site already has an owner. Sign in instead.");
      const a = Buffer.from(sha(String(b.code || ""))), c = Buffer.from(sha(code));
      if (!timingSafeEqual(a, c)) throw new HttpError(403, "That setup code is wrong.");
      checkNewPassword(b.password);
      const u = await newAccount({ username: b.username, name: b.name, role: "owner", password: b.password });
      u.lastLogin = now(); await putUser(u);
      return json(201, { user: publicUser(u) }, { "set-cookie": await startSession(u, secure) });
    },

    "POST /login": async (req, secure) => {
      const b = await readBody(req);
      const username = String(b.username || "").trim().toLowerCase();
      const u = USERNAME_RE.test(username) ? await getUser(username) : null;
      if (u?.lockUntil && u.lockUntil > now()) {
        const mins = Math.ceil((u.lockUntil - now()) / 60e3);
        throw new HttpError(429, `Too many wrong passwords. Try again in ${mins} minute${mins === 1 ? "" : "s"}.`);
      }
      const ok = u ? await checkPassword(String(b.password || ""), u) : (await hashPassword("x"), false);
      if (!u || !ok) {
        if (u) {
          u.fails = (u.fails || 0) + 1;
          if (u.fails >= MAX_FAILS) { u.lockUntil = now() + LOCK_MINUTES * 60e3; u.fails = 0; }
          await putUser(u);
        }
        throw new HttpError(401, "Wrong username or password.");
      }
      if (u.disabled) throw new HttpError(403, "This account is switched off. Ask the site owner to turn it back on.");
      u.fails = 0; u.lockUntil = 0; u.lastLogin = now(); u.lastSeen = now();
      await putUser(u);
      return json(200, { user: publicUser(u) }, { "set-cookie": await startSession(u, secure) });
    },

    "POST /logout": async (req, secure) => {
      const token = cookieFrom(req);
      if (token) await store.delete(`sessions/${sha(token)}`);
      return json(200, { ok: true }, { "set-cookie": sessionCookie(null, secure) });
    },

    "GET /me": async (req, secure, me) => json(200, { user: publicUser(me) }),

    "POST /password": async (req, secure, me) => {
      const b = await readBody(req);
      if (!(await checkPassword(String(b.current || ""), me))) throw new HttpError(403, "Your current password is wrong.");
      checkNewPassword(b.next);
      if (b.next === b.current) throw new HttpError(400, "Pick a password different from the current one.");
      Object.assign(me, await hashPassword(b.next), { mustChange: false, pwChangedAt: now() });
      await putUser(me);
      // Old sessions stop working; hand this browser a fresh one.
      return json(200, { user: publicUser(me) }, { "set-cookie": await startSession(me, secure) });
    },

    "GET /data": async (req, secure, me) => {
      const d = await store.get(`data/${me.username}`, { type: "json" });
      return json(200, d || { data: null, updatedAt: 0 });
    },

    "PUT /data": async (req, secure, me) => {
      const b = await readBody(req);
      if (!b.data || typeof b.data !== "object" || Array.isArray(b.data)) throw new HttpError(400, "Nothing to save.");
      const updatedAt = now();
      await store.setJSON(`data/${me.username}`, { data: b.data, updatedAt });
      me.dataUpdated = updatedAt; me.counts = countsOf(b.data);
      await putUser(me);
      return json(200, { updatedAt });
    },

    "GET /admin/users": async (req, secure, me) => {
      const users = (await listUsers()).map(ownerView).sort((a, b) => (a.role === "owner" ? -1 : b.role === "owner" ? 1 : b.createdAt - a.createdAt));
      return json(200, { users, me: me.username });
    },

    "POST /admin/users": async (req) => {
      const b = await readBody(req);
      const password = b.password ? String(b.password) : tempPassword();
      checkNewPassword(password);
      const u = await newAccount({ username: b.username, name: b.name, role: "user", password });
      return json(201, { user: ownerView(u), password });
    },
  };

  async function adminUser(method, username, req, me) {
    const u = await getUser(String(username).toLowerCase());
    if (!u) throw new HttpError(404, "No such user.");
    const self = u.username === me.username;
    if (method === "DELETE") {
      if (self || u.role === "owner") throw new HttpError(400, "The owner account can't be deleted.");
      await store.delete(`users/${u.username}`);
      await store.delete(`data/${u.username}`);
      return json(200, { ok: true });
    }
    const b = await readBody(req);
    let password;
    if (typeof b.name === "string" && cleanName(b.name)) u.name = cleanName(b.name);
    if (typeof b.disabled === "boolean") {
      if (self && b.disabled) throw new HttpError(400, "You can't switch off your own account.");
      u.disabled = b.disabled;
    }
    if (b.resetPassword) {
      if (self) throw new HttpError(400, "Change your own password from Backup & settings.");
      password = tempPassword();
      Object.assign(u, await hashPassword(password), { mustChange: true, pwChangedAt: now(), fails: 0, lockUntil: 0 });
    }
    await putUser(u);
    return json(200, { user: ownerView(u), ...(password ? { password } : {}) });
  }

  return async function handle(req) {
    const url = new URL(req.url);
    const secure = url.protocol === "https:";
    const path = url.pathname.replace(/^\/api/, "").replace(/\/+$/, "") || "/";
    const key = `${req.method} ${path}`;
    try {
      const open = ["GET /setup", "POST /setup", "POST /login", "POST /logout"];
      if (open.includes(key)) return await routes[key](req, secure);

      const me = await currentUser(req);
      if (!me) return fail(401, "Please sign in.");

      const m = path.match(/^\/admin\/users\/([^/]+)$/);
      const isAdmin = path.startsWith("/admin/");
      if (isAdmin && me.role !== "owner") return fail(403, "Only the site owner can do that.");
      if (m && (req.method === "PATCH" || req.method === "DELETE")) return await adminUser(req.method, decodeURIComponent(m[1]), req, me);
      // A user who still has a temporary password can only change it.
      if (me.mustChange && !["GET /me", "POST /password"].includes(key)) return fail(403, "Set a new password first.");
      const fn = routes[key];
      if (!fn) return fail(404, "Not found.");
      return await fn(req, secure, me);
    } catch (e) {
      if (e instanceof HttpError) return fail(e.status, e.message);
      console.error(e);
      return fail(500, "Something went wrong on the server. Try again.");
    }
  };
}
