import { esc, inr, num, $, $$, modal, confirmBox, toast, field, input, select, checkbox, imageUrl, mrp, finalPrice, stockOf, stockLabel, compressImage, downloadCsv, empty, ts } from '../ui.js';
import { CONFIG } from '../config.js';

const MAX_IMAGES = 5;

export async function sareeForm(ctx, s) {
  const cats = (ctx.project.categories && ctx.project.categories.length) ? ctx.project.categories : ['Kanjivaram Silk', 'Banarasi', 'Kuppadam Pattu', 'Soft Silk', 'Soft Cotton', 'Designer / Party', 'Other'];
  s = s || { stockMode: 'quantity', available: true, images: [] };
  let images = (s.images && s.images.length ? s.images : (s.imageUrl ? [s.imageUrl] : [])).slice();
  const body = '<div class="form-grid">' +
    '<p class="section-h">Photos</p><div class="full"><div class="img-pick" id="imgPick"></div><small class="muted">Up to ' + MAX_IMAGES + ' photos. The first one is the cover. Photos are resized to save space.</small></div>' +
    '<p class="section-h">Details</p>' +
    field('Saree name', input('name', s.name, 'required placeholder="e.g. Peacock Blue Kanjivaram Silk"'), '') +
    field('Weave / category', select('category', cats.concat(s.category && !cats.includes(s.category) ? [s.category] : []), s.category || cats[0])) +
    '<div class="full">' + field('Description', '<textarea name="description" rows="3" placeholder="Zari, motifs, pallu, blouse piece, occasion…">' + esc(s.description || '') + '</textarea>', 'Mention the occasion (e.g. "Ideal for weddings.") — the website uses it for the occasion filter.') + '</div>' +
    field('SKU / code', input('sku', s.sku, 'placeholder="Optional"')) +
    field('Colour', input('colour', s.colour, 'placeholder="Optional, e.g. Peacock blue"')) +
    '<p class="section-h">Price</p>' +
    field('MRP (₹)', input('sellPrice', mrp(s) || '', 'type="number" min="0" step="1" required')) +
    field('Discount %', input('discountPercent', s.discountPercent != null ? s.discountPercent : '', 'type="number" min="0" max="90" step="1" placeholder="0"'), 'Shown as “x% off” on the website.') +
    field('Cost price (₹)', input('costPrice', s.costPrice != null ? s.costPrice : '', 'type="number" min="0" step="1" placeholder="Private — for profit reports"')) +
    '<div class="field"><span>Selling price</span><strong id="finalP" style="font-size:18px;color:var(--accent);padding-top:6px">' + inr(finalPrice(s)) + '</strong></div>' +
    '<p class="section-h">Stock</p>' +
    field('Stock tracking', select('stockMode', [['quantity', 'Count pieces'], ['availability', 'Just in / out of stock']], s.stockMode || 'quantity')) +
    '<div id="qtyWrap">' + field('Pieces in stock', input('quantity', s.quantity != null ? s.quantity : '', 'type="number" min="0" step="1" placeholder="Leave empty to not track"')) + '</div>' +
    '<div id="availWrap">' + checkbox('available', s.available !== false, 'Available to buy') + '</div>' +
    '</div>';
  return modal({
    title: s.id ? 'Edit saree' : 'Add saree', wide: true, submit: s.id ? 'Save changes' : 'Publish saree', body,
    onOpen(form, onSubmit) {
      const pick = $('#imgPick', form);
      const draw = () => {
        pick.innerHTML = images.map((u, i) => '<figure class="' + (i ? '' : 'cover') + '"><img src="' + esc(imageUrl(u)) + '" alt=""><button type="button" data-rm="' + i + '" aria-label="Remove">✕</button></figure>').join('') +
          (images.length < MAX_IMAGES ? '<label class="img-add">+ Add<br>photos<input type="file" accept="image/*" multiple hidden></label>' : '');
        $$('[data-rm]', pick).forEach((b) => b.addEventListener('click', () => { images.splice(Number(b.dataset.rm), 1); draw(); }));
        const fi = $('input[type=file]', pick);
        if (fi) fi.addEventListener('change', async () => {
          for (const f of [].slice.call(fi.files).slice(0, MAX_IMAGES - images.length)) {
            try { images.push(await compressImage(f)); } catch (e) { toast(e.message, 'err'); }
          }
          draw();
        });
      };
      draw();
      const mode = form.stockMode; const sync = () => { $('#qtyWrap', form).hidden = mode.value !== 'quantity'; $('#availWrap', form).hidden = mode.value !== 'availability'; };
      mode.addEventListener('change', sync); sync();
      const price = () => { $('#finalP', form).textContent = inr(Math.round(num(form.sellPrice.value) * (1 - Math.min(90, num(form.discountPercent.value)) / 100))); };
      form.sellPrice.addEventListener('input', price); form.discountPercent.addEventListener('input', price);
      onSubmit(async () => {
        const v = { name: form.name.value.trim(), category: form.category.value, description: form.description.value.trim() };
        if (!v.name) throw new Error('Give the saree a name.');
        const sp = num(form.sellPrice.value);
        if (!sp) throw new Error('Enter the MRP.');
        if (!images.length) throw new Error('Add at least one photo.');
        const size = images.reduce((a, u) => a + (u.startsWith('data:') ? u.length : 0), 0);
        if (size > 900000) throw new Error('The photos are too large together (Firestore allows 1 MB per saree). Remove one or use smaller photos.');
        const disc = form.discountPercent.value === '' ? null : Math.min(90, Math.max(0, num(form.discountPercent.value)));
        const stockMode = form.stockMode.value;
        const data = {
          ...v, sellPrice: sp, price: '₹ ' + sp.toLocaleString('en-IN'),
          discountPercent: disc, stockMode,
          available: stockMode === 'availability' ? form.available.checked : true,
          quantity: stockMode === 'quantity' && form.quantity.value !== '' ? Math.max(0, num(form.quantity.value)) : null,
          images, imageUrl: images[0],
          sku: form.sku.value.trim() || null, colour: form.colour.value.trim() || null,
          costPrice: form.costPrice.value === '' ? null : num(form.costPrice.value)
        };
        if (s.id) { await ctx.api.update('sarees', s.id, data); return { id: s.id, ...data }; }
        const id = await ctx.api.add('sarees', data); return { id, ...data };
      });
    }
  });
}

