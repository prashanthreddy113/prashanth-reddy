/* =====================================================================
   SITE CONTENT — edit the lists below to change what the website shows.
   Put photos in the images/ folder with the exact file names used here.
   A missing photo shows a styled initials badge until you add it.
   ===================================================================== */

// Top protocol strip (order = protocol order, left to right)
const protocolLeaders = [
  { name: "Mallikarjun Kharge", role: "AICC President", img: "images/leaders/kharge.jpg" },
  { name: "Smt. Sonia Gandhi", role: "CPP Chairperson", img: "images/leaders/sonia-gandhi.jpg" },
  { name: "Rahul Gandhi", role: "Leader of Opposition, Lok Sabha", img: "images/leaders/rahul-gandhi.jpg" },
  { name: "Meenakshi Natarajan", role: "AICC In-charge, Telangana", img: "images/leaders/meenakshi-natarajan.jpg" },
  { name: "A. Revanth Reddy", role: "Chief Minister, Telangana", img: "images/leaders/revanth-reddy.jpg" },
  { name: "Mallu Bhatti Vikramarka", role: "Deputy Chief Minister", img: "images/leaders/bhatti-vikramarka.jpg" },
  { name: "B. Mahesh Kumar Goud", role: "TPCC President", img: "images/leaders/mahesh-kumar-goud.jpg" },
  { name: "G. Vivek Venkatswamy", role: "In-charge Minister, Sangareddy District", img: "images/leaders/vivek-venkatswamy.jpg" },
  { name: "Damodar Raja Narasimha", role: "Minister, Health, Telangana", img: "images/leaders/damodar-raja-narasimha.jpg" },
  { name: "Patlolla Sanjeeva Reddy", role: "MLA, Narayankhed", img: "images/family/sanjeeva-reddy.jpg" },
  { name: "Late Patlolla Kishta Reddy", role: "Former MLA, Narayankhed", img: "images/family/kishta-reddy.jpg", late: true },
];

// Headline figures under the hero
const stats = [
  { value: "DCC", label: "President, Sangareddy" },
  { value: "INC", label: "Congress family" },
  { value: "Narayankhed", label: "Home constituency" },
  { value: "24×7", label: "Open door for people" },
];

// Family legacy cards
const family = [
  {
    name: "Late Sri Patlolla Kishta Reddy",
    telugu: "స్వర్గీయ పట్లోళ్ల కిష్టా రెడ్డి",
    role: "Father · Former MLA, Narayankhed (1942 – 2015)",
    img: "images/family/kishta-reddy.jpg",
    text: "A senior Congress leader who represented Narayankhed in the Legislative Assembly and served as Chairman of the Public Accounts Committee of Telangana. His life of service to farmers and the poor remains the family's guiding light.",
    late: true,
  },
  {
    name: "Sri Patlolla Sanjeeva Reddy",
    telugu: "పట్లోళ్ల సంజీవ రెడ్డి",
    role: "Brother · MLA, Narayankhed",
    img: "images/family/sanjeeva-reddy.jpg",
    text: "Elected MLA from Narayankhed in the 2023 Telangana Assembly election on the Congress ticket, carrying forward the development work begun by their father.",
  },
  {
    name: "Sri Patlolla Chandrashekar Reddy",
    telugu: "పట్లోళ్ల చంద్రశేఖర్ రెడ్డి",
    role: "President, DCC Sangareddy",
    img: "images/hero.jpg",
    text: "Leading the Congress organisation across Sangareddy district and standing with every family in need.",
  },
];

// Social service cards — replace/extend with real events from Instagram
const services = [
  { icon: "🏥", title: "Medical Help", text: "Helping patients get treatment, hospital admissions and assistance through the CM Relief Fund and Aarogyasri." },
  { icon: "🩸", title: "Blood Donation Camps", text: "Organising blood donation drives with youth and party workers to save lives." },
  { icon: "🌾", title: "Standing With Farmers", text: "Taking farmers' issues to the government and helping them access Rythu schemes and crop support." },
  { icon: "🎓", title: "Education Support", text: "Supporting poor and meritorious students with fees, books and guidance." },
  { icon: "🤝", title: "Help in Hard Times", text: "Visiting bereaved families and accident victims, and offering personal financial assistance." },
  { icon: "🏠", title: "Welfare Schemes", text: "Helping eligible families get Indiramma houses, pensions, ration cards and Mahalakshmi benefits." },
  { icon: "🪔", title: "Festivals & Community", text: "Celebrating Bathukamma, Dasara, Ramzan and Christmas with people of every community." },
  { icon: "🇮🇳", title: "Party Building", text: "Booth, mandal and district meetings to strengthen the Congress at the grassroots." },
];

