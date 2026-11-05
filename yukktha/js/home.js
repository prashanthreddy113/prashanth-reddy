// Home page: weave tiles, new-arrival and occasion rails, stores.
(function () {
  const Y = window.Yukktha; const esc = Y.esc; const I = Y.ui.ICON; const c = Y.ui.coll;
  const $ = (id) => document.getElementById(id);

  const TILES = [
    ['Kanjivaram Silk', 'kanjivaram-silk', 'assets/img/kanjivaram-peacock.jpg'],
    ['Banarasi', 'banarasi', 'assets/img/banarasi-red-butta.jpg'],
    ['Kuppadam Pattu', 'kuppadam-pattu', 'assets/img/saree-4.jpg'],
    ['Soft Silk', 'soft-silk', 'assets/img/saree-2.jpg'],
    ['Soft Cotton', 'soft-cotton', 'assets/img/saree-1.jpg'],
    ['Designer & Party', 'designer-party', 'assets/img/kanjivaram-model.jpg']
  ];

  // stores
  $('storeList').innerHTML = Y.CFG.stores.map((s) => '<article class="store"><h3>' + I.pin + esc(s.label) + '</h3><address>' + esc(s.address) + '</address><p class="hours">Open ' + esc(Y.CFG.hours) + '</p>' +
    '<div class="btns"><a class="btn btn-solid" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(s.mapsQuery) + '">Get directions</a>' +
    '<a class="btn btn-outline" href="tel:' + Y.CFG.phoneIntl + '">Call store</a></div></article>').join('');

  // rail arrows
  document.querySelectorAll('[data-rail]').forEach((b) => {
    b.innerHTML = Number(b.dataset.rail) < 0 ? I.chevL : I.chevR;
    b.addEventListener('click', () => { const r = $(b.dataset.target || 'rail'); r.scrollBy({ left: Number(b.dataset.rail) * r.clientWidth * 0.75, behavior: 'smooth' }); });
  });

  function tabs(el, railId, options, items) {
    el.innerHTML = options.map((o, i) => '<button role="tab" class="' + (i ? '' : 'on') + '" data-i="' + i + '">' + esc(o.label) + '</button>').join('');
    const show = (i) => {
      el.querySelectorAll('button').forEach((b, k) => { b.classList.toggle('on', k === i); b.setAttribute('aria-selected', k === i); });
      const list = items.filter(options[i].filter).slice(0, 12);
      const rail = $(railId);
      rail.innerHTML = list.map((p) => Y.ui.card(p)).join('') || '<p class="no-results">Coming soon.</p>';
      rail.scrollLeft = 0;
    };
    el.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) show(Number(b.dataset.i)); });
    show(0);
  }

  Y.loadCatalogue().then((items) => {
    $('cats').innerHTML = TILES.map((t) => {
      const n = items.filter((p) => p.categorySlug === t[1]).length;
      return '<a class="cat-tile" href="' + c(t[1]) + '"><img src="' + t[2] + '" alt="" loading="lazy"><span>' + esc(t[0]) + (n ? '<em>' + n + ' designs</em>' : '') + '</span></a>';
    }).join('');

    tabs($('tabs'), 'rail', [
      { label: 'All', filter: () => true },
      { label: 'Kanjivaram', filter: (p) => p.categorySlug === 'kanjivaram-silk' },
      { label: 'Banarasi', filter: (p) => p.categorySlug === 'banarasi' },
      { label: 'Soft Silk', filter: (p) => p.categorySlug === 'soft-silk' },
      { label: 'Cotton', filter: (p) => p.material === 'Cotton' }
    ], items);

    tabs($('occTabs'), 'occRail', ['Wedding', 'Reception', 'Festive', 'Puja', 'Daily Wear'].map((o) => ({ label: o, filter: (p) => p.occasion === o })), items);
  });
})();
