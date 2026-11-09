import { esc, inr, num, $, toast, modal, fmtDate, ts, orderTotal, statusPill, STATUS_LABEL, PAY_LABEL, printInvoice, downloadCsv, imageUrl, empty } from '../ui.js';
import { CONFIG } from '../config.js';
import { changeOrderStatus } from '../ops.js';

const PAGE = 25;

export default {
  id: 'orders', title: 'Orders', group: 'Sell', icon: 'box',
  async render(view, ctx) {
    const { api, session, project } = ctx;
    let rows = await api.list('orders');
    if (ctx.stale()) return;
    const st = { q: '', status: '', source: '', from: '', to: '', page: 0 };
    const statusOptions = (o) => CONFIG.orderStatuses.map((s) => '<option value="' + s + '"' + (s === (o.status || 'pending_payment') ? ' selected' : '') + (CONFIG.unwoundStatuses.includes(s) && !session.isOwner && s !== o.status ? ' disabled' : '') + '>' + STATUS_LABEL[s] + '</option>').join('');

    view.innerHTML = '<div class="bar"><input type="search" id="q" placeholder="Customer, phone, invoice, saree…">' +
      '<select id="status"><option value="">All statuses</option>' + CONFIG.orderStatuses.map((s) => '<option value="' + s + '">' + STATUS_LABEL[s] + '</option>').join('') + '</select>' +
      '<select id="source"><option value="">Online & store</option><option value="online">Online</option><option value="store">In store</option></select>' +
      '<input type="date" id="from" title="From"><input type="date" id="to" title="To"><span class="grow"></span><button class="btn" id="exp">Export CSV</button><a class="btn primary" href="#/billing">+ New bill</a></div>' +
      '<div class="kpis" id="k"></div>' +
      '<div class="table-wrap"><table class="t"><thead><tr><th>Date</th><th>Invoice</th><th>Customer</th><th>Items</th><th class="r">Total</th><th>Payment</th><th>Status</th><th></th></tr></thead><tbody id="tb"></tbody></table></div><div class="pager" id="pg"></div>';
    $$bind();

    function filtered() {
      const q = st.q.toLowerCase(); const f = st.from ? ts(st.from) : 0; const t = st.to ? ts(st.to) + 86400000 : Infinity;
      return rows.filter((o) => (!st.status || (o.status || 'pending_payment') === st.status) && (!st.source || (o.source === 'store' ? 'store' : 'online') === st.source) &&
        ts(o.createdAt) >= f && ts(o.createdAt) < t &&
        (!q || [o.customerName, o.customerPhone, o.customerEmail, o.invoiceNo, o.id, (o.items || []).map((i) => i.name).join(' ')].join(' ').toLowerCase().includes(q)))
        .sort((a, b) => ts(b.createdAt) - ts(a.createdAt));
    }
    function askLink(o) {
      const phone = String(o.customerPhone).replace(/\D/g, '').replace(/^(\d{10})$/, '91$1');
      const it = (o.items || []).find((i) => i.itemId);
      const link = CONFIG.storefrontUrl + 'product.html?id=' + encodeURIComponent(it.itemId) + '#write-review';
      return 'https://wa.me/' + phone + '?text=' + encodeURIComponent('Namaste ' + (o.customerName || '').split(' ')[0] + ', thank you for choosing Yukktha! We hope you love your ' + it.name + '. Could you take a minute to rate it? ' + link);
    }
    function draw() {
      const r = filtered(); const pages = Math.max(1, Math.ceil(r.length / PAGE)); st.page = Math.min(st.page, pages - 1);
      const counted = r.filter((o) => !CONFIG.unwoundStatuses.includes(o.status) && o.status !== 'pending_payment');
      $('#k').innerHTML = '<div class="kpi"><span>Orders</span><strong>' + r.length + '</strong></div><div class="kpi"><span>Sales value</span><strong>' + inr(counted.reduce((a, o) => a + orderTotal(o), 0)) + '</strong><small>excl. pending, cancelled, returned</small></div>' +
        '<div class="kpi"><span>To fulfil</span><strong>' + r.filter((o) => ['paid', 'confirmed', 'preparing', 'ready'].includes(o.status)).length + '</strong></div><div class="kpi"><span>Cancelled / returned</span><strong>' + r.filter((o) => CONFIG.unwoundStatuses.includes(o.status)).length + '</strong></div>';
      const slice = r.slice(st.page * PAGE, st.page * PAGE + PAGE);
      $('#tb').innerHTML = slice.length ? slice.map((o) => '<tr data-id="' + esc(o.id) + '"><td class="nowrap">' + fmtDate(o.createdAt, true) + '</td><td>' + esc(o.invoiceNo || o.id.slice(0, 8).toUpperCase()) + '<div class="cell-sub">' + (o.source === 'store' ? 'In store' + (o.salesperson ? ' · ' + esc(o.salesperson) : '') : 'Online') + '</div></td>' +
        '<td><div class="cell-main">' + esc(o.customerName || '—') + '</div><div class="cell-sub">' + esc(o.customerPhone || o.customerEmail || '') + '</div></td>' +
        '<td>' + (o.items || []).map((i) => esc(i.name) + (num(i.qty, 1) > 1 ? ' × ' + num(i.qty) : '')).join('<br>') + '</td>' +
        '<td class="r"><strong>' + inr(orderTotal(o)) + '</strong></td><td>' + esc(PAY_LABEL[o.paymentMethod] || o.paymentMethod || '—') + '</td>' +
        '<td><select class="status-sel" data-st>' + statusOptions(o) + '</select></td><td class="acts">' + (o.status === 'completed' && o.customerPhone && (o.items || []).some((i) => i.itemId) ? '<a class="btn sm" target="_blank" rel="noopener" title="Send the customer a WhatsApp link to review what they bought" href="' + esc(askLink(o)) + '">Ask for review</a> ' : '') + '<button class="btn sm" data-view>View</button></td></tr>').join('')
        : '<tr><td colspan="8">' + empty('No orders match.') + '</td></tr>';
      $('#pg').innerHTML = '<span>Page ' + (st.page + 1) + ' of ' + pages + '</span><span><button class="btn sm" id="prev"' + (st.page ? '' : ' disabled') + '>Previous</button> <button class="btn sm" id="next"' + (st.page < pages - 1 ? '' : ' disabled') + '>Next</button></span>';
      $('#prev').onclick = () => { st.page--; draw(); }; $('#next').onclick = () => { st.page++; draw(); };
    }
    function $$bind() {
      $('#q').addEventListener('input', (e) => { st.q = e.target.value; st.page = 0; draw(); });
      ['status', 'source', 'from', 'to'].forEach((k) => $('#' + k).addEventListener('change', (e) => { st[k] = e.target.value; st.page = 0; draw(); }));
      $('#exp').addEventListener('click', () => downloadCsv('yukktha-orders.csv', filtered().map((o) => ({ date: o.createdAt, invoice: o.invoiceNo || o.id, source: o.source || 'online', customer: o.customerName || '', phone: o.customerPhone || '', items: (o.items || []).map((i) => i.name + ' x' + num(i.qty, 1)).join('; '), subtotal: num(o.subtotal), discount: num(o.couponDiscount) + num(o.firstOrderDiscount), total: orderTotal(o), payment: o.paymentMethod || '', status: o.status || '', salesperson: o.salesperson || '' }))));
      $('#tb').addEventListener('change', async (e) => {
        if (!e.target.matches('[data-st]')) return;
        const o = rows.find((x) => x.id === e.target.closest('tr').dataset.id); const prev = o.status;
        e.target.disabled = true;
        try { await changeOrderStatus(api, o, e.target.value); toast('Status: ' + STATUS_LABEL[o.status]); }
        catch (err) { toast(err.message, 'err'); e.target.value = prev || 'pending_payment'; }
        finally { e.target.disabled = false; draw(); }
      });
      $('#tb').addEventListener('click', (e) => { if (e.target.closest('[data-view]')) detail(rows.find((x) => x.id === e.target.closest('tr').dataset.id)); });
    }
    async function detail(o) {
      const items = o.items || [];
      const phone = String(o.customerPhone || '').replace(/\D/g, '');
      const body = '<div class="grid2"><div><p class="muted tiny">CUSTOMER</p><p><strong>' + esc(o.customerName || '—') + '</strong><br>' + esc(o.customerPhone || '') + (o.customerEmail ? '<br>' + esc(o.customerEmail) : '') + (o.customerAddress ? '<br>' + esc(o.customerAddress) + ' ' + esc(o.customerPincode || '') : '') + '</p>' + (o.customerNote ? '<p class="muted">Note: ' + esc(o.customerNote) + '</p>' : '') + '</div>' +
        '<div><p class="muted tiny">ORDER</p><p>' + esc(o.invoiceNo || o.id) + '<br>' + fmtDate(o.createdAt, true) + '<br>' + statusPill(o.status) + ' · ' + esc(PAY_LABEL[o.paymentMethod] || o.paymentMethod || '—') + (o.razorpayPaymentId ? '<br><span class="tiny">Razorpay ' + esc(o.razorpayPaymentId) + '</span>' : '') + (num(o.codAmountDue) ? '<br>COD due ' + inr(o.codAmountDue) : '') + '</p></div></div>' +
        '<div class="list" style="margin-top:10px">' + items.map((i) => '<div class="list-row">' + (i.imageUrl ? '<img class="thumb" src="' + esc(imageUrl(i.imageUrl)) + '" alt="">' : '') + '<div class="grow">' + esc(i.name) + '<div class="cell-sub">' + num(i.qty, 1) + ' × ' + inr(i.price) + '</div></div><strong>' + inr(num(i.price) * num(i.qty, 1)) + '</strong></div>').join('') + '</div>' +
        '<div class="sum"><div><span>Subtotal</span><span>' + inr(num(o.subtotal, items.reduce((a, i) => a + num(i.price) * num(i.qty, 1), 0))) + '</span></div>' + (num(o.couponDiscount) ? '<div><span>Discount</span><span>− ' + inr(o.couponDiscount) + '</span></div>' : '') + (num(o.firstOrderDiscount) ? '<div><span>First-order discount</span><span>− ' + inr(o.firstOrderDiscount) + '</span></div>' : '') + '<div class="grand"><span>Total</span><span>' + inr(orderTotal(o)) + '</span></div></div>' +
        (o.returnRequest ? '<div class="alert warn"><strong>Return requested</strong><p>' + esc(typeof o.returnRequest === 'object' ? (o.returnRequest.reason || JSON.stringify(o.returnRequest)) : o.returnRequest) + '</p></div>' : '') +
        (CONFIG.unwoundStatuses.includes(o.status) ? '<label class="field"><span>Refund</span><select name="refundStatus"><option value="">—</option>' + ['pending', 'refunded', 'not_applicable'].map((r) => '<option value="' + r + '"' + (o.refundStatus === r ? ' selected' : '') + '>' + r.replace('_', ' ') + '</option>').join('') + '</select></label>' : '') +
        '<div class="checks" style="margin-top:12px"><button type="button" class="btn" id="pInv">Print invoice</button>' + (phone ? '<a class="btn" target="_blank" rel="noopener" href="https://wa.me/' + esc(phone) + '?text=' + encodeURIComponent('Hello ' + (o.customerName || '') + ', this is Yukktha about your order ' + (o.invoiceNo || '') + '.') + '">WhatsApp customer</a>' : '') + '</div>';
      const v = await modal({ title: 'Order ' + (o.invoiceNo || o.id.slice(0, 8).toUpperCase()), wide: true, body, submit: CONFIG.unwoundStatuses.includes(o.status) ? 'Save refund' : null, cancel: 'Close', onOpen(f) { $('#pInv', f).addEventListener('click', () => printInvoice(o, project)); } });
      if (v && v.refundStatus !== undefined) { await api.update('orders', o.id, { refundStatus: v.refundStatus }); o.refundStatus = v.refundStatus; toast('Saved'); }
    }
    draw();
  }
};
