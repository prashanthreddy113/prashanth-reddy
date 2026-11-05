// Catalogue, bag and wishlist for the Yukktha storefront.
(function () {
  const CFG = window.YUKKTHA_CONFIG;

  // ---------- helpers ----------
  const slugify = (s) => String(s || '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const inr = (n) => '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN');
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const storage = {
    get(key, fallback) { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; } },
    set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* private mode */ } }
  };

  // ---------- facets derived from the admin's free-text fields ----------
  // Base colour families, matched against the saree name (e.g. "Peacock Blue Banarasi").
  const COLOUR_RULES = [
    ['Maroon', /maroon|wine/i], ['Pink', /pink|magenta|rani/i], ['Red', /red|coral|peacock 1/i],
    ['Orange', /orange|rust/i], ['Brown', /copper|brown/i], ['Yellow', /yellow|mustard|turmeric|gold/i],
    ['Green', /green|teal|emerald/i], ['Blue', /blue|navy/i], ['Purple', /purple|violet|lavender/i],
    ['Cream', /cream|ivory|white|off.?white/i], ['Black', /black/i], ['Grey', /grey|gray|silver/i]
  ];
  const SWATCH = {
    Maroon: '#6d1426', Pink: '#d63a83', Red: '#c0262d', Orange: '#e0702a', Brown: '#8a5232', Yellow: '#e0b232',
    Green: '#1f7a4d', Blue: '#2153a3', Purple: '#6a2c8c', Cream: '#efe4cf', Black: '#1b1b1b', Grey: '#9a9a9a', Multi: 'conic-gradient(#c0262d,#e0b232,#1f7a4d,#2153a3,#6a2c8c,#c0262d)'
  };
  const OCCASIONS = {
    weddings: 'Wedding', receptions: 'Reception', festivals: 'Festive', pujas: 'Puja',
    housewarmings: 'Housewarming', 'special occasions': 'Special Occasion', 'daily elegance': 'Daily Wear'
  };
  const colourOf = (name) => { for (const [c, re] of COLOUR_RULES) if (re.test(name)) return c; return 'Multi'; };
  const shadeOf = (name, category) => {
    const s = String(name || '').replace(category || '', '').replace(/designer\s*party/i, '').replace(/saree/i, '').trim();
    return s && s.length < 24 ? s : '';
  };
  const occasionOf = (desc) => { const m = /ideal for ([^.]+)\./i.exec(desc || ''); return m ? (OCCASIONS[m[1].toLowerCase()] || null) : null; };

  // Category banners and order, matching the admin's category list.
  const CATEGORY_META = {
    'Kanjivaram Silk': { image: 'assets/img/kanjivaram-peacock.jpg', blurb: 'Pure Kanchipuram silk, handwoven with rich zari borders, temple motifs and contrast pallus.' },
    'Banarasi': { image: 'assets/img/banarasi-red-butta.jpg', blurb: 'Timeless brocade and intricate butta from the looms of Varanasi, with a regal finish.' },
    'Kuppadam Pattu': { image: 'assets/img/saree-4.jpg', blurb: 'Interlocked kuppadam borders and gleaming zari — a South Indian heirloom weave.' },
    'Soft Silk': { image: 'assets/img/saree-2.jpg', blurb: 'Feather-light silks with gentle sheen, easy to drape from morning pujas to evening functions.' },
    'Soft Cotton': { image: 'assets/img/saree-1.jpg', blurb: 'Light, breathable handloom cottons — elegant everyday comfort.' },
    'Designer / Party': { image: 'assets/img/kanjivaram-model.jpg', blurb: 'Contemporary drapes and embellishments that turn heads at every celebration.' },
    'Other': { image: 'assets/img/saree-3.jpg', blurb: 'More handpicked weaves from our looms.', title: 'More Weaves' }
  };
  const FALLBACK_IMAGES = ['assets/img/saree-1.jpg', 'assets/img/saree-2.jpg', 'assets/img/saree-3.jpg', 'assets/img/saree-4.jpg'];

  // The admin stores built-in photos as "assets/saree-N.jpg"; ours live in assets/img/.
  const fixImage = (u) => (typeof u === 'string' && /^assets\/saree-\d\.jpg$/.test(u)) ? u.replace('assets/', 'assets/img/') : u;

  function normalise(raw) {
    const mrp = Number(raw.sellPrice) || Number(String(raw.price || '').replace(/[^0-9.]/g, '')) || 0;
    const discount = Math.min(100, Math.max(0, Number(raw.discountPercent) || 0));
    const price = Math.round(mrp * (1 - discount / 100));
    const images = [];
    [raw.imageUrl].concat(Array.isArray(raw.images) ? raw.images : []).forEach((u) => {
      u = fixImage(u);
      if (u && images.indexOf(u) === -1) images.push(u);
    });
    if (!images.length) images.push(FALLBACK_IMAGES[0]);
    let stock = Infinity;
    if (raw.stockMode === 'availability') stock = raw.available === false ? 0 : Infinity;
    else if (raw.quantity != null) stock = Math.max(0, Number(raw.quantity) || 0);
    const category = raw.category || 'Other';
    // Title-case admin entries like "Kanjivaram green silk saree".
    const name = String(raw.name || 'Saree').trim().replace(/\b([a-z])/g, (m) => m.toUpperCase());
    return {
      id: raw._id,
      name,
      title: /saree$/i.test(name) ? name : name + ' Saree',
      category,
      categoryTitle: (CATEGORY_META[category] && CATEGORY_META[category].title) || category,
      categorySlug: slugify(category),
      mrp, discount, price,
      images,
      description: raw.description || '',
      colour: colourOf(name),
      shade: shadeOf(name, category),
      occasion: occasionOf(raw.description),
      material: /cotton/i.test(category) ? 'Cotton' : 'Silk',
      createdAt: raw.createdAt ? Date.parse(raw.createdAt) || 0 : 0,
      stock,
      inStock: stock > 0
    };
  }

  // ---------- loading ----------
  function fsValue(v) {
    const k = Object.keys(v)[0]; const x = v[k];
    if (k === 'arrayValue') return (x.values || []).map(fsValue);
    if (k === 'mapValue') { const o = {}; Object.keys(x.fields || {}).forEach((f) => { o[f] = fsValue(x.fields[f]); }); return o; }
    if (k === 'integerValue') return Number(x);
    if (k === 'nullValue') return null;
    return x;
  }
  async function fetchLive() {
    const f = CFG.firebase;
    const base = 'https://firestore.googleapis.com/v1/projects/' + f.projectId + '/databases/(default)/documents/projects/' + f.projectSlug + '/sarees';
    const out = []; let token = '';
    const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), 7000);
    try {
      do {
        const res = await fetch(base + '?pageSize=300&key=' + encodeURIComponent(f.apiKey) + (token ? '&pageToken=' + encodeURIComponent(token) : ''), { signal: ctrl.signal });
        if (!res.ok) throw new Error('Firestore ' + res.status);
        const body = await res.json();
        (body.documents || []).forEach((d) => {
          const o = {}; Object.keys(d.fields || {}).forEach((k) => { o[k] = fsValue(d.fields[k]); });
          o._id = d.name.split('/').pop();
          out.push(o);
        });
        token = body.nextPageToken || '';
      } while (token);
    } finally { clearTimeout(timer); }
    if (!out.length) throw new Error('Empty catalogue');
    return out;
  }
  async function fetchSnapshot() {
    const res = await fetch('data/sarees.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error('snapshot ' + res.status);
    return res.json();
  }

  let catalogue = null;
  async function loadCatalogue() {
    if (catalogue) return catalogue;
    catalogue = (async () => {
      let raw;
      if (CFG.liveCatalogue) {
        try { raw = await fetchLive(); } catch (e) { console.warn('Live catalogue unavailable, using snapshot:', e.message); }
      }
      if (!raw) raw = await fetchSnapshot();
      const items = raw.map(normalise).sort((a, b) => b.createdAt - a.createdAt);
      return items;
    })();
    return catalogue;
  }

  // ---------- collections ----------
  function collections(items) {
    const cats = [];
    items.forEach((p) => { if (cats.indexOf(p.category) === -1) cats.push(p.category); });
    const order = Object.keys(CATEGORY_META);
    cats.sort((a, b) => (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99));
    const list = [
      { slug: 'all', title: 'All Sarees', image: 'assets/img/kanjivaram-peacock.jpg', blurb: 'Every drape in the Yukktha collection, handpicked from master weavers.', filter: () => true },
      { slug: 'new-arrivals', title: "What's New", image: 'assets/img/banarasi-red-butta.jpg', blurb: 'Fresh off the loom — our latest arrivals.', filter: (p, i) => i < 24 },
      { slug: 'under-10000', title: 'Under ₹10,000', image: 'assets/img/saree-1.jpg', blurb: 'Handwoven elegance, thoughtfully priced.', filter: (p) => p.price > 0 && p.price < 10000 }
    ];
    cats.forEach((c) => {
      const m = CATEGORY_META[c] || {};
      list.push({ slug: slugify(c), title: m.title || c, image: m.image || FALLBACK_IMAGES[2], blurb: m.blurb || '', category: c, filter: (p) => p.category === c });
    });
    Object.values(OCCASIONS).forEach((o) => {
      list.push({ slug: 'occasion-' + slugify(o), title: o + ' Sarees', image: 'assets/img/kanjivaram-model.jpg', blurb: 'Sarees chosen for ' + o.toLowerCase() + ' moments.', occasion: o, filter: (p) => p.occasion === o });
    });
    return list;
  }

  // ---------- bag & wishlist ----------
  const listeners = [];
  const emit = () => listeners.forEach((fn) => fn());
  const bag = {
    items() { return storage.get('yk_bag', []); },
    count() { return bag.items().reduce((s, i) => s + i.qty, 0); },
    add(id, qty) {
      const list = bag.items(); const row = list.find((i) => i.id === id);
      if (row) row.qty += qty || 1; else list.push({ id, qty: qty || 1 });
      storage.set('yk_bag', list); emit();
    },
    setQty(id, qty) {
      let list = bag.items();
      if (qty <= 0) list = list.filter((i) => i.id !== id);
      else list.forEach((i) => { if (i.id === id) i.qty = qty; });
      storage.set('yk_bag', list); emit();
    },
    clear() { storage.set('yk_bag', []); emit(); }
  };
  const wishlist = {
    ids() { return storage.get('yk_wish', []); },
    has(id) { return wishlist.ids().indexOf(id) !== -1; },
    toggle(id) {
      let ids = wishlist.ids();
      const on = ids.indexOf(id) === -1;
      ids = on ? ids.concat(id) : ids.filter((x) => x !== id);
      storage.set('yk_wish', ids); emit();
      return on;
    }
  };

  // ---------- WhatsApp ordering ----------
  function waLink(text) { return 'https://wa.me/' + CFG.whatsapp + '?text=' + encodeURIComponent(text); }
  function productLink(p) { return 'product.html?id=' + encodeURIComponent(p.id); }
  function absolute(path) { try { return new URL(path, location.href).href; } catch (e) { return path; } }
  function enquiryText(p) {
    return 'Hello Yukktha, I would like to order:\n' + p.title + (p.price ? ' — ' + inr(p.price) : '') + '\n' + absolute(productLink(p));
  }
  function bagOrderText(rows) {
    const lines = rows.map((r, i) => (i + 1) + '. ' + r.p.title + ' × ' + r.qty + (r.p.price ? ' — ' + inr(r.p.price * r.qty) : ''));
    const total = rows.reduce((s, r) => s + r.p.price * r.qty, 0);
    return 'Hello Yukktha, I would like to order:\n' + lines.join('\n') + (total ? '\n\nTotal: ' + inr(total) : '') + '\n\nPlease confirm availability and delivery.';
  }

  window.Yukktha = {
    CFG, slugify, inr, esc, SWATCH,
    loadCatalogue, collections, bag, wishlist,
    onChange(fn) { listeners.push(fn); },
    waLink, productLink, enquiryText, bagOrderText
  };
  // Keep tabs in sync.
  window.addEventListener('storage', (e) => { if (e.key === 'yk_bag' || e.key === 'yk_wish') emit(); });
})();
