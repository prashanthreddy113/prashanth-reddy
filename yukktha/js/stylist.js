// Yukktha AI stylist chat (served by /ai/stylist). Shown only when the AI key is configured.
(function () {
  const Y = window.Yukktha; const esc = Y.esc;
  const KEY = 'yk_stylist';
  const SUGGEST = ['A red Kanjivaram for my wedding under ₹25,000', 'Something light and elegant for office', 'What is Kuppadam Pattu?', 'How do I care for a silk saree?'];
  const WELCOME = 'Namaste! I’m the Yukktha stylist. Tell me the occasion, colour or budget you have in mind, and I’ll pick sarees from our collection for you.';
  let history = []; try { history = JSON.parse(sessionStorage.getItem(KEY) || '[]'); } catch (e) { history = []; }
  const save = () => { try { sessionStorage.setItem(KEY, JSON.stringify(history.slice(-30))); } catch (e) { /* ignore */ } };
  const PEACOCK = '<svg viewBox="0 0 120 92" aria-hidden="true"><g fill="currentColor" stroke="currentColor" stroke-linecap="round"><g fill="none" stroke-width="5"><path d="M70,78 C46,86 24,80 16,62"/><path d="M72,70 C48,70 26,60 22,42"/><path d="M75,63 C54,56 38,44 40,28"/><path d="M79,57 C64,46 56,32 62,16"/></g><g stroke="none"><ellipse cx="16" cy="62" rx="6" ry="4.3"/><ellipse cx="22" cy="42" rx="6" ry="4.3"/><ellipse cx="40" cy="28" rx="6" ry="4.3"/><ellipse cx="62" cy="16" rx="6" ry="4.3"/><path d="M92,50 C80,47 71,57 74,71 C77,84 91,89 100,80 C107,73 107,59 100,52 C97,50 94,50 92,50 Z"/><circle cx="102" cy="34" r="9"/><path d="M108,31 L120,35 L108,39 Z"/></g><path d="M97,52 C99,45 100,40 101,36" fill="none" stroke-width="6"/></g></svg>';

  function fmt(text) {
    return esc(text).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').split(/\n+/).map((line) => /^\s*[-•]\s+/.test(line) ? '<li>' + line.replace(/^\s*[-•]\s+/, '') + '</li>' : '<p>' + line + '</p>').join('').replace(/(<li>.*?<\/li>)+/g, (m) => '<ul>' + m + '</ul>');
  }
  const img = (u) => !u ? 'assets/img/saree-3.jpg' : /^(https?:|data:)/.test(u) ? u : u;
  function cards(products) {
    if (!products || !products.length) return '';
    return '<div class="st-cards">' + products.map((p) => '<article class="st-card"><a href="product.html?id=' + encodeURIComponent(p.id) + '"><img src="' + esc(img(p.image)) + '" alt="" loading="lazy"></a><div><a class="st-name" href="product.html?id=' + encodeURIComponent(p.id) + '">' + esc(p.name) + '</a><span class="st-weave">' + esc(p.weave) + '</span><span class="st-price">' + Y.inr(p.price) + (p.discount ? ' <s>' + Y.inr(p.mrp) + '</s>' : '') + '</span>' +
      (p.inStock ? '<button type="button" class="st-add" data-add="' + esc(p.id) + '">Add to bag</button>' : '<span class="st-sold">Sold out</span>') + '</div></article>').join('') + '</div>';
  }

  function mount() {
    const root = document.createElement('div'); root.className = 'st'; root.innerHTML =
      '<button class="st-launch" type="button" aria-expanded="false" aria-controls="stPanel"><span class="st-launch-ico">' + PEACOCK + '</span><span class="st-launch-txt">Ask our stylist</span></button>' +
      '<section class="st-panel" id="stPanel" role="dialog" aria-label="Yukktha stylist" hidden>' +
      '<header class="st-head"><span class="st-avatar">' + PEACOCK + '</span><div><b>Yukktha Stylist</b><small><i class="st-dot"></i>AI · picks from today’s collection</small></div><button type="button" class="st-x" aria-label="Close">' + Y.ui.ICON.close + '</button></header>' +
      '<div class="st-log" id="stLog" aria-live="polite"></div>' +
      '<form class="st-form" id="stForm"><textarea id="stInput" rows="1" maxlength="600" placeholder="Ask about a saree, occasion or budget…" aria-label="Message"></textarea><button class="st-send" aria-label="Send"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h15M13 6l6 6-6 6"/></svg></button></form>' +
      '<p class="st-foot">AI stylist — it can make mistakes. Prices and stock on the cards are live. Need a person? <a target="_blank" rel="noopener" href="' + Y.waLink('Hello Yukktha, ') + '">WhatsApp us</a></p></section>';
    document.body.appendChild(root);
    const panel = root.querySelector('.st-panel'); const launch = root.querySelector('.st-launch'); const log = root.querySelector('#stLog'); const input = root.querySelector('#stInput'); const form = root.querySelector('#stForm');
    let busy = false;

    const draw = () => {
      log.innerHTML = '<div class="st-msg bot"><div class="st-bubble">' + fmt(WELCOME) + '</div></div>' +
        (history.length ? '' : '<div class="st-suggest">' + SUGGEST.map((s) => '<button type="button" data-q="' + esc(s) + '">' + esc(s) + '</button>').join('') + '</div>') +
        history.map((m) => '<div class="st-msg ' + (m.role === 'user' ? 'me' : 'bot') + '"><div class="st-bubble">' + (m.role === 'user' ? '<p>' + esc(m.content) + '</p>' : fmt(m.content)) + '</div>' + (m.products ? cards(m.products) : '') + '</div>').join('');
      log.scrollTop = log.scrollHeight;
    };
    const open = () => { panel.hidden = false; requestAnimationFrame(() => panel.classList.add('on')); launch.setAttribute('aria-expanded', 'true'); root.classList.add('open'); draw(); setTimeout(() => input.focus(), 250); };
    const close = () => { panel.classList.remove('on'); launch.setAttribute('aria-expanded', 'false'); root.classList.remove('open'); setTimeout(() => { panel.hidden = true; }, 300); };
    launch.addEventListener('click', () => (panel.hidden ? open() : close()));
    root.querySelector('.st-x').addEventListener('click', close);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !panel.hidden) close(); });
    input.addEventListener('input', () => { input.style.height = 'auto'; input.style.height = Math.min(110, input.scrollHeight) + 'px'; });
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); } });
    log.addEventListener('click', (e) => { const q = e.target.closest('[data-q]'); if (q) send(q.dataset.q); });
    form.addEventListener('submit', (e) => { e.preventDefault(); send(input.value); });

    async function send(text) {
      text = String(text || '').trim(); if (!text || busy) return;
      busy = true; input.value = ''; input.style.height = 'auto';
      history.push({ role: 'user', content: text.slice(0, 600) }); save(); draw();
      log.insertAdjacentHTML('beforeend', '<div class="st-msg bot st-typing"><div class="st-bubble"><i></i><i></i><i></i></div></div>'); log.scrollTop = log.scrollHeight;
      try {
        const res = await fetch('ai/stylist', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: history.map((m) => ({ role: m.role, content: m.content })).slice(-12) }) });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Please try again.');
        history.push({ role: 'assistant', content: data.reply, products: data.products || [] });
      } catch (err) {
        history.push({ role: 'assistant', content: (err && err.message) || 'Please try again.', products: [] });
      }
      save(); busy = false; draw();
    }
  }

  // Only appear when the AI key is set up on the server.
  const start = () => fetch('ai/stylist').then((r) => r.ok ? r.json() : { enabled: false }).then((s) => { if (s && s.enabled) mount(); }).catch(() => {});
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
