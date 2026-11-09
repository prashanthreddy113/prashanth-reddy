// Motion layer: scroll reveals, hero word reveal, header shrink, parallax, first-visit intro.
(function () {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isHome = document.body.classList.contains('home');

  // ---------- first-visit intro (home only, once per session) ----------
  if (isHome && !reduce) {
    let seen = false; try { seen = sessionStorage.getItem('yk_intro') === '1'; sessionStorage.setItem('yk_intro', '1'); } catch (e) { seen = true; }
    if (!seen && window.Yukktha && window.Yukktha.ui) {
      const intro = document.createElement('div'); intro.className = 'intro'; intro.setAttribute('aria-hidden', 'true');
      intro.innerHTML = window.Yukktha.ui.logo('') + '<span class="bar"></span>';
      document.body.appendChild(intro);
      const hide = () => { intro.classList.add('out'); setTimeout(() => intro.remove(), 800); };
      setTimeout(hide, 1700);
      intro.addEventListener('click', hide);
    }
  }

  // ---------- design preview switcher (only for people who opened a ?theme= link) ----------
  try {
    if (localStorage.getItem('yk_theme_preview') === '1') {
      const cur = localStorage.getItem('yk_theme') || 'royal';
      const sw = document.createElement('div'); sw.className = 'theme-switch'; sw.setAttribute('aria-label', 'Design preview');
      sw.innerHTML = '<b>Design</b>' + [['royal', 'Royal'], ['noir', 'Noir'], ['ivory', 'Ivory']].map(([k, l]) => '<a href="?theme=' + k + '" data-k="' + k + '" class="' + (k === cur ? 'on' : '') + '">' + l + '</a>').join('');
      sw.addEventListener('click', (e) => {
        const a = e.target.closest('[data-k]'); if (!a) return; e.preventDefault();
        localStorage.setItem('yk_theme', a.dataset.k);
        if (a.dataset.k === 'royal') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', a.dataset.k);
        sw.querySelectorAll('a').forEach((x) => x.classList.toggle('on', x === a));
      });
      const add = () => document.body.appendChild(sw);
      if (document.body) add(); else document.addEventListener('DOMContentLoaded', add);
    }
  } catch (e) { /* storage blocked */ }

  // ---------- hero: split slide titles into words ----------
  document.querySelectorAll('.film-slide h1, .film-slide .h1').forEach((h) => {
    const words = h.textContent.trim().split(/\s+/);
    h.innerHTML = words.map((w, i) => '<span class="w"><i style="transition-delay:' + (0.15 + i * 0.09) + 's">' + w.replace(/[<>&]/g, '') + '</i></span>').join(' ');
  });

  // ---------- header shrink ----------
  const hdr = () => document.getElementById('siteHeader');
  window.addEventListener('scroll', () => { const h = hdr(); if (h) h.classList.toggle('shrink', window.scrollY > 140); }, { passive: true });

  if (reduce || !('IntersectionObserver' in window)) return;

  // ---------- reveal on scroll ----------
  const GROUPS = [
    ['.sec-head, .feat-head, .stores-head, .rv-head, .acct-hello', 'rv-in', 0],
    ['.trust-row > div', 'rv-in', 0.08],
    ['.mosaic .tile', 'rv-zoom', 0.08],
    ['.occasions a', 'rv-in', 0.09],
    ['.usp > div', 'rv-in', 0.1],
    ['.heir-list > *', 'rv-in', 0.08],
    ['.story-copy > *', 'rv-in', 0.08],
    ['.story-art img', 'rv-zoom', 0.15],
    ['.vshop-in > *', 'rv-in', 0.1],
    ['.store-card', 'rv-in', 0.12],
    ['.insta-grid a', 'rv-zoom', 0.06],
    ['.nl-in > *', 'rv-in', 0.1],
    ['.foot-grid > div', 'rv-in', 0.07],
    ['.pdp-info > *', 'rv-in', 0.05],
    ['.rv-summary, .rv', 'rv-in', 0.06],
    ['.ck-sec, .ck-summary', 'rv-in', 0.06],
    ['.coll-intro, .chips', 'rv-in', 0]
  ];
  const io = new IntersectionObserver((ents) => ents.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  const railIo = new IntersectionObserver((ents) => ents.forEach((e) => { if (e.isIntersecting) { e.target.dataset.rvIn = '1'; [].forEach.call(e.target.children, (c) => c.classList.add('in')); railIo.unobserve(e.target); } }), { threshold: 0.05 });
  function prime(el, cls, step, i) {
    if (el.dataset.rv) return; el.dataset.rv = '1';
    // already on screen at load: show without the jump
    const r = el.getBoundingClientRect(); if (r.top < window.innerHeight * 0.9 && r.bottom > 0 && document.readyState !== 'complete' && !el.closest('.rail, .grid')) return;
    el.classList.add(cls); el.style.setProperty('--d', Math.min(i * step, 0.6) + 's'); io.observe(el);
  }
  function scan(root) {
    GROUPS.forEach(([sel, cls, step]) => {
      const parents = new Map();
      (root.querySelectorAll ? root : document).querySelectorAll(sel).forEach((el) => { const k = el.parentNode; const n = parents.get(k) || 0; parents.set(k, n + 1); prime(el, cls, step, n); });
    });
    // product cards in grids & rails: stagger by position in row
    (root.querySelectorAll ? root : document).querySelectorAll('.grid > .card').forEach((el) => {
      if (el.dataset.rv) return; el.dataset.rv = '1';
      const idx = Array.prototype.indexOf.call(el.parentNode.children, el);
      el.classList.add('rv-in'); el.style.setProperty('--d', ((idx % 5) * 0.07) + 's'); io.observe(el);
    });
    // carousels scroll sideways, so reveal every card when the carousel itself comes into view
    (root.querySelectorAll ? root : document).querySelectorAll('.rail > .card').forEach((el) => {
      if (el.dataset.rv) return; el.dataset.rv = '1';
      const rail = el.parentNode; const idx = Array.prototype.indexOf.call(rail.children, el);
      el.classList.add('rv-in'); el.style.setProperty('--d', (Math.min(idx, 5) * 0.08) + 's');
      if (rail.dataset.rvIn) { requestAnimationFrame(() => el.classList.add('in')); return; }
      if (!rail.dataset.rvWatch) { rail.dataset.rvWatch = '1'; railIo.observe(rail); }
    });
  }
  const start = () => {
    scan(document);
    new MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach((n) => { if (n.nodeType === 1) scan(n.parentNode || n); }))).observe(document.body, { childList: true, subtree: true });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(start, 0)); else start();

  // ---------- parallax (desktop) ----------
  if (!window.matchMedia('(hover: hover) and (min-width: 1000px)').matches) return;
  const px = () => [].slice.call(document.querySelectorAll('[data-parallax]'));
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (ticking) return; ticking = true;
    requestAnimationFrame(() => {
      const vh = window.innerHeight;
      px().forEach((el) => { const r = el.getBoundingClientRect(); if (r.bottom < 0 || r.top > vh) return; const k = Number(el.dataset.parallax) || 0.08; el.style.transform = 'translate3d(0,' + ((r.top + r.height / 2 - vh / 2) * -k).toFixed(1) + 'px,0)'; });
      ticking = false;
    });
  }, { passive: true });
})();
