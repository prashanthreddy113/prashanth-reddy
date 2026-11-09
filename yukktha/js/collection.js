// Collection page: banner, filter sidebar with facet counts, sort, grid density, load more.
(function () {
  const Y = window.Yukktha; const esc = Y.esc;
  const PAGE = 24;
  const $ = (id) => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const list = (k) => (params.get(k) || '').split(',').map((s) => s.trim()).filter(Boolean);

  const state = {
    slug: params.get('c') || 'all',
    q: (params.get('q') || '').trim(),
    sort: params.get('sort') || 'featured',
    colour: list('colour'), weave: list('weave'), occasion: list('occasion'), material: list('material'), avail: list('avail'),
    min: params.has('min') ? Number(params.get('min')) : null,
    max: params.has('max') ? Number(params.get('max')) : null,
    shown: PAGE,
    cols: (function () { try { return localStorage.getItem('yk_cols') || '4'; } catch (e) { return '4'; } })()
  };

  let all = []; let base = []; let coll = null; let bounds = [0, 0];

  // skeleton while the catalogue loads
  $('grid').innerHTML = Array.from({ length: 8 }, () => '<div class="card skeleton"><div class="card-media"></div><div class="card-info"><span></span><span></span></div></div>').join('');
  setCols(state.cols);

  const GROUPS = [
    { key: 'avail', title: 'Availability', get: (p) => (p.inStock ? 'In stock' : 'Out of stock'), order: ['In stock', 'Out of stock'] },
    { key: 'price', title: 'Price' },
    { key: 'colour', title: 'Base Colour', get: (p) => p.colour, swatch: true },
    { key: 'weave', title: 'Weave', get: (p) => p.categoryTitle },
    { key: 'occasion', title: 'Occasion', get: (p) => p.occasion },
    { key: 'material', title: 'Material', get: (p) => p.material }
  ];

  function matches(p, skip) {
    for (const g of GROUPS) {
      if (g.key === skip) continue;
      if (g.key === 'price') {
        if (state.min != null && p.price < state.min) return false;
        if (state.max != null && p.price > state.max) return false;
        continue;
      }
      const sel = state[g.key];
      if (sel.length && sel.indexOf(g.get(p)) === -1) return false;
    }
    return true;
  }
  function sorted(items) {
    const a = items.slice();
    const cmp = {
      featured: () => 0,
      newest: (x, y) => y.createdAt - x.createdAt,
      'price-asc': (x, y) => (x.price || Infinity) - (y.price || Infinity),
      'price-desc': (x, y) => y.price - x.price,
      discount: (x, y) => y.discount - x.discount,
      rated: (x, y) => { const R = Y.ratings || {}; const r = (p) => R[p.id] ? R[p.id].sum / R[p.id].n : 0; return (r(y) - r(x)) || ((R[y.id] || {}).n || 0) - ((R[x.id] || {}).n || 0); },
      az: (x, y) => x.title.localeCompare(y.title),
      za: (x, y) => y.title.localeCompare(x.title)
    }[state.sort] || (() => 0);
    // Featured: in stock first, sarees with their own photo gallery first, then newest.
    if (state.sort === 'featured') return a.sort((x, y) => (y.inStock - x.inStock) || (y.images.length - x.images.length) || (y.createdAt - x.createdAt));
    return a.sort(cmp);
  }

  function renderFilters() {
    const html = GROUPS.map((g) => {
      if (g.key === 'price') {
        const lo = state.min != null ? state.min : bounds[0]; const hi = state.max != null ? state.max : bounds[1];
        return '<details class="fgroup" open><summary>Price' + Y.ui.ICON.chevD + '</summary><div class="price-range">' +
          '<div class="range"><div class="range-track"></div><div class="range-fill" id="rangeFill"></div>' +
          '<input type="range" id="rMin" min="' + bounds[0] + '" max="' + bounds[1] + '" step="100" value="' + lo + '" aria-label="Minimum price">' +
          '<input type="range" id="rMax" min="' + bounds[0] + '" max="' + bounds[1] + '" step="100" value="' + hi + '" aria-label="Maximum price"></div>' +
          '<div class="price-inputs"><label>₹<input type="number" id="pMin" value="' + lo + '" min="' + bounds[0] + '" max="' + bounds[1] + '" aria-label="From"></label>to<label>₹<input type="number" id="pMax" value="' + hi + '" min="' + bounds[0] + '" max="' + bounds[1] + '" aria-label="To"></label></div></div></details>';
      }
      // counts reflect every other active filter (Shopify-style)
      const pool = base.filter((p) => matches(p, g.key));
      const counts = {};
      base.forEach((p) => { const v = g.get(p); if (v) counts[v] = counts[v] || 0; });
      pool.forEach((p) => { const v = g.get(p); if (v) counts[v] += 1; });
      let values = Object.keys(counts);
      if (values.length < 2 && !state[g.key].length) return '';
      if (g.order) values.sort((a, b) => g.order.indexOf(a) - g.order.indexOf(b));
      else values.sort((a, b) => a.localeCompare(b));
      return '<details class="fgroup" open><summary>' + esc(g.title) + Y.ui.ICON.chevD + '</summary><div class="fbody">' + values.map((v) => {
        const on = state[g.key].indexOf(v) !== -1; const n = counts[v];
        return '<label class="check' + (!n && !on ? ' disabled' : '') + '"><input type="checkbox" data-group="' + g.key + '" value="' + esc(v) + '"' + (on ? ' checked' : '') + (!n && !on ? ' disabled' : '') + '>' +
          (g.swatch ? '<span class="swatch" style="background:' + Y.SWATCH[v] + '"></span>' : '') + esc(v) + ' (' + n + ')</label>';
      }).join('') + '</div></details>';
    }).join('');
    // keep open/closed state of groups across re-renders
    const closed = [].slice.call(document.querySelectorAll('.fgroup:not([open]) summary')).map((s) => s.textContent);
    $('filterGroups').innerHTML = html;
    document.querySelectorAll('.fgroup summary').forEach((s) => { if (closed.indexOf(s.textContent) !== -1) s.parentElement.removeAttribute('open'); });
    wirePrice();
  }

  function wirePrice() {
    const rMin = $('rMin'); if (!rMin) return;
    const rMax = $('rMax'); const pMin = $('pMin'); const pMax = $('pMax'); const fill = $('rangeFill');
    const span = Math.max(1, bounds[1] - bounds[0]);
    const paint = () => { fill.style.left = ((rMin.value - bounds[0]) / span * 100) + '%'; fill.style.right = (100 - (rMax.value - bounds[0]) / span * 100) + '%'; };
    const commit = (lo, hi) => {
      lo = Math.max(bounds[0], Math.min(lo, hi)); hi = Math.min(bounds[1], Math.max(lo, hi));
      state.min = lo > bounds[0] ? lo : null; state.max = hi < bounds[1] ? hi : null; state.shown = PAGE;
      update();
    };
    rMin.addEventListener('input', () => { if (+rMin.value > +rMax.value) rMin.value = rMax.value; pMin.value = rMin.value; paint(); });
    rMax.addEventListener('input', () => { if (+rMax.value < +rMin.value) rMax.value = rMin.value; pMax.value = rMax.value; paint(); });
    [rMin, rMax].forEach((r) => r.addEventListener('change', () => commit(+rMin.value, +rMax.value)));
    [pMin, pMax].forEach((i) => i.addEventListener('change', () => commit(+pMin.value || bounds[0], +pMax.value || bounds[1])));
    paint();
  }

  function renderChips() {
    const chips = [];
    ['avail', 'colour', 'weave', 'occasion', 'material'].forEach((k) => state[k].forEach((v) => chips.push('<button class="chip" data-chip="' + k + '" data-v="' + esc(v) + '">' + esc(v) + Y.ui.ICON.close + '</button>')));
    if (state.min != null || state.max != null) chips.push('<button class="chip" data-chip="price">' + Y.inr(state.min != null ? state.min : bounds[0]) + ' – ' + Y.inr(state.max != null ? state.max : bounds[1]) + Y.ui.ICON.close + '</button>');
    if (state.q) chips.push('<button class="chip" data-chip="q">“' + esc(state.q) + '”' + Y.ui.ICON.close + '</button>');
    $('chips').innerHTML = chips.length ? chips.join('') + '<button class="chip-clear" data-chip="all">Clear all</button>' : '';
  }

  function renderGrid() {
    const hits = sorted(base.filter((p) => matches(p)));
    $('count').textContent = hits.length + ' product' + (hits.length === 1 ? '' : 's');
    $('grid').innerHTML = hits.length
      ? hits.slice(0, state.shown).map((p) => Y.ui.card(p)).join('')
      : '<div class="no-results"><p>No sarees match these filters.</p><button class="btn btn-outline" data-chip="all">Clear filters</button></div>';
    const shown = Math.min(state.shown, hits.length);
    $('loadMore').innerHTML = hits.length > PAGE
      ? '<p>You’ve viewed ' + shown + ' of ' + hits.length + ' products</p><div class="progress"><span style="width:' + (shown / hits.length * 100) + '%"></span></div>' +
        (shown < hits.length ? '<button class="btn btn-outline" id="more">Load more</button>' : '')
      : '';
    const more = $('more'); if (more) more.addEventListener('click', () => { state.shown += PAGE; renderGrid(); });
    $('filterApply').textContent = 'Show ' + hits.length + ' result' + (hits.length === 1 ? '' : 's');
  }

  function syncUrl() {
    const p = new URLSearchParams(); p.set('c', state.slug);
    if (state.q) p.set('q', state.q);
    ['colour', 'weave', 'occasion', 'material', 'avail'].forEach((k) => { if (state[k].length) p.set(k, state[k].join(',')); });
    if (state.min != null) p.set('min', state.min); if (state.max != null) p.set('max', state.max);
    if (state.sort !== 'featured') p.set('sort', state.sort);
    history.replaceState(null, '', 'collection.html?' + p.toString());
  }
  function update() { renderFilters(); renderChips(); renderGrid(); syncUrl(); }

  function setCols(n) {
    state.cols = String(n);
    $('grid').className = 'grid list-' + n;
    document.querySelectorAll('.density button').forEach((b) => b.classList.toggle('on', b.dataset.cols === state.cols));
    try { localStorage.setItem('yk_cols', state.cols); } catch (e) { /* ignore */ }
  }

  // ---------- events ----------
  $('sort').value = state.sort;
  $('sort').addEventListener('change', (e) => { state.sort = e.target.value; state.shown = PAGE; renderGrid(); syncUrl(); });
  document.querySelectorAll('.density button').forEach((b) => b.addEventListener('click', () => setCols(b.dataset.cols)));
  $('filterGroups').addEventListener('change', (e) => {
    const t = e.target; if (!t.dataset.group) return;
    const arr = state[t.dataset.group]; const i = arr.indexOf(t.value);
    if (t.checked && i === -1) arr.push(t.value); if (!t.checked && i !== -1) arr.splice(i, 1);
    state.shown = PAGE; update();
  });
  document.addEventListener('click', (e) => {
    const c = e.target.closest('[data-chip]'); if (!c) return;
    const k = c.dataset.chip;
    if (k === 'all') { ['colour', 'weave', 'occasion', 'material', 'avail'].forEach((x) => { state[x] = []; }); state.min = state.max = null; state.q = ''; }
    else if (k === 'price') { state.min = state.max = null; }
    else if (k === 'q') { state.q = ''; base = scope(); computeBounds(); }
    else { state[k] = state[k].filter((v) => v !== c.dataset.v); }
    if (k === 'all') { base = scope(); computeBounds(); }
    state.shown = PAGE; update();
  });
  const filters = $('filters');
  const scrim = (on) => { const s = document.getElementById('scrim'); if (s) s.classList.toggle('on', on); };
  const openFilters = () => { filters.classList.add('open'); scrim(true); document.body.classList.add('locked'); };
  const closeFilters = () => { filters.classList.remove('open'); scrim(false); document.body.classList.remove('locked'); };
  $('filterToggle').addEventListener('click', openFilters);
  $('filterClose').addEventListener('click', closeFilters);
  $('filterApply').addEventListener('click', closeFilters);
  document.addEventListener('click', (e) => { if (e.target.id === 'scrim') closeFilters(); });

  // ---------- data ----------
  function scope() {
    let items = all.filter((p, i) => coll.filter(p, i));
    if (state.q) {
      const q = state.q.toLowerCase();
      items = items.filter((p) => (p.title + ' ' + p.category + ' ' + p.colour + ' ' + p.shade + ' ' + (p.occasion || '') + ' ' + p.description).toLowerCase().indexOf(q) !== -1);
    }
    return items;
  }
  function computeBounds() {
    const prices = base.map((p) => p.price).filter((n) => n > 0);
    bounds = prices.length ? [Math.floor(Math.min.apply(null, prices) / 100) * 100, Math.ceil(Math.max.apply(null, prices) / 100) * 100] : [0, 0];
  }

  Y.loadCatalogue().then((items) => {
    all = items;
    const cols = Y.collections(items);
    coll = cols.find((c) => c.slug === state.slug) || cols[0];
    state.slug = coll.slug;
    const title = state.q ? 'Search: ' + state.q : coll.title;
    document.title = title + ' | Yukktha — Timeless Royal Weaves';
    $('collTitle').textContent = title;
    $('crumbTitle').textContent = coll.title;
    $('collIntro').textContent = state.q ? '' : coll.blurb;
    const img = coll.category ? ((items.find((p) => p.category === coll.category && p.images[0].indexOf('saree-') === -1) || {}).images || [coll.image])[0] : coll.image;
    $('bannerImg').src = img || coll.image;
    base = scope(); computeBounds();
    update();
  }).catch((err) => {
    console.error(err);
    $('grid').innerHTML = '<div class="no-results"><p>We couldn’t load the collection right now. Please call <a href="tel:' + Y.CFG.phoneIntl + '">' + Y.CFG.phone + '</a>.</p></div>';
    $('count').textContent = '';
  });
})();