// Gallery — add photos to images/gallery/ and list them here
const gallery = [
  { src: "images/gallery/01.jpg", caption: "Appointed President, DCC Sangareddy", tag: "Party" },
  // Add more like this (photo in images/gallery/, tag = filter button):
  // { src: "images/gallery/02.jpg", caption: "With Rahul Gandhi", tag: "Leaders" },
  // { src: "images/gallery/03.jpg", caption: "Medical assistance to a family", tag: "Service" },
  // { src: "images/gallery/04.jpg", caption: "Meeting with farmers", tag: "People" },
];

// Videos — either a local file in videos/ or a YouTube video id
const videos = [
  { file: "videos/01.mp4", title: "Public meeting" },
  { file: "videos/02.mp4", title: "Service activities" },
  // { youtube: "VIDEO_ID", title: "Speech at Sangareddy" },
];

// Instagram posts / reels to embed — paste full post URLs here
const instagramPosts = [
  // "https://www.instagram.com/p/XXXXXXXXXXX/",
  // "https://www.instagram.com/reel/XXXXXXXXXXX/",
];

// Contact details
const WHATSAPP_NUMBER = ""; // e.g. "919876543210" (country code, no +)
const contacts = [
  { icon: "📍", text: "District Congress Committee Office, Sangareddy, Telangana" },
  { icon: "📷", text: "@patlolla_chandrashekar_reddy", href: "https://www.instagram.com/patlolla_chandrashekar_reddy/" },
  // { icon: "📞", text: "+91 98xxxxxxx", href: "tel:+9198xxxxxxx" },
];

/* =====================================================================
   RENDERING — no need to edit below this line
   ===================================================================== */

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const initials = (name) =>
  name.replace(/^((Late|Smt\.|Sri|Dr\.)\s+)+/i, "").split(/\s+/).filter((w) => /^[A-Z]/.test(w)).map((w) => w[0]).slice(0, 3).join("");

// Replace any image that fails to load with an initials badge
function attachFallback(img) {
  const swap = () => {
    const div = document.createElement("div");
    div.className = "fallback " + (img.className || "");
    div.textContent = img.dataset.fallback || initials(img.alt || "?");
    div.setAttribute("role", "img");
    div.setAttribute("aria-label", img.alt);
    img.replaceWith(div);
  };
  if (img.complete && img.naturalWidth === 0) swap();
  else img.addEventListener("error", swap, { once: true });
}

