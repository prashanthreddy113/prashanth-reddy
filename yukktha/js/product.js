// Product detail page: gallery with hover zoom, price, stock, bag / WhatsApp ordering, details, related sarees.
(function () {
  const Y = window.Yukktha; const esc = Y.esc; const I = Y.ui.ICON;
  const $ = (id) => document.getElementById(id);
  const id = new URLSearchParams(location.search).get('id');

  function stockLine(p) {
    if (!p.inStock) return '<span class="stock out">Sold out — ask us for similar weaves</span>';
    if (p.stock !== Infinity && p.stock <= 3) return '<span class="stock low">Only ' + p.stock + ' left</span>';
    return '<span class="stock">In stock · ready to ship</span>';
  }

  function render(p, items) {
    document.title = p.title + ' | Yukktha — Timeless Royal Weaves';
    const c = Y.ui.coll;
    $('crumbs').innerHTML = '<a href="index.html">Home</a><span>/</span><a href="' + c(p.categorySlug) + '">' + esc(p.categoryTitle) + '</a><span>/</span><span>' + esc(p.title) + '</span>';
    const wished = Y.wishlist.has(p.id);
    const canBuy = p.inStock && p.price > 0;
    $('pdp').innerHTML = '<div class="pdp">' +
      '<div class="gallery">' +
      '<div class="thumbs" role="tablist">' + (p.images.length > 1 ? p.images.map((src, i) => '<button class="' + (i ? '' : 'on') + '" data-img="' + i + '" aria-label="Photo ' + (i + 1) + '"><img src="' + esc(src) + '" alt=""></button>').join('') : '') + '</div>' +
      '<div class="stage" id="stage"><img id="stageImg" src="' + esc(p.images[0]) + '" alt="' + esc(p.title) + '"></div></div>' +
      '<div class="pdp-info">' +
      '<p class="cat">' + esc(p.categoryTitle) + '</p>' +
      '<h1>' + esc(p.title) + '</h1>' +
      '<p class="pdp-price">' + (p.price ? '<span class="now">' + Y.inr(p.price) + '</span>' + (p.discount ? '<s>' + Y.inr(p.mrp) + '</s><span class="off">' + p.discount + '% off</span>' : '') : '<span class="now">Price on request</span>') + '</p>' +
      '<p class="tax">' + (p.price ? 'Delivered across India. We confirm availability and delivery on WhatsApp.' : 'Call or WhatsApp us for today’s price.') + '</p>' +
      stockLine(p) +
      '<div class="pdp-actions">' +
      (canBuy ? '<button class="btn btn-solid" id="addBag">Add to bag</button>' : '<a class="btn btn-solid" href="tel:' + Y.CFG.phoneIntl + '">Call to enquire</a>') +
      '<button class="wish-lg' + (wished ? ' on' : '') + '" data-wish="' + esc(p.id) + '" aria-pressed="' + wished + '" aria-label="Save to wishlist">' + I.heart + '</button>' +
      '<a class="btn btn-wa" target="_blank" rel="noopener" href="' + Y.waLink(Y.enquiryText(p)) + '">' + I.wa + ' Order on WhatsApp</a>' +
      '</div>' +
      '<div class="assure"><div><strong>Handwoven</strong>Authentic weave</div><div><strong>Pan-India</strong>Delivery</div><div><strong>Video Call</strong>See it live</div></div>' +
      '<details class="acc" open><summary>Description' + I.chevD + '</summary><div class="acc-body">' + esc(p.description || 'A handpicked weave from the Yukktha collection.') + '</div></details>' +
      '<details class="acc"><summary>Product details' + I.chevD + '</summary><div class="acc-body"><dl class="spec">' +
      '<dt>Weave</dt><dd>' + esc(p.categoryTitle) + '</dd>' +
      '<dt>Material</dt><dd>' + esc(p.material) + '</dd>' +
      '<dt>Colour</dt><dd>' + esc(p.shade || p.colour) + '</dd>' +
      (p.occasion ? '<dt>Occasion</dt><dd>' + esc(p.occasion) + '</dd>' : '') +
      '<dt>Blouse</dt><dd>' + (/blouse/i.test(p.description) ? 'Blouse piece included' : 'Ask us') + '</dd>' +
      '</dl></div></details>' +
      '<details class="acc"><summary>Care' + I.chevD + '</summary><div class="acc-body">Dry clean only for silks. Store folded in a muslin cloth and refold every few months to protect the zari.</div></details>' +
      '<details class="acc"><summary>Visit our stores' + I.chevD + '</summary><div class="acc-body">' + Y.CFG.stores.map((s) => '<p><strong>' + esc(s.label) + '</strong><br>' + esc(s.address) + '</p>').join('') + '<p>' + esc(Y.CFG.hours) + '</p></div></details>' +
      '</div></div>';

    // gallery
    const stage = $('stage'); const stageImg = $('stageImg');
    document.querySelectorAll('[data-img]').forEach((b) => b.addEventListener('click', () => {
      stageImg.src = p.images[Number(b.dataset.img)];
      document.querySelectorAll('[data-img]').forEach((x) => x.classList.toggle('on', x === b));
    }));
    if (window.matchMedia('(hover: hover)').matches) {
      stage.addEventListener('mousemove', (e) => {
        const r = stage.getBoundingClientRect();
        stageImg.style.transformOrigin = ((e.clientX - r.left) / r.width * 100) + '% ' + ((e.clientY - r.top) / r.height * 100) + '%';
      });
      stage.addEventListener('mouseenter', () => stage.classList.add('zoom'));
      stage.addEventListener('mouseleave', () => stage.classList.remove('zoom'));
    }
    const add = $('addBag');
    if (add) add.addEventListener('click', () => {
      const inBag = (Y.bag.items().find((r) => r.id === p.id) || {}).qty || 0;
      if (inBag >= p.stock) { Y.ui.toast('Only ' + p.stock + ' in stock'); return; }
      Y.bag.add(p.id, 1); Y.ui.openDrawer('bag');
    });

    // related: same weave first, then same colour
    const related = items.filter((x) => x.id !== p.id && x.category === p.category)
      .concat(items.filter((x) => x.id !== p.id && x.category !== p.category && x.colour === p.colour)).slice(0, 12);
    if (related.length) {
      $('relatedWrap').hidden = false;
      $('related').innerHTML = related.map((x) => Y.ui.card(x)).join('');
      document.querySelectorAll('[data-rail]').forEach((b) => {
        b.innerHTML = Number(b.dataset.rail) < 0 ? I.chevL : I.chevR;
        b.addEventListener('click', () => { const r = $('related'); r.scrollBy({ left: Number(b.dataset.rail) * r.clientWidth * 0.75, behavior: 'smooth' }); });
      });
    }
  }

  Y.loadCatalogue().then((items) => {
    const p = items.find((x) => x.id === id);
    if (!p) {
      $('pdp').innerHTML = '<div class="pdp-missing"><h1>Saree not found</h1><p>This saree may have been sold. Explore the rest of the collection.</p><a class="btn btn-solid" href="' + Y.ui.coll('all') + '">Shop all sarees</a></div>';
      return;
    }
    render(p, items);
  }).catch(() => {
    $('pdp').innerHTML = '<div class="pdp-missing"><h1>Something went wrong</h1><p>Please call us on <a href="tel:' + Y.CFG.phoneIntl + '">' + Y.CFG.phone + '</a>.</p></div>';
  });
})();
