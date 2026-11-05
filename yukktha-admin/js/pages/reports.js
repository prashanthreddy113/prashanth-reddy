import { esc, inr, num, $, ts, today, orderTotal, counts, PAY_LABEL, barChart, hbars, downloadCsv, empty } from '../ui.js';

const RANGES = [['month', 'This month'], ['last', 'Last month'], ['90', 'Last 90 days'], ['year', 'This year'], ['custom', 'Custom']];

function range(k, from, to) {
  const n = new Date(); const y = n.getFullYear(); const m = n.getMonth();
  if (k === 'month') return [new Date(y, m, 1), new Date(y, m + 1, 1)];
  if (k === 'last') return [new Date(y, m - 1, 1), new Date(y, m, 1)];
  if (k === '90') return [new Date(Date.now() - 90 * 86400000), new Date(Date.now() + 86400000)];
  if (k === 'year') return [new Date(y, 0, 1), new Date(y + 1, 0, 1)];
  return [new Date(from || today()), new Date(ts(to || today()) + 86400000)];
}

export default {
  id: 'reports', title: 'Reports', group: 'Money', icon: 'chart', ownerOnly: true,
  async render(view, ctx) {
    const { api } = ctx;
    const [orders, sarees, expenses, purchases] = await Promise.all([api.list('orders').catch(() => []), api.list('sarees'), api.list('expenses').catch(() => []), api.list('purchases').catch(() => [])]);
    if (ctx.stale()) return;
    const st = { k: 'month', from: '', to: '' };
    const cost = {}; sarees.forEach((s) => { cost[s.id] = s.costPrice == null ? null : num(s.costPrice); });
    const draw = () => {
      const [a, b] = range(st.k, st.from, st.to); const A = a.getTime(); const B = b.getTime();
      const os = orders.filter((o) => counts(o) && ts(o.createdAt) >= A && ts(o.createdAt) < B);
      const ex = expenses.filter((e) => ts(e.date || e.createdAt) >= A && ts(e.date || e.createdAt) < B);
      const sales = os.reduce((s, o) => s + orderTotal(o), 0);
      const disc = os.reduce((s, o) => s + num(o.couponDiscount) + num(o.firstOrderDiscount), 0);
      const items = os.reduce((s, o) => s + (o.items || []).reduce((x, i) => x + num(i.qty, 1), 0), 0);
      let cogs = 0, cogsKnown = 0, lineTotal = 0;
      os.forEach((o) => (o.items || []).forEach((i) => { const c = cost[i.itemId]; const v = num(i.price) * num(i.qty, 1); lineTotal += v; if (c != null) { cogs += c * num(i.qty, 1); cogsKnown += v; } }));
      const expTotal = ex.filter((e) => e.category !== 'Stock purchase').reduce((s, e) => s + num(e.amount), 0);
      const cancelled = orders.filter((o) => ['cancelled', 'returned'].includes(o.status) && ts(o.createdAt) >= A && ts(o.createdAt) < B);
      const gstRate = (ctx.project.gst || {}).enabled ? num(ctx.project.gst.rate) : 0;
      const taxable = gstRate ? sales / (1 + gstRate / 100) : sales;

      // trend: days if range ≤ 62 days, else months
      const span = (B - A) / 86400000; const trend = [];
      if (span <= 62) { for (let t = A; t < Math.min(B, Date.now() + 86400000); t += 86400000) { const d = new Date(t); trend.push({ label: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }), short: String(d.getDate()), value: os.filter((o) => ts(o.createdAt) >= t && ts(o.createdAt) < t + 86400000).reduce((s, o) => s + orderTotal(o), 0) }); } }
      else { const d = new Date(a.getFullYear(), a.getMonth(), 1); while (d.getTime() < B && d.getTime() <= Date.now()) { const t0 = d.getTime(); const d2 = new Date(d.getFullYear(), d.getMonth() + 1, 1); trend.push({ label: d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }), value: os.filter((o) => ts(o.createdAt) >= t0 && ts(o.createdAt) < d2.getTime()).reduce((s, o) => s + orderTotal(o), 0) }); d.setMonth(d.getMonth() + 1); } }
      const group = (fn) => { const m = {}; os.forEach((o) => { const k = fn(o); m[k] = (m[k] || 0) + orderTotal(o); }); return Object.keys(m).map((k) => ({ label: k, value: m[k] })).sort((x, y) => y.value - x.value); };
      const byWeave = {}; const bySaree = {};
      os.forEach((o) => (o.items || []).forEach((i) => { const s = sarees.find((x) => x.id === i.itemId); const c = s ? s.category : 'Other'; const v = num(i.price) * num(i.qty, 1); byWeave[c] = (byWeave[c] || 0) + v; const k = i.name || 'Saree'; bySaree[k] = bySaree[k] || { n: 0, v: 0 }; bySaree[k].n += num(i.qty, 1); bySaree[k].v += v; }));
      const top = Object.keys(bySaree).map((k) => ({ k, ...bySaree[k] })).sort((x, y) => y.v - x.v).slice(0, 10);

      view.innerHTML = '<div class="bar"><select id="k">' + RANGES.map(([k, l]) => '<option value="' + k + '"' + (k === st.k ? ' selected' : '') + '>' + l + '</option>').join('') + '</select>' +
        (st.k === 'custom' ? '<input type="date" id="from" value="' + esc(st.from) + '"><input type="date" id="to" value="' + esc(st.to) + '">' : '') + '<span class="grow"></span><button class="btn" id="csv">Export sales CSV</button></div>' +
        '<div class="kpis"><div class="kpi accent"><span>Sales</span><strong>' + inr(sales) + '</strong><small>' + os.length + ' orders · ' + items + ' sarees</small></div>' +
        '<div class="kpi"><span>Average bill</span><strong>' + inr(os.length ? sales / os.length : 0) + '</strong></div>' +
        '<div class="kpi"><span>Discounts given</span><strong>' + inr(disc) + '</strong></div>' +
        '<div class="kpi"><span>Gross profit</span><strong>' + (cogsKnown ? inr(cogsKnown - cogs) : '—') + '</strong><small>' + (cogsKnown ? Math.round(cogsKnown / Math.max(1, lineTotal) * 100) + '% of sales have a cost price' : 'Add cost prices to sarees') + '</small></div>' +
        '<div class="kpi"><span>Expenses</span><strong>' + inr(expTotal) + '</strong><small>excl. stock purchases</small></div>' +
        '<div class="kpi"><span>Net (sales − expenses' + (cogsKnown ? ' − cost' : '') + ')</span><strong>' + inr(sales - expTotal - cogs) + '</strong></div>' +
        '<div class="kpi"><span>Cancelled / returned</span><strong>' + cancelled.length + '</strong><small>' + inr(cancelled.reduce((s, o) => s + orderTotal(o), 0)) + '</small></div>' +
        '<div class="kpi"><span>GST in sales' + (gstRate ? ' @' + gstRate + '%' : '') + '</span><strong>' + (gstRate ? inr(sales - taxable) : '—') + '</strong><small>' + (gstRate ? 'Taxable ' + inr(taxable) : 'GST off in Payments') + '</small></div></div>' +
        '<div class="card"><h3>Sales trend</h3>' + (trend.length ? barChart(trend) : empty('No data')) + '</div>' +
        '<div class="grid2" style="margin-top:18px"><div class="card"><h3>By weave</h3>' + (Object.keys(byWeave).length ? hbars(Object.keys(byWeave).map((k) => ({ label: k, value: byWeave[k] })).sort((x, y) => y.value - x.value)) : empty('No sales')) + '</div>' +
        '<div class="card"><h3>By payment method</h3>' + (os.length ? hbars(group((o) => PAY_LABEL[o.paymentMethod] || o.paymentMethod || 'Other')) : empty('No sales')) + '</div>' +
        '<div class="card"><h3>Online vs in store</h3>' + (os.length ? hbars(group((o) => o.source === 'store' ? 'In store' : 'Online')) : empty('No sales')) + '</div>' +
        '<div class="card"><h3>By salesperson</h3>' + (os.some((o) => o.salesperson) ? hbars(group((o) => o.salesperson || (o.source === 'store' ? 'Not set' : 'Online'))) : empty('Choose a salesperson at billing to see this.')) + '</div></div>' +
        '<div class="card" style="margin-top:18px"><h3>Top sarees</h3>' + (top.length ? '<div class="table-wrap"><table class="t"><thead><tr><th>Saree</th><th class="r">Sold</th><th class="r">Sales</th></tr></thead><tbody>' + top.map((t) => '<tr><td>' + esc(t.k) + '</td><td class="r">' + t.n + '</td><td class="r">' + inr(t.v) + '</td></tr>').join('') + '</tbody></table></div>' : empty('No sales')) + '</div>' +
        '<div class="card"><h3>Supplier purchases in this period</h3><p>' + inr(purchases.filter((p) => ts(p.date) >= A && ts(p.date) < B).reduce((s, p) => s + num(p.amount), 0)) + ' bought · ' + inr(purchases.reduce((s, p) => s + num(p.amount) - num(p.paid), 0)) + ' still owed to suppliers overall</p></div>';
      $('#k').onchange = (e) => { st.k = e.target.value; draw(); };
      if ($('#from')) { $('#from').onchange = (e) => { st.from = e.target.value; draw(); }; $('#to').onchange = (e) => { st.to = e.target.value; draw(); }; }
      $('#csv').onclick = () => downloadCsv('yukktha-sales.csv', os.map((o) => ({ date: o.createdAt, invoice: o.invoiceNo || o.id, source: o.source || 'online', customer: o.customerName || '', items: (o.items || []).map((i) => i.name + ' x' + num(i.qty, 1)).join('; '), discount: num(o.couponDiscount) + num(o.firstOrderDiscount), total: orderTotal(o), gst: gstRate ? Math.round(orderTotal(o) - orderTotal(o) / (1 + gstRate / 100)) : 0, payment: o.paymentMethod || '', salesperson: o.salesperson || '' })));
    };
    draw();
  }
};