function render() {
  // Protocol strip (duplicated once for a seamless marquee)
  const leaderHtml = protocolLeaders
    .map(
      (l) => `
      <figure class="leader ${l.late ? "late" : ""}">
        <img src="${esc(l.img)}" alt="${esc(l.name)}" data-fallback="${esc(initials(l.name))}" loading="lazy" />
        <figcaption><strong>${esc(l.name)}</strong><span>${esc(l.role)}</span></figcaption>
      </figure>`
    )
    .join("");
  $("#protocolTrack").innerHTML = leaderHtml + `<div class="dup" aria-hidden="true">${leaderHtml}</div>`;

  $("#stats").innerHTML = stats
    .map((s) => `<div class="stat"><strong>${esc(s.value)}</strong><span>${esc(s.label)}</span></div>`)
    .join("");

  $("#familyGrid").innerHTML = family
    .map(
      (f) => `
      <article class="family-card reveal ${f.late ? "late" : ""}">
        <div class="family-photo"><img src="${esc(f.img)}" alt="${esc(f.name)}" data-fallback="${esc(initials(f.name))}" loading="lazy" /></div>
        <h3>${esc(f.name)}</h3>
        <p class="telugu">${esc(f.telugu)}</p>
        <p class="family-role">${esc(f.role)}</p>
        <p>${esc(f.text)}</p>
      </article>`
    )
    .join("");

  $("#serviceGrid").innerHTML = services
    .map(
      (s) => `
      <article class="service-card reveal">
        <span class="service-icon" aria-hidden="true">${s.icon}</span>
        <h3>${esc(s.title)}</h3>
        <p>${esc(s.text)}</p>
      </article>`
    )
    .join("");

  // Gallery with filters
  const tags = ["All", ...new Set(gallery.map((g) => g.tag))];
  $("#galleryFilters").innerHTML = tags
    .map((t, i) => `<button class="${i === 0 ? "active" : ""}" data-tag="${esc(t)}">${esc(t)}</button>`)
    .join("");
  $("#galleryFilters").hidden = tags.length <= 2;
  $("#galleryGrid").innerHTML = gallery
    .map(
      (g) => `
      <figure class="g-item reveal" data-tag="${esc(g.tag)}">
        <img src="${esc(g.src)}" alt="${esc(g.caption)}" data-fallback="📷" loading="lazy" />
        <figcaption>${esc(g.caption)}</figcaption>
      </figure>`
    )
    .join("");
  $("#galleryFilters").addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    document.querySelectorAll("#galleryFilters button").forEach((b) => b.classList.toggle("active", b === btn));
    document.querySelectorAll(".g-item").forEach((it) => {
      it.hidden = btn.dataset.tag !== "All" && it.dataset.tag !== btn.dataset.tag;
    });
  });

  $("#videoGrid").innerHTML = videos
    .map((v) =>
      v.youtube
        ? `<div class="video reveal"><iframe src="https://www.youtube-nocookie.com/embed/${esc(v.youtube)}" title="${esc(v.title)}" loading="lazy" allowfullscreen></iframe><p>${esc(v.title)}</p></div>`
        : `<div class="video reveal"><video controls preload="metadata" src="${esc(v.file)}"></video><p>${esc(v.title)}</p></div>`
    )
    .join("");
  // Hide local videos that are missing
  document.querySelectorAll(".video video").forEach((vid) =>
    vid.addEventListener("error", () => {
      vid.parentElement.innerHTML = `<div class="fallback video-fallback">▶</div><p>${esc(vid.parentElement.querySelector("p").textContent)} — video coming soon</p>`;
    })
  );

  // Instagram embeds
  if (instagramPosts.length) {
    $("#instaGrid").innerHTML = instagramPosts
      .map((url) => `<blockquote class="instagram-media" data-instgrm-permalink="${esc(url)}" data-instgrm-version="14"></blockquote>`)
      .join("");
    const s = document.createElement("script");
    s.src = "https://www.instagram.com/embed.js";
    s.async = true;
    document.body.appendChild(s);
  } else {
    $("#instaGrid").innerHTML = `<p class="insta-empty">Photos and reels of daily activities are posted on Instagram.</p>`;
  }

  $("#contactList").innerHTML = contacts
    .map((c) => `<li><span>${c.icon}</span>${c.href ? `<a href="${esc(c.href)}" target="_blank" rel="noopener">${esc(c.text)}</a>` : esc(c.text)}</li>`)
    .join("");

  document.querySelectorAll("img[data-fallback]").forEach(attachFallback);
}

