import { esc, inr, num, $, $$, toast, modal, confirmBox, field, input, select, fmtDate, ts, today, orderTotal, counts, empty } from '../ui.js';

const MARKS = [['present', 'P', 'Present'], ['half', '½', 'Half day'], ['absent', 'A', 'Absent'], ['leave', 'L', 'Paid leave']];
const monthKey = (d) => String(d).slice(0, 7);
const daysIn = (m) => { const [y, mo] = m.split('-').map(Number); return new Date(y, mo, 0).getDate(); };

export default {
  id: 'employees', title: 'Employees', group: 'Team', icon: 'staff',
  async render(view, ctx) {
    const owner = ctx.session.isOwner;
    const tabs = [['staff', 'Staff'], ['attendance', 'Attendance']].concat(owner ? [['payroll', 'Salary & commission'], ['advances', 'Advances']] : []);
    const tab = tabs.some((t) => t[0] === ctx.param) ? ctx.param : 'staff';
    view.innerHTML = '<div class="tabs">' + tabs.map(([k, l]) => '<button data-t="' + k + '" class="' + (k === tab ? 'on' : '') + '">' + l + '</button>').join('') + '</div><div id="pane"></div>';
    $$('[data-t]', view).forEach((b) => b.addEventListener('click', () => ctx.go('#/employees/' + b.dataset.t)));
    try { await ({ staff, attendance, payroll, advances })[tab]($('#pane'), ctx); } catch (e) { $('#pane').innerHTML = '<div class="alert warn"><strong>Not available</strong><p>' + esc(e.message) + '</p></div>'; }
  }
};

async function staff(pane, ctx) {
  const { api } = ctx; const owner = ctx.session.isOwner;
  let rows = await api.list('employees');
  const stores = (ctx.project.stores || []).map((s) => s.label);
  const draw = () => {
    rows.sort((a, b) => (a.status === 'inactive') - (b.status === 'inactive') || String(a.name).localeCompare(b.name));
    pane.innerHTML = '<div class="bar"><p class="muted grow" style="margin:0">Your shop team. Employees don’t need a login — to give someone admin access, use Team access.</p>' + (owner ? '<button class="btn primary" id="add">+ Add employee</button>' : '') + '</div>' +
      '<div class="table-wrap"><table class="t"><thead><tr><th>Name</th><th>Role</th><th>Store</th><th>Phone</th><th>Joined</th>' + (owner ? '<th class="r">Salary / month</th><th class="r">Commission</th>' : '') + '<th>Status</th><th></th></tr></thead><tbody>' +
      (rows.length ? rows.map((e) => '<tr data-id="' + esc(e.id) + '"><td class="cell-main">' + esc(e.name) + '</td><td>' + esc(e.designation || '') + '</td><td>' + esc(e.store || '') + '</td><td>' + (e.phone ? '<a href="tel:' + esc(e.phone) + '">' + esc(e.phone) + '</a>' : '') + '</td><td>' + fmtDate(e.joinedOn) + '</td>' +
        (owner ? '<td class="r">' + inr(e.salary) + '</td><td class="r">' + (num(e.commissionPercent) ? num(e.commissionPercent) + '%' : '—') + '</td>' : '') +
        '<td><span class="pill ' + (e.status === 'inactive' ? '' : 'ok') + '">' + (e.status === 'inactive' ? 'Left' : 'Active') + '</span></td><td class="acts">' + (owner ? '<button class="icon-btn" data-edit>✎</button><button class="icon-btn" data-del>🗑</button>' : '') + '</td></tr>').join('') : '<tr><td colspan="9">' + empty('Add your sales associates, tailors and helpers.') + '</td></tr>') + '</tbody></table></div>';
    const add = $('#add'); if (add) add.onclick = () => edit(null);
    pane.querySelector('tbody').onclick = async (ev) => {
      const tr = ev.target.closest('tr[data-id]'); if (!tr) return; const e = rows.find((x) => x.id === tr.dataset.id);
      if (ev.target.closest('[data-edit]')) edit(e);
      if (ev.target.closest('[data-del]') && await confirmBox('Remove ' + e.name + '? Consider marking them as “Left” instead to keep their history.')) { await api.remove('employees', e.id); rows = await api.list('employees'); draw(); }
    };
  };
  const edit = async (e) => {
    const v = await modal({ title: e ? 'Edit employee' : 'Add employee', submit: 'Save', wide: true, body: '<div class="form-grid">' +
      field('Full name', input('name', e && e.name, 'required')) + field('Role / designation', input('designation', e && e.designation, 'placeholder="Sales associate, tailor, manager…"')) +
      field('Phone', input('phone', e && e.phone, 'inputmode="tel"')) + field('Store', select('store', stores.length ? stores : ['Main store'], e && e.store)) +
      field('Joined on', input('joinedOn', e ? e.joinedOn : today(), 'type="date"')) + field('Status', select('status', [['active', 'Active'], ['inactive', 'Left']], e && e.status)) +
      field('Monthly salary (₹)', input('salary', e ? e.salary : '', 'type="number" min="0"')) + field('Sales commission %', input('commissionPercent', e ? num(e.commissionPercent) : 0, 'type="number" min="0" max="20" step="0.5"'), 'Paid on their in-store sales.') +
      field('ID proof (Aadhaar / PAN no.)', input('idProof', e && e.idProof)) + field('Emergency contact', input('emergency', e && e.emergency)) +
      '<div class="full">' + field('Bank / UPI for salary', input('payTo', e && e.payTo)) + '</div><div class="full">' + field('Address', input('address', e && e.address)) + '</div></div>' });
    if (!v) return; if (!v.name) { toast('Name is required', 'err'); return; }
    const data = { ...v, salary: num(v.salary), commissionPercent: num(v.commissionPercent) };
    if (e) await api.update('employees', e.id, data); else await api.add('employees', data);
    toast('Saved'); rows = await api.list('employees'); draw();
  };
  draw();
}

