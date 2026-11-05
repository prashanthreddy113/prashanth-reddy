import { esc, inr, num, $, $$, toast, modal, imageUrl, finalPrice, stockOf, printInvoice, PAY_LABEL, ts, empty } from '../ui.js';
import { adjustStock, invoiceNo, normalizeMobile } from '../ops.js';

export function couponValue(c, subtotal) {
  if (!c) return 0;
  const v = num(c.discountValue);
  return Math.min(subtotal, Math.round(c.discountType === 'percent' ? subtotal * Math.min(100, v) / 100 : v));
}
export function couponProblem(c) {
  if (!c) return 'No coupon with that code.';
  if (c.used) return 'This coupon has already been used.';
  if (c.expiresAt && ts(c.expiresAt) < Date.now()) return 'This coupon has expired.';
  return '';
}

export default {
  id: 'billing', title: 'In-store billing', group: 'Sell', icon: 'bill',
  async render(view, ctx) {
    const { api, project } = ctx;
    const [sarees, employees, customers, coupons] = await Promise.all([
      api.list('sarees'), api.list('employees').catch(() => []), api.list('customers').catch(() => []), api.list('coupons').catch(() => [])
    ]);
    if (ctx.stale()) return;
    const sellable = sarees.filter((s) => finalPrice(s) > 0).sort((a, b) => ts(b.createdAt) - ts(a.createdAt));
    const staff = employees.filter((e) => e.status !== 'inactive');
    const cart = []; let coupon = null; let q = ''; let cat = '';
    const cats = [...new Set(sellable.map((x) => x.category).filter(Boolean))];
    const HOLD_KEY = 'yka_held_bills';
    const held = () => { try { return JSON.parse(localStorage.getItem(HOLD_KEY)) || []; } catch (e) { return []; } };
    const setHeld = (v) => { try { localStorage.setItem(HOLD_KEY, JSON.stringify(v)); } catch (e) { /* ignore */ } };
    const pm = project.paymentMethods || {};
    const payOpts = [['cash', 'Cash'], ['upi', 'UPI'], ['card', 'Card']].concat(pm.netbanking ? [['netbanking', 'Bank transfer']] : []);

    view.innerHTML = '<div class="pos"><div>' +
      '<div class="bar pos-search"><input type="search" id="pq" placeholder="Search saree name, colour, weave…"><input id="scan" placeholder="Scan / type SKU + Enter" autocomplete="off"></div>' +
      '<div class="pos-chips" id="chips"><button class="on" data-c="">All</button>' + cats.map((c) => '<button data-c="' + esc(c) + '">' + esc(c) + '</button>').join('') + '</div>' +
      '<div class="pos-items" id="items"></div></div>' +
      '<aside class="cart receipt"><div class="rc-head"><div><span>New bill</span><strong id="rcCount">0 items</strong></div><div class="rc-actions"><button class="btn sm ghost" id="hold" title="Park this bill and start another">Hold</button><button class="btn sm ghost" id="held">Held (<b id="heldN">0</b>)</button><button class="btn sm ghost" id="clear">Clear</button></div></div><div class="rc-body"><div id="lines"></div>' +
      '<div class="stack" style="margin-top:14px">' +
      '<div class="grid2"><label class="field"><span>Customer mobile</span><input id="cPhone" inputmode="tel" placeholder="10-digit mobile"></label><label class="field"><span>Name</span><input id="cName" placeholder="Walk-in customer"></label></div>' +
      '<p class="tiny muted" id="cHint" style="margin:-6px 0 0"></p>' +
      (staff.length ? '<label class="field"><span>Salesperson</span><select id="sp"><option value="">—</option>' + staff.map((e) => '<option value="' + esc(e.id) + '">' + esc(e.name) + '</option>').join('') + '</select></label>' : '') +
      '<div class="grid2"><label class="field"><span>Coupon code</span><input id="cpn" placeholder="Optional" style="text-transform:uppercase"></label><label class="field"><span>Extra discount ₹</span><input id="disc" type="number" min="0" step="1" placeholder="0"></label></div>' +
      '<div class="field"><span>Payment</span><div class="pay-opts">' + payOpts.map((p, i) => '<label><input type="radio" name="pay" value="' + p[0] + '"' + (i ? '' : ' checked') + '>' + p[1] + '</label>').join('') + '</div></div>' +
      '</div><div class="sum" id="sum"></div>' +
      '<button class="btn primary block" id="done" disabled>Complete sale</button>' +
      '<p class="tiny muted" style="margin:10px 0 0">Completing a sale saves the order, reduces stock and adds the customer to your list. Shortcut: Ctrl + Enter.</p></div></aside></div>';

    const drawItems = () => {
      const s = q.toLowerCase();
      const list = sellable.filter((x) => (!cat || x.category === cat) && (!s || [x.name, x.sku, x.colour, x.category].join(' ').toLowerCase().includes(s))).slice(0, 80);
      $('#items').innerHTML = list.length ? list.map((x) => {
        const st = stockOf(x); const inCart = (cart.find((c) => c.s.id === x.id) || {}).qty || 0;
        return '<button class="pos-item' + (st - inCart <= 0 ? ' out' : '') + '" data-id="' + esc(x.id) + '"><img src="' + esc(imageUrl(x.imageUrl)) + '" alt="" loading="lazy"><div><strong>' + esc(x.name) + '</strong><span>' + inr(finalPrice(x)) + '</span><em>' + (st === Infinity ? esc(x.category || '') : st + ' in stock') + '</em></div></button>';
      }).join('') : empty('No sarees match.');
    };
    const totals = () => {
      const sub = cart.reduce((a, c) => a + finalPrice(c.s) * c.qty, 0);
      const cd = couponValue(coupon, sub); const extra = Math.min(sub - cd, Math.max(0, num($('#disc').value)));
      return { sub, cd, extra, total: sub - cd - extra };
    };
    const drawCart = () => {
      $('#lines').innerHTML = cart.length ? cart.map((c, i) => '<div class="cart-line"><img src="' + esc(imageUrl(c.s.imageUrl)) + '" alt=""><div><div class="cell-main" style="font-size:13px">' + esc(c.s.name) + '</div><div class="qty"><button data-q="' + i + '" data-d="-1">−</button><span>' + c.qty + '</span><button data-q="' + i + '" data-d="1">+</button></div></div><strong>' + inr(finalPrice(c.s) * c.qty) + '</strong></div>').join('') : '<p class="muted">Tap sarees on the left to add them.</p>';
      const t = totals();
      $('#sum').innerHTML = '<div><span>Subtotal</span><span>' + inr(t.sub) + '</span></div>' + (t.cd ? '<div><span>Coupon ' + esc(coupon.code) + '</span><span>− ' + inr(t.cd) + '</span></div>' : '') + (t.extra ? '<div><span>Discount</span><span>− ' + inr(t.extra) + '</span></div>' : '') +
        ((project.gst || {}).enabled ? '<div class="muted"><span>incl. GST ' + num(project.gst.rate) + '%</span><span>' + inr(t.total - t.total / (1 + num(project.gst.rate) / 100)) + '</span></div>' : '') +
        '<div class="grand"><span>Total</span><span>' + inr(t.total) + '</span></div>';
      $('#done').disabled = !cart.length;
      $('#rcCount').textContent = cart.reduce((a, c) => a + c.qty, 0) + ' item' + (cart.reduce((a, c) => a + c.qty, 0) === 1 ? '' : 's');
      $('#heldN').textContent = held().length;
      drawItems();
    };
    $('#pq').addEventListener('input', (e) => { q = e.target.value; drawItems(); });
    $('#chips').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; cat = b.dataset.c; [].forEach.call($('#chips').children, (x) => x.classList.toggle('on', x === b)); drawItems(); });
    const addSaree = (s) => { const row = cart.find((c) => c.s.id === s.id); if (stockOf(s) - (row ? row.qty : 0) <= 0) { toast('Out of stock: ' + s.name, 'err'); return; } if (row) row.qty++; else cart.push({ s, qty: 1 }); drawCart(); };
    $('#scan').addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return; e.preventDefault();
      const code = e.target.value.trim().toLowerCase(); if (!code) return;
      const s = sellable.find((x) => String(x.sku || '').toLowerCase() === code) || sellable.find((x) => x.id.toLowerCase() === code);
      if (s) { addSaree(s); toast('Added ' + s.name); } else toast('No saree with SKU ' + code, 'err');
      e.target.value = '';
    });
    const resetBill = () => { cart.splice(0); coupon = null; ['#cPhone', '#cName', '#cpn', '#disc'].forEach((k) => { $(k).value = ''; }); $('#cHint').textContent = ''; drawCart(); };
    $('#clear').addEventListener('click', resetBill);
    $('#hold').addEventListener('click', () => {
      if (!cart.length) { toast('Nothing to hold'); return; }
      setHeld(held().concat([{ at: Date.now(), name: $('#cName').value.trim() || $('#cPhone').value.trim() || 'Customer', phone: $('#cPhone').value.trim(), items: cart.map((c) => ({ id: c.s.id, qty: c.qty })) }]));
      resetBill(); toast('Bill on hold');
    });
    $('#held').addEventListener('click', async () => {
      const list = held();
      if (!list.length) { toast('No bills on hold'); return; }
      await modal({ title: 'Bills on hold', cancel: 'Close', body: '<div class="list">' + list.map((h, i) => '<div class="list-row"><div class="grow"><div class="cell-main">' + esc(h.name) + '</div><div class="cell-sub">' + h.items.reduce((a, x) => a + x.qty, 0) + ' item(s) · held at ' + new Date(h.at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) + '</div></div><button type="button" class="btn sm primary" data-resume="' + i + '">Resume</button><button type="button" class="icon-btn" data-drop="' + i + '">✕</button></div>').join('') + '</div>',
        onOpen(f) {
          f.addEventListener('click', (e) => {
            const r = e.target.closest('[data-resume]'); const d = e.target.closest('[data-drop]');
            if (r) { const h = list[Number(r.dataset.resume)]; resetBill(); h.items.forEach((x) => { const s = sellable.find((y) => y.id === x.id); if (s) cart.push({ s, qty: Math.min(x.qty, stockOf(s)) }); }); $('#cPhone').value = h.phone || ''; $('#cName').value = h.name === 'Customer' ? '' : h.name; setHeld(list.filter((_, k) => k !== Number(r.dataset.resume))); drawCart(); f.querySelector('[data-x]').click(); }
            if (d) { setHeld(list.filter((_, k) => k !== Number(d.dataset.drop))); f.querySelector('[data-x]').click(); drawCart(); }
          });
        } });
    });
    document.addEventListener('keydown', function onKey(e) { if (!document.body.contains($('#done'))) { document.removeEventListener('keydown', onKey); return; } if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !$('#done').disabled) $('#done').click(); });
    $('#items').addEventListener('click', (e) => {
      const b = e.target.closest('[data-id]'); if (!b) return;
      addSaree(sellable.find((x) => x.id === b.dataset.id));
    });
    $('#lines').addEventListener('click', (e) => {
      const b = e.target.closest('[data-q]'); if (!b) return;
      const c = cart[Number(b.dataset.q)]; const n = c.qty + Number(b.dataset.d);
      if (n <= 0) cart.splice(Number(b.dataset.q), 1); else if (n <= stockOf(c.s)) c.qty = n; else toast('Only ' + stockOf(c.s) + ' in stock');
      drawCart();
    });
    $('#disc').addEventListener('input', drawCart);
    $('#cpn').addEventListener('change', (e) => {
      const code = e.target.value.trim().toUpperCase();
      if (!code) { coupon = null; drawCart(); return; }
      const c = coupons.find((x) => String(x.code).toUpperCase() === code); const p = couponProblem(c);
      if (p) { coupon = null; toast(p, 'err'); } else { coupon = c; toast('Coupon applied'); }
      drawCart();
    });
    $('#cPhone').addEventListener('change', (e) => {
      const m = normalizeMobile(e.target.value); const c = customers.find((x) => normalizeMobile(x.mobile) === m);
      if (c) { $('#cName').value = c.name || ''; $('#cHint').textContent = 'Returning customer · added ' + new Date(c.createdAt).toLocaleDateString('en-IN'); }
      else $('#cHint').textContent = m ? 'New customer — will be added to your list.' : '';
    });

    $('#done').addEventListener('click', async () => {
      const btn = $('#done'); btn.disabled = true;
      try {
        const t = totals(); const mobile = normalizeMobile($('#cPhone').value); const name = $('#cName').value.trim();
        const spSel = $('#sp'); const sp = spSel && spSel.value ? staff.find((x) => x.id === spSel.value) : null;
        const pay = ($('input[name=pay]:checked') || {}).value || 'cash';
        const order = {
          items: cart.map((c) => ({ itemId: c.s.id, name: c.s.name, qty: c.qty, price: finalPrice(c.s), imageUrl: (c.s.imageUrl || '').startsWith('data:') ? '' : c.s.imageUrl })),
          subtotal: t.sub, couponDiscount: t.cd + t.extra, couponCode: coupon ? coupon.code : null, total: t.total,
          status: 'completed', source: 'store', paymentMethod: pay,
          customerName: name || 'Walk-in customer', customerPhone: mobile, customerAddress: '', customerPincode: '',
          salesperson: sp ? sp.name : '', salespersonId: sp ? sp.id : '', invoiceNo: invoiceNo(project),
          gstRate: (project.gst || {}).enabled ? num(project.gst.rate) : 0, createdBy: ctx.session.email,
          stockRestored: false
        };
        const id = await api.add('orders', order);
        for (const c of cart) await adjustStock(api, c.s.id, -c.qty, 'In-store sale', order.invoiceNo);
        if (coupon) await api.update('coupons', coupon.id, { used: true, usedOn: order.invoiceNo }).catch(() => {});
        if (mobile && !customers.some((x) => normalizeMobile(x.mobile) === mobile)) await api.add('customers', { name: name || 'Customer', mobile, details: 'Added at billing' }).catch(() => {});
        const saved = { id, ...order, createdAt: new Date().toISOString() };
        const wa = mobile ? 'https://wa.me/' + mobile.replace('+', '') + '?text=' + encodeURIComponent('Thank you for shopping at Yukktha!\nInvoice ' + order.invoiceNo + '\n' + order.items.map((i) => i.name + ' × ' + i.qty + ' — ' + inr(i.price * i.qty)).join('\n') + '\nTotal: ' + inr(order.total) + ' (' + (PAY_LABEL[pay] || pay) + ')') : '';
        const again = await modal({ title: 'Sale completed', body: '<p><strong>' + esc(order.invoiceNo) + '</strong> · ' + inr(order.total) + ' via ' + esc(PAY_LABEL[pay] || pay) + '</p><div class="checks"><button type="button" class="btn" id="pInv">Print invoice</button>' + (wa ? '<a class="btn" target="_blank" rel="noopener" href="' + esc(wa) + '">Send on WhatsApp</a>' : '') + '</div>', submit: 'New bill', cancel: 'Close', onOpen(f) { $('#pInv', f).addEventListener('click', () => printInvoice(saved, project)); } });
        if (again !== undefined) ctx.rerender();
      } catch (e) { toast(e.message, 'err'); btn.disabled = false; }
    });
    drawCart();
  }
};
