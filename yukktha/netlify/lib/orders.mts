// Order rules for Yukktha's checkout. Every amount is recomputed here from the
// database; the browser only says which sarees, how many, who and how to pay.
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { settings, livePayments, HttpError } from './env.mts';
import { getDoc, queryEq, storePath, newId, commit, w } from './firestore.mts';

const METHODS = ['gpay', 'phonepe', 'card', 'netbanking', 'cod'];
const num = (v: any) => { const n = Number(String(v ?? '').replace(/[^0-9.-]/g, '')); return Number.isFinite(n) ? n : 0; };
const clip = (v: any, n: number) => String(v ?? '').trim().slice(0, n);

export function priceOf(s: any) {
  const mrp = num(s.sellPrice) || num(s.price);
  const disc = Math.min(100, Math.max(0, num(s.discountPercent)));
  return Math.round(mrp * (1 - disc / 100));
}
export function stockOf(s: any) {
  if (s.stockMode === 'availability') return s.available === false ? 0 : Infinity;
  return s.quantity == null ? Infinity : Math.max(0, num(s.quantity));
}
const tracked = (s: any) => s.stockMode !== 'availability' && s.quantity != null;

export function invoiceNo(prefix?: string) {
  const d = new Date(Date.now() + 5.5 * 3600_000); // India date
  const p = (n: number) => String(n).padStart(2, '0');
  return (prefix || 'YK-') + String(d.getUTCFullYear()).slice(2) + p(d.getUTCMonth() + 1) + p(d.getUTCDate()) + '-' + randomBytes(3).toString('hex').toUpperCase();
}

export type Input = { items: { itemId: string; qty: number }[]; customerName: string; customerPhone: string; customerEmail?: string; customerNote?: string; customerAddress: string; customerPincode: string; paymentMethod: string; couponCode?: string | null };

