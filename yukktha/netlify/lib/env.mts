// Settings for Yukktha's own checkout service. All secrets come from Netlify
// environment variables (Site configuration → Environment variables, scope: Functions).
//
//   FIREBASE_CLIENT_EMAIL   service-account email   (Firebase → Project settings → Service accounts)
//   FIREBASE_PRIVATE_KEY    service-account private key (the "-----BEGIN PRIVATE KEY-----…" text)
//   RAZORPAY_KEY_ID         rzp_live_… (or rzp_test_…)
//   RAZORPAY_KEY_SECRET     Razorpay key secret
//   RAZORPAY_WEBHOOK_SECRET optional, the secret you set on the Razorpay webhook
//
// Optional: FIREBASE_PROJECT_ID (default yukk-1cf77), STORE_SLUG (default yukktha),
// LEGACY_CHECKOUT_URL (where orders go until the Firebase keys are added).

export const env = (k: string): string => {
  const g = (globalThis as any).Netlify;
  const v = g && g.env && typeof g.env.get === 'function' ? g.env.get(k) : undefined;
  return (v ?? (typeof process !== 'undefined' ? process.env[k] : undefined) ?? '') as string;
};

export const settings = () => ({
  projectId: env('FIREBASE_PROJECT_ID') || 'yukk-1cf77',
  slug: env('STORE_SLUG') || 'yukktha',
  clientEmail: env('FIREBASE_CLIENT_EMAIL'),
  // Netlify stores multi-line values fine, but people often paste the key with literal \n
  privateKey: env('FIREBASE_PRIVATE_KEY').replace(/\\n/g, '\n'),
  razorpayKeyId: env('RAZORPAY_KEY_ID'),
  razorpayKeySecret: env('RAZORPAY_KEY_SECRET'),
  razorpayWebhookSecret: env('RAZORPAY_WEBHOOK_SECRET'),
  legacyUrl: (env('LEGACY_CHECKOUT_URL') || 'https://brightloopgroup.netlify.app/.netlify/functions').replace(/\/$/, '')
});

/** Yukktha's own service runs once the Firebase service account is configured. */
export const ownBackend = () => { const s = settings(); return !!(s.clientEmail && s.privateKey.includes('PRIVATE KEY')); };
/** Real payments once Razorpay keys are configured; otherwise a clearly marked test mode. */
export const livePayments = () => { const s = settings(); return !!(s.razorpayKeyId && s.razorpayKeySecret); };

export const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
export class HttpError extends Error { status: number; constructor(status: number, message: string) { super(message); this.status = status; } }

/** Until our own service is configured, pass the request to the previous checkout service unchanged. */
export async function forwardLegacy(req: Request, fn: string, body: string): Promise<Response> {
  const headers: Record<string, string> = { 'content-type': req.headers.get('content-type') || 'application/json' };
  const sig = req.headers.get('x-razorpay-signature'); if (sig) headers['x-razorpay-signature'] = sig;
  const res = await fetch(settings().legacyUrl + '/' + fn, { method: 'POST', headers, body });
  return new Response(await res.text(), { status: res.status, headers: { 'content-type': res.headers.get('content-type') || 'application/json', 'cache-control': 'no-store' } });
}
