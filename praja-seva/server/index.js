'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { Store, seed } = require('./store');
const { createApi, HttpError } = require('./api');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const MAX_BODY = 2 * 1024 * 1024;
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon',
};
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(self), geolocation=(self), microphone=()',
  'Content-Security-Policy': "default-src 'self'; img-src 'self' data: blob:; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
};

function createServer({ dataDir, demo = false, sendSms, quiet = false } = {}) {
  const store = new Store(dataDir || path.join(__dirname, '..', 'data'));
  const creds = seed(store, { demo });
  if (creds && !quiet) {
    const lines = creds.map((c) => `  ${c.username.padEnd(14)} ${c.password.padEnd(16)} (${c.role})`).join('\n');
    console.log(`\nFirst run: staff accounts created. Change these passwords after first login.\n${lines}\n`);
    if (!demo) fs.writeFileSync(path.join(store.dir, 'initial-credentials.txt'), lines + '\n', { mode: 0o600 });
  }
  const api = createApi(store, { demo, sendSms });

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    try {
      if (url.pathname.startsWith('/api/')) {
        const body = ['POST', 'PATCH', 'PUT'].includes(req.method) ? await readJson(req) : null;
        const result = await api.handle(req, res, url, body);
        return send(res, 200, JSON.stringify(result ?? { ok: true }), 'application/json');
      }
      return serveStatic(url.pathname, res);
    } catch (err) {
      const status = err instanceof HttpError ? err.status : 500;
      if (status === 500 && !quiet) console.error(err);
      return send(res, status, JSON.stringify({ error: status === 500 ? 'Something went wrong' : err.message }), 'application/json');
    }
  });
  server.store = store;
  server.on('close', () => store.flush());
  return server;
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) { reject(new HttpError(413, 'Request too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try {
        const v = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        resolve(v && typeof v === 'object' && !Array.isArray(v) ? v : {});
      } catch { reject(new HttpError(400, 'Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

function send(res, status, body, type) {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', ...SECURITY_HEADERS });
  res.end(body);
}

function serveStatic(pathname, res) {
  let rel = decodeURIComponent(pathname);
  if (rel === '/' || !path.extname(rel)) rel = '/index.html'; // single-page app
  const file = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!file.startsWith(PUBLIC_DIR + path.sep)) return send(res, 403, 'Forbidden', 'text/plain');
  fs.readFile(file, (err, buf) => {
    if (err) return send(res, 404, 'Not found', 'text/plain');
    const type = TYPES[path.extname(file)] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-cache', ...SECURITY_HEADERS });
    res.end(buf);
  });
}

if (require.main === module) {
  const port = Number(process.env.PORT) || 8080;
  const demo = process.env.DEMO === '1';
  const server = createServer({ dataDir: process.env.DATA_DIR, demo });
  server.listen(port, () => {
    console.log(`Praja Seva running on http://localhost:${port}${demo ? '  (DEMO mode: OTP shown on screen, demo payments)' : ''}`);
  });
  const stop = () => server.close(() => process.exit(0));
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

module.exports = { createServer };
