// Shared helpers for the admin pages.
import { CONFIG } from './config.js';

export const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const inr = (n) => '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN');
export const num = (v, d = 0) => { const n = Number(String(v == null ? '' : v).replace(/[^0-9.-]/g, '')); return Number.isFinite(n) && String(v).trim() !== '' ? n : d; };
export const today = () => new Date().toISOString().slice(0, 10);
export const fmtDate = (v, withTime) => {
  if (!v) return '—';
  const d = new Date(v); if (isNaN(d)) return esc(v);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) + (withTime ? ' · ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '');
};
export const ts = (v) => { const t = Date.parse(v); return isNaN(t) ? 0 : t; };
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [].slice.call(root.querySelectorAll(sel));

// ---------- sarees ----------
export function imageUrl(u) {
  if (!u) return CONFIG.storefrontUrl + 'assets/img/saree-3.jpg';
  if (/^(data:|https?:)/.test(u)) return u;
  if (/^assets\/saree-\d\.jpg$/.test(u)) return CONFIG.storefrontUrl + u.replace('assets/', 'assets/img/');
  return CONFIG.storefrontUrl + u.replace(/^\//, '');
}
export const mrp = (s) => num(s.sellPrice) || num(s.price);
export const finalPrice = (s) => Math.round(mrp(s) * (1 - Math.min(100, Math.max(0, num(s.discountPercent))) / 100));
export function stockOf(s) {
  if (s.stockMode === 'availability') return s.available === false ? 0 : Infinity;
  return s.quantity == null ? Infinity : Math.max(0, num(s.quantity));
}
export const stockLabel = (s) => { const n = stockOf(s); return n === Infinity ? (s.stockMode === 'availability' ? 'Available' : 'Not tracked') : n === 0 ? 'Out of stock' : n + ' pcs'; };

// ---------- orders ----------
export const STATUS_LABEL = { pending_payment: 'Pending payment', paid: 'Paid', confirmed: 'Confirmed', preparing: 'Preparing', ready: 'Ready', completed: 'Completed', cancelled: 'Cancelled', returned: 'Returned' };
export const PAY_LABEL = { cash: 'Cash', upi: 'UPI', card: 'Card', gpay: 'Google Pay', phonepe: 'PhonePe', netbanking: 'Net banking', cod: 'Cash on delivery', razorpay: 'Razorpay', split: 'Split' };
export const orderTotal = (o) => num(o.total, num(o.subtotal) - num(o.couponDiscount) - num(o.firstOrderDiscount));
export const counts = (o) => !CONFIG.unwoundStatuses.includes(o.status) && o.status !== 'pending_payment';
export const statusPill = (s) => '<span class="pill st-' + esc(s || 'pending_payment') + '">' + esc(STATUS_LABEL[s] || s || 'Pending payment') + '</span>';

// ---------- toast / modal / confirm ----------
let toastTimer;
export function toast(msg, kind) {
  const t = $('#toast'); t.textContent = msg; t.className = 'toast on ' + (kind || '');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.className = 'toast'; }, kind === 'err' ? 5000 : 2400);
}
export function modal({ title, body, submit, wide, onOpen, cancel = 'Cancel', danger }) {
  return new Promise((resolve) => {
    const wrap = document.createElement('div');
    wrap.className = 'modal-wrap';
    wrap.innerHTML = '<form class="modal' + (wide ? ' wide' : '') + '" novalidate><header><h3>' + esc(title) + '</h3><button type="button" class="icon-btn" data-x aria-label="Close">✕</button></header>' +
      '<div class="modal-body">' + body + '</div><p class="form-err" hidden></p>' +
      '<footer>' + (cancel ? '<button type="button" class="btn ghost" data-x>' + esc(cancel) + '</button>' : '') + (submit ? '<button class="btn ' + (danger ? 'danger' : 'primary') + '" type="submit">' + esc(submit) + '</button>' : '') + '</footer></form>';
    document.body.appendChild(wrap);
    const form = wrap.querySelector('form'); const err = wrap.querySelector('.form-err');
    const close = (v) => { wrap.remove(); document.removeEventListener('keydown', onKey); resolve(v); };
    const onKey = (e) => { if (e.key === 'Escape') close(null); };
    document.addEventListener('keydown', onKey);
    wrap.addEventListener('mousedown', (e) => { if (e.target === wrap) close(null); });
    $$('[data-x]', wrap).forEach((b) => b.addEventListener('click', () => close(null)));
    form.addEventListener('submit', async (e) => {
      e.preventDefault(); err.hidden = true;
      if (!submit) return;
      const btn = form.querySelector('[type=submit]'); btn.disabled = true;
      try {
        const v = typeof submit === 'string' && form.__onSubmit ? await form.__onSubmit(form) : formValues(form);
        if (v === false) { btn.disabled = false; return; }
        close(v === undefined ? formValues(form) : v);
      } catch (ex) { err.textContent = ex.message || String(ex); err.hidden = false; btn.disabled = false; }
    });
    if (onOpen) onOpen(form, (fn) => { form.__onSubmit = fn; });
    const first = form.querySelector('input:not([type=hidden]):not([type=checkbox]), select, textarea'); if (first) setTimeout(() => first.focus(), 30);
  });
}
export const confirmBox = (text, yes = 'Delete') => modal({ title: 'Please confirm', body: '<p>' + esc(text) + '</p>', submit: yes, danger: true }).then((v) => !!v);
export function formValues(form) {
  const o = {};
  $$('input, select, textarea', form).forEach((el) => {
    if (!el.name) return;
    if (el.type === 'checkbox') o[el.name] = el.checked;
    else if (el.type === 'number') o[el.name] = el.value === '' ? null : Number(el.value);
    else if (el.type === 'file') return;
    else o[el.name] = el.value.trim();
  });
  return o;
}

