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
  // Drop videos whose file isn't there yet; hide the whole section if none remain
  const hideVideosIfEmpty = () => {
    const empty = !document.querySelector("#videoGrid .video");
    $("#videos").hidden = empty;
    document.querySelector('.nav-links a[href="#videos"]').hidden = empty;
  };
  document.querySelectorAll(".video video").forEach((vid) =>
    vid.addEventListener("error", () => {
      vid.closest(".video").remove();
      hideVideosIfEmpty();
    })
  );
  hideVideosIfEmpty();

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

  // Reveal on scroll. Content is visible by default; the fade-in is only an
  // enhancement, and everything is shown after a moment even if the viewer
  // (an embedded preview, an old browser) never reports scrolling.
  const items = document.querySelectorAll(".reveal");
  const showAll = () => items.forEach((el) => el.classList.add("in"));
  if ("IntersectionObserver" in window) {
    document.documentElement.classList.add("anim");
    const io = new IntersectionObserver(
      (entries) => entries.forEach((en) => en.isIntersecting && (en.target.classList.add("in"), io.unobserve(en.target))),
      { threshold: 0.12 }
    );
    items.forEach((el) => io.observe(el));
    setTimeout(showAll, 1500);
  }

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

// Cinematic tribute: rose petals drifting in 3D and golden embers rising
(function tributeEffects() {
  const petals = document.getElementById("petals");
  const sparks = document.getElementById("sparks");
  if (!petals || !sparks) return;
  const small = window.innerWidth < 700;
  const kinds = ["", "", "", "pink", "white", "gold"];
  for (let i = 0; i < (small ? 22 : 36); i++) {
    const p = document.createElement("span");
    p.className = "t-petal " + kinds[i % kinds.length];
    const dur = 9 + Math.random() * 8;
    p.style.left = Math.random() * 100 + "%";
    p.style.animationDuration = dur + "s";
    p.style.animationDelay = -Math.random() * dur + "s";
    p.style.setProperty("--drift", (Math.random() * 160 - 40).toFixed(0) + "px");
    p.style.scale = (0.6 + Math.random() * 0.7).toFixed(2);
    p.style.opacity = (0.75 + Math.random() * 0.25).toFixed(2);
    if (Math.random() < 0.25) p.style.filter = "blur(1.5px)"; // depth of field
    const inner = document.createElement("i");
    inner.style.animationDuration = 2 + Math.random() * 3 + "s";
    p.appendChild(inner);
    petals.appendChild(p);
  }
  for (let i = 0; i < (small ? 18 : 30); i++) {
    const s = document.createElement("span");
    s.className = "t-spark";
    const dur = 6 + Math.random() * 7;
    s.style.left = (small ? 10 + Math.random() * 80 : 5 + Math.random() * 50) + "%";
    s.style.animationDuration = dur + "s";
    s.style.animationDelay = -Math.random() * dur + "s";
    s.style.setProperty("--sway", (Math.random() * 80 - 40).toFixed(0) + "px");
    s.style.scale = (0.5 + Math.random()).toFixed(2);
    sparks.appendChild(s);
  }
})();