export async function quote(input: Input, uid: string | null) {
  // ----- validate the request -----
  if (!Array.isArray(input.items) || !input.items.length || input.items.length > 20) throw new HttpError(400, 'Your bag is empty.');
  const name = clip(input.customerName, 80); const phone = String(input.customerPhone || '').replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '');
  const address = clip(input.customerAddress, 400); const pincode = String(input.customerPincode || '').trim();
  if (!name) throw new HttpError(400, 'Please enter your name.');
  if (!/^[6-9]\d{9}$/.test(phone)) throw new HttpError(400, 'Please enter a valid 10-digit mobile number.');
  if (address.length < 8) throw new HttpError(400, 'Please enter your full delivery address.');
  if (!/^\d{6}$/.test(pincode)) throw new HttpError(400, 'Please enter a 6-digit pincode.');
  const method = String(input.paymentMethod || '');
  if (!METHODS.includes(method)) throw new HttpError(400, 'Please choose a payment method.');

  // ----- store settings -----
  const projDoc = await getDoc(storePath());
  const project = projDoc ? projDoc.data : {};
  const pm = project.paymentMethods;
  const allowed = pm ? METHODS.filter((k) => pm[k] === true) : ['gpay', 'phonepe'];
  if (!allowed.includes(method)) throw new HttpError(400, 'That payment method is not available right now. Please choose another.');

  // ----- items, prices, stock (merge duplicate lines) -----
  const want = new Map<string, number>();
  for (const it of input.items) { const q = Math.floor(num(it.qty)); if (!it.itemId || q < 1 || q > 10) throw new HttpError(400, 'Please check the quantities in your bag.'); want.set(String(it.itemId), (want.get(String(it.itemId)) || 0) + q); }
  const lines: any[] = [];
  for (const [id, qty] of want) {
    const d = await getDoc(storePath('sarees', id));
    if (!d) throw new HttpError(400, 'One of the sarees in your bag is no longer available. Please remove it and try again.');
    const s = d.data; const price = priceOf(s);
    if (!(price > 0)) throw new HttpError(400, (s.name || 'A saree') + ' has no online price yet — please call or WhatsApp us to order it.');
    const left = stockOf(s);
    if (left < qty) throw new HttpError(409, left > 0 ? 'Only ' + left + ' left of ' + (s.name || 'this saree') + '.' : (s.name || 'A saree') + ' has just sold out.');
    const img = String(s.imageUrl || ''); lines.push({ itemId: id, name: String(s.name || 'Saree'), qty, price, imageUrl: img.startsWith('data:') ? '' : img, tracked: tracked(s) });
  }
  const subtotal = lines.reduce((a, l) => a + l.price * l.qty, 0);

  // ----- coupon -----
  let coupon: any = null; let couponDiscount = 0;
  const code = clip(input.couponCode, 40).toUpperCase();
  if (code) {
    const found = (await queryEq(storePath('coupons'), 'code', code, 1))[0];
    if (!found) throw new HttpError(400, 'Coupon ' + code + ' is not valid.');
    if (found.data.used) throw new HttpError(400, 'Coupon ' + code + ' has already been used.');
    if (found.data.expiresAt && Date.parse(found.data.expiresAt) < Date.now()) throw new HttpError(400, 'Coupon ' + code + ' has expired.');
    const v = num(found.data.discountValue);
    couponDiscount = Math.min(subtotal, Math.round(found.data.discountType === 'percent' ? subtotal * Math.min(100, v) / 100 : v));
    coupon = { id: found.id, code };
  }

  // ----- first-order discount (signed-in customers with no previous orders) -----
  let fodAmount = 0; let customer: any = null;
  if (uid) {
    const c = await getDoc(storePath('customers', uid));
    if (c) {
      customer = c;
      const fod = project.firstOrderDiscount;
      if (fod && fod.enabled && num(fod.value) > 0 && !(num(c.data.orderCount) > 0)) {
        const base = subtotal - couponDiscount;
        fodAmount = Math.min(base, Math.round(fod.type === 'percent' ? base * Math.min(100, num(fod.value)) / 100 : num(fod.value)));
      }
    }
  }

  const total = Math.max(0, subtotal - couponDiscount - fodAmount);
  if (method === 'cod' && project.paymentConfig && num(project.paymentConfig.codLimit) > 0 && total > num(project.paymentConfig.codLimit)) throw new HttpError(400, 'Cash on delivery is available for orders up to ₹' + num(project.paymentConfig.codLimit).toLocaleString('en-IN') + '. Please pay online.');
  if (total < 1 && method !== 'cod') throw new HttpError(400, 'The order total is ₹0 — please choose cash on delivery or call us.');
  const gst = project.gst || {}; const rate = gst.enabled ? num(gst.rate) : 0;
  const gstAmount = rate ? Math.round(total - total / (1 + rate / 100)) : 0;

  return {
    lines, subtotal, coupon, couponDiscount, fodAmount, total, rate, gstAmount, customer, project, method,
    who: { name, phone, email: clip(input.customerEmail, 120), address, pincode, note: clip(input.customerNote, 500) }
  };
}

