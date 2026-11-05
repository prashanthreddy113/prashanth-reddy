import { esc, inr, num, $, toast, modal, confirmBox, field, input, select, fmtDate, ts, today, hbars, downloadCsv, empty } from '../ui.js';

export const EXPENSE_CATS = ['Rent', 'Salaries', 'Electricity', 'Stock purchase', 'Marketing', 'Packaging', 'Tailoring / fall & pico', 'Transport', 'Maintenance', 'Exhibition', 'Taxes & fees', 'Other'];

export default {
  id: 'expenses', title: 'Expenses', group: 'Money', icon: 'wallet', ownerOnly: true,
  async render(view, ctx) {
    const { api } = ctx;
    let rows = await api.list('expenses');
    if (ctx.stale()) return;
    let month = today().slice(0, 7); let cat = '';
    const draw = () => {
      const r = rows.filter((e) => String(e.date || '').slice(0, 7) === month && (!cat || e.category === cat)).sort((a, b) => ts(b.date) - ts(a.date));
      const by = {}; r.forEach((e) => { by[e.category] = (by[e.category] || 0) + num(e.amount); });
      const total = r.reduce((a, e) => a + num(e.amount), 0);
      view.innerHTML = '<div class="bar"><input type="month" id="m" value="' + month + '"><select id="c"><option value="">All categories</option>' + EXPENSE_CATS.map((c) => '<option' + (c === cat ? ' selected' : '') + '>' + c + '</option>').join('') + '</select><span class="grow"></span><button class="btn" id="copy">Copy fixed costs from last month</button><button class="btn" id="exp">Export</button><button class="btn primary" id="add">+ Add expense</button></div>' +
        '<div class="split"><div class="table-wrap"><table class="t"><thead><tr><th>Date</th><th>Category</th><th>Details</th><th>Paid via</th><th class="r">Amount</th><th></th></tr></thead><tbody>' +
        (r.length ? r.map((e) => '<tr data-id="' + esc(e.id) + '"><td>' + fmtDate(e.date) + '</td><td><span class="pill plum">' + esc(e.category) + '</span></td><td>' + esc(e.note || '') + '</td><td>' + esc(e.paidVia || '') + '</td><td class="r"><strong>' + inr(e.amount) + '</strong></td><td class="acts"><button class="icon-btn" data-edit>✎</button><button class="icon-btn" data-del>🗑</button></td></tr>').join('') : '<tr><td colspan="6">' + empty('No expenses this month.') + '</td></tr>') + '</tbody></table></div>' +
        '<div><div class="kpi accent" style="margin-bottom:18px"><span>Total · ' + esc(month) + '</span><strong>' + inr(total) + '</strong></div><div class="card"><h3>By category</h3>' + (Object.keys(by).length ? hbars(Object.keys(by).map((k) => ({ label: k, value: by[k] })).sort((a, b) => b.value - a.value)) : '<p class="muted">—</p>') + '</div></div></div>';
      $('#m').onchange = (e) => { month = e.target.value || month; draw(); };
      $('#c').onchange = (e) => { cat = e.target.value; draw(); };
      $('#add').onclick = () => edit(null);
      $('#exp').onclick = () => downloadCsv('yukktha-expenses-' + month + '.csv', r.map((e) => ({ date: e.date, category: e.category, details: e.note || '', paid_via: e.paidVia || '', amount: num(e.amount) })));
      $('#copy').onclick = async () => {
        const [y, m] = month.split('-').map(Number); const prev = new Date(y, m - 2, 1).toISOString().slice(0, 7);
        const fixed = rows.filter((e) => String(e.date).slice(0, 7) === prev && ['Rent', 'Electricity', 'Maintenance', 'Marketing'].includes(e.category));
        if (!fixed.length) { toast('No rent / bills found in ' + prev); return; }
        if (!await confirmBox('Add ' + fixed.length + ' expenses from ' + prev + ' (rent, bills) to ' + month + '?', 'Add')) return;
        for (const e of fixed) await api.add('expenses', { category: e.category, note: e.note, amount: num(e.amount), paidVia: e.paidVia, date: month + String(e.date).slice(7) });
        toast('Added'); rows = await api.list('expenses'); draw();
      };
      view.querySelector('tbody').onclick = async (ev) => {
        const tr = ev.target.closest('tr[data-id]'); if (!tr) return; const e = rows.find((x) => x.id === tr.dataset.id);
        if (ev.target.closest('[data-edit]')) edit(e);
        if (ev.target.closest('[data-del]') && await confirmBox('Delete this expense?')) { await api.remove('expenses', e.id); rows = await api.list('expenses'); draw(); }
      };
    };
    const edit = async (e) => {
      const v = await modal({ title: e ? 'Edit expense' : 'Add expense', submit: 'Save', body: '<div class="form-grid">' + field('Category', select('category', EXPENSE_CATS, e && e.category)) + field('Amount (₹)', input('amount', e ? e.amount : '', 'type="number" min="1" required')) + field('Date', input('date', e ? e.date : today(), 'type="date" required')) + field('Paid via', select('paidVia', [['cash', 'Cash'], ['upi', 'UPI'], ['bank', 'Bank transfer'], ['card', 'Card']], e && e.paidVia)) + '<div class="full">' + field('Details', input('note', e && e.note, 'placeholder="e.g. Shop rent — Jubilee Hills"')) + '</div></div>' });
      if (!v) return; if (!v.amount) { toast('Enter an amount', 'err'); return; }
      if (e) await api.update('expenses', e.id, v); else await api.add('expenses', v);
      toast('Saved'); rows = await api.list('expenses'); draw();
    };
    draw();
  }
};
