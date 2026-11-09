// Verifies a Firebase Authentication ID token (RS256) so the server knows which
// customer is signed in, instead of trusting a uid sent by the browser.
import { createVerify } from 'node:crypto';
import { settings } from './env.mts';

let certs: { keys: Record<string, string>; exp: number } | null = null;
async function googleCerts() {
  if (certs && certs.exp > Date.now()) return certs.keys;
  const res = await fetch('https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com');
  const keys = await res.json();
  const m = /max-age=(\d+)/.exec(res.headers.get('cache-control') || '');
  certs = { keys, exp: Date.now() + (m ? Number(m[1]) : 3600) * 1000 };
  return keys;
}
const dec = (s: string) => JSON.parse(Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));

/** Returns the uid for a valid token, or null. */
export async function verifyIdToken(token: string | null | undefined): Promise<string | null> {
  if (!token) return null;
  try {
    const [h, p, sig] = token.split('.'); if (!h || !p || !sig) return null;
    const head = dec(h); const claims = dec(p); const pid = settings().projectId; const now = Math.floor(Date.now() / 1000);
    if (head.alg !== 'RS256' || !head.kid) return null;
    if (claims.aud !== pid || claims.iss !== 'https://securetoken.google.com/' + pid) return null;
    if (!(claims.exp > now) || !(claims.iat <= now + 300) || !claims.sub) return null;
    const cert = (await googleCerts())[head.kid]; if (!cert) return null;
    const v = createVerify('RSA-SHA256'); v.update(h + '.' + p);
    return v.verify(cert, Buffer.from(sig.replace(/-/g, '+').replace(/_/g, '/'), 'base64')) ? String(claims.sub) : null;
  } catch { return null; }
}
export const bearer = (req: Request) => { const a = req.headers.get('authorization') || ''; return a.startsWith('Bearer ') ? a.slice(7) : null; };
