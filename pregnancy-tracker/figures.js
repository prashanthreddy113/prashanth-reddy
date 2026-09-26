/* Animated stretch demonstrations. Each stretch has two key poses (a → b) drawn as a figure with a bump;
   the figure eases between them in an 8-second breathing cycle. Coordinates live in a 240 × 160 box, ground at y = 150. */
const Figures = (() => {
  // Joints: h head, n neck, s1/s2 shoulders (front views), c spine curve, p hip,
  // e/w elbow/hand, k/f knee/foot (1 = far side, 2 = near side), b bump [x, y, r], g pelvic-floor pulse [x, y, r].
  const POSES = {
    catcow: {
      props: [{ t: 'mat' }],
      cue: ['Breathe out · round your back (cat)', 'Breathe in · belly drops, look up (cow)'],
      a: { h: [172, 68], n: [150, 86], p: [80, 86], c: [115, 104], e1: [148, 118], w1: [146, 148], e2: [152, 118], w2: [154, 148], k1: [78, 148], f1: [38, 148], k2: [84, 148], f2: [44, 148], b: [115, 110, 13] },
      b: { h: [164, 104], n: [150, 84], p: [80, 84], c: [115, 56], b: [115, 97, 13] },
    },
    child: {
      props: [{ t: 'mat' }],
      cue: ['Breathe out · sink your hips back', 'Breathe in · return to all fours'],
      a: { h: [170, 78], n: [150, 86], p: [82, 86], c: [116, 82], e1: [148, 118], w1: [146, 148], e2: [152, 118], w2: [154, 148], k1: [82, 148], f1: [40, 148], k2: [88, 148], f2: [46, 148], b: [116, 104, 13] },
      b: { h: [150, 134], n: [128, 124], p: [54, 126], c: [90, 110], e1: [170, 140], w1: [200, 146], e2: [175, 142], w2: [206, 147], k1: [96, 146], f1: [42, 148], k2: [102, 147], f2: [48, 148], b: [98, 130, 12] },
    },
    butterfly: {
      props: [{ t: 'mat' }],
      cue: ['Breathe out · let your knees soften down', 'Breathe in · sit tall'],
      a: { h: [120, 38], n: [120, 56], s1: [106, 60], s2: [134, 60], p: [120, 126], c: [120, 92], e1: [100, 98], w1: [113, 138], e2: [140, 98], w2: [127, 138], k1: [86, 110], f1: [114, 143], k2: [154, 110], f2: [126, 143], b: [120, 100, 15] },
      b: { k1: [70, 134], k2: [170, 134], e1: [96, 104], e2: [144, 104] },
    },
    side: {
      props: [{ t: 'mat' }],
      cue: ['Breathe out · reach up and over', 'Breathe in · come back to centre'],
      a: { h: [120, 38], n: [120, 56], s1: [106, 60], s2: [134, 60], p: [120, 128], c: [120, 93], e1: [100, 92], w1: [96, 122], e2: [140, 92], w2: [144, 122], k1: [82, 138], f1: [132, 146], k2: [158, 138], f2: [108, 146], b: [120, 102, 15] },
      b: { h: [94, 46], n: [105, 62], s1: [93, 70], s2: [117, 56], c: [114, 95], e1: [82, 106], w1: [74, 138], e2: [118, 32], w2: [90, 20], b: [118, 104, 15] },
    },
    pelvictilt: {
      props: [{ t: 'wall', x: 50 }],
      cue: ['Breathe out · press your low back to the wall', 'Breathe in · release'],
      a: { h: [76, 22], n: [72, 40], p: [70, 88], c: [68, 64], e1: [74, 64], w1: [78, 88], e2: [76, 64], w2: [80, 88], k1: [80, 118], f1: [76, 148], k2: [84, 118], f2: [82, 148], b: [90, 74, 14] },
      b: { p: [63, 91], c: [62, 64], k1: [84, 118], k2: [88, 118], b: [86, 77, 14] },
    },
    neck: {
      props: [],
      cue: ['Tilt one ear towards the shoulder', 'Tilt to the other side'],
      a: { h: [134, 32], n: [120, 50], s1: [104, 54], s2: [136, 54], p: [120, 102], c: [120, 76], e1: [98, 78], w1: [96, 102], e2: [142, 78], w2: [144, 102], k1: [112, 126], f1: [110, 148], k2: [128, 126], f2: [130, 148], b: [120, 86, 15] },
      b: { h: [106, 32], s1: [104, 50], s2: [136, 50] },
    },
    chest: {
      props: [{ t: 'door', x: 140 }],
      cue: ['Step through · open your chest', 'Step back · relax'],
      a: { h: [116, 22], n: [112, 40], p: [110, 92], c: [110, 66], e1: [138, 42], w1: [140, 20], e2: [138, 44], w2: [140, 22], k1: [108, 120], f1: [104, 148], k2: [116, 120], f2: [120, 148], b: [126, 72, 13] },
      b: { h: [156, 24], n: [150, 42], p: [136, 92], c: [140, 66], e1: [138, 44], w1: [140, 22], e2: [138, 46], w2: [140, 24], k1: [112, 120], f1: [104, 148], k2: [150, 120], f2: [150, 148], b: [160, 74, 13] },
    },
    calf: {
      props: [{ t: 'wall', x: 204 }],
      cue: ['Step back · heel down, lean in', 'Come back to the wall'],
      a: { h: [166, 26], n: [160, 42], p: [150, 94], c: [154, 68], e1: [180, 50], w1: [202, 46], e2: [182, 52], w2: [202, 50], k1: [152, 122], f1: [150, 148], k2: [160, 122], f2: [160, 148], b: [172, 74, 13] },
      b: { h: [176, 34], n: [168, 48], p: [140, 96], c: [152, 72], e1: [186, 54], w1: [202, 48], e2: [188, 56], w2: [202, 52], k1: [118, 122], f1: [94, 148], k2: [172, 122], f2: [166, 148], b: [164, 80, 13] },
    },
    ankle: {
      props: [{ t: 'chair', x: 60, seat: 102, top: 50, dir: 1 }, { t: 'stool', x: 160, y: 120, w: 44 }],
      cue: ['Point your toes away', 'Flex your toes towards you'],
      a: { h: [80, 32], n: [76, 50], p: [80, 98], c: [76, 74], e1: [90, 76], w1: [108, 94], e2: [92, 78], w2: [112, 96], k1: [128, 96], f1: [178, 104], k2: [132, 98], f2: [182, 106], b: [92, 82, 13] },
      b: { f1: [190, 116], f2: [194, 118] },
    },
    squat: {
      props: [{ t: 'chair', x: 176, seat: 108, top: 66, dir: 1 }],
      cue: ['Lower slowly · heels down', 'Rise slowly using the chair'],
      a: { h: [120, 22], n: [116, 40], p: [110, 92], c: [112, 66], e1: [144, 54], w1: [174, 68], e2: [146, 56], w2: [176, 70], k1: [112, 120], f1: [104, 148], k2: [120, 120], f2: [114, 148], b: [130, 72, 13] },
      b: { h: [132, 66], n: [122, 82], p: [96, 124], c: [106, 104], e1: [150, 86], w1: [174, 72], e2: [152, 88], w2: [176, 74], k1: [134, 118], k2: [140, 120], b: [124, 108, 13] },
    },
    hipflexor: {
      props: [{ t: 'mat' }],
      cue: ['Shift your hips forward · feel the stretch', 'Return to kneeling tall'],
      a: { h: [104, 40], n: [100, 56], p: [98, 104], c: [98, 80], e1: [118, 82], w1: [140, 104], e2: [120, 84], w2: [144, 106], k1: [94, 146], f1: [56, 148], k2: [146, 110], f2: [146, 148], b: [114, 86, 13] },
      b: { h: [118, 42], n: [114, 58], p: [114, 108], c: [113, 82], e1: [132, 84], w1: [150, 106], e2: [134, 86], w2: [154, 108], k1: [98, 146], k2: [150, 112], b: [128, 88, 13] },
    },
    kegel: {
      props: [{ t: 'chair', x: 60, seat: 102, top: 50, dir: 1 }],
      cue: ['Squeeze and lift · hold for 5', 'Relax for 5'],
      a: { h: [84, 30], n: [80, 48], p: [82, 98], c: [80, 72], e1: [92, 74], w1: [110, 94], e2: [94, 76], w2: [114, 96], k1: [130, 98], f1: [130, 148], k2: [136, 100], f2: [136, 148], b: [96, 80, 13], g: [88, 99, 3] },
      b: { g: [88, 99, 13] },
    },
  };

  const lerp = (a, b, t) => a + (b - a) * t;
  function mix(A, B, t) {
    const o = {};
    for (const k in A) { const a = A[k], b = B[k] || a; o[k] = a.map((v, i) => lerp(v, b[i], t)); }
    return o;
  }
  const xy = v => `${v[0].toFixed(1)},${v[1].toFixed(1)}`;

  function props(list) {
    return list.map(p => {
      if (p.t === 'mat') return '<rect class="fg-mat" x="20" y="148" width="200" height="5" rx="2.5"></rect>';
      if (p.t === 'wall') return `<rect class="fg-prop" x="${p.x}" y="4" width="6" height="146"></rect>`;
      if (p.t === 'door') return `<path class="fg-line" d="M${p.x},150 L${p.x},6 L${p.x + 40},6"></path>`;
      if (p.t === 'stool') return `<path class="fg-line" d="M${p.x},${p.y} L${p.x + p.w},${p.y} M${p.x + 6},${p.y} L${p.x + 6},150 M${p.x + p.w - 6},${p.y} L${p.x + p.w - 6},150"></path>`;
      if (p.t === 'chair') {
        const x2 = p.x + 38 * p.dir;
        return `<path class="fg-line" d="M${p.x},${p.top} L${p.x},150 M${p.x},${p.seat} L${x2},${p.seat} L${x2},150"></path>`;
      }
      return '';
    }).join('');
  }

  function svgFor(id, t) {
    const d = POSES[id];
    const q = mix(d.a, d.b, t);
    const s1 = q.s1 ? 's1' : 'n', s2 = q.s2 ? 's2' : 'n';
    const c = q.c || [(q.p[0] + q.n[0]) / 2, (q.p[1] + q.n[1]) / 2];
    let s = '<line class="fg-ground" x1="8" y1="150" x2="232" y2="150"></line>' + props(d.props);
    s += `<path class="fg-far" d="M${xy(q.p)} L${xy(q.k1)} L${xy(q.f1)} M${xy(q[s1])} L${xy(q.e1)} L${xy(q.w1)}"></path>`;
    s += `<path class="fg-body" d="M${xy(q.p)} Q${xy(c)} ${xy(q.n)} L${xy(q.h)}${q.s1 ? ` M${xy(q.s1)} L${xy(q.n)} L${xy(q.s2)}` : ''}"></path>`;
    if (q.b) s += `<circle class="fg-belly" cx="${q.b[0].toFixed(1)}" cy="${q.b[1].toFixed(1)}" r="${q.b[2].toFixed(1)}"></circle>`;
    if (q.g) s += `<circle class="fg-pulse" cx="${q.g[0].toFixed(1)}" cy="${q.g[1].toFixed(1)}" r="${q.g[2].toFixed(1)}"></circle>`;
    s += `<path class="fg-near" d="M${xy(q.p)} L${xy(q.k2)} L${xy(q.f2)} M${xy(q[s2])} L${xy(q.e2)} L${xy(q.w2)}"></path>`;
    s += `<circle class="fg-head" cx="${q.h[0].toFixed(1)}" cy="${q.h[1].toFixed(1)}" r="11"></circle>`;
    return s;
  }

  // 8-second loop: ease a→b (3 s), hold (1 s), ease b→a (3 s), hold (1 s).
  const ease = x => 0.5 - 0.5 * Math.cos(Math.PI * x);
  function phase(ms) {
    const x = ms % 8000;
    if (x < 3000) return [ease(x / 3000), 0];
    if (x < 4000) return [1, 0];
    if (x < 7000) return [1 - ease((x - 4000) / 3000), 1];
    return [0, 1];
  }

  let reduce = false;
  try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { /* ignore */ }

  function html(id, big) {
    const d = POSES[id];
    if (!d) return '';
    return `<figure class="fig-wrap ${big ? 'big' : ''}">
      <svg class="fig" data-sid="${id}" viewBox="0 0 240 160" role="img" aria-label="Animated demonstration: ${d.cue.join(', then ')}">${svgFor(id, reduce ? 1 : 0)}</svg>
      <figcaption class="fig-cue" data-cue="${id}">${reduce ? d.cue.join(' → ') : d.cue[0]}</figcaption>
    </figure>`;
  }

  let raf = null, last = 0;
  function loop(ts) {
    const figs = document.querySelectorAll('svg.fig[data-sid]');
    if (!figs.length) { raf = null; return; }
    if (ts - last > 33) {
      last = ts;
      const vh = window.innerHeight;
      const [t, ph] = phase(ts);
      figs.forEach(svg => {
        const r = svg.getBoundingClientRect();
        if (r.bottom < 0 || r.top > vh || !r.width) return;
        const id = svg.dataset.sid;
        svg.innerHTML = svgFor(id, t);
        const cap = svg.nextElementSibling;
        const txt = POSES[id].cue[ph];
        if (cap && cap.textContent !== txt) cap.textContent = txt;
      });
    }
    raf = requestAnimationFrame(loop);
  }
  function start() { if (!reduce && !raf) raf = requestAnimationFrame(loop); }

  return { html, start, has: id => !!POSES[id] };
})();
