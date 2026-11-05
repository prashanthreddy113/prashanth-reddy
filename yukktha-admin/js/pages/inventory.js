import { esc, inr, num, $, $$, toast, modal, confirmBox, field, input, select, fmtDate, ts, today, imageUrl, stockOf, stockLabel, empty } from '../ui.js';
import { CONFIG } from '../config.js';
import { adjustStock } from '../ops.js';

const REASONS = ['New stock received', 'Stock count correction', 'Damaged / defective', 'Sent for fall & pico', 'Returned to supplier', 'Gift / sample'];

export default {
  id: 'inventory', title: 'Stock & suppliers', group: 'Catalogue', icon: 'stock',
  async render(view, ctx) {
    const { api } = ctx;
    const tab = ['stock', 'moves', 'suppliers', 'purchases'].includes(ctx.param) ? ctx.param : 'stock';
    view.innerHTML = '<div class="tabs">' + [['stock', 'Stock levels'], ['moves', 'Stock history'], ['suppliers', 'Suppliers / weavers'], ['purchases', 'Purchases']].map(([k, l]) => '<button data-t="' + k + '" class="' + (k === tab ? 'on' : '') + '">' + l + '</button>').join('') + '</div><div id="pane"></div>';
    $$('[data-t]', view).forEach((b) => b.addEventListener('click', () => ctx.go('#/inventory/' + b.dataset.t)));
    const pane = $('#pane');
    try { await ({ stock, moves, suppliers, purchases })[tab](pane, ctx); } catch (e) { pane.innerHTML = '<div class="alert warn"><strong>Not available</strong><p>' + esc(e.message) + '</p></div>'; }
  }
};

async function stock(pane, ctx) {
  const { api } = ctx;
  let rows = await api.list('sarees'); let q = ''; let only = '';
  const tracked = (s) => s.stockMode !== 'availability' && s.quantity != null;
  pane.innerHTML = '<div class="bar"><input type="search" id="q" placeholder="Search sarees…"><select id="only"><option value="">All sarees</option><option value="low">Low (≤ ' + CONFIG.lowStockAt + ')</option><option value="out">Out of stock</option><option value="untracked">Not counted</option></select><span class="grow"></span><span class="muted" id="sum"></span></div>' +
    '<div class="table-wrap"><table class="t"><thead><tr><th></th><th>Saree</th><th>Weave</th><th>Stock</th><th class="r">Stock value (MRP)</th><th class="r">Adjust</th></tr></thead><tbody id="tb"></tbody></table></div>';
  const draw = () => {
    const s = q.toLowerCase();
    const r = rows.filter((x) => (!s || String(x.name).toLowerCase().includes(s)) && (!only || (only === 'low' ? tracked(x) && stockOf(x) <= CONFIG.lowStockAt && stockOf(x) > 0 : only === 'out' ? stockOf(x) === 0 : !tracked(x) && x.stockMode !== 'availability'))).sort((a, b) => stockOf(a) - stockOf(b));
    const pcs = rows.filter(tracked).reduce((a, x) => a + num(x.quantity), 0);
    const val = rows.filter(tracked).reduce((a, x) => a + num(x.quantity) * num(x.sellPrice), 0);
    $('#sum').textContent = pcs + ' counted pieces · ' + inr(val) + ' at MRP';
    $('#tb').innerHTML = r.length ? r.map((x) => '<tr data-id="' + esc(x.id) + '"><td><img class="thumb" src="' + esc(imageUrl(x.imageUrl)) + '" alt="" loading="lazy"></td><td class="cell-main">' + esc(x.name) + '</td><td>' + esc(x.category || '') + '</td>' +
      '<td><span class="pill ' + (stockOf(x) === 0 ? 'err' : stockOf(x) <= CONFIG.lowStockAt ? 'warn' : 'ok') + '">' + esc(stockLabel(x)) + '</span></td><td class="r">' + (tracked(x) ? inr(num(x.quantity) * num(x.sellPrice)) : '—') + '</td>' +
      '<td class="acts"><button class="btn sm" data-adj>' + (tracked(x) ? 'Add / remove' : 'Start counting') + '</button></td></tr>').join('') : '<tr><td colspan="6">' + empty('Nothing here.') + '</td></tr>';
  };
  $('#q').addEventListener('input', (e) => { q = e.target.value; draw(); });
  $('#only').addEventListener('change', (e) => { only = e.target.value; draw(); });
  $('#tb').addEventListener('click', async (e) => {
    if (!e.target.closest('[data-adj]')) return;
    const s = rows.find((x) => x.id === e.target.closest('tr').dataset.id);
    if (!tracked(s)) {
      const v = await modal({ title: 'Count pieces for ' + s.name, body: field('Pieces in stock now', input('n', '', 'type="number" min="0" required')), submit: 'Save' });
      if (v && v.n != null) { await api.update('sarees', s.id, { stockMode: 'quantity', quantity: Math.max(0, v.n), available: true }); toast('Now counting stock'); rows = await api.list('sarees'); draw(); }
      return;
    }
    const v = await modal({ title: 'Adjust stock · ' + s.name, body: '<p class="muted">Now ' + num(s.quantity) + ' pieces.</p><div class="form-grid">' + field('Change', select('dir', [['in', 'Add pieces (+)'], ['out', 'Remove pieces (−)']])) + field('Pieces', input('n', 1, 'type="number" min="1" required')) + '<div class="full">' + field('Reason', select('reason', REASONS)) + '</div><div class="full">' + field('Reference', input('ref', '', 'placeholder="Bill no., note…"')) + '</div></div>', submit: 'Save' });
    if (v && v.n) { const r = await adjustStock(api, s.id, (v.dir === 'in' ? 1 : -1) * v.n, v.reason, v.ref); toast('Stock now ' + r.after); rows = await api.list('sarees'); draw(); }
  });
  draw();
}