async function attendance(pane, ctx) {
  const { api } = ctx;
  const emps = (await api.list('employees')).filter((e) => e.status !== 'inactive').sort((a, b) => String(a.name).localeCompare(b.name));
  let att = await api.list('attendance');
  let date = today();
  const draw = () => {
    const doc = att.find((a) => a.id === date) || { marks: {} };
    const m = monthKey(date);
    const monthDocs = att.filter((a) => monthKey(a.id) === m);
    pane.innerHTML = '<div class="bar"><label class="field" style="flex-direction:row;align-items:center;gap:10px"><span>Date</span><input type="date" id="d" value="' + date + '" max="' + today() + '" style="width:170px"></label><span class="grow"></span><button class="btn" id="allP">Mark everyone present</button></div>' +
      (emps.length ? '<div class="table-wrap"><table class="t"><thead><tr><th>Employee</th><th>' + fmtDate(date) + '</th><th class="r">This month: present</th><th class="r">Half</th><th class="r">Absent</th><th class="r">Leave</th></tr></thead><tbody>' +
        emps.map((e) => { const c = { present: 0, half: 0, absent: 0, leave: 0 }; monthDocs.forEach((a) => { const v = (a.marks || {})[e.id]; if (v) c[v]++; });
          const cur = doc.marks[e.id] || '';
          return '<tr data-id="' + esc(e.id) + '"><td><div class="cell-main">' + esc(e.name) + '</div><div class="cell-sub">' + esc(e.designation || '') + '</div></td><td><div class="att">' + MARKS.map(([k, s, l]) => '<button class="' + k + (cur === k ? ' on' : '') + '" data-m="' + k + '" title="' + l + '">' + s + '</button>').join('') + '</div></td><td class="r">' + c.present + '</td><td class="r">' + c.half + '</td><td class="r">' + c.absent + '</td><td class="r">' + c.leave + '</td></tr>'; }).join('') + '</tbody></table></div>'
        : empty('Add employees first.', '<a class="btn" href="#/employees/staff">Add employees</a>')) +
      '<p class="tiny muted">P present · ½ half day · A absent · L paid leave. Saved instantly.</p>';
    $('#d').onchange = (e) => { date = e.target.value || today(); draw(); };
    const save = async (marks) => { await api.set('attendance', date, { date, marks }); att = await api.list('attendance'); draw(); };
    $('#allP').onclick = () => { const marks = { ...doc.marks }; emps.forEach((e) => { marks[e.id] = marks[e.id] || 'present'; }); save(marks).then(() => toast('Marked present')); };
    const tb = pane.querySelector('tbody');
    if (tb) tb.onclick = (ev) => { const b = ev.target.closest('[data-m]'); if (!b) return; const id = b.closest('tr').dataset.id; const marks = { ...doc.marks }; marks[id] = marks[id] === b.dataset.m ? undefined : b.dataset.m; if (!marks[id]) delete marks[id]; save(marks); };
  };
  draw();
}

