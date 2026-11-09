import { esc, inr, num, $, toast, field, input, checkbox, ts, orderTotal, counts, PAY_LABEL, hbars, fmtDate, statusPill } from '../ui.js';

const METHODS = [['gpay', 'Google Pay'], ['phonepe', 'PhonePe'], ['card', 'Debit / credit card'], ['netbanking', 'Net banking'], ['cod', 'Cash on delivery']];

export default {
  id: 'payments', title: 'Payments', group: 'Money', icon: 'card', ownerOnly: true,
  async render(view, ctx) {
    const { api } = ctx; const p = ctx.project;
    const orders = await api.list('orders').catch(() => []);
    if (ctx.stale()) return;
    const pm = p.paymentMethods || {}; const gst = p.gst || {}; const pc = p.paymentConfig || {};
    const start = new Date(); start.setDate(1); start.setHours(0, 0, 0, 0);
    const month = orders.filter((o) => counts(o) && ts(o.createdAt) >= start.getTime());
    const by = {}; month.forEach((o) => { const k = PAY_LABEL[o.paymentMethod] || o.paymentMethod || 'Other'; by[k] = (by[k] || 0) + orderTotal(o); });
    const codDue = orders.filter((o) => o.paymentMethod === 'cod' && !['completed', 'cancelled', 'returned'].includes(o.status));
    const refunds = orders.filter((o) => ['cancelled', 'returned'].includes(o.status) && o.paymentMethod !== 'cod' && o.paymentMethod !== 'cash' && o.refundStatus !== 'refunded' && o.refundStatus !== 'not_applicable');

    view.innerHTML = '<div class="split"><form id="f" class="stack">' +
      '<div class="card"><h3>Website checkout methods</h3><p class="muted">Which payment options customers see at checkout on the store website.</p><div class="checks">' + METHODS.map(([k, l]) => checkbox('pm_' + k, pm[k] !== false && pm[k] !== undefined ? pm[k] : false, l)).join('') + '</div></div>' +
      '<div class="card"><h3>GST</h3><div class="form-grid">' + '<div class="full">' + checkbox('gstEnabled', gst.enabled, 'Prices include GST — show it on invoices') + '</div>' + field('GSTIN', input('gstin', gst.gstin, 'placeholder="36XXXXXXXXXXXZX"')) + field('GST rate %', input('gstRate', gst.rate != null ? gst.rate : 5, 'type="number" min="0" max="28"'), 'Silk and cotton sarees are usually 5%.') + '</div></div>' +
      '<div class="card"><h3>Shop payment details</h3><p class="muted">Printed on invoices and used when you share payment details with customers.</p><div class="form-grid">' +
      field('UPI ID', input('upiId', pc.upiId, 'placeholder="yukktha@okaxis"')) + field('Payee name', input('payeeName', pc.payeeName, 'placeholder="Yukktha Sarees"')) +
      field('Bank name', input('bankName', pc.bankName)) + field('Account number', input('accountNumber', pc.accountNumber)) + field('IFSC', input('ifsc', pc.ifsc)) + field('Invoice number prefix', input('invoicePrefix', pc.invoicePrefix || 'YK-')) +
      field('Razorpay Key ID', input('razorpayKeyId', pc.razorpayKeyId, 'placeholder="rzp_live_…"'), 'Public key only. Keep the Razorpay secret in the Netlify environment variables of the checkout site — never here.') +
      field('COD limit (₹)', input('codLimit', pc.codLimit || '', 'type="number" min="0" placeholder="No limit"')) + '</div></div>' +
      '<div><button class="btn primary">Save payment settings</button></div></form>' +
      '<div><div class="card" id="ckStatus"><h3>Online checkout</h3><p class="muted">Checking…</p></div><div class="card"><h3>Collected this month</h3>' + (Object.keys(by).length ? hbars(Object.keys(by).map((k) => ({ label: k, value: by[k] })).sort((a, b) => b.value - a.value)) : '<p class="muted">No sales yet this month.</p>') + '<p class="muted tiny" style="margin-top:12px">Total ' + inr(month.reduce((a, o) => a + orderTotal(o), 0)) + ' from ' + month.length + ' orders</p></div>' +
      (pc.upiId ? '<div class="card"><h3>Share UPI</h3><p><code>upi://pay?pa=' + esc(pc.upiId) + '&amp;pn=' + esc(encodeURIComponent(pc.payeeName || 'Yukktha')) + '&amp;cu=INR</code></p><p class="muted tiny">Paste this link in WhatsApp; on a phone it opens the customer’s UPI app.</p></div>' : '') +
      '<div class="card"><h3>Cash on delivery to collect</h3>' + (codDue.length ? '<div class="list">' + codDue.map((o) => '<div class="list-row"><div class="grow">' + esc(o.customerName || '') + '<div class="cell-sub">' + fmtDate(o.createdAt) + '</div></div>' + statusPill(o.status) + '<strong>' + inr(num(o.codAmountDue, orderTotal(o))) + '</strong></div>').join('') + '</div>' : '<p class="muted">Nothing pending.</p>') + '</div>' +
      '<div class="card"><h3>Refunds to process</h3>' + (refunds.length ? '<div class="list">' + refunds.map((o) => '<div class="list-row"><div class="grow">' + esc(o.customerName || '') + '<div class="cell-sub">' + esc(o.invoiceNo || o.id) + ' · ' + esc(PAY_LABEL[o.paymentMethod] || o.paymentMethod || '') + '</div></div><strong>' + inr(orderTotal(o)) + '</strong></div>').join('') + '</div><p class="tiny muted">Mark them refunded from the order details in Orders.</p>' : '<p class="muted">None.</p>') + '</div></div></div>';

    // Which checkout service is running (Yukktha's own, in test or live mode, or the previous one)
    fetch(ctx.CONFIG.storefrontUrl + 'api/checkout-status').then((r) => r.json()).then((st) => {
      const box = $('#ckStatus'); if (!box) return;
      const label = { 'live': ['Live — real payments', 'ok'], 'razorpay-test': ['Razorpay test keys', 'warn'], 'test-mode': ['Test mode — no money is charged', 'warn'], 'previous-service': ['Previous checkout service', 'info'] }[st.payments] || [st.payments, ''];
      const steps = st.backend !== 'yukktha'
        ? '<ol class="steps"><li>Firebase console → Project settings → Service accounts → <b>Generate new private key</b>.</li><li>Netlify → <b>yukktha-sarees</b> → Site configuration → Environment variables: add <code>FIREBASE_CLIENT_EMAIL</code> and <code>FIREBASE_PRIVATE_KEY</code> from that file (scope: Functions).</li><li>Redeploy the site. Checkout then runs on Yukktha’s own service in test mode.</li></ol>'
        : st.payments !== 'live'
          ? '<ol class="steps"><li>Razorpay dashboard → Account & Settings → <b>API keys</b> → generate live keys.</li><li>Netlify → yukktha-sarees → Environment variables: add <code>RAZORPAY_KEY_ID</code> and <code>RAZORPAY_KEY_SECRET</code>, then redeploy.</li>' + (st.webhook ? '' : '<li>Optional: Razorpay → Webhooks → URL <code>' + esc(ctx.CONFIG.storefrontUrl) + 'api/razorpay-webhook</code>, events <i>payment.captured</i>, and add the secret as <code>RAZORPAY_WEBHOOK_SECRET</code>.</li>') + '</ol>'
          : (st.webhook ? '<p class="muted">Payments are confirmed by Razorpay’s signature and the webhook.</p>' : '<p class="muted">Tip: add a Razorpay webhook (<code>' + esc(ctx.CONFIG.storefrontUrl) + 'api/razorpay-webhook</code>, event <i>payment.captured</i>) and set <code>RAZORPAY_WEBHOOK_SECRET</code> so payments are confirmed even if a customer closes the browser.</p>');
      box.innerHTML = '<h3>Online checkout <span class="pill ' + label[1] + '">' + esc(label[0]) + '</span></h3><p class="muted">Service: ' + (st.backend === 'yukktha' ? 'Yukktha’s own checkout' : 'previous service (until the Firebase key is added)') + '</p>' + steps;
    }).catch(() => { const box = $('#ckStatus'); if (box) box.innerHTML = '<h3>Online checkout</h3><p class="muted">Status unavailable right now.</p>'; });

    $('#f').addEventListener('submit', async (e) => {
      e.preventDefault(); const f = e.target;
      const paymentMethods = {}; METHODS.forEach(([k]) => { paymentMethods[k] = f['pm_' + k].checked; });
      try {
        await api.updateProject({
          paymentMethods,
          gst: { enabled: f.gstEnabled.checked, gstin: f.gstin.value.trim().toUpperCase(), rate: num(f.gstRate.value, 5) },
          paymentConfig: { upiId: f.upiId.value.trim(), payeeName: f.payeeName.value.trim(), bankName: f.bankName.value.trim(), accountNumber: f.accountNumber.value.trim(), ifsc: f.ifsc.value.trim().toUpperCase(), invoicePrefix: f.invoicePrefix.value.trim() || 'YK-', razorpayKeyId: f.razorpayKeyId.value.trim(), codLimit: f.codLimit.value === '' ? null : num(f.codLimit.value) }
        });
        await ctx.reloadProject(); toast('Payment settings saved');
      } catch (err) { toast(err.message, 'err'); }
    });
  }
};
