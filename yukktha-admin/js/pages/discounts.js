import { esc, inr, num, $, $$, toast, modal, confirmBox, field, input, select, checkbox, fmtDate, ts, empty } from '../ui.js';

const genCode = () => 'YK' + Array.from({ length: 6 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 31)]).join('');

export default {
  id: 'discounts', title: 'Discounts & offers', group: 'Catalogue', icon: 'tag',
  async render(view, ctx) {
    if (ctx.param === 'banners') { ctx.go('#/banners'); return; }
    const tab = ['coupons', 'sale', 'first'].includes(ctx.param) ? ctx.param : 'coupons';
    const tabs = [['coupons', 'Coupons'], ['sale', 'Sale by weave'], ['first', 'First-order discount']];
    view.innerHTML = '<div class="tabs">' + tabs.map(([k, l]) => '<button data-t="' + k + '" class="' + (k === tab ? 'on' : '') + '">' + l + '</button>').join('') + '</div><div id="pane"></div>';
    $$('[data-t]', view).forEach((b) => b.addEventListener('click', () => ctx.go('#/discounts/' + b.dataset.t)));
    try { await ({ coupons, sale, first, banners })[tab]($('#pane'), ctx); } catch (e) { $('#pane').innerHTML = '<div class="alert warn"><strong>Not available</strong><p>' + esc(e.message) + '</p></div>'; }
  }
};

async function coupons(pane, ctx) {
  const { api } = ctx;
  let rows = await api.list('coupons');
  const state = (c) => c.used ? ['Used', 'err'] : (c.expiresAt && ts(c.expiresAt) < Date.now() ? ['Expired', 'warn'] : ['Active', 'ok']);
  const draw = () => {
    rows.sort((a, b) => ts(b.createdAt) - ts(a.createdAt));
    pane.innerHTML = '<div class="bar"><p class="muted grow" style="margin:0">Single-use codes for the website checkout and in-store billing. Share them on WhatsApp or as scratch cards.</p><button class="btn primary" id="add">+ New coupon</button></div>' +
      '<div class="table-wrap"><table class="t"><thead><tr><th>Code</th><th>Discount</th><th>Expires</th><th>Status</th><th>Note</th><th></th></tr></thead><tbody>' +
      (rows.length ? rows.map((c) => { const [l, k] = state(c); return '<tr data-id="' + esc(c.id) + '"><td><strong style="letter-spacing:1px">' + esc(c.code) + '</strong></td><td>' + (c.discountType === 'percent' ? num(c.discountValue) + '% off' : inr(c.discountValue) + ' off') + '</td><td>' + (c.expiresAt ? fmtDate(c.expiresAt) : 'Never') + '</td><td><span class="pill ' + k + '">' + l + '</span></td><td class="cell-sub">' + esc(c.note || (c.usedOn ? 'Used on ' + c.usedOn : '')) + '</td><td class="acts"><button class="icon-btn" data-copy title="Copy WhatsApp message">📋</button><button class="icon-btn" data-del>🗑</button></td></tr>'; }).join('') : '<tr><td colspan="6">' + empty('No coupons yet.') + '</td></tr>') + '</tbody></table></div>';
    $('#add').onclick = add;
    pane.querySelector('tbody').onclick = async (e) => {
      const tr = e.target.closest('tr[data-id]'); if (!tr) return; const c = rows.find((x) => x.id === tr.dataset.id);
      if (e.target.closest('[data-del]') && await confirmBox('Delete coupon ' + c.code + '?')) { await api.remove('coupons', c.id); rows = await api.list('coupons'); draw(); }
      if (e.target.closest('[data-copy]')) {
        const text = 'A gift from Yukktha! Use code ' + c.code + ' for ' + (c.discountType === 'percent' ? num(c.discountValue) + '%' : inr(c.discountValue)) + ' off your next saree' + (c.expiresAt ? ' (valid till ' + fmtDate(c.expiresAt) + ')' : '') + '. Shop: ' + ctx.CONFIG.storefrontUrl;
        try { await navigator.clipboard.writeText(text); toast('Message copied'); } catch (_) { toast(text); }
      }
    };
  };
  const add = async () => {
    const v = await modal({ title: 'New coupon', submit: 'Create', body: '<div class="form-grid">' + field('Code', input('code', genCode(), 'required style="text-transform:uppercase"')) + field('Type', select('discountType', [['percent', 'Percent off'], ['amount', 'Flat ₹ off']])) + field('Value', input('discountValue', 10, 'type="number" min="1" required')) + field('Valid for (days)', input('days', 30, 'type="number" min="1"'), 'Leave empty for no expiry.') + field('How many codes', input('count', 1, 'type="number" min="1" max="50"'), 'More than 1 adds a random suffix to each.') + field('Note', input('note', '', 'placeholder="e.g. Diwali WhatsApp blast"')) + '</div>' });
    if (!v) return;
    const code = String(v.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!code || !v.discountValue) { toast('Code and value are required', 'err'); return; }
    const n = Math.min(50, Math.max(1, num(v.count, 1)));
    const expiresAt = v.days ? new Date(Date.now() + v.days * 86400000).toISOString() : null;
    for (let i = 0; i < n; i++) {
      const c = n === 1 ? code : code + '-' + genCode().slice(2, 6);
      if (rows.some((x) => String(x.code).toUpperCase() === c)) { toast('Code ' + c + ' already exists', 'err'); continue; }
      await api.add('coupons', { code: c, discountType: v.discountType, discountValue: Math.max(1, v.discountValue), expiresAt, used: false, note: v.note || '' });
    }
    toast(n > 1 ? n + ' coupons created' : 'Coupon ' + code + ' created'); rows = await api.list('coupons'); draw();
  };
  draw();
}

