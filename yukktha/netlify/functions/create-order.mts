// POST /api/create-order — validates the bag, prices it from the database and creates
// the order (plus a Razorpay order for online payment). Served at /.netlify/functions/create-order.
import { ownBackend, forwardLegacy, json, HttpError, settings } from '../lib/env.mts';
import { verifyIdToken, bearer } from '../lib/idtoken.mts';
import { quote, placeOrder } from '../lib/orders.mts';

export default async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const raw = await req.text();
  if (!ownBackend()) return forwardLegacy(req, 'create-order', raw);
  try {
    let body: any; try { body = JSON.parse(raw); } catch { throw new HttpError(400, 'Invalid request.'); }
    if (body.slug && body.slug !== settings().slug) throw new HttpError(400, 'Unknown store.');
    const uid = await verifyIdToken(bearer(req)); // signed-in customer, verified — never trust a uid from the body
    const q = await quote(body, uid);
    return json(await placeOrder(q, uid));
  } catch (e: any) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    console.error('create-order failed', e);
    return json({ error: 'We couldn’t place your order just now. Please try again, or order on WhatsApp.' }, 500);
  }
};
