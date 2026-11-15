// Builds the Praja Seva presentation for the Chief Minister's review.
// Run from a folder where pptxgenjs, react, react-dom, react-icons and sharp are installed:
//   NODE_PATH=<that folder>/node_modules node build-deck.js <output.pptx> <path to pptx skill apply_theme.js>
'use strict';

const path = require('path');
const pptxgen = require('pptxgenjs');
const React = require('react');
const ReactDOMServer = require('react-dom/server');
const sharp = require('sharp');
const md = require('react-icons/md');

const OUT = process.argv[2] || 'Praja-Seva-CM-Presentation.pptx';
const APPLY_THEME = process.argv[3];
const ASSETS = path.join(__dirname, 'assets');

const THEME = {
  name: 'Praja Seva',
  headFontFace: 'Cambria',
  bodyFontFace: 'Calibri',
  colors: {
    dk1: '1F2933', lt1: 'FFFFFF', dk2: '0B3D2E', lt2: 'EEF6F2',
    accent1: '0E8A5F', accent2: 'D97706', accent3: 'D6336C', accent4: '2563EB', accent5: '7C3AED', accent6: '0E8FA0',
    hlink: '2563EB', folHlink: '7C3AED',
  },
};
const HEX = THEME.colors;

const pres = new pptxgen();
pres.layout = 'LAYOUT_WIDE'; // 13.333 x 7.5 in
pres.title = 'Praja Seva: a citizen-first blueprint for Telangana municipalities';
pres.subject = 'Presentation to the Chief Minister of Telangana';
pres.author = 'Municipal Chairperson';
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
const C = pres.SchemeColor;
const ACC = [C.accent1, C.accent2, C.accent3, C.accent4, C.accent5, C.accent6];
const W = 13.333, M = 0.6, CW = W - 2 * M;

// ---------- layouts ----------
pres.defineSlideMaster({
  title: 'TITLE_DARK',
  background: { color: HEX.dk2 },
  objects: [
    { placeholder: { options: { name: 'title', type: 'title', x: M, y: 2.1, w: 6.4, h: 1.6, fontSize: 54, bold: true, color: C.background1, align: 'left', valign: 'bottom', margin: 0 }, text: '' } },
    { placeholder: { options: { name: 'body', type: 'body', x: M, y: 3.85, w: 6.2, h: 1.5, fontSize: 22, color: C.background2, align: 'left', valign: 'top', margin: 0 }, text: '' } },
  ],
});
pres.defineSlideMaster({
  title: 'CONTENT',
  background: { color: HEX.lt1 },
  margin: [0.5, 0.6, 0.6, 0.6],
  objects: [
    { placeholder: { options: { name: 'title', type: 'title', x: M, y: 0.35, w: CW, h: 0.9, fontSize: 32, bold: true, color: C.text2, valign: 'middle', margin: 0 }, text: '' } },
    { text: { text: 'Praja Seva · A citizen-first blueprint for Telangana municipalities', options: { x: M, y: 7.0, w: 8, h: 0.3, fontSize: 10, color: C.text1, transparency: 40, margin: 0 } } },
  ],
  slideNumber: { x: 12.2, y: 7.0, w: 0.53, h: 0.3, fontSize: 10, color: C.text1, align: 'right' },
});
pres.defineSlideMaster({
  title: 'CLOSING_DARK',
  background: { color: HEX.dk2 },
  objects: [
    { placeholder: { options: { name: 'title', type: 'title', x: M, y: 1.7, w: CW, h: 1.5, fontSize: 54, bold: true, color: C.background1, align: 'center', valign: 'middle', margin: 0 }, text: '' } },
    { placeholder: { options: { name: 'body', type: 'body', x: 1.5, y: 3.3, w: W - 3, h: 1.0, fontSize: 22, color: C.background2, align: 'center', valign: 'top', margin: 0 }, text: '' } },
  ],
});

// ---------- helpers ----------
const shadow = () => ({ type: 'outer', color: '000000', opacity: 0.14, blur: 8, offset: 2, angle: 90 });
const iconCache = new Map();
async function icon(name, color = 'FFFFFF') {
  const key = name + color;
  if (iconCache.has(key)) return iconCache.get(key);
  const Cmp = md[name];
  if (!Cmp) throw new Error(`Unknown icon ${name}`);
  const svg = ReactDOMServer.renderToStaticMarkup(React.createElement(Cmp, { color: '#' + color, size: 256 }));
  const png = await sharp(Buffer.from(svg)).resize(256, 256).png().toBuffer();
  const data = 'image/png;base64,' + png.toString('base64');
  iconCache.set(key, data);
  return data;
}
async function iconCircle(slide, name, x, y, d, fill, label) {
  slide.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color: fill }, line: { color: fill }, objectName: `${label} icon circle` });
  const pad = d * 0.22;
  slide.addImage({ data: await icon(name), x: x + pad, y: y + pad, w: d - 2 * pad, h: d - 2 * pad, altText: label, objectName: `${label} icon` });
}
function card(slide, x, y, w, h, opts = {}) {
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x, y, w, h, rectRadius: opts.radius ?? 0.12,
    fill: opts.fill ? { color: opts.fill, transparency: opts.transparency ?? 0 } : { color: C.background1 },
    line: { color: opts.line || C.background2, width: 1 }, shadow: opts.noShadow ? undefined : shadow(), objectName: opts.name || 'card',
  });
}
function text(slide, t, x, y, w, h, o = {}) {
  slide.addText(t, { x, y, w, h, isTextBox: true, margin: 0, fontSize: 14, color: C.text1, valign: 'top', ...o });
}
// Screenshot inside a rounded "device" frame.
function screenshot(slide, file, x, y, w, ratio, kind, alt) {
  const pad = kind === 'phone' ? 0.09 : 0.06;
  const iw = w - 2 * pad, ih = iw / ratio;
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h: ih + 2 * pad, rectRadius: kind === 'phone' ? 0.22 : 0.1, fill: { color: C.text1 }, line: { color: C.text1 }, shadow: shadow(), objectName: `${alt} frame` });
  slide.addImage({ path: path.join(ASSETS, file), x: x + pad, y: y + pad, w: iw, h: ih, altText: alt, objectName: alt });
  return ih + 2 * pad;
}
function addSlide(section, master = 'CONTENT') { return pres.addSlide({ masterName: master, sectionTitle: section }); }

