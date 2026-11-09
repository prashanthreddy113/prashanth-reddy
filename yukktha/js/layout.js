// Shared chrome: announcement bar, header + menus, search, bag/wishlist drawers, footer.
(function () {
  const Y = window.Yukktha; const CFG = Y.CFG; const esc = Y.esc;

  // ---------- icons ----------
  const ICON = {
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
    heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M12 20s-7.5-4.6-7.5-10.1A4.4 4.4 0 0 1 12 7.4a4.4 4.4 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20Z"/></svg>',
    bag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M5 8h14l-1 12H6L5 8Z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/></svg>',
    user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="8" r="4"/><path d="M4.5 20.5c1.2-3.6 4-5.5 7.5-5.5s6.3 1.9 7.5 5.5"/></svg>',
    menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M3 6h18M3 12h18M3 18h18"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    chevL: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="m15 5-7 7 7 7"/></svg>',
    chevR: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="m9 5 7 7-7 7"/></svg>',
    chevD: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="m6 9 6 6 6-6"/></svg>',
    insta: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.3" cy="6.7" r="1" fill="currentColor" stroke="none"/></svg>',
    wa: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22c5.46 0 9.9-4.45 9.9-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm0 1.83c2.16 0 4.18.84 5.71 2.37a8.04 8.04 0 0 1 2.37 5.71c0 4.45-3.62 8.08-8.08 8.08a8.1 8.1 0 0 1-4.12-1.13l-.3-.18-3.12.82.83-3.04-.19-.31a8.05 8.05 0 0 1-1.24-4.32c0-4.45 3.62-8.07 8.07-8.07Zm-2.6 3.85c-.13 0-.34.05-.52.24-.18.19-.68.67-.68 1.62s.7 1.88.79 2.01c.1.13 1.37 2.19 3.4 2.99 1.68.66 2.03.53 2.39.5.36-.03 1.17-.48 1.34-.95.16-.46.16-.86.11-.94-.05-.08-.18-.13-.37-.22-.19-.1-1.17-.58-1.35-.64-.18-.07-.31-.1-.44.09-.13.19-.5.64-.62.77-.11.13-.23.15-.42.05-.19-.1-.82-.3-1.56-.96-.58-.51-.96-1.15-1.08-1.34-.11-.19-.01-.29.08-.39.09-.09.19-.23.29-.34.1-.12.13-.2.19-.33.06-.13.03-.24-.02-.34-.05-.1-.43-1.06-.6-1.45-.15-.38-.31-.33-.43-.33Z"/></svg>',
    phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M5 3h3.5l1.6 4.4-2.2 1.5a11 11 0 0 0 7.2 7.2l1.5-2.2L21 15.5V19a2 2 0 0 1-2.2 2A17 17 0 0 1 3 5.2 2 2 0 0 1 5 3Z"/></svg>',
    pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.5"/></svg>'
  };

  // Yukktha peacock logo (from the BrightLoop project assets), inlined so the
  // wordmark renders in the page's Cormorant Garamond / Poppins fonts.
  function logo(cls) {
    return '<svg class="' + (cls || '') + '" viewBox="0 0 292 70" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Yukktha — Timeless Royal Weaves">' +
      '<g fill="currentColor" stroke="currentColor"><g transform="translate(4,4) scale(0.52)" stroke-linecap="round" stroke-linejoin="round">' +
      '<g fill="none" stroke-width="4.4"><path d="M70,78 C46,86 24,80 16,62"/><path d="M72,70 C48,70 26,60 22,42"/><path d="M75,63 C54,56 38,44 40,28"/><path d="M79,57 C64,46 56,32 62,16"/><path d="M84,52 C78,40 80,26 90,18"/></g>' +
      '<g stroke="none" class="logo-eyes"><ellipse cx="16" cy="62" rx="6" ry="4.3" transform="rotate(-20 16 62)"/><ellipse cx="22" cy="42" rx="6" ry="4.3" transform="rotate(-35 22 42)"/><ellipse cx="40" cy="28" rx="6" ry="4.3" transform="rotate(-55 40 28)"/><ellipse cx="62" cy="16" rx="6" ry="4.3" transform="rotate(-70 62 16)"/><ellipse cx="90" cy="18" rx="6" ry="4.3" transform="rotate(-88 90 18)"/></g>' +
      '<path d="M16,62 C6,60 3,72 13,75 C21,77 22,66 15,66" fill="none" stroke-width="4"/>' +
      '<path d="M92,50 C80,47 71,57 74,71 C77,84 91,89 100,80 C107,73 107,59 100,52 C97,50 94,50 92,50 Z" stroke="none"/>' +
      '<path d="M97,52 C99,45 100,40 101,36" fill="none" stroke-width="5.6"/><circle cx="102" cy="34" r="9" stroke="none"/><path d="M108,31 L120,35 L108,39 Z" stroke="none"/>' +
      '<g stroke-width="3.2" fill="none"><path d="M98,29 L94,20"/><path d="M102,28 L102,17"/><path d="M106,29 L111,20"/></g>' +
      '<g stroke="none"><circle cx="93.5" cy="19" r="3.4"/><circle cx="102" cy="16" r="3.4"/><circle cx="111.5" cy="19" r="3.4"/></g></g>' +
      '<text x="82" y="42" stroke="none" font-family="\'Cormorant Garamond\', Georgia, serif" font-size="36" font-weight="500" letter-spacing="6">YUKKTHA</text>' +
      '<text x="84" y="58" stroke="none" class="logo-sub" font-family="\'Poppins\', Arial, sans-serif" font-size="9" font-weight="300" letter-spacing="2.5">TIMELESS ROYAL WEAVES</text></g></svg>';
  }

  const coll = (slug) => 'collection.html?c=' + encodeURIComponent(slug);
  const NAV = [
    { label: 'Kanjivaram', href: coll('kanjivaram-silk'), menu: [
      { title: 'Shop Kanjivaram', links: [['Kanjivaram Silk', coll('kanjivaram-silk')], ['Kuppadam Pattu', coll('kuppadam-pattu')], ['Bridal Sarees', coll('occasion-wedding')], ['Reception Sarees', coll('occasion-reception')]] },
      { image: 'assets/img/kanjivaram-peacock.jpg', caption: 'Signature Kanchi Pattu', href: coll('kanjivaram-silk') }
    ] },
    { label: 'Weave', href: coll('all'), menu: [
      { title: 'By Weave', links: [['Kanjivaram Silk', coll('kanjivaram-silk')], ['Banarasi', coll('banarasi')], ['Kuppadam Pattu', coll('kuppadam-pattu')], ['Soft Silk', coll('soft-silk')], ['Soft Cotton', coll('soft-cotton')], ['More Weaves', coll('other')]] },
      { title: 'By Material', links: [['Silk', coll('all') + '&material=Silk'], ['Cotton', coll('all') + '&material=Cotton']] },
      { image: 'assets/img/banarasi-red-butta.jpg', caption: 'Banarasi Butta', href: coll('banarasi') }
    ] },
    { label: 'Occasion', href: coll('all'), menu: [
      { title: 'Celebrations', links: [['Wedding', coll('occasion-wedding')], ['Reception', coll('occasion-reception')], ['Festive', coll('occasion-festive')], ['Special Occasion', coll('occasion-special-occasion')]] },
      { title: 'Everyday Grace', links: [['Puja', coll('occasion-puja')], ['Housewarming', coll('occasion-housewarming')], ['Daily Wear', coll('occasion-daily-wear')]] },
      { image: 'assets/img/kanjivaram-model.jpg', caption: 'Dressed for the muhurtham', href: coll('occasion-wedding') }
    ] },
    { label: 'Designer & Party', href: coll('designer-party') },
    { label: "What's New", href: coll('new-arrivals') },
    { label: 'Stores', href: 'index.html#stores' }
  ];
  const ANNOUNCEMENTS = [
    'Pan-India delivery',
    'Call or WhatsApp ' + CFG.phone + ' to order',
    'Book a video call to see sarees live',
    'Stores in New Nallakunta & Jubilee Hills'
  ];

  function header() {
    const nav = NAV.map((n, i) => {
      if (!n.menu) return '<li><a class="nav-link" href="' + n.href + '">' + esc(n.label) + '</a></li>';
      const cols = n.menu.map((c) => c.image
        ? '<a class="mega-feature" href="' + c.href + '"><img src="' + c.image + '" alt="" loading="lazy"><span>' + esc(c.caption) + '</span></a>'
        : '<div class="mega-col"><p class="mega-title">' + esc(c.title) + '</p>' + c.links.map((l) => '<a href="' + l[1] + '">' + esc(l[0]) + '</a>').join('') + '</div>').join('');
      return '<li class="has-mega"><a class="nav-link" href="' + n.href + '" aria-haspopup="true">' + esc(n.label) + '</a><div class="mega" role="menu"><div class="mega-inner">' + cols + '</div></div></li>';
    }).join('');
    return '' +
      '<a class="skip" href="#main">Skip to content</a>' +
      '<div class="announce" aria-label="Announcements"><button class="announce-btn" data-dir="-1" aria-label="Previous">' + ICON.chevL + '</button>' +
      '<div class="announce-track">' + ANNOUNCEMENTS.map((a, i) => '<p class="' + (i === 0 ? 'on' : '') + '">' + esc(a) + '</p>').join('') + '</div>' +
      '<button class="announce-btn" data-dir="1" aria-label="Next">' + ICON.chevR + '</button></div>' +
      '<header class="site-header" id="siteHeader"><div class="header-inner">' +
      '<button class="icon-btn menu-btn" id="menuBtn" aria-label="Open menu">' + ICON.menu + '</button>' +
      '<a class="logo" href="index.html" aria-label="Yukktha home">' + logo('logo-svg') + '</a>' +
      '<nav class="main-nav" aria-label="Primary"><ul>' + nav + '</ul></nav>' +
      '<div class="header-icons">' +
      '<button class="icon-btn" data-open="search" aria-label="Search">' + ICON.search + '</button>' +
      '<a class="icon-btn acct-btn" id="acctBtn" href="account.html" aria-label="My account">' + ICON.user + '<span class="acct-dot" hidden></span></a>' +
      '<button class="icon-btn" data-open="wish" aria-label="Wishlist">' + ICON.heart + '<span class="badge" id="wishCount" hidden></span></button>' +
      '<button class="icon-btn" data-open="bag" aria-label="Bag">' + ICON.bag + '<span class="badge" id="bagCount" hidden></span></button>' +
      '</div></div></header>';
  }

  function drawers() {
    const mobileNav = NAV.map((n) => {
      if (!n.menu) return '<a class="m-link" href="' + n.href + '">' + esc(n.label) + '</a>';
      const links = n.menu.filter((c) => c.links).map((c) => c.links.map((l) => '<a href="' + l[1] + '">' + esc(l[0]) + '</a>').join('')).join('');
      return '<details class="m-group"><summary>' + esc(n.label) + ICON.chevD + '</summary><div>' + links + '</div></details>';
    }).join('');
    return '' +
      '<div class="scrim" id="scrim"></div>' +
      '<aside class="drawer drawer-left" id="drawer-menu" aria-label="Menu"><div class="drawer-head"><span>Menu</span><button class="icon-btn" data-close aria-label="Close">' + ICON.close + '</button></div>' +
      '<div class="drawer-body m-nav">' + mobileNav +
      '<a class="m-link" href="account.html" id="mAcct">My account</a>' +
      '<div class="m-contact"><a href="tel:' + CFG.phoneIntl + '">' + ICON.phone + ' ' + CFG.phone + '</a><a href="https://wa.me/' + CFG.whatsapp + '" target="_blank" rel="noopener">' + ICON.wa + ' WhatsApp</a><a href="https://www.instagram.com/' + CFG.instagram + '/" target="_blank" rel="noopener">' + ICON.insta + ' @' + CFG.instagram + '</a></div></div></aside>' +
      '<aside class="drawer" id="drawer-bag" aria-label="Bag"><div class="drawer-head"><span>Your Bag</span><button class="icon-btn" data-close aria-label="Close">' + ICON.close + '</button></div><div class="drawer-body" id="bagBody"></div><div class="drawer-foot" id="bagFoot"></div></aside>' +
      '<aside class="drawer" id="drawer-wish" aria-label="Wishlist"><div class="drawer-head"><span>Wishlist</span><button class="icon-btn" data-close aria-label="Close">' + ICON.close + '</button></div><div class="drawer-body" id="wishBody"></div></aside>' +
      '<div class="search-panel" id="drawer-search" role="dialog" aria-label="Search"><form class="search-form" action="collection.html" method="get">' + ICON.search +
      '<input type="hidden" name="c" value="all"><input type="search" name="q" id="searchInput" placeholder="Search sarees, colours, weaves…" autocomplete="off" aria-label="Search">' +
      '<button type="button" class="icon-btn" data-close aria-label="Close">' + ICON.close + '</button></form>' +
      '<div class="search-results" id="searchResults"></div></div>' +
      '<div class="toast" id="toast" role="status" aria-live="polite"></div>' +
      '<a class="float-wa" href="https://wa.me/' + CFG.whatsapp + '" target="_blank" rel="noopener" aria-label="Chat on WhatsApp">' + ICON.wa + '</a>';
  }

  function footer() {
    const stores = CFG.stores.map((s) => '<a href="https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(s.mapsQuery) + '" target="_blank" rel="noopener">' + esc(s.label) + '</a>').join(' · ');
    return '<footer class="site-footer"><div class="container">' +
      '<div class="foot-grid">' +
      '<div class="foot-visit"><p class="foot-kicker">Visit us</p><p class="foot-h">2 stores in Hyderabad</p><p class="foot-stores">' + stores + '</p>' +
      '<a class="btn btn-solid" href="index.html#stores">Find a store</a><a class="btn btn-outline" href="https://wa.me/' + CFG.whatsapp + '?text=' + encodeURIComponent('Hello Yukktha, I would like to book a video call to see sarees.') + '" target="_blank" rel="noopener">Book video shopping</a></div>' +
      '<div><p class="foot-title">Contact us</p><a href="tel:' + CFG.phoneIntl + '">+91 ' + CFG.phone + '</a><a href="https://wa.me/' + CFG.whatsapp + '" target="_blank" rel="noopener">WhatsApp us</a><a href="https://www.instagram.com/' + CFG.instagram + '/" target="_blank" rel="noopener">@' + CFG.instagram + '</a><span>' + esc(CFG.hours) + '</span></div>' +
      '<div><p class="foot-title">Shop</p><a href="' + coll('kanjivaram-silk') + '">Kanjivaram Silk</a><a href="' + coll('banarasi') + '">Banarasi</a><a href="' + coll('kuppadam-pattu') + '">Kuppadam Pattu</a><a href="' + coll('soft-silk') + '">Soft Silk</a><a href="' + coll('soft-cotton') + '">Soft Cotton</a></div>' +
      '<div><p class="foot-title">Occasion</p><a href="' + coll('occasion-wedding') + '">Wedding</a><a href="' + coll('occasion-festive') + '">Festive</a><a href="' + coll('occasion-puja') + '">Puja</a><a href="' + coll('occasion-daily-wear') + '">Daily Wear</a></div>' +
      '<div><p class="foot-title">Help</p><a href="index.html#about">About Yukktha</a><a href="index.html#stores">Store Locator</a><a href="' + coll('new-arrivals') + '">New Arrivals</a><a href="https://wa.me/' + CFG.whatsapp + '?text=' + encodeURIComponent('Hello Yukktha, I need help with my order.') + '" target="_blank" rel="noopener">Track Order</a></div>' +
      '</div>' +
      '<div class="popular"><p class="popular-h">Popular searches</p><p>' + [
        ['Kanjivaram Sarees', coll('kanjivaram-silk')], ['Bridal Kanjivaram', coll('occasion-wedding')], ['Banarasi Sarees', coll('banarasi')], ['Kuppadam Pattu', coll('kuppadam-pattu')],
        ['Soft Silk', coll('soft-silk')], ['Cotton Sarees', coll('soft-cotton')], ['Party Wear', coll('designer-party')], ['Under ₹10,000', coll('under-10000')],
        ['Festive', coll('occasion-festive')], ['Puja Sarees', coll('occasion-puja')], ['Red Sarees', coll('all') + '&colour=Red'], ['Green Sarees', coll('all') + '&colour=Green'], ['Pink Sarees', coll('all') + '&colour=Pink']
      ].map((l) => '<a href="' + l[1] + '">' + esc(l[0]) + '</a>').join('<span>|</span>') + '</p></div>' +
      '<div class="foot-base"><a class="logo foot-logo" href="index.html" aria-label="Yukktha home">' + logo('logo-svg') + '</a>' +
      '<address>' + esc(CFG.stores[0].address) + '</address>' +
      '<div class="socials"><a href="https://www.instagram.com/' + CFG.instagram + '/" target="_blank" rel="noopener" aria-label="Instagram">' + ICON.insta + '</a><a href="https://wa.me/' + CFG.whatsapp + '" target="_blank" rel="noopener" aria-label="WhatsApp">' + ICON.wa + '</a><a href="tel:' + CFG.phoneIntl + '" aria-label="Call">' + ICON.phone + '</a></div></div>' +
      '<p class="copy">© ' + new Date().getFullYear() + ' - Yukktha · Timeless Royal Weaves. All Rights Reserved.</p>' +
      '</div></footer>';
  }

  // ---------- product card (shared) ----------
  function card(p, opts) {
    opts = opts || {};
    const on = Y.wishlist.has(p.id);
    const img2 = p.images[1];
    return '<article class="card' + (p.inStock ? '' : ' sold') + '" data-id="' + esc(p.id) + '"><div class="card-top">' +
      '<a class="card-media" href="' + Y.productLink(p) + '">' +
      '<img class="img-a" src="' + esc(p.images[0]) + '" alt="' + esc(p.title) + '" loading="lazy">' +
      (img2 ? '<img class="img-b" src="' + esc(img2) + '" alt="" loading="lazy">' : '') +
      (p.discount ? '<span class="tag tag-off">' + p.discount + '% off</span>' : (!p.inStock ? '<span class="tag tag-sold">Sold out</span>' : '')) +
      '</a>' +
      '<button class="wish-btn' + (on ? ' on' : '') + '" data-wish="' + esc(p.id) + '" aria-pressed="' + on + '" aria-label="Add ' + esc(p.title) + ' to wishlist">' + ICON.heart + '</button>' +
      (p.inStock && p.price ? '<button class="quick-add" data-add="' + esc(p.id) + '">Add to bag</button>' : '') +
      '</div><div class="card-info"><a class="card-title" href="' + Y.productLink(p) + '">' + esc(p.title) + '</a>' +
      (opts.showCategory ? '<span class="card-cat">' + esc(p.categoryTitle) + '</span>' : '') +
      '<p class="card-price">' + priceHtml(p) + '</p></div></article>';
  }
  function priceHtml(p) {
    if (!p.price) return '<span class="ask">Price on request</span>';
    return '<span class="now">' + Y.inr(p.price) + '</span>' + (p.discount ? ' <s>' + Y.inr(p.mrp) + '</s>' : '');
  }

  // ---------- behaviour ----------
  let items = [];
  const byId = (id) => items.find((p) => p.id === id);
  function openDrawer(name) {
    closeAll();
    const el = document.getElementById('drawer-' + name); if (!el) return;
    el.classList.add('open'); document.getElementById('scrim').classList.add('on');
    document.body.classList.add('locked');
    if (name === 'search') setTimeout(() => document.getElementById('searchInput').focus(), 50);
    if (name === 'bag') renderBag();
    if (name === 'wish') renderWish();
  }
  function closeAll() {
    document.querySelectorAll('.drawer.open, .search-panel.open').forEach((d) => d.classList.remove('open'));
    const s = document.getElementById('scrim'); if (s) s.classList.remove('on');
    document.body.classList.remove('locked');
  }
  let toastTimer;
  function toast(msg) {
    const t = document.getElementById('toast'); t.textContent = msg; t.classList.add('on');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('on'), 2200);
  }

  function renderCounts() {
    const b = Y.bag.count(); const w = Y.wishlist.ids().length;
    const bc = document.getElementById('bagCount'); const wc = document.getElementById('wishCount');
    bc.textContent = b; bc.hidden = !b; wc.textContent = w; wc.hidden = !w;
    document.querySelectorAll('[data-wish]').forEach((el) => {
      const on = Y.wishlist.has(el.getAttribute('data-wish'));
      el.classList.toggle('on', on); el.setAttribute('aria-pressed', on);
    });
  }
  function renderBag() {
    const body = document.getElementById('bagBody'); const foot = document.getElementById('bagFoot');
    const rows = Y.bag.items().map((r) => ({ p: byId(r.id), qty: r.qty })).filter((r) => r.p);
    if (!rows.length) {
      body.innerHTML = '<div class="empty"><p>Your bag is empty.</p><a class="btn btn-solid" href="' + coll('all') + '">Shop sarees</a></div>';
      foot.innerHTML = ''; return;
    }
    body.innerHTML = rows.map((r) => '<div class="line"><a href="' + Y.productLink(r.p) + '"><img src="' + esc(r.p.images[0]) + '" alt=""></a><div class="line-body">' +
      '<a class="line-title" href="' + Y.productLink(r.p) + '">' + esc(r.p.title) + '</a><span class="line-price">' + Y.inr(r.p.price) + '</span>' +
      '<div class="qty"><button data-qty="' + esc(r.p.id) + '" data-d="-1" aria-label="Decrease">−</button><span>' + r.qty + '</span><button data-qty="' + esc(r.p.id) + '" data-d="1" aria-label="Increase">+</button></div>' +
      '</div><button class="icon-btn line-x" data-remove="' + esc(r.p.id) + '" aria-label="Remove">' + ICON.close + '</button></div>').join('');
    const total = rows.reduce((s, r) => s + r.p.price * r.qty, 0);
    foot.innerHTML = '<div class="subtotal"><span>Subtotal</span><strong>' + Y.inr(total) + '</strong></div>' +
      '<p class="fine">Pan-India delivery. Pay online securely, or cash on delivery where available.</p>' +
      '<a class="btn btn-solid btn-block" href="checkout.html">Checkout · ' + Y.inr(total) + '</a>' +
      '<p class="pay-badges" aria-label="Payment options">UPI · Google Pay · PhonePe · Cards · Net banking · Cash on delivery</p>' +
      '<a class="btn btn-outline btn-block" target="_blank" rel="noopener" href="' + Y.waLink(Y.bagOrderText(rows)) + '">' + ICON.wa + ' Order on WhatsApp instead</a>';
  }
  function renderWish() {
    const body = document.getElementById('wishBody');
    const list = Y.wishlist.ids().map(byId).filter(Boolean);
    body.innerHTML = list.length
      ? '<div class="wish-grid">' + list.map((p) => card(p)).join('') + '</div>'
      : '<div class="empty"><p>Tap the heart on any saree to save it here.</p><a class="btn btn-solid" href="' + coll('all') + '">Shop sarees</a></div>';
  }
  function renderSearch(q) {
    const box = document.getElementById('searchResults');
    q = q.trim().toLowerCase();
    if (!q) { box.innerHTML = ''; return; }
    const hits = items.filter((p) => (p.title + ' ' + p.category + ' ' + p.colour + ' ' + (p.occasion || '')).toLowerCase().indexOf(q) !== -1);
    box.innerHTML = hits.length
      ? '<p class="sr-count">' + hits.length + ' result' + (hits.length > 1 ? 's' : '') + '</p><div class="sr-list">' + hits.slice(0, 6).map((p) => '<a class="sr-item" href="' + Y.productLink(p) + '"><img src="' + esc(p.images[0]) + '" alt=""><span><strong>' + esc(p.title) + '</strong><em>' + (p.price ? Y.inr(p.price) : 'Price on request') + '</em></span></a>').join('') + '</div>' +
        '<a class="btn btn-outline" href="collection.html?c=all&q=' + encodeURIComponent(q) + '">View all results</a>'
      : '<p class="sr-count">No sarees match “' + esc(q) + '”.</p>';
  }

  function mount() {
    document.body.insertAdjacentHTML('afterbegin', header());
    document.body.insertAdjacentHTML('beforeend', footer() + drawers());

    // announcement rotator
    const slides = [].slice.call(document.querySelectorAll('.announce-track p')); let ai = 0;
    const show = (d) => { slides[ai].classList.remove('on'); ai = (ai + d + slides.length) % slides.length; slides[ai].classList.add('on'); };
    document.querySelectorAll('.announce-btn').forEach((b) => b.addEventListener('click', () => show(Number(b.dataset.dir))));
    setInterval(() => show(1), 5000);

    // sticky header shadow
    const hdr = document.getElementById('siteHeader');
    const onScroll = () => hdr.classList.toggle('scrolled', window.scrollY > 33);
    window.addEventListener('scroll', onScroll, { passive: true }); onScroll();

    document.getElementById('menuBtn').addEventListener('click', () => openDrawer('menu'));
    document.getElementById('scrim').addEventListener('click', closeAll);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeAll(); });
    document.getElementById('searchInput').addEventListener('input', (e) => renderSearch(e.target.value));

    // one delegated handler for every page
    document.addEventListener('click', (e) => {
      const t = e.target.closest('[data-open],[data-close],[data-wish],[data-add],[data-qty],[data-remove]');
      if (!t) return;
      if (t.hasAttribute('data-open')) { e.preventDefault(); openDrawer(t.getAttribute('data-open')); }
      else if (t.hasAttribute('data-close')) { e.preventDefault(); closeAll(); }
      else if (t.hasAttribute('data-wish')) { e.preventDefault(); const on = Y.wishlist.toggle(t.getAttribute('data-wish')); toast(on ? 'Saved to wishlist' : 'Removed from wishlist'); if (document.getElementById('drawer-wish').classList.contains('open')) renderWish(); }
      else if (t.hasAttribute('data-add')) { e.preventDefault(); Y.bag.add(t.getAttribute('data-add'), 1); openDrawer('bag'); }
      else if (t.hasAttribute('data-qty')) {
        const id = t.getAttribute('data-qty'); const row = Y.bag.items().find((r) => r.id === id); const p = byId(id);
        if (row) {
          const next = row.qty + Number(t.getAttribute('data-d'));
          if (p && next > p.stock) { toast('Only ' + p.stock + ' in stock'); return; }
          Y.bag.setQty(id, next);
        }
        renderBag();
      } else if (t.hasAttribute('data-remove')) { Y.bag.setQty(t.getAttribute('data-remove'), 0); renderBag(); }
    });

    // account state in the header
    if (Y.account) Y.account.on((st) => {
      const b = document.getElementById('acctBtn'); const signed = !!(st.user && st.profile);
      b.querySelector('.acct-dot').hidden = !signed;
      b.setAttribute('aria-label', signed ? 'My account (' + Y.account.firstName() + ')' : 'Sign in');
      b.title = signed ? 'Hi ' + Y.account.firstName() : 'Sign in / create account';
      const m = document.getElementById('mAcct'); if (m) m.textContent = signed ? 'My account · ' + Y.account.firstName() : 'Sign in / create account';
    });
    // star ratings on every product card, wherever cards are drawn
    if (Y.account) Y.account.loadReviews().then((all) => {
      if (!all.length) return;
      const agg = {}; all.forEach((r) => { const a = agg[r.productId] = agg[r.productId] || { n: 0, sum: 0 }; a.n++; a.sum += Number(r.rating) || 0; });
      Y.ratings = agg;
      const deco = (root) => (root.querySelectorAll ? root.querySelectorAll('.card[data-id]:not([data-rated])') : []).forEach((c) => {
        c.setAttribute('data-rated', ''); const a = agg[c.getAttribute('data-id')]; if (!a) return;
        const info = c.querySelector('.card-info'); if (!info) return;
        info.insertAdjacentHTML('beforeend', '<span class="card-rating">' + Y.account.stars(a.sum / a.n) + '<em>(' + a.n + ')</em></span>');
      });
      deco(document);
      new MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach((n) => { if (n.nodeType === 1) deco(n.matches && n.matches('.card') ? n.parentNode : n); }))).observe(document.body, { childList: true, subtree: true });
    });
    Y.onChange(renderCounts);
    renderCounts();
    Y.loadCatalogue().then((list) => { items = list; renderCounts(); });
  }

  Y.ui = { ICON, logo, card, priceHtml, toast, openDrawer, coll };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})();
