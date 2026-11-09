// GET /api/checkout-status — tells the admin which checkout is running. No secrets returned.
import { ownBackend, livePayments, settings, json } from '../lib/env.mts';

export default async () => {
  const s = settings();
  const res = json({
    backend: ownBackend() ? 'yukktha' : 'previous-service',
    payments: ownBackend() ? (livePayments() ? (s.razorpayKeyId.startsWith('rzp_live_') ? 'live' : 'razorpay-test') : 'test-mode') : 'previous-service',
    webhook: !!s.razorpayWebhookSecret
  });
  // the Yukktha admin shows this status on its Payments page
  res.headers.set('access-control-allow-origin', 'https://yukktha-sarees-admin.netlify.app');
  return res;
};