(async () => {
  // =========================== OPENING ===========================
  pres.addSection({ title: 'Opening' });
  {
    const s = addSlide('Opening', 'TITLE_DARK');
    text(s, 'PRESENTATION TO THE HON\'BLE CHIEF MINISTER OF TELANGANA', M, 1.2, 6.6, 0.4, { fontSize: 13, bold: true, color: C.accent2, charSpacing: 1 });
    s.addText('Praja Seva', { placeholder: 'title' });
    s.addText('A citizen-first blueprint and digital platform for Telangana\'s municipalities', { placeholder: 'body' });
    text(s, 'Municipal Chairperson · November 2026', M, 5.8, 6, 0.4, { fontSize: 16, color: C.background1 });
    screenshot(s, 'portal-home.png', 7.3, 1.75, 5.45, 1366 / 768, 'desktop', 'Praja Seva municipal portal home page');
    text(s, 'Working prototype · sample data', 7.3, 5.05, 5.45, 0.35, { fontSize: 12, color: C.background2, italic: true, align: 'center' });
    s.addNotes('Namaskaram. In the next twenty minutes I will present a five-year blueprint for what a municipal Chairperson can deliver under the Telangana Municipalities Act, and Praja Seva, a working platform that lets citizens and the municipality see the same record. I will end with a request for a ninety-day pilot.');
  }
  {
    const s = addSlide('Opening');
    s.addText('Every complaint tracked, every rupee shown', { placeholder: 'title' });
    const items = [
      ['MdMenuBook', 'The blueprint', 'What a Chairperson can legally do, a 100-day to 5-year plan, and 10 targets citizens can feel.', C.accent1],
      ['MdDevices', 'The platform', 'Three connected websites, a public portal, a citizen app and an office console, built and tested.', C.accent4],
      ['MdHandshake', 'The request', 'Approve a 90-day pilot in one municipality, with state integration, then review and scale.', C.accent3],
    ];
    const w = (CW - 2 * 0.4) / 3;
    for (const [i, [ic, h, b, col]] of items.entries()) {
      const x = M + i * (w + 0.4);
      card(s, x, 1.65, w, 4.4, { fill: col, transparency: 90, line: col, noShadow: true, name: `${h} card` });
      await iconCircle(s, ic, x + 0.4, 2.0, 1.0, col, h);
      text(s, h, x + 0.4, 3.25, w - 0.8, 0.6, { fontSize: 24, bold: true, color: col, fontFace: THEME.headFontFace });
      text(s, b, x + 0.4, 3.95, w - 0.8, 1.9, { fontSize: 17 });
    }
    text(s, 'One idea runs through all three: citizens and officials work from the same record, in Telugu or English.', M, 6.3, CW, 0.45, { fontSize: 16, italic: true, color: C.text2 });
    s.addNotes('This is the whole presentation on one slide. The blueprint sets out what we will do. The platform is how we will prove it, every day, in public. The request is a ninety-day pilot.');
  }

  // =========================== BLUEPRINT ===========================
  pres.addSection({ title: 'The blueprint' });
  {
    const s = addSlide('The blueprint');
    s.addText('Where citizens feel the gap today', { placeholder: 'title' });
    const pains = [
      ['MdReportProblem', 'Complaints get lost', 'No number, no deadline and no named officer, so citizens keep calling and visiting.', C.accent3],
      ['MdVisibilityOff', 'Progress is invisible', 'Works, budgets and council decisions are hard to see, so trust erodes.', C.accent2],
      ['MdMoneyOff', 'Revenue leaks', 'Unassessed buildings, arrears and manual receipts weaken own revenue.', C.accent5],
      ['MdGroupOff', 'Wards are not heard', 'Ward committees exist on paper but rarely meet or shape the work plan.', C.accent6],
    ];
    const w = (CW - 3 * 0.3) / 4;
    for (const [i, [ic, h, b, col]] of pains.entries()) {
      const x = M + i * (w + 0.3);
      card(s, x, 1.6, w, 4.0, { name: `${h} card` });
      await iconCircle(s, ic, x + 0.3, 1.9, 0.9, col, h);
      text(s, h, x + 0.3, 3.0, w - 0.6, 0.75, { fontSize: 19, bold: true, color: col });
      text(s, b, x + 0.3, 3.85, w - 0.6, 1.6, { fontSize: 16 });
    }
    text(s, 'Citizens judge a municipality by what they can see and feel every day: garbage, water, lights and answers.', M, 6.0, CW, 0.5, { fontSize: 17, italic: true, color: C.text2 });
    s.addNotes('These four gaps are what residents tell us at every Praja Vani. None of them needs a new law. They need a fixed process, a deadline and visibility.');
  }
  {
    const s = addSlide('The blueprint');
    s.addText('What the Chairperson can do under the Act', { placeholder: 'title' });
    const powers = [
      ['MdGavel', 'Lead the council', 'Convene and preside over meetings, set the agenda and pass resolutions.', C.accent1],
      ['MdManageSearch', 'Oversee administration', 'Call for any record or report and review every wing with the Commissioner.', C.accent4],
      ['MdFlashOn', 'Emergency powers (s. 26)', 'Order urgent works in floods or epidemics, then report to the council.', C.accent3],
      ['MdShare', 'Delegate (s. 27)', 'Delegate chosen functions to the Vice-Chairperson or council committees.', C.accent5],
      ['MdSavings', 'Budget and green budget', 'Lead budget adoption, watch tax collection and protect the green share.', C.accent2],
      ['MdGroups', 'Ward committees (ss. 30–31)', 'Make sure committees form in every ward, meet and shape the works plan.', C.accent6],
    ];
    const w = (CW - 2 * 0.3) / 3, h = 2.3;
    for (const [i, [ic, t1, b, col]] of powers.entries()) {
      const x = M + (i % 3) * (w + 0.3), y = 1.5 + Math.floor(i / 3) * (h + 0.3);
      card(s, x, y, w, h, { fill: col, transparency: 91, line: col, noShadow: true, name: `${t1} card` });
      await iconCircle(s, ic, x + 0.3, y + 0.3, 0.8, col, t1);
      text(s, t1, x + 1.3, y + 0.35, w - 1.55, 0.75, { fontSize: 19, bold: true, color: col, valign: 'middle' });
      text(s, b, x + 0.3, y + 1.25, w - 0.6, 0.95, { fontSize: 15 });
    }
    text(s, 'Telangana Municipalities Act, 2019. Section numbers to be verified against the current gazette before formal use.', M, 6.5, CW, 0.3, { fontSize: 11, color: C.text1, transparency: 30 });
    s.addNotes('The Act already gives the Chairperson enough authority to deliver this plan. What the Chairperson cannot do is bypass the Commissioner, spend outside the budget, or approve buildings outside TS-bPASS. Our plan stays inside those limits and keeps every decision on file.');
  }
  {
    const s = addSlide('The blueprint');
    s.addText('Four pillars of the plan', { placeholder: 'title' });
    const pillars = [
      ['MdCleaningServices', 'Clean town', ['Door-to-door collection in every ward', 'Segregation at source', 'No open garbage points'], C.accent1],
      ['MdWaterDrop', 'Water and drains', ['Daily water supply in every ward', 'Pre-monsoon desilting', 'No flooded colonies'], C.accent4],
      ['MdLightbulb', 'Green and lit streets', ['Green budget protected', '85% sapling survival', 'LED lights on every street'], C.accent2],
      ['MdVerified', 'Answerable municipality', ['A deadline on every complaint', 'Council decisions published', 'Ward committees that meet'], C.accent3],
    ];
    const w = (CW - 3 * 0.3) / 4;
    for (const [i, [ic, h, list, col]] of pillars.entries()) {
      const x = M + i * (w + 0.3);
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 1.5, w, h: 4.2, rectRadius: 0.14, fill: { color: col }, line: { color: col }, shadow: shadow(), objectName: `${h} pillar` });
      s.addShape(pres.shapes.OVAL, { x: x + 0.35, y: 1.8, w: 0.9, h: 0.9, fill: { color: C.background1, transparency: 80 }, line: { color: C.background1, transparency: 80 }, objectName: `${h} icon circle` });
      s.addImage({ data: await icon(ic), x: x + 0.53, y: 1.98, w: 0.54, h: 0.54, altText: h, objectName: `${h} icon` });
      text(s, h, x + 0.35, 2.9, w - 0.7, 0.9, { fontSize: 22, bold: true, color: C.background1, fontFace: THEME.headFontFace });
      s.addText(list.map((t1, j) => ({ text: t1, options: { bullet: true, breakLine: j < list.length - 1 } })), { x: x + 0.35, y: 3.85, w: w - 0.6, h: 1.7, isTextBox: true, margin: 0, fontSize: 15, color: C.background1, paraSpaceAfter: 6, valign: 'top' });
    }
    card(s, M, 5.95, CW, 0.75, { fill: C.text2, line: C.text2, noShadow: true, name: 'foundation' });
    text(s, 'Foundation: Praja Seva platform · ward committees · open data · monthly KPI review', M, 5.95, CW, 0.75, { fontSize: 17, bold: true, color: C.background1, align: 'center', valign: 'middle' });
    s.addNotes('Every activity in the blueprint fits under one of these four pillars. The foundation underneath is what makes them stick: one platform, active ward committees, open data and a monthly review against targets.');
  }
  {
    const s = addSlide('The blueprint');
    s.addText('Roadmap: first 100 days to year five', { placeholder: 'title' });
    const phases = [
      ['First 100 days', 'Fix what people see', ['Council adopts 100-day agenda and Citizen Charter', 'Ward committees formed in all wards', 'Praja Seva launched with a helpline', 'Worst 20% of garbage points cleared', 'Property-tax drive and monsoon preparation'], C.accent1],
      ['Year one', 'Lift service standards', ['Budget with green share and ward works list', '100% door-to-door collection with segregation', 'All streetlights LED with fault reporting', 'Tax collection above 85% of demand', 'Scheme proposals: AMRUT 2.0, SBM-U 2.0'], C.accent4],
      ['Years two to five', 'Build lasting assets', ['Daily water supply in every ward', 'Storm-water drain master plan', 'Integrated market and modern crematorium', 'Parks and urban forest in every ward', 'Annual public report card'], C.accent5],
    ];
    const w = (CW - 2 * 0.3) / 3;
    for (const [i, [h, sub, list, col]] of phases.entries()) {
      const x = M + i * (w + 0.3);
      s.addShape(i === 0 ? pres.shapes.PENTAGON : pres.shapes.CHEVRON, { x, y: 1.5, w: i === 2 ? w : w + 0.25, h: 1.0, fill: { color: col }, line: { color: col }, objectName: `${h} phase` });
      text(s, h, x + (i ? 0.55 : 0.3), 1.55, w - 0.8, 0.5, { fontSize: 21, bold: true, color: C.background1, valign: 'middle' });
      text(s, sub, x + (i ? 0.55 : 0.3), 2.0, w - 0.8, 0.4, { fontSize: 15, color: C.background1, valign: 'middle' });
      card(s, x, 2.75, w, 3.85, { fill: col, transparency: 92, line: col, noShadow: true, name: `${h} items` });
      s.addText(list.map((t1, j) => ({ text: t1, options: { bullet: true, breakLine: j < list.length - 1 } })), { x: x + 0.3, y: 2.95, w: w - 0.55, h: 3.5, isTextBox: true, margin: 0, fontSize: 15, color: C.text1, paraSpaceAfter: 8, valign: 'top' });
    }
    s.addNotes('The first hundred days are about visible basics. Year one raises standards and revenue. Years two to five build the assets that keep the town working. Each line here is already loaded into the action tracker in the office console, so progress is tracked from day one.');
  }
  {
    const s = addSlide('The blueprint');
    s.addText('Ten targets citizens can feel', { placeholder: 'title' });
    const kpis = [
      ['90%', 'Complaints resolved within deadline'], ['4 / 5', 'Average citizen rating'], ['100%', 'Households with daily door-to-door collection'],
      ['80%', 'Waste segregated at source'], ['Daily', 'Water supply in the worst ward'], ['98%', 'Streetlights working on night audit'],
      ['85%', 'Property-tax collection of demand'], ['100%', 'Building permissions decided on time'], ['85%', 'Saplings surviving after one year'], ['12', 'Council meetings a year, minutes published'],
    ];
    const w = (CW - 4 * 0.25) / 5, h = 2.15;
    for (const [i, [v, l]] of kpis.entries()) {
      const col = ACC[i % 6];
      const x = M + (i % 5) * (w + 0.25), y = 1.5 + Math.floor(i / 5) * (h + 0.3);
      card(s, x, y, w, h, { fill: col, transparency: 90, line: col, noShadow: true, name: `${l} tile` });
      text(s, v, x + 0.25, y + 0.25, w - 0.5, 0.85, { fontSize: 40, bold: true, color: col, fontFace: THEME.headFontFace });
      text(s, l, x + 0.25, y + 1.15, w - 0.5, 1.0, { fontSize: 15 });
    }
    text(s, 'Four are calculated live by Praja Seva; six are entered monthly by the Commissioner\'s office. All ten appear on the public service report.', M, 6.4, CW, 0.45, { fontSize: 15, italic: true, color: C.text2 });
    s.addNotes('These are the numbers we ask to be judged on. Complaint deadlines, citizen rating, tax collection and council meetings are calculated automatically from the platform. The rest are entered monthly, and all ten are shown publicly against their targets.');
  }
  {
    const s = addSlide('The blueprint');
    s.addText('Funding the plan: own revenue first, then schemes', { placeholder: 'title' });
    card(s, M, 1.5, 5.9, 5.1, { name: 'own revenue card' });
    text(s, 'Raise own revenue', M + 0.35, 1.75, 5.2, 0.5, { fontSize: 22, bold: true, color: C.accent1 });
    const own = [
      ['MdMapsHomeWork', 'Property tax: GIS survey to add unassessed buildings'],
      ['MdPayments', 'Online payment, SMS reminders and receipts'],
      ['MdStorefront', 'Trade licences and advertisement tax renewed online'],
      ['MdApartment', 'Re-auction shops and lease vacant land at market rates'],
      ['MdWaterDrop', 'Regularise water connections and bill by meter'],
    ];
    for (const [i, [ic, t1]] of own.entries()) {
      const y = 2.45 + i * 0.8;
      await iconCircle(s, ic, M + 0.35, y, 0.58, C.accent1, t1);
      text(s, t1, M + 1.15, y, 4.5, 0.58, { fontSize: 16, valign: 'middle' });
    }
    const rx = M + 6.2, rw = CW - 6.2;
    card(s, rx, 1.5, rw, 5.1, { name: 'schemes card' });
    text(s, 'Tap state and central schemes', rx + 0.35, 1.75, rw - 0.7, 0.5, { fontSize: 22, bold: true, color: C.accent4 });
    const schemes = [['Finance Commission', 'Water, sanitation, local priorities'], ['AMRUT 2.0', 'Water supply, sewerage, lakes'], ['SBM-U 2.0', 'Waste processing, toilets, legacy waste'], ['PMAY-U 2.0', 'Housing for the urban poor'], ['MEPMA, PM SVANidhi', 'SHGs, street-vendor loans'], ['State funds, TUFIDC', 'Roads, drains, markets']];
    const cw2 = (rw - 0.7 - 0.25) / 2;
    for (const [i, [n, u]] of schemes.entries()) {
      const col = ACC[(i + 1) % 6];
      const x = rx + 0.35 + (i % 2) * (cw2 + 0.25), y = 2.45 + Math.floor(i / 2) * 1.32;
      card(s, x, y, cw2, 1.12, { fill: col, transparency: 88, line: col, noShadow: true, name: `${n} chip` });
      text(s, n, x + 0.2, y + 0.12, cw2 - 0.3, 0.4, { fontSize: 15, bold: true, color: col });
      text(s, u, x + 0.2, y + 0.55, cw2 - 0.4, 0.5, { fontSize: 14 });
    }
    s.addNotes('Own revenue is the only money the council fully controls, so property-tax coverage and collection come first. Ready-to-sanction project reports then let us draw scheme funds on time instead of losing them at year end.');
  }

  // =========================== PLATFORM ===========================
  pres.addSection({ title: 'Praja Seva platform' });
  {
    const s = addSlide('Praja Seva platform');
    s.addText('Praja Seva: one platform, three websites', { placeholder: 'title' });
    const sites = [
      ['MdPublic', 'Municipal portal', 'For every resident, with no login', ['Live service report and KPI scorecard', 'Works, budget, council resolutions', 'Citizen Charter and status tracking'], C.accent1],
      ['MdPhoneAndroid', 'Citizen services', 'Mobile number and OTP', ['Report problems with photo and GPS', 'Apply for 10 municipal services', 'Pay tax, meet the Chairperson'], C.accent3],
      ['MdDashboard', 'Municipal office', 'Chairperson, Commissioner, officers', ['Queue with deadlines and escalation', 'Works, council, committees, budget', 'One-page review report for the CM'], C.accent4],
    ];
    const w = (CW - 2 * 0.4) / 3;
    for (const [i, [ic, h, who, list, col]] of sites.entries()) {
      const x = M + i * (w + 0.4);
      card(s, x, 1.5, w, 3.75, { name: `${h} card` });
      await iconCircle(s, ic, x + 0.3, 1.75, 0.85, col, h);
      text(s, h, x + 1.3, 1.75, w - 1.5, 0.5, { fontSize: 21, bold: true, color: col });
      text(s, who, x + 1.3, 2.25, w - 1.5, 0.4, { fontSize: 14, italic: true });
      s.addText(list.map((t1, j) => ({ text: t1, options: { bullet: true, breakLine: j < list.length - 1 } })), { x: x + 0.3, y: 2.95, w: w - 0.55, h: 2.1, isTextBox: true, margin: 0, fontSize: 15, color: C.text1, paraSpaceAfter: 8, valign: 'top' });
      s.addShape(pres.shapes.LINE, { x: x + w / 2, y: 5.25, w: 0, h: 0.55, line: { color: col, width: 2, endArrowType: 'triangle' }, objectName: `${h} connector` });
    }
    card(s, M + 1.5, 5.85, CW - 3, 0.85, { fill: C.text2, line: C.text2, name: 'one record' });
    text(s, 'One server · one record · Telugu and English · works on any phone', M + 1.5, 5.85, CW - 3, 0.85, { fontSize: 18, bold: true, color: C.background1, align: 'center', valign: 'middle' });
    s.addNotes('Praja Seva is three websites on one server. What a citizen sees on the phone, what the officer works on and what the public report shows all come from the same record, so the numbers cannot drift apart.');
  }
  {
    const s = addSlide('Praja Seva platform');
    s.addText('A complaint can no longer get lost', { placeholder: 'title' });
    const steps = [['Citizen reports', 'Photo, GPS, ward'], ['Auto-routed', 'Right department, deadline set'], ['Assigned', 'A named officer'], ['Work started', 'Status visible'], ['Closed', 'With a remark'], ['Citizen rates', 'Reopen within 7 days']];
    const bw = 1.75, gap = (CW - 6 * bw) / 5;
    for (const [i, [h, sub]] of steps.entries()) {
      const x = M + i * (bw + gap), col = ACC[[0, 5, 3, 4, 0, 2][i]];
      card(s, x, 1.75, bw, 1.6, { fill: col, transparency: 88, line: col, noShadow: true, name: `${h} step` });
      s.addShape(pres.shapes.OVAL, { x: x + bw / 2 - 0.25, y: 1.5, w: 0.5, h: 0.5, fill: { color: col }, line: { color: C.background1, width: 2 }, objectName: `step ${i + 1} number` });
      text(s, String(i + 1), x + bw / 2 - 0.25, 1.5, 0.5, 0.5, { fontSize: 16, bold: true, color: C.background1, align: 'center', valign: 'middle' });
      text(s, h, x + 0.12, 2.15, bw - 0.24, 0.45, { fontSize: 17, bold: true, color: col, align: 'center' });
      text(s, sub, x + 0.12, 2.6, bw - 0.24, 0.65, { fontSize: 14, align: 'center' });
      if (i < 5) s.addShape(pres.shapes.LINE, { x: x + bw + 0.04, y: 2.55, w: gap - 0.08, h: 0, line: { color: C.text1, width: 1.5, endArrowType: 'triangle' }, objectName: `arrow ${i + 1}` });
    }
    text(s, 'If it is not closed in time, it moves up automatically', M, 3.9, CW, 0.45, { fontSize: 20, bold: true, color: C.text2 });
    const esc = [['MdAlarm', 'Past the deadline', 'Escalates to the Commissioner', C.accent2], ['MdPriorityHigh', 'Still late', 'Escalates to the Chairperson after another full period', C.accent3], ['MdVisibility', 'Every case visible', 'On the review report and the public service report', C.accent5]];
    const ew = (CW - 2 * 0.55) / 3;
    for (const [i, [ic, h, b, col]] of esc.entries()) {
      const x = M + i * (ew + 0.55);
      card(s, x, 4.5, ew, 1.55, { name: `${h} card` });
      await iconCircle(s, ic, x + 0.25, 4.82, 0.9, col, h);
      text(s, h, x + 1.35, 4.75, ew - 1.55, 0.45, { fontSize: 17, bold: true, color: col });
      text(s, b, x + 1.35, 5.2, ew - 1.55, 0.75, { fontSize: 15 });
      if (i < 2) s.addShape(pres.shapes.LINE, { x: x + ew + 0.06, y: 5.27, w: 0.43, h: 0, line: { color: C.text1, width: 1.5, endArrowType: 'triangle' }, objectName: `escalation arrow ${i + 1}` });
    }
    text(s, 'Walk-in petitions at Praja Vani, helpline calls and the Chairperson\'s field inspections enter the same queue.', M, 6.35, CW, 0.4, { fontSize: 15, italic: true, color: C.text2 });
    s.addNotes('This is the core of accountability. Every complaint gets a number, a department, a deadline and a named officer the moment it is filed. If the deadline passes it reaches the Commissioner, and if it stays late it reaches me. Complaints received in person or by phone are entered into the same queue.');
  }
  {
    const s = addSlide('Praja Seva platform');
    s.addText('For citizens: report, apply, track and pay from any phone', { placeholder: 'title' });
    const rows = [['MdAddAPhoto', 'Report in a minute', 'Photo, GPS and ward; a complaint number at once', C.accent3], ['MdAssignment', 'Apply for 10 services', 'Water tap, trade licence, certificates, mutation', C.accent4], ['MdTrackChanges', 'Track by number', 'Deadline, officer and every step, with no login', C.accent1], ['MdTranslate', 'Telugu or English', 'One tap to switch; OTP login, no passwords', C.accent2]];
    for (const [i, [ic, h, b, col]] of rows.entries()) {
      const y = 1.55 + i * 1.22;
      await iconCircle(s, ic, M, y, 0.8, col, h);
      text(s, h, M + 1.0, y - 0.02, 3.6, 0.45, { fontSize: 19, bold: true, color: col });
      text(s, b, M + 1.0, y + 0.43, 3.6, 0.7, { fontSize: 15 });
    }
    const phones = [['phone-home.png', 'Home'], ['phone-report.png', 'Report a problem'], ['phone-tracked.png', 'Tracked with a deadline']];
    const pw = 2.3, px0 = 5.4, pgap = (W - M - px0 - 3 * pw) / 2;
    for (const [i, [f, cap]] of phones.entries()) {
      const x = px0 + i * (pw + pgap);
      const h = screenshot(s, f, x, 1.5, pw, 390 / 780, 'phone', `Citizen app: ${cap}`);
      text(s, cap, x, 1.5 + h + 0.12, pw, 0.35, { fontSize: 13, bold: true, align: 'center', color: C.text2 });
    }
    s.addNotes('A citizen logs in with a mobile number and OTP, reports a problem with a photo and location, and gets a number and a deadline immediately. They can apply for ten services online and switch between Telugu and English with one tap.');
  }
  {
    const s = addSlide('Praja Seva platform');
    s.addText('For the public: a live report card of the town', { placeholder: 'title' });
    const h1 = screenshot(s, 'portal-home.png', M, 1.5, 7.3, 1366 / 768, 'desktop', 'Municipal portal home page');
    text(s, 'Municipal portal home page (prototype, sample data)', M, 1.5 + h1 + 0.1, 7.3, 0.35, { fontSize: 12, italic: true, align: 'center' });
    const pts = [['MdInsights', 'Live service report', 'Ten KPIs against targets, complaints by department, a ward map', C.accent1], ['MdConstruction', 'Works and budget in the open', 'Every project with scheme, money spent and progress', C.accent2], ['MdAccountBalance', 'Council decisions published', 'Agendas, minutes and every resolution', C.accent5], ['MdHowToVote', 'Ward pages', 'Councillor, committees, works and open complaints', C.accent3]];
    const rx = 8.35;
    for (const [i, [ic, h, b, col]] of pts.entries()) {
      const y = 1.55 + i * 1.25;
      await iconCircle(s, ic, rx, y, 0.75, col, h);
      text(s, h, rx + 0.95, y - 0.02, W - M - rx - 0.95, 0.42, { fontSize: 18, bold: true, color: col });
      text(s, b, rx + 0.95, y + 0.4, W - M - rx - 0.95, 0.75, { fontSize: 15 });
    }
    s.addNotes('The portal needs no login. Any resident, journalist or official can see how the town is doing right now: the ten KPIs against targets, works and spending, council resolutions and a page for every ward.');
  }
  {
    const s = addSlide('Praja Seva platform');
    s.addText('For officials: one console from daily queue to CM review', { placeholder: 'title' });
    const h1 = screenshot(s, 'office-report.png', M, 1.5, 7.3, 1366 / 768, 'desktop', 'Office console review report');
    text(s, 'One-page review report, printable as PDF (sample data)', M, 1.5 + h1 + 0.1, 7.3, 0.35, { fontSize: 12, italic: true, align: 'center' });
    const mods = ['Complaint queue with escalation', 'Praja Vani walk-in petitions', 'Service applications', 'Field inspections into complaints', 'Works progress and spending', 'Council meetings and resolutions', 'Ward committees', 'Budget, tax and KPI entry'];
    const rx = 8.35, rw = W - M - rx;
    for (const [i, m] of mods.entries()) {
      const col = ACC[i % 6], y = 1.5 + i * 0.6;
      card(s, rx, y, rw, 0.48, { fill: col, transparency: 86, line: col, noShadow: true, radius: 0.24, name: `${m} chip` });
      text(s, m, rx + 0.25, y, rw - 0.4, 0.48, { fontSize: 15, bold: true, color: col, valign: 'middle' });
    }
    text(s, 'Each role sees only its own work: officers their department, ward officers their ward.', rx, 6.35, rw, 0.55, { fontSize: 13, italic: true, color: C.text2 });
    s.addNotes('The office console is where the work happens. Officers see their own department or ward, the Commissioner runs the daily queue, and the Chairperson gets a one-page review report that can be printed for any review with the Collector, the Minister or the Chief Minister.');
  }
  {
    const s = addSlide('Praja Seva platform');
    s.addText('Built to be trusted and to scale across Telangana', { placeholder: 'title' });
    const items = [
      ['MdSms', 'OTP login', 'Citizens sign in with a mobile number, with no passwords to forget'],
      ['MdAdminPanelSettings', 'Role-based access', 'Every rule is enforced on the server, not just hidden on screen'],
      ['MdHistory', 'Full audit log', 'Every login, assignment, payment and edit is recorded'],
      ['MdPrivacyTip', 'Privacy by design', 'Public tracking shows status, never names or numbers'],
      ['MdTranslate', 'Telugu and English', 'Every screen, switchable with one tap'],
      ['MdPhoneAndroid', 'Works on any phone', 'Installable app that loads on weak connections'],
      ['MdHub', 'Ready to integrate', 'SMS gateway, payments, TS-bPASS and CDMA portals'],
      ['MdFactCheck', 'Tested', 'Automated tests cover every module and permission'],
    ];
    const w = (CW - 3 * 0.3) / 4, h = 2.35;
    for (const [i, [ic, t1, b]] of items.entries()) {
      const col = ACC[i % 6], x = M + (i % 4) * (w + 0.3), y = 1.5 + Math.floor(i / 4) * (h + 0.3);
      card(s, x, y, w, h, { name: `${t1} card` });
      await iconCircle(s, ic, x + 0.25, y + 0.25, 0.7, col, t1);
      text(s, t1, x + 1.1, y + 0.25, w - 1.3, 0.7, { fontSize: 18, bold: true, color: col, valign: 'middle' });
      text(s, b, x + 0.25, y + 1.1, w - 0.5, 1.1, { fontSize: 15 });
    }
    s.addNotes('Trust matters as much as features. Permissions are enforced on the server, every action is logged, and public tracking never exposes a citizen\'s name or number. The platform is built to connect with the state systems we already have rather than duplicate them.');
  }

  // =========================== THE ASK ===========================
  pres.addSection({ title: 'The ask' });
  {
    const s = addSlide('The ask');
    s.addText('A 90-day pilot, then a decision to scale', { placeholder: 'title' });
    const phases = [
      ['Weeks 1–2', 'Set up', 'Configure the town, staff accounts, SMS and payment gateways; load wards and tax data', C.accent1],
      ['Weeks 3–4', 'Launch', 'Train officers; brief ward committees; QR posters, SHG campaign and Praja Vani desk', C.accent4],
      ['Weeks 5–12', 'Run and review', 'Weekly review on the platform; monthly KPIs; public report card each month', C.accent2],
      ['Day 90', 'CM review', 'Results against targets and a decision on rolling out to all municipalities', C.accent3],
    ];
    const w = (CW - 3 * 0.3) / 4, ly = 2.05;
    s.addShape(pres.shapes.LINE, { x: M + w / 2, y: ly, w: CW - w, h: 0, line: { color: C.text2, width: 2 }, objectName: 'timeline' });
    for (const [i, [when, h, b, col]] of phases.entries()) {
      const x = M + i * (w + 0.3);
      s.addShape(pres.shapes.OVAL, { x: x + w / 2 - 0.3, y: ly - 0.3, w: 0.6, h: 0.6, fill: { color: col }, line: { color: C.background1, width: 3 }, objectName: `${when} marker` });
      text(s, when, x, 1.3, w, 0.4, { fontSize: 16, bold: true, color: col, align: 'center' });
      card(s, x, 2.6, w, 2.4, { fill: col, transparency: 90, line: col, noShadow: true, name: `${h} card` });
      text(s, h, x + 0.25, 2.8, w - 0.5, 0.45, { fontSize: 20, bold: true, color: col });
      text(s, b, x + 0.25, 3.3, w - 0.5, 1.6, { fontSize: 15 });
    }
    card(s, M, 5.3, CW, 1.4, { name: 'success criteria' });
    await iconCircle(s, 'MdFlag', M + 0.3, 5.55, 0.9, C.accent1, 'Success criteria');
    text(s, 'The pilot succeeds if', M + 1.45, 5.45, CW - 1.7, 0.45, { fontSize: 18, bold: true, color: C.accent1 });
    text(s, '90% of complaints are closed on time · citizens rate the work 4 out of 5 · committees meet in every ward · the review report is used at every council meeting', M + 1.45, 5.9, CW - 1.7, 0.75, { fontSize: 15 });
    s.addNotes('We propose a ninety-day pilot in one municipality. The success criteria are set in advance and measured by the platform itself, so the review on day ninety rests on evidence.');
  }
  {
    const s = addSlide('The ask');
    s.addText('Requests to the Hon\'ble Chief Minister', { placeholder: 'title' });
    const asks = [
      ['Approve the pilot', 'A 90-day Praja Seva pilot in one municipality, with the council\'s 100-day agenda as its scope.', C.accent1],
      ['Direct integration', 'MA&UD and CDMA to connect the existing property-tax, certificate and TS-bPASS systems and an SMS gateway.', C.accent4],
      ['Secure hosting', 'Host on the State Data Centre, with a security audit before citizens use it.', C.accent5],
      ['Review and scale', 'A review with the CM on day 90, then a decision on rolling out to all urban local bodies.', C.accent3],
    ];
    const w = (CW - 0.4) / 2, h = 2.35;
    for (const [i, [h1, b, col]] of asks.entries()) {
      const x = M + (i % 2) * (w + 0.4), y = 1.5 + Math.floor(i / 2) * (h + 0.35);
      card(s, x, y, w, h, { name: `${h1} card` });
      text(s, String(i + 1), x + 0.3, y + 0.25, 1.0, 1.4, { fontSize: 72, bold: true, color: col, fontFace: THEME.headFontFace });
      text(s, h1, x + 1.45, y + 0.35, w - 1.75, 0.5, { fontSize: 22, bold: true, color: col });
      text(s, b, x + 1.45, y + 0.95, w - 1.75, 1.25, { fontSize: 16 });
    }
    s.addNotes('These are our four requests. The pilot needs no new legislation, only approval, integration with systems the state already runs, secure hosting, and a review date.');
  }
  {
    const s = addSlide('The ask', 'CLOSING_DARK');
    s.addText([{ text: 'ధన్యవాదాలు', options: { fontFace: 'Nirmala UI' } }, { text: '  ·  Thank you' }], { placeholder: 'title' });
    s.addText('Clean, green and accountable municipalities for every citizen of Telangana', { placeholder: 'body' });
    const demos = [['MdPublic', 'Municipal portal'], ['MdPhoneAndroid', 'Citizen services'], ['MdDashboard', 'Municipal office']];
    const w = 3.2, gap = 0.5, x0 = (W - (3 * w + 2 * gap)) / 2;
    for (const [i, [ic, l]] of demos.entries()) {
      const x = x0 + i * (w + gap);
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 4.75, w, h: 1.0, rectRadius: 0.5, fill: { color: C.background1, transparency: 85 }, line: { color: C.background1, transparency: 60 }, objectName: `${l} pill` });
      s.addImage({ data: await icon(ic), x: x + 0.3, y: 5.0, w: 0.5, h: 0.5, altText: l, objectName: `${l} icon` });
      text(s, l, x + 0.95, 4.75, w - 1.15, 1.0, { fontSize: 18, bold: true, color: C.background1, valign: 'middle' });
    }
    text(s, 'Live demonstration available on request', M, 6.2, CW, 0.4, { fontSize: 15, italic: true, color: C.background2, align: 'center' });
    s.addNotes('Thank you. I would be glad to show the three websites live, and to answer any questions.');
  }

  await pres.writeFile({ fileName: OUT });
  if (APPLY_THEME) {
    const { applyTheme } = require(APPLY_THEME);
    await applyTheme(OUT, THEME);
  }
  console.log('Wrote', OUT);
})().catch((e) => { console.error(e); process.exit(1); });