// ---------- form fields ----------
export const field = (label, input, hint) => '<label class="field"><span>' + esc(label) + '</span>' + input + (hint ? '<small>' + esc(hint) + '</small>' : '') + '</label>';
export const input = (name, value, attrs = '') => '<input name="' + name + '" value="' + esc(value == null ? '' : value) + '" ' + attrs + '>';
export const select = (name, options, value, attrs = '') => '<select name="' + name + '" ' + attrs + '>' + options.map((o) => { const [v, l] = Array.isArray(o) ? o : [o, o]; return '<option value="' + esc(v) + '"' + (String(v) === String(value) ? ' selected' : '') + '>' + esc(l) + '</option>'; }).join('') + '</select>';
export const checkbox = (name, checked, label) => '<label class="check"><input type="checkbox" name="' + name + '"' + (checked ? ' checked' : '') + '> ' + esc(label) + '</label>';

// ---------- images ----------
// Firestore docs hold at most 1 MB, so photos are shrunk to ~1000px JPEGs before saving.
export function compressImage(file, maxSide = 1000, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const img = new Image(); const url = URL.createObjectURL(file);
    img.onload = () => {
      const s = Math.min(1, maxSide / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url); resolve(c.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read ' + file.name)); };
    img.src = url;
  });
}

// ---------- CSV ----------
export function downloadCsv(name, rows) {
  if (!rows.length) { toast('Nothing to export'); return; }
  const cols = Object.keys(rows[0]);
  const cell = (v) => { v = v == null ? '' : String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
  const csv = [cols.join(',')].concat(rows.map((r) => cols.map((c) => cell(r[c])).join(','))).join('\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv' })); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
export function parseCsv(text) {
  const rows = []; let row = []; let cur = ''; let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"' && text[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; }
    else if (ch === '"') q = true; else if (ch === ',') { row.push(cur); cur = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; }
    else cur += ch;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  const head = (rows.shift() || []).map((h) => h.trim().toLowerCase());
  return rows.filter((r) => r.some((c) => c.trim())).map((r) => { const o = {}; head.forEach((h, i) => { o[h] = (r[i] || '').trim(); }); return o; });
}

// ---------- charts (tiny SVG bars) ----------
export function barChart(data, { height = 180, money = true } = {}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const w = 100 / Math.max(1, data.length);
  return '<div class="chart"><svg viewBox="0 0 100 ' + height + '" preserveAspectRatio="none" role="img">' + data.map((d, i) => {
    const h = (d.value / max) * (height - 4);
    return '<rect x="' + (i * w + w * 0.18) + '" y="' + (height - h) + '" width="' + (w * 0.64) + '" height="' + h + '" rx="0.6"><title>' + esc(d.label) + ': ' + (money ? inr(d.value) : d.value) + '</title></rect>';
  }).join('') + '</svg><div class="chart-x">' + data.map((d, i) => '<span style="width:' + w + '%">' + (data.length > 16 && i % Math.ceil(data.length / 8) ? '' : esc(d.short || d.label)) + '</span>').join('') + '</div></div>';
}
export function hbars(rows, money = true) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return '<div class="hbars">' + rows.map((r) => '<div class="hbar"><span class="hb-l">' + esc(r.label) + '</span><span class="hb-t"><i style="width:' + (r.value / max * 100) + '%"></i></span><span class="hb-v">' + (money ? inr(r.value) : r.value) + '</span></div>').join('') + '</div>';
}

// ---------- empty / error states ----------
export const empty = (msg, action) => '<div class="empty"><p>' + esc(msg) + '</p>' + (action || '') + '</div>';
export function errorBox(err) {
  const denied = err && err.code === 'permission-denied';
  return '<div class="alert ' + (denied ? 'warn' : 'err') + '"><strong>' + (denied ? 'Not allowed yet' : 'Something went wrong') + '</strong><p>' + esc(err && err.message || err) + '</p></div>';
}

