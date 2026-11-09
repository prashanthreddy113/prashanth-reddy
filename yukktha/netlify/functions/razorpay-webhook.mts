// POST /api/razorpay-webhook — Razorpay calls this when a payment is captured, so an order
// is marked paid even if the customer closed the browser before verify-payment ran.
// Razorpay dashboard → Webhooks → URL https://<site>/api/razorpay-webhook, events
// payment.captured and order.paid, secret = RAZORPAY_WEBHOOK_SECRET.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { ownBackend, settings, json } from '../lib/env.mts';
import { markPaid } from '../lib/orders.mts';

export default async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const raw = await req.text(); const s = settings();
  if (!ownBackend() || !s.razorpayWebhookSecret) return json({ ok: false, error: 'Webhook not configured' }, 503);
  const want = Buffer.from(createHmac('sha256', s.razorpayWebhookSecret).update(raw).digest('hex'));
  const got = Buffer.from(req.headers.get('x-razorpay-signature') || '');
  if (want.length !== got.length || !timingSafeEqual(want, got)) return json({ ok: false }, 401);
  try {
    const ev = JSON.parse(raw);
    const pay = ev.payload && ev.payload.payment && ev.payload.payment.entity;
    if ((ev.event === 'payment.captured' || ev.event === 'order.paid') && pay && pay.notes && pay.notes.orderId && pay.notes.store === s.slug) {
      await markPaid(String(pay.notes.orderId), String(pay.id));
    }
    return json({ ok: true });
  } catch (e) { console.error('webhook failed', e); return json({ ok: false }, 500); }
};