/** Writes the order (and, for cash on delivery, reserves stock straight away). */
export async function placeOrder(q: Awaited<ReturnType<typeof quote>>, uid: string | null) {
  const s = settings(); const id = newId(); const path = storePath('orders', id);
  const inv = invoiceNo(q.project.paymentConfig && q.project.paymentConfig.invoicePrefix);
  const cod = q.method === 'cod'; const live = livePayments();
  const order: Record<string, any> = {
    items: q.lines.map(({ tracked, ...l }) => l), subtotal: q.subtotal, couponCode: q.coupon ? q.coupon.code : null, couponDiscount: q.couponDiscount, firstOrderDiscount: q.fodAmount,
    total: q.total, gstRate: q.rate, gstAmount: q.gstAmount, status: cod ? 'confirmed' : 'pending_payment', paymentMethod: q.method, source: 'online',
    customerName: q.who.name, customerPhone: q.who.phone, customerEmail: q.who.email, customerAddress: q.who.address, customerPincode: q.who.pincode, customerNote: q.who.note,
    customerUid: uid && q.customer ? uid : null, invoiceNo: inv, invoiceNumber: inv, createdAt: new Date(), stockRestored: false,
    ...(cod ? { codAmountDue: q.total, stockReserved: true } : { testPayment: !live })
  };
  let rzp: any = null;
  if (!cod) {
    if (live) {
      const res = await fetch('https://api.razorpay.com/v1/orders', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Basic ' + Buffer.from(s.razorpayKeyId + ':' + s.razorpayKeySecret).toString('base64') }, body: JSON.stringify({ amount: q.total * 100, currency: 'INR', receipt: inv.slice(0, 40), notes: { orderId: id, store: s.slug } }) });
      rzp = await res.json().catch(() => ({}));
      if (!res.ok || !rzp.id) throw new HttpError(502, 'The payment gateway is busy. Please try again in a minute.');
      order.razorpayOrderId = rzp.id;
    } else order.razorpayOrderId = 'test_' + id;
  }
  const writes = [w.create(path, order)];
  if (cod) writes.push(...finalWrites(q.lines, q.coupon && q.coupon.id, inv, uid && q.customer ? uid : null, q.who));
  await commit(writes);
  return {
    orderId: id, invoiceNumber: inv, amount: q.total * 100, currency: 'INR', keyId: live ? s.razorpayKeyId : null,
    razorpayOrderId: order.razorpayOrderId || null, cod, dummy: !cod && !live,
    couponDiscount: q.coupon ? { code: q.coupon.code, amount: q.couponDiscount } : null,
    firstOrderDiscount: q.fodAmount ? { amount: q.fodAmount } : null,
    gst: { enabled: !!q.rate, rate: q.rate, amount: q.gstAmount }
  };
}

/** Stock down, coupon used, customer profile updated — applied once an order is confirmed. */
function finalWrites(lines: any[], couponId: string | null, inv: string, uid: string | null, who: any) {
  const out: any[] = [];
  for (const l of lines) if (l.tracked !== false) out.push(w.increment(storePath('sarees', l.itemId), 'quantity', -l.qty));
  if (couponId) out.push(w.patch(storePath('coupons', couponId), { used: true, usedOn: inv, usedAt: new Date() }));
  if (uid) { out.push(w.patch(storePath('customers', uid), { address: who.address, pincode: who.pincode, lastOrderAt: new Date() })); out.push(w.increment(storePath('customers', uid), 'orderCount', 1)); }
  return out;
}

export function signatureOk(orderId: string, paymentId: string, signature: string) {
  const want = createHmac('sha256', settings().razorpayKeySecret).update(orderId + '|' + paymentId).digest('hex');
  const a = Buffer.from(want); const b = Buffer.from(String(signature || ''));
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Marks an online order paid exactly once (safe to call from both the browser and the webhook). */
export async function markPaid(orderId: string, paymentId: string, opts: { test?: boolean } = {}) {
  const path = storePath('orders', orderId);
  for (let attempt = 0; attempt < 3; attempt++) {
    const d = await getDoc(path); if (!d) throw new HttpError(404, 'Order not found.');
    const o = d.data;
    if (o.status && o.status !== 'pending_payment') return { already: true, order: o };
    // only count stock for sarees that are still counted
    const lines: any[] = [];
    for (const it of o.items || []) { const s = await getDoc(storePath('sarees', it.itemId)); lines.push({ ...it, tracked: !!(s && tracked(s.data)) }); }
    const couponId = o.couponCode ? ((await queryEq(storePath('coupons'), 'code', o.couponCode, 1))[0] || {} as any).id || null : null;
    const writes = [w.patch(path, { status: 'paid', razorpayPaymentId: paymentId, paidAt: new Date(), ...(opts.test ? { testPayment: true } : {}) }, d.updateTime),
      ...finalWrites(lines, couponId, o.invoiceNo, o.customerUid || null, { address: o.customerAddress, pincode: o.customerPincode })];
    try { await commit(writes); return { already: false, order: o }; }
    catch (e: any) { if (e.fsStatus === 'FAILED_PRECONDITION' || e.status === 409) continue; throw e; } // changed meanwhile → re-read
  }
  return { already: true, order: null };
}