async function payroll(pane, ctx) {
  const { api } = ctx;
  const [emps, att, orders, pays] = await Promise.all([api.list('employees'), api.list('attendance').catch(() => []), api.list('orders').catch(() => []), api.list('payroll').catch(() => [])]);
  let month = today().slice(0, 7);
  const draw = () => {
    const nd = daysIn(month); const md = att.filter((a) => monthKey(a.id) === month);
    const rows = emps.filter((e) => e.status !== 'inactive' || pays.some((p) => p.employeeId === e.id && p.month === month)).map((e) => {
      let worked = 0, absent = 0, marked = 0;
      md.forEach((a) => { const v = (a.marks || {})[e.id]; if (!v) return; marked++; if (v === 'present' || v === 'leave') worked++; else if (v === 'half') { worked += 0.5; absent += 0.5; } else absent++; });
      const base = num(e.salary); const cut = Math.round(base / nd * absent);
      const sales = orders.filter((o) => o.salespersonId === e.id && monthKey(o.createdAt) === month && counts(o)).reduce((a, o) => a + orderTotal(o), 0);
      const comm = Math.round(sales * num(e.commissionPercent) / 100);
      const adv = pays.filter((p) => p.employeeId === e.id && p.type === 'advance' && p.deductMonth === month).reduce((a, p) => a + num(p.amount), 0);
      const paid = pays.find((p) => p.employeeId === e.id && p.type === 'salary' && p.month === month);
      return { e, worked, absent, marked, base, cut, sales, comm, adv, net: Math.max(0, base - cut + comm - adv), paid };
    });
    pane.innerHTML = '<div class="bar"><label class="field" style="flex-direction:row;align-items:center;gap:10px"><span>Month</span><input type="month" id="m" value="' + month + '" style="width:170px"></label><span class="grow"></span><span class="muted">Absences are deducted per day (salary ÷ ' + nd + '). Unmarked days count as present.</span></div>' +
      '<div class="table-wrap"><table class="t"><thead><tr><th>Employee</th><th class="r">Days marked</th><th class="r">Absent</th><th class="r">Salary</th><th class="r">Deduction</th><th class="r">Their sales</th><th class="r">Commission</th><th class="r">Advance</th><th class="r">Net pay</th><th></th></tr></thead><tbody>' +
      (rows.length ? rows.map((r) => '<tr data-id="' + esc(r.e.id) + '"><td class="cell-main">' + esc(r.e.name) + '</td><td class="r">' + r.marked + '</td><td class="r">' + r.absent + '</td><td class="r">' + inr(r.base) + '</td><td class="r">' + (r.cut ? '− ' + inr(r.cut) : '—') + '</td><td class="r">' + inr(r.sales) + '</td><td class="r">' + (r.comm ? '+ ' + inr(r.comm) : '—') + '</td><td class="r">' + (r.adv ? '− ' + inr(r.adv) : '—') + '</td><td class="r"><strong>' + inr(r.paid ? r.paid.amount : r.net) + '</strong></td><td class="acts">' + (r.paid ? '<span class="pill ok">Paid ' + fmtDate(r.paid.paidOn) + '</span>' : '<button class="btn sm primary" data-pay>Mark paid</button>') + '</td></tr>').join('') : '<tr><td colspan="10">' + empty('No active employees.') + '</td></tr>') +
      '</tbody></table></div><p class="muted tiny">Total payable: <strong>' + inr(rows.reduce((a, r) => a + (r.paid ? 0 : r.net), 0)) + '</strong> · already paid ' + inr(rows.reduce((a, r) => a + (r.paid ? num(r.paid.amount) : 0), 0)) + '</p>';
    $('#m').onchange = (e) => { month = e.target.value || month; draw(); };
    pane.querySelector('tbody').onclick = async (ev) => {
      if (!ev.target.closest('[data-pay]')) return;
      const r = rows.find((x) => x.e.id === ev.target.closest('tr').dataset.id);
      const v = await modal({ title: 'Pay ' + r.e.name + ' · ' + month, submit: 'Save', body: '<div class="form-grid">' + field('Amount (₹)', input('amount', r.net, 'type="number" min="0" required')) + field('Paid on', input('paidOn', today(), 'type="date"')) + field('Paid via', select('via', [['bank', 'Bank transfer'], ['upi', 'UPI'], ['cash', 'Cash']])) + field('Note', input('note', r.e.payTo || '')) + '</div><label class="check" style="margin-top:12px"><input type="checkbox" name="exp" checked> Record in expenses (Salaries)</label>' });
      if (!v) return;
      await api.add('payroll', { type: 'salary', employeeId: r.e.id, employeeName: r.e.name, month, amount: num(v.amount), base: r.base, deduction: r.cut, commission: r.comm, advance: r.adv, paidOn: v.paidOn, via: v.via, note: v.note });
      if (v.exp) await api.add('expenses', { category: 'Salaries', note: 'Salary ' + month + ' · ' + r.e.name, amount: num(v.amount), paidVia: v.via, date: v.paidOn }).catch(() => {});
      toast('Salary recorded'); pays.splice(0, pays.length, ...(await api.list('payroll'))); draw();
    };
  };
  draw();
}