async function moves(pane, ctx) {
  const rows = (await ctx.api.list('stockMoves')).sort((a, b) => ts(b.createdAt) - ts(a.createdAt));
  pane.innerHTML = '<div class="table-wrap"><table class="t"><thead><tr><th>When</th><th>Saree</th><th class="r">Change</th><th class="r">Stock after</th><th>Reason</th><th>Ref</th><th>By</th></tr></thead><tbody>' +
    (rows.length ? rows.slice(0, 300).map((m) => '<tr><td class="nowrap">' + fmtDate(m.createdAt, true) + '</td><td>' + esc(m.name) + '</td><td class="r"><span class="pill ' + (m.delta > 0 ? 'ok' : 'err') + '">' + (m.delta > 0 ? '+' : '') + m.delta + '</span></td><td class="r">' + (m.after == null ? '—' : m.after) + '</td><td>' + esc(m.reason) + '</td><td>' + esc(m.ref || '') + '</td><td class="cell-sub">' + esc(m.by || '') + '</td></tr>').join('') : '<tr><td colspan="7">' + empty('Stock changes from billing, cancellations and adjustments appear here.') + '</td></tr>') + '</tbody></table></div>';
}

async function suppliers(pane, ctx) {
  const { api } = ctx;
  let [rows, buys] = await Promise.all([api.list('suppliers'), api.list('purchases').catch(() => [])]);
  const bal = (s) => buys.filter((p) => p.supplierId === s.id).reduce((a, p) => a + num(p.amount) - num(p.paid), 0) + num(s.openingBalance);
  const draw = () => {
    pane.innerHTML = '<div class="bar"><span class="grow"></span><button class="btn primary" id="add">+ Add supplier</button></div><div class="table-wrap"><table class="t"><thead><tr><th>Supplier</th><th>Place</th><th>Specialty</th><th>Phone</th><th class="r">Balance due</th><th></th></tr></thead><tbody>' +
      (rows.length ? rows.map((s) => '<tr data-id="' + esc(s.id) + '"><td class="cell-main">' + esc(s.name) + (s.gstin ? '<div class="cell-sub">GSTIN ' + esc(s.gstin) + '</div>' : '') + '</td><td>' + esc(s.place || '') + '</td><td>' + esc(s.specialty || '') + '</td><td>' + esc(s.phone || '') + '</td><td class="r"><strong>' + inr(bal(s)) + '</strong></td><td class="acts"><button class="icon-btn" data-edit>✎</button><button class="icon-btn" data-del>🗑</button></td></tr>').join('') : '<tr><td colspan="6">' + empty('Add the weavers and wholesalers you buy from.') + '</td></tr>') + '</tbody></table></div>';
    $('#add').onclick = () => edit(null);
    pane.querySelector('tbody').onclick = async (e) => {
      const tr = e.target.closest('tr[data-id]'); if (!tr) return; const s = rows.find((x) => x.id === tr.dataset.id);
      if (e.target.closest('[data-edit]')) edit(s);
      if (e.target.closest('[data-del]') && await confirmBox('Delete supplier ' + s.name + '?')) { await api.remove('suppliers', s.id); rows = await api.list('suppliers'); draw(); }
    };
  };
  const edit = async (s) => {
    const v = await modal({ title: s ? 'Edit supplier' : 'Add supplier', submit: 'Save', body: '<div class="form-grid">' + field('Name', input('name', s && s.name, 'required')) + field('Place', input('place', s && s.place, 'placeholder="Kanchipuram"')) + field('Phone', input('phone', s && s.phone)) + field('GSTIN', input('gstin', s && s.gstin)) + field('Specialty', input('specialty', s && s.specialty, 'placeholder="Kanjivaram, Kuppadam…"')) + field('Opening balance due (₹)', input('openingBalance', s ? num(s.openingBalance) : 0, 'type="number" min="0"')) + '<div class="full">' + field('Bank / UPI details', input('payTo', s && s.payTo)) + '</div></div>' });
    if (!v) return; if (!v.name) { toast('Name is required', 'err'); return; }
    if (s) await api.update('suppliers', s.id, v); else await api.add('suppliers', v);
    toast('Saved'); rows = await api.list('suppliers'); draw();
  };
  draw();
}

