// Minimal Firestore REST client authenticated as the service account (no SDK needed).
import { createSign, randomBytes } from 'node:crypto';
import { settings } from './env.mts';

let token: { value: string; exp: number } | null = null;
const b64url = (b: Buffer | string) => Buffer.from(b).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');

async function accessToken(): Promise<string> {
  if (token && token.exp > Date.now() + 60_000) return token.value;
  const s = settings(); const now = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = b64url(JSON.stringify({ iss: s.clientEmail, scope: 'https://www.googleapis.com/auth/datastore', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }));
  const signer = createSign('RSA-SHA256'); signer.update(head + '.' + claim);
  const jwt = head + '.' + claim + '.' + b64url(signer.sign(s.privateKey));
  const res = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'grant_type=' + encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer') + '&assertion=' + jwt });
  const data: any = await res.json();
  if (!res.ok || !data.access_token) throw new Error('Firebase sign-in failed: ' + (data.error_description || data.error || res.status));
  token = { value: data.access_token, exp: Date.now() + (Number(data.expires_in) || 3600) * 1000 };
  return token.value;
}

const root = () => 'projects/' + settings().projectId + '/databases/(default)/documents';
const api = () => 'https://firestore.googleapis.com/v1/';
async function call(method: string, url: string, body?: unknown): Promise<any> {
  const res = await fetch(url, { method, headers: { authorization: 'Bearer ' + (await accessToken()), 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) { const e: any = new Error('Firestore ' + res.status + ': ' + ((data.error && data.error.message) || '')); e.status = res.status; e.fsStatus = data.error && data.error.status; throw e; }
  return data;
}

// ---------- value conversion ----------
export function toFs(v: any): any {
  if (v === null || v === undefined) return { nullValue: null };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toFs) } };
  if (typeof v === 'object') return { mapValue: { fields: fields(v) } };
  return { stringValue: String(v) };
}
export const fields = (o: Record<string, any>) => { const f: Record<string, any> = {}; for (const k of Object.keys(o)) if (o[k] !== undefined) f[k] = toFs(o[k]); return f; };
export function fromFs(v: any): any {
  const k = Object.keys(v || {})[0]; const x = v ? v[k] : undefined;
  switch (k) {
    case 'integerValue': return Number(x);
    case 'doubleValue': return Number(x);
    case 'booleanValue': return !!x;
    case 'nullValue': return null;
    case 'arrayValue': return (x.values || []).map(fromFs);
    case 'mapValue': return plain(x.fields || {});
    default: return x; // string, timestamp (ISO string), reference, …
  }
}
export const plain = (f: Record<string, any>) => { const o: Record<string, any> = {}; for (const k of Object.keys(f || {})) o[k] = fromFs(f[k]); return o; };

// ---------- documents ----------
export type Doc = { id: string; path: string; data: Record<string, any>; updateTime: string } | null;
export const storePath = (...p: string[]) => ['projects', settings().slug, ...p].join('/');
export async function getDoc(path: string): Promise<Doc> {
  try {
    const d = await call('GET', api() + root() + '/' + path);
    return { id: path.split('/').pop() as string, path, data: plain(d.fields || {}), updateTime: d.updateTime };
  } catch (e: any) { if (e.status === 404) return null; throw e; }
}
export async function queryEq(collectionPath: string, field: string, value: any, limit = 5) {
  const parts = collectionPath.split('/'); const coll = parts.pop() as string;
  const parent = api() + root() + (parts.length ? '/' + parts.join('/') : '');
  const rows = await call('POST', parent + ':runQuery', { structuredQuery: { from: [{ collectionId: coll }], where: { fieldFilter: { field: { fieldPath: field }, op: 'EQUAL', value: toFs(value) } }, limit } });
  return (rows as any[]).filter((r) => r.document).map((r) => ({ id: r.document.name.split('/').pop(), path: collectionPath + '/' + r.document.name.split('/').pop(), data: plain(r.document.fields || {}), updateTime: r.document.updateTime }));
}
export const newId = () => { const a = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'; return Array.from(randomBytes(20), (b) => a[b % a.length]).join(''); };

// ---------- atomic writes ----------
export type Write = Record<string, any>;
const full = (path: string) => root() + '/' + path;
export const w = {
  create: (path: string, data: Record<string, any>): Write => ({ update: { name: full(path), fields: fields(data) }, currentDocument: { exists: false } }),
  /** merge the given fields; `ifUpdateTime` makes the whole commit fail if the doc changed meanwhile */
  patch: (path: string, data: Record<string, any>, ifUpdateTime?: string): Write => ({ update: { name: full(path), fields: fields(data) }, updateMask: { fieldPaths: Object.keys(data).filter((k) => data[k] !== undefined).map((k) => '`' + k + '`') }, ...(ifUpdateTime ? { currentDocument: { updateTime: ifUpdateTime } } : { currentDocument: { exists: true } }) }),
  increment: (path: string, field: string, by: number): Write => ({ transform: { document: full(path), fieldTransforms: [{ fieldPath: '`' + field + '`', increment: { integerValue: String(by) } }] } })
};
export async function commit(writes: Write[]) { return call('POST', api() + root() + ':commit', { writes }); }