// ---------- invoice ----------
export function printInvoice(order, project) {
  const pc = project.paymentConfig || {}; const gst = project.gst || {};
  const store = (project.stores || [])[0] || {};
  const items = order.items || [];
  const sub = num(order.subtotal, items.reduce((a, b) => a + num(b.price) * num(b.qty, 1), 0));
  const total = orderTotal(order);
  const rate = gst.enabled ? num(gst.rate) : 0;
  const taxable = rate ? total / (1 + rate / 100) : total;
  const w = window.open('', '_blank', 'width=820,height=900');
  if (!w) { toast('Allow pop-ups to print the invoice', 'err'); return; }
  w.document.write('<!doctype html><meta charset="utf-8"><title>Invoice ' + esc(order.invoiceNo || order.id) + '</title><style>body{font:14px/1.5 "Open Sans",Arial,sans-serif;color:#222;margin:40px}h1{font:500 26px Georgia,serif;letter-spacing:5px;color:#6b1b4e;margin:0}small{color:#777}table{width:100%;border-collapse:collapse;margin:24px 0}th,td{padding:9px 6px;border-bottom:1px solid #eee;text-align:left}th{font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#6b1b4e}td.r,th.r{text-align:right}.top{display:flex;justify-content:space-between;gap:30px}.tot td{border:0;padding:4px 6px}.grand td{font-weight:700;font-size:16px;border-top:2px solid #6b1b4e}@media print{button{display:none}}</style>' +
    '<div class="top"><div><h1>YUKKTHA</h1><small>Timeless Royal Weaves</small><p>' + esc(store.address || '') + '<br>Phone: +' + esc(project.whatsappNumber || '') + (gst.enabled && gst.gstin ? '<br>GSTIN: ' + esc(gst.gstin) : '') + '</p></div>' +
    '<div style="text-align:right"><strong>Invoice ' + esc(order.invoiceNo || order.id.slice(0, 8).toUpperCase()) + '</strong><br>' + fmtDate(order.createdAt, true) + '<br>' + esc(STATUS_LABEL[order.status] || '') + '<p><strong>' + esc(order.customerName || 'Walk-in customer') + '</strong><br>' + esc(order.customerPhone || '') + (order.customerAddress ? '<br>' + esc(order.customerAddress) + ' ' + esc(order.customerPincode || '') : '') + '</p></div></div>' +
    '<table><tr><th>#</th><th>Item</th><th class="r">Qty</th><th class="r">Price</th><th class="r">Amount</th></tr>' + items.map((it, i) => '<tr><td>' + (i + 1) + '</td><td>' + esc(it.name) + '</td><td class="r">' + num(it.qty, 1) + '</td><td class="r">' + inr(it.price) + '</td><td class="r">' + inr(num(it.price) * num(it.qty, 1)) + '</td></tr>').join('') + '</table>' +
    '<table class="tot" style="width:320px;margin-left:auto"><tr><td>Subtotal</td><td class="r">' + inr(sub) + '</td></tr>' +
    (num(order.couponDiscount) ? '<tr><td>Discount' + (order.couponCode ? ' (' + esc(order.couponCode) + ')' : '') + '</td><td class="r">− ' + inr(order.couponDiscount) + '</td></tr>' : '') +
    (num(order.firstOrderDiscount) ? '<tr><td>First-order discount</td><td class="r">− ' + inr(order.firstOrderDiscount) + '</td></tr>' : '') +
    (rate ? '<tr><td>Taxable value</td><td class="r">' + inr(taxable) + '</td></tr><tr><td>CGST ' + (rate / 2) + '%</td><td class="r">' + inr((total - taxable) / 2) + '</td></tr><tr><td>SGST ' + (rate / 2) + '%</td><td class="r">' + inr((total - taxable) / 2) + '</td></tr>' : '') +
    '<tr class="grand"><td>Total</td><td class="r">' + inr(total) + '</td></tr><tr><td>Paid via</td><td class="r">' + esc(PAY_LABEL[order.paymentMethod] || order.paymentMethod || '—') + '</td></tr></table>' +
    (pc.upiId ? '<p><small>UPI: ' + esc(pc.upiId) + (pc.payeeName ? ' (' + esc(pc.payeeName) + ')' : '') + '</small></p>' : '') +
    '<p style="margin-top:40px;text-align:center;color:#6b1b4e;font-family:Georgia,serif;font-style:italic">' + esc(project.footerQuote || 'Thank you for shopping with Yukktha') + '</p><button onclick="print()">Print</button>');
  w.document.close(); setTimeout(() => { try { w.focus(); w.print(); } catch (e) { /* ignore */ } }, 300);
}