export default {
  id: 'sarees', title: 'Sarees', group: 'Catalogue', icon: 'saree',
  async render(view, ctx) {
    const { api } = ctx;
    let rows = await api.list('sarees');
    if (ctx.stale()) return;
    const state = { q: '', cat: '', stock: '', sort: 'new', sel: new Set() };
    const cats = [...new Set(rows.map((s) => s.category).filter(Boolean))].sort();

    view.innerHTML = '<div class="bar"><input type="search" id="q" placeholder="Search name, SKU, colour…">' +
      '<select id="cat"><option value="">All weaves</option>' + cats.map((c) => '<option>' + esc(c) + '</option>').join('') + '</select>' +
      '<select id="stock"><option value="">Any stock</option><option value="low">Low stock</option><option value="out">Out of stock</option><option value="disc">On discount</option></select>' +
      '<select id="sort"><option value="new">Newest</option><option value="name">Name A–Z</option><option value="pa">Price low–high</option><option value="pd">Price high–low</option><option value="stock">Stock low–high</option></select>' +
      '<span class="grow"></span><button class="btn" id="exp">Export CSV</button><button class="btn primary" id="add">+ Add saree</button></div>' +
      '<div class="bar" id="bulk" hidden><strong id="selN"></strong><button class="btn sm" id="bDisc">Set discount</button><button class="btn sm" id="bCat">Change weave</button><button class="btn sm" id="bStock">Mark out of stock</button><button class="btn sm danger" id="bDel">Delete</button></div>' +
      '<div class="table-wrap"><table class="t"><thead><tr><th><input type="checkbox" id="all" aria-label="Select all"></th><th></th><th>Saree</th><th>Weave</th><th class="r">MRP</th><th class="r">Disc.</th><th class="r">Selling</th><th>Stock</th><th></th></tr></thead><tbody id="tb"></tbody></table></div>' +
      '<p class="muted tiny" id="cnt"></p>';

    const filtered = () => {
      const q = state.q.toLowerCase();
      let r = rows.filter((s) => (!q || [s.name, s.sku, s.colour, s.category].join(' ').toLowerCase().includes(q)) && (!state.cat || s.category === state.cat));
      if (state.stock === 'low') r = r.filter((s) => stockOf(s) !== Infinity && stockOf(s) <= CONFIG.lowStockAt && stockOf(s) > 0);
      if (state.stock === 'out') r = r.filter((s) => stockOf(s) === 0);
      if (state.stock === 'disc') r = r.filter((s) => num(s.discountPercent) > 0);
      const cmp = { new: (a, b) => ts(b.createdAt) - ts(a.createdAt), name: (a, b) => String(a.name).localeCompare(b.name), pa: (a, b) => finalPrice(a) - finalPrice(b), pd: (a, b) => finalPrice(b) - finalPrice(a), stock: (a, b) => stockOf(a) - stockOf(b) }[state.sort];
      return r.sort(cmp);
    };
    const draw = () => {
      const r = filtered();
      $('#tb').innerHTML = r.length ? r.map((s) => '<tr data-id="' + esc(s.id) + '"><td><input type="checkbox" class="sel" value="' + esc(s.id) + '"' + (state.sel.has(s.id) ? ' checked' : '') + '></td>' +
        '<td><img class="thumb" src="' + esc(imageUrl(s.imageUrl)) + '" alt="" loading="lazy"></td>' +
        '<td><div class="cell-main">' + esc(s.name) + '</div><div class="cell-sub">' + esc([s.sku, s.colour].filter(Boolean).join(' · ') || ((s.images || []).length || 1) + ' photo(s)') + '</div></td>' +
        '<td>' + esc(s.category || '—') + '</td><td class="r">' + (mrp(s) ? inr(mrp(s)) : '—') + '</td><td class="r">' + (num(s.discountPercent) ? '<span class="pill plum">' + num(s.discountPercent) + '%</span>' : '—') + '</td>' +
        '<td class="r"><strong>' + (mrp(s) ? inr(finalPrice(s)) : '—') + '</strong></td>' +
        '<td><span class="pill ' + (stockOf(s) === 0 ? 'err' : stockOf(s) <= CONFIG.lowStockAt ? 'warn' : 'ok') + '">' + esc(stockLabel(s)) + '</span></td>' +
        '<td class="acts"><a class="icon-btn" href="' + CONFIG.storefrontUrl + 'product.html?id=' + encodeURIComponent(s.id) + '" target="_blank" rel="noopener" title="View on website">↗</a><button class="icon-btn" data-edit title="Edit">✎</button><button class="icon-btn" data-del title="Delete">🗑</button></td></tr>').join('')
        : '<tr><td colspan="9">' + empty('No sarees match.') + '</td></tr>';
      $('#cnt').textContent = r.length + ' of ' + rows.length + ' sarees';
      $('#bulk').hidden = !state.sel.size; $('#selN').textContent = state.sel.size + ' selected';
    };
    const reload = async () => { rows = await api.list('sarees'); draw(); };
    const edit = async (s) => { const saved = await sareeForm(ctx, s); if (saved) { toast(s && s.id ? 'Saved — live on the website' : 'Published on the website'); await reload(); } };

    $('#q').addEventListener('input', (e) => { state.q = e.target.value; draw(); });
    ['cat', 'stock', 'sort'].forEach((k) => $('#' + k).addEventListener('change', (e) => { state[k] = e.target.value; draw(); }));
    $('#add').addEventListener('click', () => edit(null));
    $('#exp').addEventListener('click', () => downloadCsv('yukktha-sarees.csv', filtered().map((s) => ({ id: s.id, name: s.name, category: s.category, sku: s.sku || '', colour: s.colour || '', mrp: mrp(s), discount_percent: num(s.discountPercent), selling_price: finalPrice(s), cost_price: s.costPrice == null ? '' : s.costPrice, stock: stockLabel(s) }))));
    $('#tb').addEventListener('click', async (e) => {
      const tr = e.target.closest('tr[data-id]'); if (!tr) return;
      const s = rows.find((x) => x.id === tr.dataset.id);
      if (e.target.closest('[data-edit]')) edit(s);
      else if (e.target.closest('[data-del]')) { if (await confirmBox('Delete “' + s.name + '”? It disappears from the website.')) { await api.remove('sarees', s.id); toast('Deleted'); state.sel.delete(s.id); reload(); } }
    });
    $('#tb').addEventListener('change', (e) => { if (e.target.classList.contains('sel')) { e.target.checked ? state.sel.add(e.target.value) : state.sel.delete(e.target.value); draw(); } });
    $('#all').addEventListener('change', (e) => { filtered().forEach((s) => e.target.checked ? state.sel.add(s.id) : state.sel.delete(s.id)); draw(); });
    const bulk = async (patchFn, msg) => { for (const id of state.sel) await api.update('sarees', id, patchFn(rows.find((r) => r.id === id))); toast(msg); state.sel.clear(); $('#all').checked = false; reload(); };
    $('#bDisc').addEventListener('click', async () => { const v = await modal({ title: 'Set discount', body: field('Discount % for ' + state.sel.size + ' sarees', input('d', '', 'type="number" min="0" max="90" required'), 'Use 0 to remove the discount.'), submit: 'Apply' }); if (v && v.d != null) bulk(() => ({ discountPercent: Math.min(90, Math.max(0, v.d)) || null }), 'Discount updated'); });
    $('#bCat').addEventListener('click', async () => { const v = await modal({ title: 'Change weave', body: field('New weave', select('c', ctx.project.categories || cats)), submit: 'Apply' }); if (v) bulk(() => ({ category: v.c }), 'Weave updated'); });
    $('#bStock').addEventListener('click', () => bulk((s) => s.stockMode === 'availability' ? { available: false } : { quantity: 0 }, 'Marked out of stock'));
    $('#bDel').addEventListener('click', async () => { if (await confirmBox('Delete ' + state.sel.size + ' sarees from the website?')) { for (const id of state.sel) await api.remove('sarees', id); toast('Deleted'); state.sel.clear(); reload(); } });
    draw();
    if (ctx.param === 'new') { history.replaceState(null, '', '#/sarees'); edit(null); }
  }
};
