// Local server for trying the site without Netlify: static files + the same API on an in-memory store.
// Usage: DAYBOOK_SETUP_CODE=letmein node test/dev-server.mjs  (then open http://localhost:8888)
import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { createApi } from "../lib/api-core.mjs";

const m = new Map();
const store = {
  async get(k) { return m.has(k) ? JSON.parse(m.get(k)) : null; },
  async setJSON(k, v) { m.set(k, JSON.stringify(v)); },
  async delete(k) { m.delete(k); },
  async list({ prefix = "" } = {}) { return { blobs: [...m.keys()].filter(k => k.startsWith(prefix)).map(key => ({ key })) }; },
};
const handle = createApi({ store, env: k => process.env[k] });
const root = new URL("../public/", import.meta.url).pathname;
const types = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript" };
const port = Number(process.env.PORT || 8888);

http.createServer(async (req, res) => {
  if (req.url.startsWith("/api/")) {
    const chunks = []; for await (const c of req) chunks.push(c);
    const body = chunks.length ? Buffer.concat(chunks) : undefined;
    const r = await handle(new Request(`http://localhost:${port}${req.url}`, { method: req.method, headers: req.headers, body: ["GET", "HEAD"].includes(req.method) ? undefined : body }));
    res.writeHead(r.status, Object.fromEntries(r.headers)); res.end(Buffer.from(await r.arrayBuffer()));
    return;
  }
  let p = req.url.split("?")[0];
  if (p === "/") p = "/index.html"; if (p === "/owner") p = "/owner.html";
  try { const f = await readFile(join(root, normalize(p))); res.writeHead(200, { "content-type": types[extname(p)] || "application/octet-stream" }); res.end(f); }
  catch { res.writeHead(404); res.end("Not found"); }
}).listen(port, () => console.log(`Daybook on http://localhost:${port}`));