function wire() {
  $("#year").textContent = new Date().getFullYear();

  // Mobile menu
  const toggle = $("#navToggle");
  const links = $("#navLinks");
  toggle.addEventListener("click", () => {
    const open = links.classList.toggle("open");
    toggle.setAttribute("aria-expanded", open);
  });
  links.addEventListener("click", (e) => e.target.tagName === "A" && links.classList.remove("open"));

  // Shadow on scroll
  addEventListener("scroll", () => $("#nav").classList.toggle("scrolled", scrollY > 40), { passive: true });

  // Reveal on scroll
  const io = new IntersectionObserver(
    (entries) => entries.forEach((en) => en.isIntersecting && (en.target.classList.add("in"), io.unobserve(en.target))),
    { threshold: 0.12 }
  );
  document.querySelectorAll(".reveal").forEach((el) => io.observe(el));

  // Lightbox
  const lb = $("#lightbox");
  $("#galleryGrid").addEventListener("click", (e) => {
    const img = e.target.closest(".g-item")?.querySelector("img");
    if (!img) return;
    $("#lbImg").src = img.src;
    $("#lbImg").alt = img.alt;
    $("#lbCaption").textContent = img.alt;
    lb.hidden = false;
  });
  const close = () => (lb.hidden = true);
  $("#lbClose").addEventListener("click", close);
  lb.addEventListener("click", (e) => e.target === lb && close());
  addEventListener("keydown", (e) => e.key === "Escape" && close());

  // Contact form → WhatsApp
  $("#contactForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const d = new FormData(e.target);
    const msg = `Namaste Anna,\nName: ${d.get("name")}\nPhone: ${d.get("phone")}\nPlace: ${d.get("place") || "-"}\n\n${d.get("message")}`;
    const base = WHATSAPP_NUMBER ? `https://wa.me/${WHATSAPP_NUMBER}` : "https://wa.me/";
    window.open(`${base}?text=${encodeURIComponent(msg)}`, "_blank", "noopener");
  });
}

render();
wire();

// Continuous flower shower on the father's photo
(function flowerShower() {
  const box = document.getElementById("petals");
  if (!box) return;
  const kinds = ["marigold", "marigold", "marigold", "rose", "rose", "jasmine", "gold"];
  const count = window.innerWidth < 600 ? 26 : 38;
  for (let i = 0; i < count; i++) {
    const p = document.createElement("span");
    p.className = "petal " + kinds[i % kinds.length];
    const fall = 4 + Math.random() * 4;
    p.style.left = Math.random() * 100 + "%";
    p.style.animationDuration = fall + "s";
    p.style.animationDelay = -Math.random() * fall + "s"; // start mid-fall so the shower is full at once
    p.style.scale = (0.7 + Math.random() * 0.7).toFixed(2);
    const i2 = document.createElement("i");
    i2.style.animationDuration = 1 + Math.random() * 1.5 + "s";
    p.appendChild(i2);
    box.appendChild(p);
  }
})();

