// POST /api/verify-payment — confirms a Razorpay payment (signature check) and marks
// the order paid: stock down, coupon used, customer updated. Idempotent.
import { ownBackend, livePayments, forwardLegacy, json, HttpError, settings } from '../lib/env.mts';
import { getDoc, storePath } from '../lib/firestore.mts';
import { signatureOk, markPaid } from '../lib/orders.mts';

export default async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const raw = await req.text();
  if (!ownBackend()) return forwardLegacy(req, 'verify-payment', raw);
  try {
    let b: any; try { b = JSON.parse(raw); } catch { throw new HttpError(400, 'Invalid request.'); }
    if (b.slug && b.slug !== settings().slug) throw new HttpError(400, 'Unknown store.');
    const orderId = String(b.orderId || ''); const rzpOrder = String(b.razorpay_order_id || ''); const payId = String(b.razorpay_payment_id || '');
    if (!orderId || !rzpOrder || !payId) throw new HttpError(400, 'Missing payment details.');
    const d = await getDoc(storePath('orders', orderId));
    if (!d) throw new HttpError(404, 'Order not found.');
    if (d.data.razorpayOrderId !== rzpOrder) throw new HttpError(400, 'This payment does not belong to this order.');
    if (livePayments()) {
      if (!signatureOk(rzpOrder, payId, String(b.razorpay_signature || ''))) throw new HttpError(400, 'Payment could not be verified.');
      await markPaid(orderId, payId);
    } else {
      // Test mode (no Razorpay keys yet): only orders created in test mode can be "paid" this way.
      if (!(rzpOrder.startsWith('test_') && d.data.testPayment === true && b.razorpay_signature === 'dummy')) throw new HttpError(400, 'Payment could not be verified.');
      await markPaid(orderId, payId, { test: true });
    }
    return json({ verified: true, orderId });
  } catch (e: any) {
    if (e instanceof HttpError) return json({ verified: false, error: e.message }, e.status);
    console.error('verify-payment failed', e);
    return json({ verified: false, error: 'We couldn’t confirm the payment. If money was deducted, WhatsApp us with your order ID.' }, 500);
  }
};
