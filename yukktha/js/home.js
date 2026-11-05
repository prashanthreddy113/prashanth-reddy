// Home page: hero film, trending tabs, Kanjivaram rail, heirloom showcase, live stats, stores with maps.
(function () {
  const Y = window.Yukktha; const esc = Y.esc; const I = Y.ui.ICON;
  const $ = (id) => document.getElementById(id);
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- hero film ----------
  // MP4 (H.264) first: every browser incl. iPhone Safari plays it; WebM is the fallback.
  // Phones get the portrait cut. Autoplay is retried on the first tap/scroll for
  // browsers that block it (e.g. iPhone Low Power Mode).
  const film = $('film');
  const mobile = window.matchMedia('(max-width: 720px)').matches;
  if (mobile) {
    film.poster = 'assets/video/hero-mobile-poster.jpg';
    [].forEach.call(film.querySelectorAll('source'), (s) => { s.src = s.dataset.mobile; });
    film.load();
  }
  film.muted = true; film.defaultMuted = true; film.playsInline = true;
  const pauseBtn = $('filmPause');
  const setPaused = (p) => { pauseBtn.classList.toggle('paused', p); pauseBtn.setAttribute('aria-label', p ? 'Play video' : 'Pause video'); };
  let userPaused = false;
  const tryPlay = () => {
    if (userPaused) return;
    const pr = film.play();
    if (pr && pr.then) pr.then(() => { setPaused(false); film.parentElement.classList.remove('still'); }).catch(() => { setPaused(true); film.parentElement.classList.add('still'); });
  };
  tryPlay();
  film.addEventListener('playing', () => { setPaused(false); film.parentElement.classList.remove('still'); });
  film.addEventListener('error', () => film.parentElement.classList.add('still'), true);
  const kick = () => { if (film.paused) tryPlay(); };
  ['touchstart', 'pointerdown', 'scroll', 'keydown'].forEach((ev) => window.addEventListener(ev, kick, { once: true, passive: true }));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) kick(); });
  pauseBtn.addEventListener('click', () => {
    if (film.paused) { userPaused = false; tryPlay(); } else { userPaused = true; film.pause(); setPaused(true); }
  });

  const slides = [].slice.call(document.querySelectorAll('.film-slide')); let si = 0; let timer;
  $('filmDots').innerHTML = slides.map((_, i) => '<button role="tab" aria-label="Slide ' + (i + 1) + '" class="' + (i ? '' : 'on') + '"><i></i></button>').join('');
  const dots = [].slice.call($('filmDots').children);
  const show = (n) => { slides[si].classList.remove('on'); dots[si].classList.remove('on'); si = (n + slides.length) % slides.length; slides[si].classList.add('on'); dots[si].classList.add('on'); };
  const auto = () => { clearInterval(timer); if (!reduceMotion) timer = setInterval(() => show(si + 1), 5500); };
  dots.forEach((d, i) => d.addEventListener('click', () => { show(i); auto(); }));
  auto();

  // ---------- video shopping / newsletter ----------
  $('vshopBtn').href = Y.waLink('Hello Yukktha, I would like to book a video call to see sarees. My preferred time is: ');
  $('nlForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const n = $('nlPhone').value.replace(/\D/g, '');
    if (n.length < 10) { Y.ui.toast('Enter a 10-digit WhatsApp number'); return; }
    window.open(Y.waLink('Hello Yukktha, please add me to your new arrivals list on WhatsApp. My number: ' + n), '_blank', 'noopener');
  });

  // ---------- stores with live maps ----------
  const stores = Y.CFG.stores;
  $('storeChips').innerHTML = '<button class="on" data-s="all">All</button>' + stores.map((s, i) => '<button data-s="' + i + '">' + esc(s.label) + '</button>').join('');
  $('storeList').innerHTML = stores.map((s, i) => '<article class="store-card" data-i="' + i + '"><div class="map"><iframe title="Map of ' + esc(s.label) + '" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="https://www.google.com/maps?q=' + encodeURIComponent(s.mapsQuery) + '&output=embed"></iframe></div>' +
    '<div class="store-body"><p class="store-kicker">Telangana · Hyderabad</p><h3>' + esc(s.label) + '</h3><address>' + esc(s.address) + '</address><p class="hours">Open ' + esc(Y.CFG.hours) + '</p>' +
    '<div class="store-links"><a target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(s.mapsQuery) + '">Directions</a><a href="tel:' + Y.CFG.phoneIntl + '">Call store</a><a target="_blank" rel="noopener" href="' + Y.waLink('Hello Yukktha ' + s.label + ', ') + '">WhatsApp</a></div></div></article>').join('');
  $('storeChips').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    [].forEach.call($('storeChips').children, (x) => x.classList.toggle('on', x === b));
    document.querySelectorAll('.store-card').forEach((c) => { c.hidden = b.dataset.s !== 'all' && c.dataset.i !== b.dataset.s; });
  });

  // ---------- heirloom hover showcase ----------
  const stage = $('heirStage'); const cap = $('heirCap');
  document.querySelectorAll('#heirList li').forEach((li) => {
    const activate = () => {
      document.querySelectorAll('#heirList li').forEach((x) => x.classList.toggle('on', x === li));
      const img = document.createElement('img'); img.src = li.dataset.img; img.alt = '';
      stage.appendChild(img); requestAnimationFrame(() => requestAnimationFrame(() => img.classList.add('on')));
      const old = [].slice.call(stage.querySelectorAll('img')).slice(0, -1);
      setTimeout(() => old.forEach((o) => o.remove()), 700);
      cap.textContent = li.querySelector('span').textContent + ' · ' + li.querySelector('b').textContent;
    };
    li.addEventListener('mouseenter', activate); li.addEventListener('focus', activate);
    li.addEventListener('click', () => { location.href = li.dataset.href; });
    li.tabIndex = 0; li.addEventListener('keydown', (e) => { if (e.key === 'Enter') location.href = li.dataset.href; });
  });

  // ---------- rails ----------
  document.querySelectorAll('[data-rail]').forEach((b) => {
    b.innerHTML = Number(b.dataset.rail) < 0 ? I.chevL : I.chevR;
    b.addEventListener('click', () => { const r = $(b.dataset.target || 'rail'); r.scrollBy({ left: Number(b.dataset.rail) * r.clientWidth * 0.8, behavior: 'smooth' }); });
  });
  const kan = $('kanRail');
  kan.addEventListener('scroll', () => { const max = kan.scrollWidth - kan.clientWidth; $('kanProg').style.width = (max > 0 ? 18 + 82 * kan.scrollLeft / max : 100) + '%'; }, { passive: true });

  function tabs(el, railId, options, items) {
    el.innerHTML = options.map((o, i) => '<button role="tab" class="' + (i ? '' : 'on') + '" data-i="' + i + '">' + esc(o.label) + '</button>').join('');
    const showTab = (i) => {
      el.querySelectorAll('button').forEach((b, k) => { b.classList.toggle('on', k === i); b.setAttribute('aria-selected', k === i); });
      const rail = $(railId);
      rail.innerHTML = items.filter(options[i].filter).slice(0, 12).map((p) => Y.ui.card(p)).join('') || '<p class="no-results">Coming soon.</p>';
      rail.scrollLeft = 0;
    };
    el.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) showTab(Number(b.dataset.i)); });
    showTab(0);
  }

  // count-up for stats when they scroll into view
  function countUp(el, to) {
    if (reduceMotion || !('IntersectionObserver' in window)) { el.textContent = to; return; }
    const io = new IntersectionObserver((ents) => {
      if (!ents[0].isIntersecting) return; io.disconnect();
      const t0 = performance.now();
      const step = (t) => { const k = Math.min(1, (t - t0) / 1200); el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(step); };
      requestAnimationFrame(step);
    });
    io.observe(el);
  }

  Y.loadCatalogue().then((items) => {
    tabs($('tabs'), 'rail', [
      { label: 'New arrivals', filter: () => true },
      { label: 'Kanjivaram', filter: (p) => p.categorySlug === 'kanjivaram-silk' },
      { label: 'Banarasi', filter: (p) => p.categorySlug === 'banarasi' },
      { label: 'Soft Silk', filter: (p) => p.categorySlug === 'soft-silk' },
      { label: 'Cotton', filter: (p) => p.material === 'Cotton' }
    ], items);
    kan.innerHTML = items.filter((p) => p.categorySlug === 'kanjivaram-silk').sort((a, b) => b.images.length - a.images.length).slice(0, 15).map((p) => Y.ui.card(p)).join('');
    kan.dispatchEvent(new Event('scroll'));
    const weaves = new Set(items.map((p) => p.category)).size;
    countUp($('statDesigns'), items.length); countUp($('statWeaves'), weaves);
    // live counts on mosaic tiles
    document.querySelectorAll('#mosaic .tile').forEach((t) => {
      const slug = new URL(t.href, location.href).searchParams.get('c');
      const c = Y.collections(items).find((x) => x.slug === slug); if (!c) return;
      const n = items.filter((p, i) => c.filter(p, i)).length; if (n) t.querySelector('em').textContent = n + ' designs · Shop now';
    });
  });
})();