// Real-flower garland (mala) draped over the father's portrait, Sakshi-style:
// a long, dense jasmine mala banded with red roses, a flower heap at the base, and a pendant
(function drawGarland() {
  const svg = document.getElementById("garland");
  if (!svg) return;
  const NS = "http://www.w3.org/2000/svg";
  // Portrait sits at x 40–290, y 22–342 in this viewBox (330 × 500)
  svg.innerHTML = `
    <defs>
      <radialGradient id="gMari" cx="45%" cy="40%"><stop offset="0" stop-color="#ffe066"/><stop offset=".55" stop-color="#ffa000"/><stop offset="1" stop-color="#e65100"/></radialGradient>
      <radialGradient id="gRose" cx="40%" cy="35%"><stop offset="0" stop-color="#ff3b5c"/><stop offset=".6" stop-color="#c4001f"/><stop offset="1" stop-color="#5e0010"/></radialGradient>
      <radialGradient id="gJas" cx="45%" cy="40%"><stop offset="0" stop-color="#ffffff"/><stop offset=".75" stop-color="#fbf8ec"/><stop offset="1" stop-color="#d9d2b8"/></radialGradient>
      <g id="fMari"><circle r="10" fill="url(#gMari)"/><circle r="10" fill="none" stroke="#d84315" stroke-width="3" stroke-dasharray="2 2.2"/><circle r="5.5" fill="none" stroke="#ef6c00" stroke-width="2.4" stroke-dasharray="1.5 1.8"/></g>
      <g id="fRose"><circle r="9.5" fill="url(#gRose)"/><path d="M-4.5 -1 a4.5 4.5 0 1 1 6.3 4.5 a3.2 3.2 0 1 1 -3.6 -4.5 a1.8 1.8 0 1 1 1.8 1.8" fill="none" stroke="#4a000c" stroke-width="1.2"/><path d="M-8 4 q4 4.5 8 4.5" fill="none" stroke="#7d001a" stroke-width="1.1"/></g>
      <g id="fJas">${[0, 72, 144, 216, 288].map((a) => `<ellipse rx="3" ry="5.6" cy="-4.6" fill="url(#gJas)" stroke="#cfc7aa" stroke-width=".5" transform="rotate(${a})"/>`).join("")}<circle r="1.8" fill="#efe2a0"/></g>
      <g id="fBud"><ellipse rx="2.6" ry="5.5" fill="#fffdf3" stroke="#d6cfb4" stroke-width=".5"/></g>
      <g id="fLeaf"><path d="M0 0 q7 -6 15 0 q-7 6 -15 0z" fill="#2e7d32" stroke="#1b5e20" stroke-width=".6"/></g>
    </defs>`;
  const use = (id, x, y, rot = 0, s = 1) => {
    const u = document.createElementNS(NS, "use");
    u.setAttribute("href", "#" + id);
    u.setAttribute("transform", `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${rot.toFixed(0)}) scale(${s.toFixed(2)})`);
    svg.appendChild(u);
  };
  // Seeded random so the garland looks the same on every load
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

  // 1. Flower heap offered at the foot of the portrait
  for (let k = 0; k < 150; k++) {
    const x = 18 + rnd() * 294;
    const h = 30 * Math.sqrt(Math.max(0, 1 - ((x - 165) / 150) ** 2));
    const y = 356 - rnd() * h + 6;
    const r = rnd();
    use(r < 0.45 ? "fRose" : r < 0.8 ? "fMari" : "fJas", x, y, rnd() * 360, 0.8 + rnd() * 0.35);
  }

  // 2. Long mala hanging from the top corners, below the frame
  const path = document.createElementNS(NS, "path");
  path.setAttribute("d", "M54 30 C8 230 58 398 165 402 C272 398 322 230 276 30");
  path.setAttribute("fill", "none");
  svg.appendChild(path);
  const len = path.getTotalLength();
  const at = (d) => {
    const p = path.getPointAtLength(d), q = path.getPointAtLength(Math.min(len, d + 1));
    const nx = -(q.y - p.y), ny = q.x - p.x, n = Math.hypot(nx, ny) || 1;
    return { x: p.x, y: p.y, nx: nx / n, ny: ny / n, ang: (Math.atan2(q.y - p.y, q.x - p.x) * 180) / Math.PI };
  };
  for (let d = 0; d <= len; d += 15) {
    const p = at(d);
    use("fLeaf", p.x + p.nx * 14, p.y + p.ny * 14, p.ang + 70, 1);
    use("fLeaf", p.x - p.nx * 14, p.y - p.ny * 14, p.ang - 110, 1);
  }
  // Mostly jasmine, three strands thick, with a band of red roses every ~46px
  const band = 46;
  for (let d = 0; d <= len; d += 6.5) {
    const p = at(d);
    const inBand = d % band < 13;
    for (const off of [-9, 0, 9]) {
      const jx = p.x + p.nx * off, jy = p.y + p.ny * off;
      if (inBand) use("fRose", jx, jy, rnd() * 360, 0.95 + rnd() * 0.15);
      else use(rnd() < 0.25 ? "fBud" : "fJas", jx, jy, rnd() * 360, 0.95 + rnd() * 0.25);
    }
  }
  // Marigold knots where the mala hangs on the frame
  use("fMari", 54, 30, 0, 1.5);
  use("fMari", 276, 30, 0, 1.5);

  // 3. Pendant: rose cluster, jasmine string and a gold-red tassel
  const cx = 165, cy = 404;
  [[0, 0], [-10, 6], [10, 6], [0, 12], [-6, 20], [6, 20], [0, 28]].forEach(([dx, dy]) => use("fRose", cx + dx, cy + dy, rnd() * 360, 1.05));
  for (let k = 0; k < 4; k++) use("fJas", cx, cy + 40 + k * 10, rnd() * 360, 1);
  use("fMari", cx, cy + 82, 0, 1.2);
  const tassel = document.createElementNS(NS, "g");
  tassel.innerHTML = [-8, -5, -2, 1, 4, 7]
    .map((dx, k) => `<path d="M${cx} ${cy + 92} q${dx} 12 ${dx * 1.4} 30" stroke="${k % 2 ? "#c4001f" : "#ffc107"}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`)
    .join("") + `<circle cx="${cx}" cy="${cy + 92}" r="5.5" fill="#ffc107" stroke="#9c6b00"/>`;
  svg.appendChild(tassel);
})();
