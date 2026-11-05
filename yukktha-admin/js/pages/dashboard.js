import { esc, inr, ts, orderTotal, counts, statusPill, fmtDate, barChart, hbars, imageUrl, stockOf, empty } from '../ui.js';
import { CONFIG } from '../config.js';

export default {
  id: 'dashboard', title: 'Dashboard', group: 'Overview', icon: 'home',
  async render(view, ctx) {
    const { api, session } = ctx;
    const [orders, sarees, customers, expenses] = await Promise.all([
      api.list('orders').catch(() => []),
      api.list('sarees'),
      api.list('customers').catch(() => []),
      session.isOwner ? api.list('expenses').catch(() => []) : Promise.resolve([])
    ]);
    if (ctx.stale()) return;
    const now = new Date(); const startDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const good = orders.filter(counts);
    const sum = (list) => list.reduce((a, o) => a + orderTotal(o), 0);
    const todays = good.filter((o) => ts(o.createdAt) >= startDay);
    const month = good.filter((o) => ts(o.createdAt) >= startMonth);
    const monthExp = expenses.filter((e) => ts(e.date || e.createdAt) >= startMonth).reduce((a, e) => a + (Number(e.amount) || 0), 0);
    const open = orders.filter((o) => ['pending_payment', 'paid', 'confirmed', 'preparing', 'ready'].includes(o.status));
    const low = sarees.filter((s) => stockOf(s) !== Infinity && stockOf(s) <= CONFIG.lowStockAt).sort((a, b) => stockOf(a) - stockOf(b));

    // last 30 days
    const days = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(startDay - i * 86400000); const t0 = d.getTime(); const t1 = t0 + 86400000;
      days.push({ label: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }), short: String(d.getDate()), value: sum(good.filter((o) => ts(o.createdAt) >= t0 && ts(o.createdAt) < t1)) });
    }
    const byCat = {};
    good.forEach((o) => (o.items || []).forEach((it) => {
      const s = sarees.find((x) => x.id === it.itemId); const c = s ? s.category : 'Other';
      byCat[c] = (byCat[c] || 0) + (Number(it.price) || 0) * (Number(it.qty) || 1);
    }));
    const catRows = Object.keys(byCat).map((k) => ({ label: k, value: byCat[k] })).sort((a, b) => b.value - a.value).slice(0, 7);

    view.innerHTML = '<div class="kpis">' +
      '<div class="kpi accent"><span>Today’s sales</span><strong>' + inr(sum(todays)) + '</strong><small>' + todays.length + ' order' + (todays.length === 1 ? '' : 's') + '</small></div>' +
      '<div class="kpi"><span>This month</span><strong>' + inr(sum(month)) + '</strong><small>' + month.length + ' orders</small></div>' +
      (session.isOwner ? '<div class="kpi"><span>Month expenses</span><strong>' + inr(monthExp) + '</strong><small>Profit ' + inr(sum(month) - monthExp) + ' before cost of goods</small></div>' : '') +
      '<div class="kpi"><span>Open orders</span><strong>' + open.length + '</strong><small>to confirm, pack or deliver</small></div>' +
      '<div class="kpi"><span>Catalogue</span><strong>' + sarees.length + '</strong><small>' + low.length + ' low / out of stock</small></div>' +
      '<div class="kpi"><span>Customers</span><strong>' + customers.length + '</strong><small>in your list</small></div>' +
      '</div>' +
      '<div class="split"><div>' +
      '<div class="card"><h3>Sales · last 30 days</h3>' + barChart(days) + '</div>' +
      '<div class="card"><h3>Recent orders <a class="btn sm" href="#/orders">All orders</a></h3>' + (orders.length ? '<div class="list">' +
        orders.slice().sort((a, b) => ts(b.createdAt) - ts(a.createdAt)).slice(0, 7).map((o) => '<div class="list-row"><div class="grow"><div class="cell-main">' + esc(o.customerName || 'Walk-in customer') + '</div><div class="cell-sub">' + fmtDate(o.createdAt, true) + ' · ' + (o.items || []).length + ' item(s) · ' + (o.source === 'store' ? 'In store' : 'Online') + '</div></div>' + statusPill(o.status) + '<strong class="nowrap">' + inr(orderTotal(o)) + '</strong></div>').join('') + '</div>' : empty('No orders yet.')) + '</div>' +
      '</div><div>' +
      '<div class="card"><h3>Quick actions</h3><div class="grid2"><a class="btn primary" href="#/billing">New bill</a><a class="btn" href="#/sarees/new">Add saree</a><a class="btn" href="#/customers">Customers</a><a class="btn" href="#/discounts">Offers</a></div></div>' +
      '<div class="card"><h3>Sales by weave</h3>' + (catRows.length ? hbars(catRows) : empty('No sales yet.')) + '</div>' +
      '<div class="card"><h3>Low stock <a class="btn sm" href="#/inventory">Stock</a></h3>' + (low.length ? '<div class="list">' + low.slice(0, 8).map((s) => '<div class="list-row"><img class="thumb" src="' + esc(imageUrl(s.imageUrl)) + '" alt=""><div class="grow"><div class="cell-main">' + esc(s.name) + '</div><div class="cell-sub">' + esc(s.category || '') + '</div></div><span class="pill ' + (stockOf(s) ? 'warn' : 'err') + '">' + (stockOf(s) ? stockOf(s) + ' left' : 'Out') + '</span></div>').join('') + '</div>' : empty('All counted sarees are well stocked. Sarees without a piece count aren’t tracked.')) + '</div>' +
      '</div></div>';
  }
};
