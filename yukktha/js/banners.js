// Admin-managed banners: home "spotlight" slideshow, site-wide top ribbon, offer pop-up.
// Reads projects/<slug>/banners where active == true (managed in the Yukktha admin). Also renders previews sent from the admin.
(function () {
  const Y = window.Yukktha; const CFG = Y.CFG; const F = CFG.firebase; const esc = Y.esc;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const THEMES = ['maroon', 'gold', 'emerald', 'rose', 'midnight'];

  // ---------- data ----------
  function val(v) { const k = Object.keys(v)[0]; const x = v[k]; if (k === 'integerValue' || k === 'doubleValue') return Number(x); if (k === 'booleanValue') return !!x; if (k === 'mapValue') { const o = {}; Object.keys(x.fields || {}).forEach((f) => { o[f] = val(x.fields[f]); }); return o; } if (k === 'arrayValue') return (x.values || []).map(val); if (k === 'nullValue') return null; return x; }
  async function load() {
    try {
      const res = await fetch('https://firestore.googleapis.com/v1/projects/' + F.projectId + '/databases/(default)/documents/projects/' + F.projectSlug + ':runQuery?key=' + encodeURIComponent(F.apiKey), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ structuredQuery: { from: [{ collectionId: 'banners' }], where: { fieldFilter: { field: { fieldPath: 'active' }, op: 'EQUAL', value: { booleanValue: true } } } } })
      });
      if (!res.ok) return [];
      return (await res.json()).filter((r) => r.document).map((r) => { const o = { id: r.document.name.split('/').pop() }; Object.keys(r.document.fields || {}).forEach((k) => { o[k] = val(r.document.fields[k]); }); return o; });
    } catch (e) { return []; }
  }
  const live = (b, now) => (!b.startAt || Date.parse(b.startAt) <= now) && (!b.endAt || Date.parse(b.endAt) > now);
  const order = (a, b) => (Number(b.priority) || 0) - (Number(a.priority) || 0) || String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
  const theme = (b) => THEMES.indexOf(b.theme) >= 0 ? b.theme : 'maroon';
  const linkOf = (b) => { const l = String(b.ctaLink || '').trim(); if (!l) return ''; if (/^\+?\d[\d\s-]{6,}$/.test(l)) return 'tel:' + l.replace(/[^\d+]/g, ''); if (/^(https?:|mailto:|tel:|[a-z0-9-]+\.html)/i.test(l)) return l; return 'collection.html?c=' + encodeURIComponent(l); };
  const ICON_X = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>';

  // ---------- shared pieces ----------
  function sparkles(n) { let h = ''; for (let i = 0; i < n; i++) { const s = 3 + Math.random() * 5; h += '<i style="left:' + (Math.random() * 100).toFixed(1) + '%;top:' + (Math.random() * 100).toFixed(1) + '%;width:' + s.toFixed(1) + 'px;height:' + s.toFixed(1) + 'px;animation-delay:' + (-Math.random() * 6).toFixed(2) + 's;animation-duration:' + (4 + Math.random() * 5).toFixed(2) + 's"></i>'; } return '<div class="bn-sparks" aria-hidden="true">' + h + '</div>'; }
  function letters(text) { return String(text || '').split(/(\s+)/).map((w) => /^\s+$/.test(w) ? w : '<span class="bn-word">' + [...w].map((ch, i) => '<span class="bn-ch" style="--i:' + i + '">' + esc(ch) + '</span>').join('') + '</span>').join(''); }
  function countdown(b) { return b.countdown && b.endAt ? '<div class="bn-count" data-end="' + esc(b.endAt) + '" aria-label="Offer ends in">' + ['Days', 'Hrs', 'Min', 'Sec'].map((l) => '<div><b><span>00</span></b><small>' + l + '</small></div>').join('') + '</div>' : ''; }
  function coupon(b) { return b.couponCode ? '<button type="button" class="bn-coupon" data-code="' + esc(b.couponCode) + '"><span class="bn-coupon-l">Use code</span><strong>' + esc(b.couponCode) + '</strong><span class="bn-coupon-r">Copy</span></button>' : ''; }
  function cta(b, cls) { const l = linkOf(b); return b.ctaLabel ? (l ? '<a class="bn-cta ' + (cls || '') + '" href="' + esc(l) + '">' : '<span class="bn-cta ' + (cls || '') + '">') + '<span>' + esc(b.ctaLabel) + '</span><i></i>' + (l ? '</a>' : '</span>') : ''; }

  function tickCountdowns(root) {
    const els = [].slice.call((root || document).querySelectorAll('.bn-count'));
    if (!els.length) return;
    const tick = () => els.forEach((el) => {
      let s = Math.max(0, Math.floor((Date.parse(el.dataset.end) - Date.now()) / 1000));
      const parts = [Math.floor(s / 86400), Math.floor(s % 86400 / 3600), Math.floor(s % 3600 / 60), s % 60];
      el.querySelectorAll('b').forEach((box, i) => {
        const v = String(parts[i]).padStart(2, '0'); const cur = box.firstChild;
        if (cur.textContent === v) return;
        if (reduce) { cur.textContent = v; return; }
        const nx = document.createElement('span'); nx.textContent = v; nx.className = 'in'; cur.className = 'out'; box.appendChild(nx);
        setTimeout(() => { if (cur.parentNode) cur.remove(); nx.className = ''; }, 450);
      });
    });
    tick(); setInterval(tick, 1000);
  }
  function confetti(x, y) {
    if (reduce) return;
    const colors = ['#f3dfae', '#d9b56f', '#7a1c2b', '#e9b6c1', '#ffffff', '#b48a46'];
    for (let i = 0; i < 46; i++) {
      const p = document.createElement('i'); p.className = 'bn-confetti';
      const ang = Math.random() * Math.PI * 2; const dist = 70 + Math.random() * 170;
      p.style.cssText = 'left:' + x + 'px;top:' + y + 'px;background:' + colors[i % colors.length] + ';--dx:' + (Math.cos(ang) * dist).toFixed(0) + 'px;--dy:' + (Math.sin(ang) * dist - 60).toFixed(0) + 'px;--r:' + (Math.random() * 720 - 360).toFixed(0) + 'deg;animation-delay:' + (Math.random() * 0.08).toFixed(2) + 's';
      document.body.appendChild(p); setTimeout(() => p.remove(), 1400);
    }
  }
  document.addEventListener('click', async (e) => {
    const c = e.target.closest('.bn-coupon'); if (!c) return;
    try { await navigator.clipboard.writeText(c.dataset.code); } catch (er) { /* clipboard blocked */ }
    const r = c.getBoundingClientRect(); confetti(r.left + r.width / 2, r.top + r.height / 2);
    c.classList.add('copied'); c.querySelector('.bn-coupon-r').textContent = 'Copied ✓';
    if (Y.ui && Y.ui.toast) Y.ui.toast('Code ' + c.dataset.code + ' copied — apply it at checkout');
    setTimeout(() => { c.classList.remove('copied'); c.querySelector('.bn-coupon-r').textContent = 'Copy'; }, 2600);
  });

  // ---------- spotlight (home) ----------
  function spotlightHTML(list) {
    return '<section class="bn-spot" aria-roledescription="carousel" aria-label="Offers">' + list.map((b, i) => '<article class="bn-slide bn-t-' + theme(b) + (i ? '' : ' on') + (b.imageUrl ? '' : ' no-img') + '" data-i="' + i + '">' +
      '<div class="bn-silk" aria-hidden="true"></div>' + sparkles(22) +
      '<div class="bn-inner"><div class="bn-copy">' + (b.kicker ? '<p class="bn-kicker">' + esc(b.kicker) + '</p>' : '') +
      '<h2 class="bn-title">' + letters(b.title) + '</h2>' + (b.message ? '<p class="bn-msg">' + esc(b.message) + '</p>' : '') +
      countdown(b) + '<div class="bn-actions">' + cta(b) + coupon(b) + '</div></div>' +
      (b.imageUrl ? '<div class="bn-media"><div class="bn-frame"><img src="' + esc(b.imageUrl) + '" alt=""><span class="bn-shine"></span></div><span class="bn-orbit"></span></div>' : '<div class="bn-media bn-emblem" aria-hidden="true">' + (Y.ui ? Y.ui.logo('') : '') + '</div>') +
      '</div></article>').join('') +
      (list.length > 1 ? '<div class="bn-dots">' + list.map((_, i) => '<button aria-label="Offer ' + (i + 1) + '" class="' + (i ? '' : 'on') + '"><i></i></button>').join('') + '</div>' : '') + '</section>';
  }
  function mountSpotlight(list, where) {
    if (!list.length || !where) return;
    where.insertAdjacentHTML('afterend', spotlightHTML(list));
    const sec = where.nextElementSibling; wireSpot(sec);
  }
  function wireSpot(sec) {
    const slides = [].slice.call(sec.querySelectorAll('.bn-slide')); const dots = [].slice.call(sec.querySelectorAll('.bn-dots button'));
    let i = 0; let timer;
    const show = (n) => { slides[i].classList.remove('on'); if (dots[i]) dots[i].classList.remove('on'); i = (n + slides.length) % slides.length; slides[i].classList.add('on'); if (dots[i]) dots[i].classList.add('on'); };
    const auto = () => { clearInterval(timer); if (slides.length > 1 && !reduce) timer = setInterval(() => show(i + 1), 7000); };
    dots.forEach((d, k) => d.addEventListener('click', () => { show(k); auto(); }));
    let sx = null; sec.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; }, { passive: true });
    sec.addEventListener('touchend', (e) => { if (sx == null || slides.length < 2) return; const dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 50) { show(i + (dx < 0 ? 1 : -1)); auto(); } sx = null; });
    sec.addEventListener('mouseenter', () => clearInterval(timer)); sec.addEventListener('mouseleave', auto);
    auto();
    // reveal (letters rise) when scrolled into view
    if ('IntersectionObserver' in window && !reduce) { const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { sec.classList.add('in'); io.disconnect(); } }), { threshold: 0.25 }); io.observe(sec); } else sec.classList.add('in');
    // 3D tilt of the photo
    if (!reduce && window.matchMedia('(hover: hover)').matches) sec.querySelectorAll('.bn-media').forEach((m) => {
      const f = m.querySelector('.bn-frame'); if (!f) return;
      m.addEventListener('mousemove', (e) => { const r = m.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width - 0.5; const y = (e.clientY - r.top) / r.height - 0.5; f.style.transform = 'rotateY(' + (x * 14).toFixed(2) + 'deg) rotateX(' + (-y * 12).toFixed(2) + 'deg) translateZ(0)'; });
      m.addEventListener('mouseleave', () => { f.style.transform = ''; });
    });
    tickCountdowns(sec);
  }

  // ---------- ribbon (every page) ----------
  function ribbonHTML(b) {
    const long = (String(b.title || '') + String(b.message || '')).length > 70;
    const text = '<span class="bn-rb-text"><b>' + esc(b.title || '') + '</b>' + (b.message ? ' <span>' + esc(b.message) + '</span>' : '') + (b.couponCode ? ' <em>Code ' + esc(b.couponCode) + '</em>' : '') + '</span>';
    return '<div class="bn-ribbon bn-t-' + theme(b) + '" data-id="' + esc(b.id) + '" role="region" aria-label="Offer"><span class="bn-rb-spark" aria-hidden="true">✦</span>' +
      '<div class="bn-rb-track' + (long && !reduce ? ' run' : '') + '"><div>' + text + (long && !reduce ? text + text : '') + '</div></div>' +
      (b.ctaLabel && linkOf(b) ? '<a class="bn-rb-cta" href="' + esc(linkOf(b)) + '">' + esc(b.ctaLabel) + ' →</a>' : '') +
      '<button class="bn-rb-x" aria-label="Dismiss offer">' + ICON_X + '</button></div>';
  }
  function mountRibbon(b) {
    try { if (sessionStorage.getItem('yk_rb_' + b.id)) return; } catch (e) { /* ignore */ }
    const top = document.querySelector('.announce'); if (!top) return;
    top.insertAdjacentHTML('beforebegin', ribbonHTML(b));
    const el = document.querySelector('.bn-ribbon');
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('on')));
    document.body.classList.add('has-ribbon');
    el.querySelector('.bn-rb-x').addEventListener('click', () => { el.classList.remove('on'); el.classList.add('off'); document.body.classList.remove('has-ribbon'); try { sessionStorage.setItem('yk_rb_' + b.id, '1'); } catch (e) { /* ignore */ } setTimeout(() => el.remove(), 500); });
  }

  // ---------- pop-up ----------
  function popupHTML(b) {
    let petals = ''; if (!reduce) for (let i = 0; i < 16; i++) petals += '<i style="left:' + (Math.random() * 100).toFixed(1) + '%;animation-delay:' + (Math.random() * 6).toFixed(2) + 's;animation-duration:' + (6 + Math.random() * 6).toFixed(2) + 's;--s:' + (0.6 + Math.random() * 0.8).toFixed(2) + '"></i>';
    return '<div class="bn-pop bn-t-' + theme(b) + '" role="dialog" aria-modal="true" aria-label="' + esc(b.title || 'Offer') + '"><div class="bn-petals" aria-hidden="true">' + petals + '</div>' +
      '<div class="bn-pop-card">' + '<button class="bn-pop-x" aria-label="Close">' + ICON_X + '</button>' +
      (b.imageUrl ? '<div class="bn-pop-img"><img src="' + esc(b.imageUrl) + '" alt=""><span class="bn-shine"></span></div>' : '') +
      '<div class="bn-pop-body"><div class="bn-silk" aria-hidden="true"></div>' + sparkles(12) + (b.kicker ? '<p class="bn-kicker">' + esc(b.kicker) + '</p>' : '') + '<h2 class="bn-title">' + letters(b.title) + '</h2>' + (b.message ? '<p class="bn-msg">' + esc(b.message) + '</p>' : '') +
      countdown(b) + '<div class="bn-actions">' + cta(b) + coupon(b) + '</div><button class="bn-pop-no">No thanks</button></div></div></div>';
  }
  function mountPopup(b, opts) {
    opts = opts || {};
    if (!opts.preview) { try { if (sessionStorage.getItem('yk_pop_' + b.id)) return; sessionStorage.setItem('yk_pop_' + b.id, '1'); } catch (e) { /* ignore */ } }
    const open = () => {
      document.body.insertAdjacentHTML('beforeend', popupHTML(b));
      const el = document.body.lastElementChild; document.body.classList.add('locked');
      requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('on')));
      const close = () => { el.classList.remove('on'); document.body.classList.remove('locked'); setTimeout(() => el.remove(), 500); document.removeEventListener('keydown', key); };
      const key = (e) => { if (e.key === 'Escape') close(); };
      document.addEventListener('keydown', key);
      el.addEventListener('click', (e) => { if (e.target === el || e.target.closest('.bn-pop-x, .bn-pop-no')) close(); if (e.target.closest('.bn-cta')) close(); });
      tickCountdowns(el);
    };
    setTimeout(open, opts.delay != null ? opts.delay : 3500);
  }

  // ---------- boot ----------
  function render(list, opts) {
    opts = opts || {};
    const now = Date.now();
    const on = list.filter((b) => opts.preview || live(b, now)).sort(order);
    const byStyle = (s) => on.filter((b) => (b.style || 'ribbon') === s);
    const home = document.body.classList.contains('home');
    const spots = byStyle('spotlight');
    if (spots.length && (home || opts.preview)) mountSpotlight(spots, document.getElementById('trust') || document.querySelector('main > :first-child'));
    const rb = byStyle('ribbon')[0]; if (rb && !(rb.pages === 'home' && !home)) mountRibbon(rb);
    const pop = byStyle('popup')[0]; if (pop && !(pop.pages === 'home' && !home)) mountPopup(pop, opts);
  }
  Y.banners = { render };

  // Live preview from the Yukktha admin (banner-preview.html in an iframe).
  if (document.body.classList.contains('bn-preview')) {
    window.addEventListener('message', (e) => {
      if (!/^https:\/\/yukktha-sarees-admin\.netlify\.app$|^http:\/\/localhost(:\d+)?$/.test(e.origin)) return;
      const b = e.data && e.data.yukkthaBanner; if (!b) return;
      document.querySelectorAll('.bn-spot, .bn-ribbon, .bn-pop').forEach((x) => x.remove()); document.body.classList.remove('locked', 'has-ribbon');
      render([{ ...b, id: 'preview', active: true }], { preview: true, delay: 200 });
    });
    if (window.parent !== window) window.parent.postMessage({ yukkthaPreviewReady: true }, '*');
    return;
  }
  const go = () => load().then((list) => render(list));
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
})();
