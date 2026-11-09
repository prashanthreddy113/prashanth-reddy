// Product detail page: gallery with hover zoom, price, stock, bag / WhatsApp ordering, details, related sarees.
(function () {
  const WEAVES = {
    'Kanjivaram Silk': 'Kanjivaram (Kanchipuram) silks are woven in Tamil Nadu from mulberry silk, known for their weight, lustre and zari borders. The body and border are often woven separately and joined by hand — the korvai technique — which is why the border colour can contrast so boldly with the body.',
    'Banarasi': 'Banarasi sarees come from Varanasi, where weavers create brocade patterns — butta, jaal and floral vines — by lifting extra threads into the weave. They are prized for intricate zari work and a regal, slightly structured drape.',
    'Kuppadam Pattu': 'Kuppadam is a Telugu weaving style in which the border is interlocked with the body of the saree using a comb-like technique, giving a seamless, durable join and a border that stays crisp pleat after pleat.',
    'Soft Silk': 'Soft silks are lighter and more fluid than traditional heavy silks, so they drape easily and are comfortable for long functions, while still carrying a gentle sheen and zari detailing.',
    'Soft Cotton': 'Handloom cottons are breathable and light — ideal for warm days, office wear and everyday elegance. They soften further with every wash.',
    'Designer / Party': 'Designer and party sarees bring contemporary colours, embellishments and finishes to traditional drapes, for receptions, sangeets and evening celebrations.'
  };
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
      // Desktop: every photo large, two to a row. Phones: swipe through them.
      '<div class="gallery2' + (p.images.length > 1 ? ' multi' : '') + '" id="gal">' + p.images.map((src, i) => '<button class="g-item" data-zoom="' + i + '" aria-label="View photo ' + (i + 1) + ' full screen"><img src="' + esc(src) + '" alt="' + esc(p.title) + (i ? ' — photo ' + (i + 1) : '') + '"' + (i > 1 ? ' loading="lazy"' : '') + '><span class="g-zoom">' + I.search + '</span></button>').join('') + '</div>' +
      (p.images.length > 1 ? '<div class="g-dots" id="gDots">' + p.images.map((_, i) => '<i class="' + (i ? '' : 'on') + '"></i>').join('') + '</div>' : '') +
      '<div class="pdp-info">' +
      '<p class="cat">' + esc(p.categoryTitle) + '</p>' +
      '<h1>' + esc(p.title) + '</h1>' +
      '<a class="pdp-rating" href="#reviewsWrap" id="pdpRating"></a>' +
      '<p class="pdp-price">' + (p.price ? '<span class="now">' + Y.inr(p.price) + '</span>' + (p.discount ? '<s>' + Y.inr(p.mrp) + '</s><span class="off">' + p.discount + '% off</span>' : '') : '<span class="now">Price on request</span>') + '</p>' +
      '<p class="tax">' + (p.price ? 'Delivered across India. We confirm availability and delivery on WhatsApp.' : 'Call or WhatsApp us for today’s price.') + '</p>' +
      stockLine(p) +
      '<div class="pdp-actions">' +
      (canBuy ? '<button class="btn btn-solid" id="addBag">Add to bag</button><button class="btn btn-buy" id="buyNow">Buy now</button>' : '<a class="btn btn-solid" href="tel:' + Y.CFG.phoneIntl + '">Call to enquire</a>') +
      '<button class="wish-lg' + (wished ? ' on' : '') + '" data-wish="' + esc(p.id) + '" aria-pressed="' + wished + '" aria-label="Save to wishlist">' + I.heart + '</button>' +
      '<a class="btn btn-wa" target="_blank" rel="noopener" href="' + Y.waLink(Y.enquiryText(p)) + '">' + I.wa + ' Order on WhatsApp</a>' +
      '</div>' +
      '<div class="assure"><div><strong>Handwoven</strong>Authentic weave</div><div><strong>Pan-India</strong>Delivery</div><div><strong>Video Call</strong>See it live</div></div>' +
      '<details class="acc" open><summary>Description' + I.chevD + '</summary><div class="acc-body">' + esc(p.description || 'A handpicked weave from the Yukktha collection.') + '</div></details>' +
      (WEAVES[p.category] ? '<details class="acc"><summary>About ' + esc(p.categoryTitle) + I.chevD + '</summary><div class="acc-body weave-note">' + WEAVES[p.category] + '</div></details>' : '') +
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
    const gal = $('gal');
    gal.addEventListener('click', (e) => { const b = e.target.closest('[data-zoom]'); if (b) lightbox(p, Number(b.dataset.zoom)); });
    if (window.matchMedia('(hover: hover)').matches) {
      gal.querySelectorAll('.g-item').forEach((it) => {
        const img = it.querySelector('img');
        it.addEventListener('mousemove', (e) => { const r = it.getBoundingClientRect(); img.style.transformOrigin = ((e.clientX - r.left) / r.width * 100) + '% ' + ((e.clientY - r.top) / r.height * 100) + '%'; });
        it.addEventListener('mouseenter', () => it.classList.add('zoom')); it.addEventListener('mouseleave', () => it.classList.remove('zoom'));
      });
    }
    const dots = $('gDots');
    if (dots) gal.addEventListener('scroll', () => { const i = Math.round(gal.scrollLeft / gal.clientWidth); [].forEach.call(dots.children, (d, k) => d.classList.toggle('on', k === i)); }, { passive: true });
    const buy = $('buyNow');
    if (buy) buy.addEventListener('click', () => {
      const inBag = (Y.bag.items().find((r) => r.id === p.id) || {}).qty || 0;
      if (!inBag) Y.bag.add(p.id, 1);
      location.href = 'checkout.html';
    });
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
    if (Y.account) reviews(p);
  }).catch(() => {
    $('pdp').innerHTML = '<div class="pdp-missing"><h1>Something went wrong</h1><p>Please call us on <a href="tel:' + Y.CFG.phoneIntl + '">' + Y.CFG.phone + '</a>.</p></div>';
  });

  // ---------- ratings & reviews ----------
  async function reviews(p) {
    const A = Y.account; const wrap = $('reviewsWrap');
    const { list, count, avg } = await A.ratingFor(p.id);
    $('pdpRating').innerHTML = count ? A.stars(avg) + '<span>' + avg.toFixed(1) + ' · ' + count + ' review' + (count > 1 ? 's' : '') + '</span>' : '<span class="no-rev">Be the first to review this saree</span>';
    const dist = [5, 4, 3, 2, 1].map((n) => ({ n, c: list.filter((r) => Math.round(r.rating) === n).length }));
    let shown = 4;
    const draw = () => {
      wrap.innerHTML = '<div class="rv-head"><h2>Ratings & reviews</h2><button class="btn btn-solid" id="rvWrite">Write a review</button></div>' +
        '<div class="rv-grid"><div class="rv-summary">' + (count
          ? '<div class="rv-avg"><strong>' + avg.toFixed(1) + '</strong>' + A.stars(avg, 'lg') + '<span>Based on ' + count + ' review' + (count > 1 ? 's' : '') + '</span></div>' +
            '<div class="rv-dist">' + dist.map((d) => '<div><span>' + d.n + ' ★</span><i><b style="width:' + (count ? d.c / count * 100 : 0) + '%"></b></i><em>' + d.c + '</em></div>').join('') + '</div>'
          : '<div class="rv-none"><p>No reviews yet.</p><p class="muted-p">Bought this saree? Share how it looked and felt — it helps other customers choose.</p></div>') + '</div>' +
        '<div class="rv-list">' + (list.length ? list.slice(0, shown).map((r) => '<article class="rv"><div class="rv-top">' + A.stars(r.rating) + (r.verified ? '<span class="rv-verified">✓ Verified buyer</span>' : '') + '</div>' + (r.title ? '<h3>' + esc(r.title) + '</h3>' : '') + '<p>' + esc(r.text) + '</p><footer>' + esc(r.name || 'Customer') + (r.source ? ' · ' + esc(({ store: 'Shared in store', whatsapp: 'Shared on WhatsApp', phone: 'Shared on a call', email: 'Shared by email', instagram: 'Shared on Instagram' })[r.source] || 'Shared with the shop') : '') + ' · ' + new Date(r.createdAt).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) + '</footer>' + (r.storeReply ? '<div class="rv-reply"><b>Yukktha replied</b>' + esc(r.storeReply) + '</div>' : '') + '</article>').join('') +
          (list.length > shown ? '<button class="btn btn-outline" id="rvMore">Show more reviews</button>' : '') : '') + '</div></div>';
      $('rvWrite').addEventListener('click', write);
      const more = $('rvMore'); if (more) more.addEventListener('click', () => { shown += 6; draw(); });
    };
    async function write() {
      await A.ready();
      if (!A.signedIn()) { location.href = 'account.html?next=' + encodeURIComponent('product.html?id=' + p.id + '#write-review'); return; }
      const dlg = document.createElement('div'); dlg.className = 'rv-modal';
      dlg.innerHTML = '<form class="rv-form" novalidate><button type="button" class="icon-btn rv-x" aria-label="Close">' + I.close + '</button><h3>Review this saree</h3><p class="rv-prod">' + esc(p.title) + '</p>' +
        '<div class="rv-pick" role="radiogroup" aria-label="Your rating">' + [1, 2, 3, 4, 5].map((n) => '<label><input type="radio" name="rating" value="' + n + '"><span aria-hidden="true">★</span><em class="sr">' + n + ' star</em></label>').join('') + '<b id="rvLbl">Tap to rate</b></div>' +
        '<label class="ck-field"><span>Headline <em>(optional)</em></span><input name="title" maxlength="120" placeholder="e.g. Stunning zari, perfect for my sister’s wedding"></label>' +
        '<label class="ck-field"><span>Your review</span><textarea name="text" rows="5" maxlength="2000" placeholder="How was the colour, drape, zari and quality? Where did you wear it?"></textarea></label>' +
        '<p class="acct-msg" id="rvMsg" hidden></p><button class="btn btn-solid btn-block">Submit review</button><p class="tiny-note">Reviews appear after a quick check by the Yukktha team. Posting as ' + esc(A.firstName()) + '.</p></form>';
      document.body.appendChild(dlg); document.body.classList.add('locked');
      const close = () => { dlg.remove(); document.body.classList.remove('locked'); };
      dlg.querySelector('.rv-x').addEventListener('click', close);
      dlg.addEventListener('mousedown', (e) => { if (e.target === dlg) close(); });
      const words = ['', 'Poor', 'Fair', 'Good', 'Very good', 'Loved it'];
      const pick = dlg.querySelector('.rv-pick');
      pick.addEventListener('change', (e) => { const v = Number(e.target.value); pick.querySelectorAll('label').forEach((l, i) => l.classList.toggle('on', i < v)); $('rvLbl').textContent = words[v]; });
      dlg.querySelector('form').addEventListener('submit', async (e) => {
        e.preventDefault(); const f = e.target; const m = $('rvMsg'); const btn = f.querySelector('.btn');
        const r = f.querySelector('input[name=rating]:checked');
        btn.disabled = true;
        try {
          await A.submitReview({ product: p, rating: r ? r.value : 0, title: f.title.value, text: f.text.value });
          f.innerHTML = '<div class="rv-thanks"><div class="ck-tick"><svg viewBox="0 0 52 52"><circle cx="26" cy="26" r="24"/><path d="M15 27l7 7 15-16"/></svg></div><h3>Thank you!</h3><p>Your review has been sent. It will appear here once the Yukktha team approves it.</p><button type="button" class="btn btn-outline" id="rvDone">Close</button></div>';
          $('rvDone').addEventListener('click', close);
        } catch (ex) { m.textContent = ex.message; m.className = 'acct-msg err'; m.hidden = false; btn.disabled = false; }
      });
      setTimeout(() => pick.querySelector('input').focus(), 50);
    }
    draw();
    if (location.hash === '#write-review') { wrap.scrollIntoView({ behavior: 'smooth' }); setTimeout(write, 600); }
  }

  // ---------- full-screen photo viewer ----------
  function lightbox(p, start) {
    let i = start; const n = p.images.length;
    const box = document.createElement('div'); box.className = 'lb'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', 'Photos of ' + p.title);
    box.innerHTML = '<button class="lb-x" aria-label="Close">' + I.close + '</button>' + (n > 1 ? '<button class="lb-prev" aria-label="Previous photo">' + I.chevL + '</button><button class="lb-next" aria-label="Next photo">' + I.chevR + '</button>' : '') +
      '<figure><img alt=""><figcaption></figcaption></figure>';
    const img = box.querySelector('img'); const cap = box.querySelector('figcaption');
    const show = () => { img.classList.remove('in'); img.src = p.images[i]; img.alt = p.title; cap.textContent = p.title + (n > 1 ? '  ·  ' + (i + 1) + ' / ' + n : ''); requestAnimationFrame(() => img.classList.add('in')); };
    const close = () => { box.classList.remove('on'); document.body.classList.remove('locked'); document.removeEventListener('keydown', key); setTimeout(() => box.remove(), 300); };
    const go = (d) => { i = (i + d + n) % n; show(); };
    const key = (e) => { if (e.key === 'Escape') close(); if (e.key === 'ArrowRight') go(1); if (e.key === 'ArrowLeft') go(-1); };
    box.addEventListener('click', (e) => { if (e.target.closest('.lb-x') || e.target === box) close(); else if (e.target.closest('.lb-next')) go(1); else if (e.target.closest('.lb-prev')) go(-1); });
    let sx = null; box.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; }, { passive: true });
    box.addEventListener('touchend', (e) => { if (sx == null) return; const dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1); sx = null; });
    document.body.appendChild(box); document.body.classList.add('locked'); document.addEventListener('keydown', key);
    show(); requestAnimationFrame(() => box.classList.add('on')); box.querySelector('.lb-x').focus();
  }
})();