async function advances(pane, ctx) {
  const { api } = ctx;
  const emps = await api.list('employees'); let pays = await api.list('payroll');
  const draw = () => {
    const adv = pays.filter((p) => p.type === 'advance').sort((a, b) => ts(b.date) - ts(a.date));
    pane.innerHTML = '<div class="bar"><p class="muted grow" style="margin:0">Salary advances are deducted in the month you choose.</p><button class="btn primary" id="add">+ Give advance</button></div><div class="table-wrap"><table class="t"><thead><tr><th>Date</th><th>Employee</th><th class="r">Amount</th><th>Deduct in</th><th>Note</th><th></th></tr></thead><tbody>' +
      (adv.length ? adv.map((p) => '<tr data-id="' + esc(p.id) + '"><td>' + fmtDate(p.date) + '</td><td>' + esc(p.employeeName) + '</td><td class="r">' + inr(p.amount) + '</td><td>' + esc(p.deductMonth) + '</td><td>' + esc(p.note || '') + '</td><td class="acts"><button class="icon-btn" data-del>🗑</button></td></tr>').join('') : '<tr><td colspan="6">' + empty('No advances.') + '</td></tr>') + '</tbody></table></div>';
    $('#add').onclick = async () => {
      const v = await modal({ title: 'Give advance', submit: 'Save', body: '<div class="form-grid">' + field('Employee', select('employeeId', emps.filter((e) => e.status !== 'inactive').map((e) => [e.id, e.name]))) + field('Amount (₹)', input('amount', '', 'type="number" min="1" required')) + field('Date', input('date', today(), 'type="date"')) + field('Deduct from salary of', input('deductMonth', today().slice(0, 7), 'type="month"')) + '<div class="full">' + field('Note', input('note', '')) + '</div></div>' });
      if (!v || !v.amount) return; const e = emps.find((x) => x.id === v.employeeId);
      await api.add('payroll', { type: 'advance', employeeId: v.employeeId, employeeName: e ? e.name : '', amount: num(v.amount), date: v.date, deductMonth: v.deductMonth, note: v.note });
      toast('Advance recorded'); pays = await api.list('payroll'); draw();
    };
    pane.querySelector('tbody').onclick = async (ev) => { const tr = ev.target.closest('tr[data-id]'); if (tr && ev.target.closest('[data-del]') && await confirmBox('Delete this advance?')) { await api.remove('payroll', tr.dataset.id); pays = await api.list('payroll'); draw(); } };
  };
  draw();
}