async function sale(pane, ctx) {
  const { api } = ctx;
  let sarees = await api.list('sarees');
  const draw = () => {
    const cats = {};
    sarees.forEach((s) => { const c = s.category || 'Other'; cats[c] = cats[c] || { n: 0, disc: 0, pcts: new Set() }; cats[c].n++; if (num(s.discountPercent)) { cats[c].disc++; cats[c].pcts.add(num(s.discountPercent)); } });
    pane.innerHTML = '<p class="muted">Put a whole weave on sale in one click. The discount shows on the website as “x% off” with the MRP struck through, and applies at billing.</p>' +
      '<div class="table-wrap"><table class="t"><thead><tr><th>Weave</th><th class="r">Sarees</th><th>On discount now</th><th class="r">Set discount</th></tr></thead><tbody>' +
      Object.keys(cats).sort().map((c) => '<tr data-c="' + esc(c) + '"><td class="cell-main">' + esc(c) + '</td><td class="r">' + cats[c].n + '</td><td>' + (cats[c].disc ? cats[c].disc + ' sarees · ' + [...cats[c].pcts].sort((a, b) => a - b).join('%, ') + '%' : '—') + '</td><td class="acts"><input type="number" min="0" max="90" placeholder="%" style="width:70px;height:32px;border:1px solid var(--line);border-radius:6px;padding:0 8px"> <button class="btn sm primary" data-apply>Apply</button> <button class="btn sm" data-clear>Remove</button></td></tr>').join('') + '</tbody></table></div>';
    pane.querySelector('tbody').onclick = async (e) => {
      const tr = e.target.closest('tr[data-c]'); if (!tr) return; const c = tr.dataset.c;
      const list = sarees.filter((s) => (s.category || 'Other') === c);
      let pct = null;
      if (e.target.closest('[data-apply]')) { pct = Math.min(90, Math.max(0, num(tr.querySelector('input').value))); if (!pct) { toast('Enter a discount %', 'err'); return; } }
      else if (!e.target.closest('[data-clear]')) return;
      if (!await confirmBox((pct ? 'Set ' + pct + '% off on ' : 'Remove the discount from ') + list.length + ' ' + c + ' sarees?', pct ? 'Apply' : 'Remove')) return;
      for (const s of list) await api.update('sarees', s.id, { discountPercent: pct });
      toast('Updated ' + list.length + ' sarees'); sarees = await api.list('sarees'); draw();
    };
  };
  draw();
}

