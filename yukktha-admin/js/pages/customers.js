import { esc, inr, $, toast, modal, confirmBox, field, input, fmtDate, ts, orderTotal, counts, statusPill, downloadCsv, parseCsv, empty } from '../ui.js';
import { normalizeMobile } from '../ops.js';

const TAGS = ['VIP', 'Bridal', 'Regular', 'Wholesale', 'Online'];
const md = (d) => (d ? String(d).slice(5, 10) : '');

function upcoming(c, field) {
  if (!c[field]) return null;
  const now = new Date(); const [m, d] = md(c[field]).split('-').map(Number); if (!m) return null;
  let next = new Date(now.getFullYear(), m - 1, d); if (next < new Date(now.getFullYear(), now.getMonth(), now.getDate())) next = new Date(now.getFullYear() + 1, m - 1, d);
  return Math.round((next - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / 86400000);
}

export default {
  id: 'customers', title: 'Customers', group: 'Sell', icon: 'users',
  async render(view, ctx) {
    const { api } = ctx;
    let [rows, orders] = await Promise.all([api.list('customers'), api.list('orders').catch(() => [])]);
    if (ctx.stale()) return;
    const st = { q: '', tag: '', sort: 'recent' };
    const stats = () => {
      const m = {};
      orders.forEach((o) => { const k = normalizeMobile(o.customerPhone); if (!k) return; m[k] = m[k] || { n: 0, spend: 0, last: 0 }; if (counts(o)) { m[k].n++; m[k].spend += orderTotal(o); } m[k].last = Math.max(m[k].last, ts(o.createdAt)); });
      return m;
    };
    let S = stats();

    view.innerHTML = '<div class="bar"><input type="search" id="q" placeholder="Name, mobile, notes…"><select id="tag"><option value="">All customers</option>' + TAGS.map((t) => '<option>' + t + '</option>').join('') + '</select>' +
      '<select id="sort"><option value="recent">Recently added</option><option value="spend">Top spenders</option><option value="name">Name A–Z</option><option value="last">Last purchase</option></select><span class="grow"></span>' +
      '<label class="btn">Import CSV<input type="file" id="imp" accept=".csv,text/csv" hidden></label><button class="btn" id="exp">Export</button><button class="btn primary" id="add">+ Add customer</button></div>' +
      '<div class="split"><div class="table-wrap"><table class="t"><thead><tr><th>Customer</th><th>Mobile</th><th class="r">Orders</th><th class="r">Spent</th><th>Last purchase</th><th></th></tr></thead><tbody id="tb"></tbody></table></div>' +
      '<div><div class="card"><h3>Birthdays & anniversaries · next 30 days</h3><div id="events"></div></div><div class="card"><h3>Tips</h3><p class="muted">Add birthday and anniversary dates to send greetings and offers on WhatsApp. Import a CSV with columns <code>name, mobile, details, tags, birthday, anniversary</code>.</p></div></div></div>';

    const filtered = () => {
      const q = st.q.toLowerCase();
      const r = rows.filter((c) => (!q || [c.name, c.mobile, c.details, c.email].join(' ').toLowerCase().includes(q)) && (!st.tag || (c.tags || []).includes(st.tag)));
      const sp = (c) => (S[normalizeMobile(c.mobile)] || {}).spend || 0;
      return r.sort({ recent: (a, b) => ts(b.createdAt) - ts(a.createdAt), spend: (a, b) => sp(b) - sp(a), name: (a, b) => String(a.name).localeCompare(b.name), last: (a, b) => ((S[normalizeMobile(b.mobile)] || {}).last || 0) - ((S[normalizeMobile(a.mobile)] || {}).last || 0) }[st.sort]);
    };
    const draw = () => {
      const r = filtered();
      $('#tb').innerHTML = r.length ? r.map((c) => { const s = S[normalizeMobile(c.mobile)] || {}; return '<tr data-id="' + esc(c.id) + '"><td><div class="cell-main">' + esc(c.name || '—') + ' ' + (c.hasAccount ? '<span class="pill info" title="Has a login on the website">Account</span> ' : '') + (c.tags || []).map((t) => '<span class="pill plum">' + esc(t) + '</span>').join(' ') + '</div><div class="cell-sub">' + esc(c.details || '') + '</div></td>' +
        '<td class="nowrap">' + esc(c.mobile || '') + '</td><td class="r">' + (s.n || 0) + '</td><td class="r">' + inr(s.spend || 0) + '</td><td>' + (s.last ? fmtDate(s.last) : '—') + '</td>' +
        '<td class="acts">' + (c.mobile ? '<a class="icon-btn" target="_blank" rel="noopener" title="WhatsApp" href="https://wa.me/' + esc(String(c.mobile).replace(/\D/g, '')) + '">💬</a>' : '') + '<button class="icon-btn" data-open title="Details">👁</button><button class="icon-btn" data-edit title="Edit">✎</button><button class="icon-btn" data-del title="Delete">🗑</button></td></tr>'; }).join('')
        : '<tr><td colspan="6">' + empty('No customers yet. They are added automatically at billing, or add them here.') + '</td></tr>';
      const ev = [];
      rows.forEach((c) => { [['birthday', '🎂 Birthday'], ['anniversary', '💍 Anniversary']].forEach(([f, l]) => { const d = upcoming(c, f); if (d != null && d <= 30) ev.push({ c, l, d }); }); });
      ev.sort((a, b) => a.d - b.d);
      $('#events').innerHTML = ev.length ? '<div class="list">' + ev.map((e) => '<div class="list-row"><div class="grow"><div class="cell-main">' + esc(e.c.name) + '</div><div class="cell-sub">' + e.l + ' · ' + (e.d === 0 ? 'today' : 'in ' + e.d + ' day' + (e.d > 1 ? 's' : '')) + '</div></div>' + (e.c.mobile ? '<a class="btn sm" target="_blank" rel="noopener" href="https://wa.me/' + esc(String(e.c.mobile).replace(/\D/g, '')) + '?text=' + encodeURIComponent('Dear ' + e.c.name + ', warm wishes from Yukktha on your ' + e.l.split(' ')[1].toLowerCase() + '! Visit us for a special gift on your next saree.') + '">Send wishes</a>' : '') + '</div>').join('') + '</div>' : '<p class="muted">Nothing coming up.</p>';
    };
    const form = (c) => modal({
      title: c ? 'Edit customer' : 'Add customer', submit: 'Save',
      body: '<div class="form-grid">' + field('Name', input('name', c && c.name, 'required')) + field('Mobile', input('mobile', c && c.mobile, 'required inputmode="tel"')) +
        field('Email', input('email', c && c.email, 'type="email"')) + field('City / area', input('city', c && c.city)) +
        field('Birthday', input('birthday', c && c.birthday, 'type="date"')) + field('Anniversary', input('anniversary', c && c.anniversary, 'type="date"')) +
        '<div class="full field"><span>Tags</span><div class="checks">' + TAGS.map((t) => '<label class="check"><input type="checkbox" name="tag_' + t + '"' + (c && (c.tags || []).includes(t) ? ' checked' : '') + '> ' + t + '</label>').join('') + '</div></div>' +
        '<div class="full">' + field('Notes', '<textarea name="details" rows="3" placeholder="Preferences, measurements, blouse size…">' + esc(c && c.details || '') + '</textarea>') + '</div></div>',
      onOpen(f, onSubmit) {
        onSubmit(async () => {
          const mobile = normalizeMobile(f.mobile.value);
          if (!f.name.value.trim()) throw new Error('Enter a name.');
          if (!mobile) throw new Error('Enter a valid mobile number.');
          if (rows.some((x) => normalizeMobile(x.mobile) === mobile && (!c || x.id !== c.id))) throw new Error('A customer with this mobile already exists.');
          const data = { name: f.name.value.trim(), mobile, email: f.email.value.trim(), city: f.city.value.trim(), birthday: f.birthday.value, anniversary: f.anniversary.value, details: f.details.value.trim(), tags: TAGS.filter((t) => f['tag_' + t].checked) };
          if (c) await api.update('customers', c.id, data); else await api.add('customers', data);
          return true;
        });
      }
    });
    const reload = async () => { rows = await api.list('customers'); draw(); };
    $('#q').addEventListener('input', (e) => { st.q = e.target.value; draw(); });
    $('#tag').addEventListener('change', (e) => { st.tag = e.target.value; draw(); });
    $('#sort').addEventListener('change', (e) => { st.sort = e.target.value; draw(); });
    $('#add').addEventListener('click', async () => { if (await form(null)) { toast('Customer added'); reload(); } });
    $('#exp').addEventListener('click', () => downloadCsv('yukktha-customers.csv', filtered().map((c) => ({ name: c.name, mobile: c.mobile, email: c.email || '', city: c.city || '', tags: (c.tags || []).join(' '), birthday: c.birthday || '', anniversary: c.anniversary || '', orders: (S[normalizeMobile(c.mobile)] || {}).n || 0, spent: Math.round((S[normalizeMobile(c.mobile)] || {}).spend || 0), details: c.details || '' }))));
    $('#imp').addEventListener('change', async (e) => {
      const file = e.target.files[0]; if (!file) return;
      const list = parseCsv(await file.text()); let added = 0, skipped = 0;
      for (const r of list) {
        const mobile = normalizeMobile(r.mobile || r.phone || r['mobile number']);
        if (!mobile || rows.some((x) => normalizeMobile(x.mobile) === mobile)) { skipped++; continue; }
        await api.add('customers', { name: r.name || 'Customer', mobile, details: r.details || r.notes || '', tags: (r.tags || '').split(/[ ;|]+/).filter((t) => TAGS.includes(t)), birthday: r.birthday || '', anniversary: r.anniversary || '' });
        rows.push({ mobile }); added++;
      }
      toast(added + ' imported, ' + skipped + ' skipped (duplicate or no mobile)'); e.target.value = ''; reload();
    });
    $('#tb').addEventListener('click', async (e) => {
      const tr = e.target.closest('tr[data-id]'); if (!tr) return; const c = rows.find((x) => x.id === tr.dataset.id);
      if (e.target.closest('[data-edit]')) { if (await form(c)) { toast('Saved'); reload(); } }
      else if (e.target.closest('[data-del]')) { if (await confirmBox('Delete ' + (c.name || 'this customer') + '?')) { await api.remove('customers', c.id); toast('Deleted'); reload(); } }
      else if (e.target.closest('[data-open]')) {
        const mine = orders.filter((o) => normalizeMobile(o.customerPhone) === normalizeMobile(c.mobile)).sort((a, b) => ts(b.createdAt) - ts(a.createdAt));
        modal({ title: c.name || 'Customer', wide: true, cancel: 'Close', body: '<p>' + esc(c.mobile || '') + (c.email ? ' · ' + esc(c.email) : '') + (c.city ? ' · ' + esc(c.city) : '') + '</p>' + (c.details ? '<p class="muted">' + esc(c.details) + '</p>' : '') +
          '<h4 style="margin:16px 0 8px">Purchases</h4>' + (mine.length ? '<div class="list">' + mine.map((o) => '<div class="list-row"><div class="grow">' + (o.items || []).map((i) => esc(i.name)).join(', ') + '<div class="cell-sub">' + fmtDate(o.createdAt) + ' · ' + esc(o.invoiceNo || '') + '</div></div>' + statusPill(o.status) + '<strong>' + inr(orderTotal(o)) + '</strong></div>').join('') + '</div>' : '<p class="muted">No orders with this mobile yet.</p>') });
      }
    });
    draw();
  }
};