async function purchases(pane, ctx) {
  const { api } = ctx;
  let [rows, sups] = await Promise.all([api.list('purchases'), api.list('suppliers').catch(() => [])]);
  const draw = () => {
    rows.sort((a, b) => ts(b.date) - ts(a.date));
    const due = rows.reduce((a, p) => a + num(p.amount) - num(p.paid), 0);
    pane.innerHTML = '<div class="kpis"><div class="kpi"><span>Purchases</span><strong>' + inr(rows.reduce((a, p) => a + num(p.amount), 0)) + '</strong><small>' + rows.reduce((a, p) => a + num(p.pieces), 0) + ' pieces</small></div><div class="kpi"><span>Paid</span><strong>' + inr(rows.reduce((a, p) => a + num(p.paid), 0)) + '</strong></div><div class="kpi accent"><span>Balance due to suppliers</span><strong>' + inr(due) + '</strong></div></div>' +
      '<div class="bar"><span class="grow"></span><button class="btn primary" id="add">+ Record purchase</button></div><div class="table-wrap"><table class="t"><thead><tr><th>Date</th><th>Supplier</th><th>Bill no.</th><th class="r">Pieces</th><th class="r">Amount</th><th class="r">Paid</th><th class="r">Due</th><th></th></tr></thead><tbody>' +
      (rows.length ? rows.map((p) => '<tr data-id="' + esc(p.id) + '"><td>' + fmtDate(p.date) + '</td><td>' + esc(p.supplierName || '') + '<div class="cell-sub">' + esc(p.note || '') + '</div></td><td>' + esc(p.billNo || '') + '</td><td class="r">' + num(p.pieces) + '</td><td class="r">' + inr(p.amount) + '</td><td class="r">' + inr(p.paid) + '</td><td class="r"><strong>' + inr(num(p.amount) - num(p.paid)) + '</strong></td><td class="acts">' + (num(p.amount) > num(p.paid) ? '<button class="btn sm" data-pay>Pay</button>' : '<span class="pill ok">Settled</span>') + '<button class="icon-btn" data-edit>✎</button><button class="icon-btn" data-del>🗑</button></td></tr>').join('') : '<tr><td colspan="8">' + empty('Record supplier bills to track what you owe.') + '</td></tr>') + '</tbody></table></div>';
    $('#add').onclick = () => edit(null);
    pane.querySelector('tbody').onclick = async (e) => {
      const tr = e.target.closest('tr[data-id]'); if (!tr) return; const p = rows.find((x) => x.id === tr.dataset.id);
      if (e.target.closest('[data-edit]')) edit(p);
      else if (e.target.closest('[data-del]')) { if (await confirmBox('Delete this purchase?')) { await api.remove('purchases', p.id); rows = await api.list('purchases'); draw(); } }
      else if (e.target.closest('[data-pay]')) {
        const v = await modal({ title: 'Pay ' + (p.supplierName || 'supplier'), body: field('Amount paid now (₹)', input('amt', num(p.amount) - num(p.paid), 'type="number" min="1" required')) + '<label class="check" style="margin-top:12px"><input type="checkbox" name="exp" checked> Also record as an expense</label>', submit: 'Save payment' });
        if (v && v.amt) {
          await api.update('purchases', p.id, { paid: num(p.paid) + v.amt });
          if (v.exp) await api.add('expenses', { category: 'Stock purchase', note: 'Paid ' + (p.supplierName || '') + ' · ' + (p.billNo || ''), amount: v.amt, paidVia: 'bank', date: today() }).catch(() => {});
          toast('Payment saved'); rows = await api.list('purchases'); draw();
        }
      }
    };
  };
  const edit = async (p) => {
    const v = await modal({ title: p ? 'Edit purchase' : 'Record purchase', submit: 'Save', body: '<div class="form-grid">' + field('Supplier', select('supplierId', sups.map((s) => [s.id, s.name]).concat([['', '— other —']]), p && p.supplierId)) + field('Date', input('date', p ? p.date : today(), 'type="date" required')) + field('Bill no.', input('billNo', p && p.billNo)) + field('Pieces', input('pieces', p ? p.pieces : '', 'type="number" min="0"')) + field('Bill amount (₹)', input('amount', p ? p.amount : '', 'type="number" min="0" required')) + field('Paid so far (₹)', input('paid', p ? p.paid : 0, 'type="number" min="0"')) + '<div class="full">' + field('Note', input('note', p && p.note)) + '</div></div>' + (p ? '' : '<p class="tiny muted">Add the new sarees in Sarees (or use “Add / remove” in Stock levels) to put the pieces on sale.</p>') });
    if (!v) return;
    const s = sups.find((x) => x.id === v.supplierId);
    const data = { ...v, supplierName: s ? s.name : 'Other', amount: num(v.amount), paid: num(v.paid), pieces: num(v.pieces) };
    if (p) await api.update('purchases', p.id, data); else await api.add('purchases', data);
    toast('Saved'); rows = await api.list('purchases'); draw();
  };
  draw();
}