async function first(pane, ctx) {
  const p = ctx.project; const f = p.firstOrderDiscount || {};
  pane.innerHTML = '<div class="card" style="max-width:560px"><h3>First-order discount</h3><p class="muted">Applied automatically at the website checkout on a customer’s first order.</p><form id="f" class="stack">' +
    checkbox('enabled', f.enabled, 'Give new customers a first-order discount') +
    '<div class="grid2">' + field('Type', select('type', [['percent', 'Percent off'], ['amount', 'Flat ₹ off']], f.type || 'percent')) + field('Value', input('value', f.value || 10, 'type="number" min="1"')) + '</div>' +
    '<button class="btn primary" ' + (ctx.session.isOwner ? '' : 'disabled title="Owner only"') + '>Save</button></form></div>';
  $('#f').addEventListener('submit', async (e) => {
    e.preventDefault(); const t = e.target;
    try { await ctx.api.updateProject({ firstOrderDiscount: { enabled: t.enabled.checked, type: t.type.value, value: Math.max(1, num(t.value.value, 1)) } }); await ctx.reloadProject(); toast('Saved'); } catch (err) { toast(err.message, 'err'); }
  });
}

async function banners(pane, ctx) {
  const { api } = ctx;
  let rows = await api.list('banners');
  const draw = () => {
    rows.sort((a, b) => ts(b.createdAt) - ts(a.createdAt));
    pane.innerHTML = '<div class="bar"><p class="muted grow" style="margin:0">Active banners appear on the website — use them for new stock, sales and exhibitions.</p><button class="btn primary" id="add">+ New banner</button></div>' +
      '<div class="table-wrap"><table class="t"><thead><tr><th>Title</th><th>Message</th><th>Button</th><th>Status</th><th></th></tr></thead><tbody>' +
      (rows.length ? rows.map((b) => '<tr data-id="' + esc(b.id) + '"><td class="cell-main">' + esc(b.title) + '</td><td>' + esc(b.message || '') + '</td><td class="cell-sub">' + esc(b.ctaLabel || '') + (b.ctaLink ? ' → ' + esc(b.ctaLink) : '') + '</td><td><button class="btn sm" data-toggle>' + (b.active ? '<span class="pill ok">Live</span> Turn off' : '<span class="pill">Off</span> Turn on') + '</button></td><td class="acts"><button class="icon-btn" data-edit>✎</button><button class="icon-btn" data-del>🗑</button></td></tr>').join('') : '<tr><td colspan="5">' + empty('No banners yet.') + '</td></tr>') + '</tbody></table></div>';
    $('#add').onclick = () => edit(null);
    pane.querySelector('tbody').onclick = async (e) => {
      const tr = e.target.closest('tr[data-id]'); if (!tr) return; const b = rows.find((x) => x.id === tr.dataset.id);
      if (e.target.closest('[data-toggle]')) { await api.update('banners', b.id, { active: !b.active }); rows = await api.list('banners'); draw(); }
      if (e.target.closest('[data-edit]')) edit(b);
      if (e.target.closest('[data-del]') && await confirmBox('Delete banner “' + b.title + '”?')) { await api.remove('banners', b.id); rows = await api.list('banners'); draw(); }
    };
  };
  const edit = async (b) => {
    const v = await modal({ title: b ? 'Edit banner' : 'New banner', submit: 'Save', body: '<div class="form-grid">' + '<div class="full">' + field('Title', input('title', b && b.title, 'required placeholder="New stock arrived 🛍️"')) + '</div><div class="full">' + field('Message', input('message', b && b.message, 'placeholder="Flat 20% off on soft silks this weekend"')) + '</div>' + field('Button label', input('ctaLabel', b && b.ctaLabel, 'placeholder="Call now"')) + field('Button link / phone', input('ctaLink', b && b.ctaLink, 'placeholder="8341448340 or https://…"')) + '<div class="full">' + checkbox('active', b ? b.active : true, 'Show on the website') + '</div></div>' });
    if (!v) return; if (!v.title) { toast('Title is required', 'err'); return; }
    if (b) await api.update('banners', b.id, v); else await api.add('banners', v);
    toast('Saved'); rows = await api.list('banners'); draw();
  };
  draw();
}
