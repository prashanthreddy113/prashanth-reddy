// Checkout: contact + address + payment method -> create-order (via /api),
// then Razorpay (or cash on delivery), then verify-payment. The order lands in the
// same Firestore orders the Yukktha admin manages.
(function () {
  const Y = window.Yukktha; const esc = Y.esc; const CFG = Y.CFG;
  const $ = (id) => document.getElementById(id);
  const API = CFG.checkoutApi || 'api/';

  const PAY = {
    gpay: { label: 'Google Pay', sub: 'UPI', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M10 18.5h4"/><path d="M9.5 9.5l2 2 3.5-4"/></svg>' },
    phonepe: { label: 'PhonePe', sub: 'UPI', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M10 18.5h4"/><path d="M10 7h4l-2 4h2"/></svg>' },
    card: { label: 'Card', sub: 'Debit / credit', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2.5" y="5" width="19" height="14" rx="2"/><path d="M2.5 9.5h19M6 15h4"/></svg>' },
    netbanking: { label: 'Net banking', sub: 'All major banks', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 9.5 12 4l9 5.5M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18"/></svg>' },
    cod: { label: 'Cash on delivery', sub: 'Pay when it arrives', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2.5" y="6" width="19" height="12" rx="1.5"/><circle cx="12" cy="12" r="2.6"/><path d="M6 9.5v5M18 9.5v5"/></svg>' }
  };
  const ORDER = ['gpay', 'phonepe', 'card', 'netbanking', 'cod'];

  let items = []; let project = {}; let methods = ['gpay', 'phonepe']; let loaded = false;
  const form = $('ckForm');
  const rows = () => Y.bag.items().map((r) => ({ p: items.find((x) => x.id === r.id), qty: r.qty })).filter((r) => r.p && r.p.price > 0);

  // ---------- remembered details ----------
  const SAVE = 'yk_checkout';
  try { const saved = JSON.parse(localStorage.getItem(SAVE) || 'null'); if (saved) Object.keys(saved).forEach((k) => { if (form[k] && form[k].type !== 'checkbox') form[k].value = saved[k]; }); } catch (e) { /* ignore */ }

  // ---------- summary ----------
  function drawSummary(server) {
    if (!loaded) return; // wait for the catalogue, or an unknown bag looks empty
    const r = rows();
    if (!r.length && !server) {
      $('ck').innerHTML = '<div class="ck-empty"><h1>Your bag is empty</h1><p>Add a saree you love, then come back to check out.</p><a class="btn btn-solid" href="collection.html?c=all">Shop sarees</a></div>';
      return;
    }
    $('ckLines').innerHTML = r.map((x) => '<div class="ck-line"><span class="ck-thumb"><img src="' + esc(x.p.images[0]) + '" alt=""><b>' + x.qty + '</b></span><div><a href="' + Y.productLink(x.p) + '">' + esc(x.p.title) + '</a><small>' + esc(x.p.categoryTitle) + (x.p.discount ? ' · ' + x.p.discount + '% off' : '') + '</small></div><strong>' + Y.inr(x.p.price * x.qty) + '</strong></div>').join('');
    const sub = r.reduce((a, x) => a + x.p.price * x.qty, 0);
    const fod = project.firstOrderDiscount && project.firstOrderDiscount.enabled ? project.firstOrderDiscount : null;
    let html = '<div><span>Subtotal</span><span>' + Y.inr(sub) + '</span></div>';
    if (server) {
      if (server.couponDiscount) html += '<div class="minus"><span>Coupon ' + esc(server.couponDiscount.code) + '</span><span>− ' + Y.inr(server.couponDiscount.amount) + '</span></div>';
      if (server.firstOrderDiscount) html += '<div class="minus"><span>First-order discount</span><span>− ' + Y.inr(server.firstOrderDiscount.amount) + '</span></div>';
      if (server.gst && server.gst.enabled && server.gst.amount > 0) html += '<div class="muted"><span>Includes GST @ ' + server.gst.rate + '%</span><span>' + Y.inr(server.gst.amount) + '</span></div>';
      html += '<div><span>Delivery</span><span>Included</span></div><div class="grand"><span>Total</span><span>' + Y.inr(server.amount / 100) + '</span></div>';
    } else {
      const A = Y.account; const signed = A && A.signedIn();
      if (fod && fod.value) {
        const amt = fod.type === 'percent' ? fod.value + '%' : Y.inr(fod.value);
        if (signed && !(Number(A.state.profile.orderCount) > 0)) html += '<div class="hint"><span>' + amt + ' off your first order</span><span>at payment</span></div>';
        else if (!signed) html += '<div class="hint"><span><a href="account.html?next=checkout.html">Sign in</a> for ' + amt + ' off your first order</span></div>';
      }
      html += '<div class="grand"><span>Total</span><span>' + Y.inr(sub) + '</span></div><p class="ck-fine">Any coupon or first-order discount is taken off when you place the order.</p>';
    }
    $('ckTotals').innerHTML = html;
    $('ckPay').textContent = chosen() === 'cod' ? 'Place order · ' + Y.inr(server ? server.amount / 100 : sub) : 'Pay securely · ' + Y.inr(server ? server.amount / 100 : sub);
    $('ckWa').href = Y.waLink(Y.bagOrderText(r));
  }

  // ---------- payment methods ----------
  const chosen = () => { const el = form.querySelector('input[name=pay]:checked'); return el ? el.value : methods[0]; };
  function drawMethods() {
    const prev = chosen();
    $('pmGrid').innerHTML = methods.map((k, i) => '<label class="pm"><input type="radio" name="pay" value="' + k + '"' + ((prev ? prev === k : i === 0) ? ' checked' : '') + '><span class="pm-card">' + PAY[k].icon + '<b>' + PAY[k].label + '</b><small>' + PAY[k].sub + '</small></span></label>').join('');
    if (!form.querySelector('input[name=pay]:checked')) form.querySelector('input[name=pay]').checked = true;
    syncNote();
  }
  function syncNote() {
    const m = chosen();
    $('pmNote').textContent = m === 'cod' ? 'No payment now — pay the delivery person in cash when your saree arrives.'
      : m === 'card' ? 'You’ll enter your card details in Razorpay’s secure window.'
        : m === 'netbanking' ? 'You’ll choose your bank in Razorpay’s secure window.'
          : 'You’ll approve the payment in your ' + PAY[m].label + ' app (or any UPI app).';
    drawSummary(null);
  }
  $('pmGrid').addEventListener('change', syncNote);

  // ---------- validation ----------
  const err = (msg) => { const e = $('ckErr'); e.textContent = msg; e.hidden = !msg; if (msg) e.scrollIntoView({ behavior: 'smooth', block: 'center' }); };
  function readForm() {
    const v = {}; ['name', 'phone', 'email', 'address', 'city', 'state', 'pincode', 'landmark', 'note'].forEach((k) => { v[k] = form[k].value.trim(); });
    const phone = v.phone.replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '');
    form.querySelectorAll('.bad').forEach((x) => x.classList.remove('bad'));
    const bad = (k) => { form[k].classList.add('bad'); form[k].focus(); };
    if (!v.name) { bad('name'); throw new Error('Please enter your name.'); }
    if (!/^[6-9]\d{9}$/.test(phone)) { bad('phone'); throw new Error('Please enter a valid 10-digit mobile number.'); }
    if (v.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email)) { bad('email'); throw new Error('Please check your email address.'); }
    if (v.address.length < 8) { bad('address'); throw new Error('Please enter your full delivery address.'); }
    if (!v.city) { bad('city'); throw new Error('Please enter your city.'); }
    if (!/^\d{6}$/.test(v.pincode)) { bad('pincode'); throw new Error('Please enter a 6-digit pincode.'); }
    v.phone = phone;
    return v;
  }

  // ---------- API ----------
  async function post(fn, body) {
    let res;
    try { res = await fetch(API + fn, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); }
    catch (e) { throw new Error('No connection. Check your internet and try again.'); }
    let data = {}; try { data = await res.json(); } catch (e) { /* non-JSON */ }
    if (!res.ok) throw new Error(data.error || 'Something went wrong (' + res.status + '). Please try again or order on WhatsApp.');
    return data;
  }
  let rzpLoad = null;
  const loadRazorpay = () => window.Razorpay ? Promise.resolve() : (rzpLoad = rzpLoad || new Promise((ok, bad) => {
    const s = document.createElement('script'); s.src = 'https://checkout.razorpay.com/v1/checkout.js'; s.onload = ok;
    s.onerror = () => { rzpLoad = null; bad(new Error('Could not load the payment window. Check your connection and try again.')); }; document.head.appendChild(s);
  }));

  // ---------- place order ----------
  form.addEventListener('submit', async (e) => {
    e.preventDefault(); err('');
    let v; try { v = readForm(); } catch (ex) { err(ex.message); return; }
    const r = rows(); if (!r.length) { drawSummary(null); return; }
    const pay = chosen(); const btn = $('ckPay'); btn.disabled = true; btn.classList.add('busy');
    if (form.remember.checked) { try { const keep = { ...v }; delete keep.note; localStorage.setItem(SAVE, JSON.stringify(keep)); } catch (ex) { /* ignore */ } } else { try { localStorage.removeItem(SAVE); } catch (ex) { /* ignore */ } }
    const address = [v.address, v.landmark ? 'Landmark: ' + v.landmark : '', v.city, v.state].filter(Boolean).join(', ');
    try {
      btn.textContent = 'Creating your order…';
      const data = await post('create-order', {
        slug: CFG.firebase.projectSlug, items: r.map((x) => ({ itemId: x.p.id, qty: x.qty })),
        customerName: v.name, customerPhone: v.phone, customerEmail: v.email, customerNote: v.note,
        customerAddress: address, customerPincode: v.pincode, paymentMethod: pay, customerUid: (Y.account && Y.account.signedIn()) ? Y.account.state.user.uid : null,
        couponCode: $('ckCoupon').value.trim().toUpperCase() || null
      });
      drawSummary(data);
      const order = { data, v, pay, rows: r, address };
      if (data.cod) { done(order, null); return; }
      const verify = async (paymentId, signature) => {
        btn.textContent = 'Confirming payment…';
        const vd = await post('verify-payment', { slug: CFG.firebase.projectSlug, orderId: data.orderId, razorpay_order_id: data.razorpayOrderId, razorpay_payment_id: paymentId, razorpay_signature: signature });
        if (!vd.verified) throw new Error(vd.error || 'Payment could not be verified.');
        done(order, paymentId);
      };
      if (data.dummy) {
        // The shop hasn't connected live Razorpay keys yet: the backend runs a test gateway.
        btn.textContent = 'Processing ' + PAY[pay].label + ' (test mode)…';
        await new Promise((ok) => setTimeout(ok, 1200));
        await verify('pay_test_' + pay + '_' + Date.now(), 'dummy');
        return;
      }
      await loadRazorpay();
      const method = { gpay: 'upi', phonepe: 'upi', card: 'card', netbanking: 'netbanking' }[pay];
      const rzp = new window.Razorpay({
        key: data.keyId, amount: data.amount, currency: data.currency || 'INR', order_id: data.razorpayOrderId,
        name: 'Yukktha', description: 'Order ' + (data.invoiceNumber || data.orderId), image: new URL('assets/favicon.svg', location.href).href,
        prefill: { name: v.name, contact: '+91' + v.phone, email: v.email || undefined, method },
        notes: { orderId: data.orderId }, theme: { color: '#6b1b4e' },
        handler: (resp) => verify(resp.razorpay_payment_id, resp.razorpay_signature).catch((ex) => fail(ex.message + ' If money was deducted, WhatsApp us with your order ID ' + data.orderId + '.')),
        modal: { ondismiss: () => fail('Payment was cancelled. Your order ' + data.orderId + ' is saved as pending — you can try again.') }
      });
      rzp.on && rzp.on('payment.failed', (resp) => fail('Payment failed: ' + ((resp && resp.error && resp.error.description) || 'please try another method.')));
      rzp.open();
    } catch (ex) { fail(ex.message); }
  });
  function fail(msg) { err(msg); const btn = $('ckPay'); btn.disabled = false; btn.classList.remove('busy'); drawSummary(null); }

  // ---------- confirmation ----------
  function done(o, paymentId) {
    const total = o.data.amount / 100;
    if (Y.account && Y.account.signedIn()) Y.account.updateProfile({ addrLine: o.v.address, city: o.v.city, state: o.v.state, landmark: o.v.landmark, pincode: o.v.pincode }).catch(() => {});
    Y.bag.clear();
    $('stepDone').classList.add('on');
    const wa = Y.waLink('Hello Yukktha, I just placed order ' + o.data.orderId + (o.data.invoiceNumber ? ' (invoice ' + o.data.invoiceNumber + ')' : '') + ' for ' + Y.inr(total) + '.');
    $('ck').innerHTML = '<section class="ck-done">' +
      '<div class="ck-tick"><svg viewBox="0 0 52 52"><circle cx="26" cy="26" r="24"/><path d="M15 27l7 7 15-16"/></svg></div>' +
      '<p class="sec-kicker">Thank you, ' + esc(o.v.name.split(' ')[0]) + '</p><h1>Your order is confirmed</h1>' +
      '<p class="ck-done-sub">' + (o.data.cod ? 'Pay ' + Y.inr(total) + ' in cash when it arrives.' : 'We’ve received ' + Y.inr(total) + ' via ' + esc(PAY[o.pay].label) + '.') + ' We’ll call or WhatsApp you on ' + esc(o.v.phone) + ' to confirm delivery.</p>' +
      '<div class="ck-done-id"><span>Order ID</span><strong id="oid">' + esc(o.data.orderId) + '</strong><button type="button" class="link-btn" id="copyId">Copy</button></div>' +
      (o.data.invoiceNumber ? '<p class="ck-fine">Invoice ' + esc(o.data.invoiceNumber) + (paymentId ? ' · Payment ' + esc(paymentId) : '') + '</p>' : '') +
      '<div class="ck-done-grid"><div><h3>Delivering to</h3><p>' + esc(o.v.name) + '<br>' + esc(o.address) + ' – ' + esc(o.v.pincode) + '</p></div>' +
      '<div><h3>Items</h3>' + o.rows.map((x) => '<p>' + esc(x.p.title) + ' × ' + x.qty + '</p>').join('') + '<p><strong>Total ' + Y.inr(total) + '</strong></p></div></div>' +
      '<ol class="ck-next"><li class="on"><b>Order placed</b>Saved with Yukktha</li><li><b>Packed with care</b>Fall, pico & checks</li><li><b>Shipped</b>Pan-India delivery</li><li><b>Delivered</b>To your door</li></ol>' +
      '<div class="ck-done-btns"><a class="btn btn-solid" href="collection.html?c=new-arrivals">Continue shopping</a><a class="btn btn-outline" target="_blank" rel="noopener" href="' + wa + '">Message us on WhatsApp</a></div></section>';
    const c = $('copyId'); c.addEventListener('click', async () => { try { await navigator.clipboard.writeText(o.data.orderId); c.textContent = 'Copied ✓'; } catch (e) { c.textContent = 'Select & copy'; } });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ---------- boot ----------
  Promise.all([Y.loadCatalogue(), Y.loadProject()]).then(([list, proj]) => {
    items = list; project = proj || {}; loaded = true;
    const cfg = project.paymentMethods;
    if (cfg) { const on = ORDER.filter((k) => cfg[k] === true); if (on.length) methods = on; }
    drawMethods(); drawSummary(null);
  }).catch(() => { loaded = true; drawMethods(); drawSummary(null); });
  Y.onChange(() => { if (form.isConnected) drawSummary(null); });

  // ---------- signed-in customers ----------
  if (Y.account) Y.account.on((st) => {
    const box = $('ckAcct'); if (!box) return;
    if (st.user && st.profile) {
      const pr = st.profile;
      const fill = (k, v) => { if (form[k] && !form[k].value && v) form[k].value = v; };
      fill('name', pr.name); fill('phone', pr.mobile); fill('email', pr.email || st.user.email);
      // Structured address saved after a previous checkout here; otherwise the one-line address from the profile.
      if (!form.address.value) {
        if (pr.addrLine) { form.address.value = pr.addrLine; fill('city', pr.city); if (pr.state) form.state.value = pr.state; fill('landmark', pr.landmark); fill('pincode', pr.pincode); }
        else if (pr.address) { form.address.value = pr.address; fill('pincode', pr.pincode); }
      }
      box.innerHTML = 'Signed in as <b>' + esc(pr.name || st.user.email) + '</b> — this order will appear in <a href="account.html">My account</a>.';
    } else {
      box.innerHTML = 'Have an account? <a href="account.html?next=checkout.html">Sign in</a> for faster checkout and to track this order. Or continue as a guest.';
    }
    if (form.isConnected) drawSummary(null);
  });
})();
