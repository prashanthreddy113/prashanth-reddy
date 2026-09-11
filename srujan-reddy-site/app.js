/* Srujan Kumar Reddy Konda · Congress work organiser
 * Plain JavaScript, no build step. All data lives in this browser's localStorage. */
(function () {
  'use strict';

  const STORE_KEY = 'srujan-organiser-v1';
  const PHOTO_KEY = 'srujan-organiser-photos-v1';
  const SECTIONS = {
    political: { label: 'Political Work', colour: '#FF9933', icon: '✋' },
    work:      { label: 'Work Status',    colour: '#1a3a8a', icon: '📋' },
    business:  { label: 'Business Dealings', colour: '#138808', icon: '💼' },
  };
  const PRIORITY_COLOUR = { High: '#c0392b', Medium: '#FF9933', Low: '#138808' };

  const QUOTES = [
    'Nafrat ke bazaar mein mohabbat ki dukaan kholne aaya hoon.',
    'This is not a yatra to gain power; it is a yatra to unite India.',
    'Daro mat. Darao mat.',
    'The Constitution is the voice of every Indian. We will protect it.',
    'Jitni aabadi, utna haq.',
    'Politics should be about listening to people, not shouting at them.',
  ];

  const TIMELINE = [
    { year: '2004', text: 'Elected to the Lok Sabha from Amethi for the first time.' },
    { year: '2007', text: 'Appointed General Secretary of the All India Congress Committee.' },
    { year: '2013', text: 'Became Vice-President of the Indian National Congress.' },
    { year: '2017', text: 'Elected President of the Indian National Congress.' },
    { year: '2022–23', text: 'Led the Bharat Jodo Yatra — about 4,000 km on foot from Kanyakumari to Kashmir.' },
    { year: '2024', text: 'Bharat Jodo Nyay Yatra from Manipur to Mumbai; elected from Rae Bareli.' },
    { year: '2024', text: 'Took charge as Leader of the Opposition in the Lok Sabha.' },
  ];

  const today = () => new Date().toISOString().slice(0, 10);
  const daysFrom = (d) => Math.round((new Date(d) - new Date(today())) / 86400000);
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const rupee = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  /* ---------------- Sample data ---------------- */
  function sampleData() {
    const d = (offset) => { const x = new Date(); x.setDate(x.getDate() + offset); return x.toISOString().slice(0, 10); };
    const base = { sample: true, updated: Date.now() };
    return {
      political: [
        { ...base, id: uid(), title: 'Booth committee meeting – Ward 12', status: 'Planned', priority: 'High', date: d(3), category: 'Meeting', person: 'Block President', progress: 20, notes: 'Finalise booth-level agents list and voter slip distribution plan.' },
        { ...base, id: uid(), title: 'Congress membership drive – 200 new members', status: 'In progress', priority: 'High', date: d(14), category: 'Membership', person: 'Youth Congress team', progress: 55, notes: '112 enrolled so far. Target colleges and self-help groups this week.' },
        { ...base, id: uid(), title: 'Public grievance camp – drinking water issue', status: 'Planned', priority: 'Medium', date: d(7), category: 'Public grievance', person: 'Municipal Commissioner', progress: 0, notes: 'Collect petitions from Colony 4 & 5; submit to MRO.' },
        { ...base, id: uid(), title: 'Rahul Gandhi rally – volunteer coordination', status: 'Done', priority: 'High', date: d(-10), category: 'Rally', person: 'District Congress Committee', progress: 100, notes: 'Arranged 40 volunteers and 3 buses. Great turnout!' },
      ],
      work: [
        { ...base, id: uid(), title: 'Submit ration card applications (18 families)', status: 'In progress', priority: 'High', date: d(2), category: 'Applications', person: 'MeeSeva centre', progress: 60, notes: '11 submitted, 7 pending Aadhaar copies.' },
        { ...base, id: uid(), title: 'Follow up: road repair request, Main Bazaar', status: 'On hold', priority: 'Medium', date: d(-1), category: 'Follow-up', person: 'Ward Councillor', progress: 30, notes: 'Waiting for estimate from the engineering dept.' },
        { ...base, id: uid(), title: 'Meet farmers on crop insurance claims', status: 'Planned', priority: 'Medium', date: d(5), category: 'Meeting', person: 'Rythu Sangham', progress: 0, notes: '' },
      ],
      business: [
        { ...base, id: uid(), title: 'Construction material supply – Phase 2', status: 'In progress', priority: 'High', date: d(10), category: 'Contract', person: 'Sri Lakshmi Builders', amount: 450000, flow: 'in', progress: 40, notes: 'Second instalment due on delivery of steel.' },
        { ...base, id: uid(), title: 'Transport vendor payment – August', status: 'Planned', priority: 'Medium', date: d(4), category: 'Payment', person: 'KRT Logistics', amount: 85000, flow: 'out', progress: 0, notes: 'Verify trip sheets before releasing.' },
        { ...base, id: uid(), title: 'New partnership discussion – agri warehousing', status: 'Planned', priority: 'Low', date: d(20), category: 'Partnership', person: 'Mr. Venkat Rao', amount: 0, flow: 'none', progress: 10, notes: 'Initial call done. Share land documents.' },
      ],
      rgNotes: '',
    };
  }

  /* ---------------- State ---------------- */
  let state = load();
  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) { const s = JSON.parse(raw); for (const k of Object.keys(SECTIONS)) s[k] = s[k] || []; return s; }
    } catch (e) { console.warn('Could not read saved data', e); }
    return sampleData();
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
    catch (e) { toast('⚠️ Could not save — storage full or blocked.'); }
  }

  /* ---------------- Photos ---------------- */
  function initPhotos() {
    let photos = {};
    try { photos = JSON.parse(localStorage.getItem(PHOTO_KEY) || '{}'); } catch (e) { /* ignore */ }
    for (const who of ['rahul', 'srujan']) {
      const img = $('#photo-' + who);
      if (photos[who]) img.src = photos[who];
      img.addEventListener('error', () => img.classList.add('missing'));
      img.addEventListener('load', () => img.classList.remove('missing'));
      if (img.complete && img.naturalWidth === 0) img.classList.add('missing');
    }
    const input = $('#photo-input');
    let target = null;
    $$('[data-upload]').forEach((b) => b.addEventListener('click', () => { target = b.dataset.upload; input.value = ''; input.click(); }));
    $$('.portrait .fallback').forEach((f) => f.addEventListener('click', () => { target = f.closest('.portrait').dataset.photo; input.value = ''; input.click(); }));
    input.addEventListener('change', () => {
      const file = input.files && input.files[0];
      if (!file || !target) return;
      // Downscale to keep localStorage small
      const reader = new FileReader();
      reader.onload = () => {
        const im = new Image();
        im.onload = () => {
          const size = 480, c = document.createElement('canvas'); c.width = c.height = size;
          const ctx = c.getContext('2d');
          const s = Math.min(im.width, im.height);
          ctx.drawImage(im, (im.width - s) / 2, (im.height - s) / 2, s, s, 0, 0, size, size);
          const url = c.toDataURL('image/jpeg', 0.85);
          photos[target] = url;
          try { localStorage.setItem(PHOTO_KEY, JSON.stringify(photos)); } catch (e) { toast('⚠️ Photo too large to save.'); }
          $('#photo-' + target).src = url;
          toast('📷 Photo updated');
        };
        im.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  /* ---------------- Rendering ---------------- */
  const filters = { political: {}, work: {}, business: {} };

  function render() {
    renderStats();
    renderUpcoming();
    renderRecent();
    for (const sec of Object.keys(SECTIONS)) renderList(sec);
    renderMoney();
    renderCategories();
  }

  function allItems() {
    return Object.keys(SECTIONS).flatMap((sec) => state[sec].map((it) => ({ ...it, section: sec })));
  }

  function renderStats() {
    const items = allItems();
    const open = items.filter((i) => i.status !== 'Done');
    const overdue = open.filter((i) => i.date && daysFrom(i.date) < 0);
    const week = open.filter((i) => i.date && daysFrom(i.date) >= 0 && daysFrom(i.date) <= 7);
    const cards = [
      { c: '#FF9933', num: state.political.filter((i) => i.status !== 'Done').length, lbl: 'Political tasks open', sub: `${state.political.length} total`, tab: 'political' },
      { c: '#1a3a8a', num: state.work.filter((i) => i.status !== 'Done').length, lbl: 'Work items open', sub: `${state.work.length} total`, tab: 'work' },
      { c: '#138808', num: state.business.filter((i) => i.status !== 'Done').length, lbl: 'Business dealings open', sub: `${state.business.length} total`, tab: 'business' },
      { c: '#c0392b', num: overdue.length, lbl: 'Overdue', sub: 'past due date', tab: null },
      { c: '#e07b00', num: week.length, lbl: 'Due this week', sub: 'next 7 days', tab: null },
      { c: '#1c6b17', num: items.filter((i) => i.status === 'Done').length, lbl: 'Completed', sub: 'all sections', tab: null },
    ];
    $('#stats').innerHTML = cards.map((c) => `
      <div class="stat" style="--c:${c.c}" ${c.tab ? `data-goto="${c.tab}"` : ''}>
        <div class="num">${c.num}</div><div class="lbl">${c.lbl}</div><div class="sub">${c.sub}</div>
      </div>`).join('');
    $$('#stats [data-goto]').forEach((el) => el.addEventListener('click', () => showTab(el.dataset.goto)));
  }

  function whenLabel(date) {
    if (!date) return '';
    const n = daysFrom(date);
    if (n < 0) return `<span class="when overdue">${-n} day${n === -1 ? '' : 's'} overdue</span>`;
    if (n === 0) return `<span class="when overdue">Today</span>`;
    if (n === 1) return `<span class="when">Tomorrow</span>`;
    return `<span class="when">in ${n} days · ${date}</span>`;
  }

  function renderUpcoming() {
    const list = allItems().filter((i) => i.status !== 'Done' && i.date).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 8);
    $('#upcoming').innerHTML = list.length ? list.map((i) => `
      <li><span><span class="sec">${SECTIONS[i.section].icon} ${SECTIONS[i.section].label}</span>${esc(i.title)}</span>${whenLabel(i.date)}</li>`).join('')
      : '<li class="empty">Nothing scheduled. Add tasks with a date to see them here.</li>';
  }

  function renderRecent() {
    const list = allItems().sort((a, b) => (b.updated || 0) - (a.updated || 0)).slice(0, 6);
    $('#recent').innerHTML = list.length ? list.map((i) => `
      <li><span><span class="sec">${SECTIONS[i.section].icon} ${SECTIONS[i.section].label}</span>${esc(i.title)}</span><span class="when">${i.status}</span></li>`).join('')
      : '<li class="empty">No entries yet.</li>';
  }

  function renderList(sec) {
    const f = filters[sec];
    const q = (f.search || '').toLowerCase();
    let items = state[sec].filter((i) =>
      (!f.status || i.status === f.status) &&
      (!f.priority || i.priority === f.priority) &&
      (!q || [i.title, i.notes, i.category, i.person].join(' ').toLowerCase().includes(q)));
    const order = { High: 0, Medium: 1, Low: 2 };
    items.sort((a, b) => (a.status === 'Done') - (b.status === 'Done') || order[a.priority] - order[b.priority] || (a.date || '9').localeCompare(b.date || '9'));
    const root = $('#list-' + sec);
    if (!items.length) {
      root.innerHTML = `<div class="empty">No ${SECTIONS[sec].label.toLowerCase()} entries match. Click “＋ Add” to create one.</div>`;
      return;
    }
    root.innerHTML = items.map((i) => `
      <article class="item ${i.status === 'Done' ? 'done' : ''} ${i.sample ? 'sample' : ''}" style="--pc:${PRIORITY_COLOUR[i.priority] || '#FF9933'}" data-id="${i.id}">
        <div class="title">${esc(i.title)}</div>
        <div class="meta">
          <span class="badge" data-s="${esc(i.status)}">${esc(i.status)}</span>
          <span class="badge">${esc(i.priority)} priority</span>
          ${i.date ? `<span class="badge">📅 ${i.date}</span>` : ''}
          ${i.category ? `<span class="badge">🏷️ ${esc(i.category)}</span>` : ''}
          ${i.person ? `<span class="badge">👤 ${esc(i.person)}</span>` : ''}
          ${sec === 'business' && i.flow && i.flow !== 'none' ? `<span class="badge money-${i.flow}">${i.flow === 'in' ? '⬇️ Receivable' : '⬆️ Payable'} ${rupee(i.amount)}</span>` : ''}
        </div>
        <div class="progress" title="${i.progress || 0}% complete"><span style="width:${i.progress || 0}%"></span></div>
        ${i.notes ? `<div class="notes">${esc(i.notes)}</div>` : ''}
        <div class="actions">
          ${i.status !== 'Done' ? `<button class="icon-btn" data-act="done">✅ Mark done</button>` : `<button class="icon-btn" data-act="reopen">↩️ Reopen</button>`}
          <button class="icon-btn" data-act="edit">✏️ Edit</button>
          <button class="icon-btn danger" data-act="delete">🗑️</button>
        </div>
      </article>`).join('');
  }

  function renderMoney() {
    const open = state.business.filter((i) => i.status !== 'Done');
    const sum = (arr, flow) => arr.filter((i) => i.flow === flow).reduce((a, i) => a + Number(i.amount || 0), 0);
    const inOpen = sum(open, 'in'), outOpen = sum(open, 'out');
    const done = state.business.filter((i) => i.status === 'Done');
    $('#money-summary').innerHTML = `
      <div class="stat" style="--c:#138808"><div class="num">${rupee(inOpen)}</div><div class="lbl">To receive (open deals)</div></div>
      <div class="stat" style="--c:#c0392b"><div class="num">${rupee(outOpen)}</div><div class="lbl">To pay (open deals)</div></div>
      <div class="stat" style="--c:#1a3a8a"><div class="num">${rupee(inOpen - outOpen)}</div><div class="lbl">Net position (open)</div></div>
      <div class="stat" style="--c:#FF9933"><div class="num">${rupee(sum(done, 'in'))}</div><div class="lbl">Received (closed deals)</div></div>`;
  }

  function renderCategories() {
    const cats = [...new Set(allItems().map((i) => i.category).filter(Boolean))].sort();
    $('#category-list').innerHTML = cats.map((c) => `<option value="${esc(c)}">`).join('');
  }

  /* ---------------- Tabs ---------------- */
  function showTab(name) {
    $$('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === name));
    $$('.panel').forEach((p) => p.classList.toggle('active', p.id === 'tab-' + name));
    if (name === 'rahul') animateTimeline();
    try { localStorage.setItem(STORE_KEY + ':tab', name); } catch (e) { /* ignore */ }
    window.scrollTo({ top: Math.min(window.scrollY, $('.tabs').offsetTop - 8), behavior: 'smooth' });
  }

  /* ---------------- Modal ---------------- */
  const modal = $('#modal'), form = $('#item-form');
  function openModal(sec, item) {
    form.reset();
    form.section.value = sec;
    form.id.value = item ? item.id : '';
    $('#modal-title').textContent = (item ? 'Edit ' : 'Add ') + SECTIONS[sec].label.toLowerCase().replace(/s$/, '') + ' entry';
    $('.business-only').hidden = sec !== 'business';
    if (item) {
      for (const k of ['title', 'status', 'priority', 'date', 'category', 'person', 'amount', 'flow', 'progress', 'notes']) {
        if (form[k] && item[k] !== undefined) form[k].value = item[k];
      }
    } else {
      form.date.value = today();
      form.flow.value = sec === 'business' ? 'in' : 'none';
    }
    $('#progress-out').value = form.progress.value;
    modal.hidden = false;
    setTimeout(() => form.title.focus(), 50);
  }
  function closeModal() { modal.hidden = true; }

  form.progress.addEventListener('input', () => { $('#progress-out').value = form.progress.value; });
  form.status.addEventListener('change', () => { if (form.status.value === 'Done') { form.progress.value = 100; $('#progress-out').value = 100; } });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const sec = form.section.value;
    const data = {
      title: form.title.value.trim(),
      status: form.status.value,
      priority: form.priority.value,
      date: form.date.value,
      category: form.category.value.trim(),
      person: form.person.value.trim(),
      progress: Number(form.progress.value),
      notes: form.notes.value.trim(),
      updated: Date.now(),
    };
    if (sec === 'business') { data.amount = Number(form.amount.value || 0); data.flow = form.flow.value; }
    if (data.status === 'Done') data.progress = 100;
    if (form.id.value) {
      const idx = state[sec].findIndex((i) => i.id === form.id.value);
      if (idx > -1) state[sec][idx] = { ...state[sec][idx], ...data, sample: false };
      toast('✏️ Updated');
    } else {
      state[sec].unshift({ id: uid(), ...data });
      toast('✅ Added to ' + SECTIONS[sec].label);
    }
    save(); render(); closeModal();
  });
  $('#modal-cancel').addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal.hidden) closeModal(); });

  /* ---------------- Item actions ---------------- */
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const card = btn.closest('.item'), sec = card.closest('[data-section]').dataset.section;
    const item = state[sec].find((i) => i.id === card.dataset.id);
    if (!item) return;
    switch (btn.dataset.act) {
      case 'done': item.status = 'Done'; item.progress = 100; item.updated = Date.now(); toast('✅ Marked done'); break;
      case 'reopen': item.status = 'In progress'; item.progress = Math.min(item.progress, 90); item.updated = Date.now(); break;
      case 'edit': openModal(sec, item); return;
      case 'delete':
        if (!confirm(`Delete "${item.title}"?`)) return;
        state[sec] = state[sec].filter((i) => i.id !== item.id); toast('🗑️ Deleted'); break;
    }
    save(); render();
  });

  $$('[data-add]').forEach((b) => b.addEventListener('click', () => openModal(b.dataset.add)));
  $$('.tab').forEach((t) => t.addEventListener('click', () => showTab(t.dataset.tab)));

  /* Filters */
  $$('[data-search]').forEach((el) => el.addEventListener('input', () => { filters[el.dataset.search].search = el.value; renderList(el.dataset.search); }));
  $$('[data-filter-status]').forEach((el) => el.addEventListener('change', () => { filters[el.dataset.filterStatus].status = el.value; renderList(el.dataset.filterStatus); }));
  $$('[data-filter-priority]').forEach((el) => el.addEventListener('change', () => { filters[el.dataset.filterPriority].priority = el.value; renderList(el.dataset.filterPriority); }));

  /* ---------------- Tools ---------------- */
  $('#btn-export').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `srujan-organiser-backup-${today()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast('⬇️ Backup downloaded');
  });
  $('#import-file').addEventListener('change', (e) => {
    const file = e.target.files[0]; if (!file) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const data = JSON.parse(r.result);
        if (!data || typeof data !== 'object') throw new Error('bad');
        if (!confirm('Replace all current data with this backup?')) return;
        state = { political: [], work: [], business: [], rgNotes: '', ...data };
        save(); render(); $('#rg-notes').value = state.rgNotes || ''; toast('⬆️ Backup restored');
      } catch (err) { toast('⚠️ That file is not a valid backup.'); }
      e.target.value = '';
    };
    r.readAsText(file);
  });
  $('#btn-print').addEventListener('click', () => window.print());
  $('#btn-clear-sample').addEventListener('click', () => {
    const n = allItems().filter((i) => i.sample).length;
    if (!n) return toast('No sample entries left.');
    if (!confirm(`Remove ${n} sample entries?`)) return;
    for (const sec of Object.keys(SECTIONS)) state[sec] = state[sec].filter((i) => !i.sample);
    save(); render(); toast('🧹 Sample entries removed');
  });

  /* ---------------- Rahul Gandhi corner ---------------- */
  $('#timeline').innerHTML = TIMELINE.map((t) => `<div class="tl-item"><div class="year">${t.year}</div><div>${t.text}</div></div>`).join('');
  function animateTimeline() {
    $$('.tl-item').forEach((el, i) => { el.classList.remove('show'); setTimeout(() => el.classList.add('show'), 80 + i * 120); });
  }
  const notes = $('#rg-notes');
  notes.value = state.rgNotes || '';
  let nt; notes.addEventListener('input', () => { clearTimeout(nt); nt = setTimeout(() => { state.rgNotes = notes.value; save(); }, 400); });

  $('#quote-text').textContent = QUOTES[new Date().getDate() % QUOTES.length];

  /* ---------------- Confetti ---------------- */
  (function confetti() {
    const box = $('#confetti'); if (!box) return;
    const colours = ['#FF9933', '#ffffff', '#138808'];
    const frag = document.createDocumentFragment();
    for (let i = 0; i < 24; i++) {
      const el = document.createElement('i');
      el.style.left = Math.random() * 100 + 'vw';
      el.style.background = colours[i % 3];
      el.style.animationDuration = 9 + Math.random() * 9 + 's';
      el.style.animationDelay = -Math.random() * 18 + 's';
      el.style.transform = `scale(${0.6 + Math.random()})`;
      if (i % 3 === 1) el.style.boxShadow = '0 0 0 1px rgba(0,0,0,.08)';
      frag.appendChild(el);
    }
    box.appendChild(frag);
  })();

  /* ---------------- Toast ---------------- */
  let toastTimer;
  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 2200);
  }

  /* ---------------- Boot ---------------- */
  initPhotos();
  render();
  let startTab = 'dashboard';
  try { startTab = localStorage.getItem(STORE_KEY + ':tab') || 'dashboard'; } catch (e) { /* ignore */ }
  if (!SECTIONS[startTab] && startTab !== 'rahul') startTab = 'dashboard';
  showTab(startTab);
})();
