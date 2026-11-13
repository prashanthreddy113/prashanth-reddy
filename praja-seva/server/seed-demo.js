'use strict';

// Structure every installation needs (wards, budget heads), plus optional demo
// activity so the portal and dashboards can be reviewed with realistic-looking data.
// Demo records are created only when the server runs with DEMO=1.

const cfg = require('./config');
const { newId } = require('./store');

const HOUR = 36e5;
const DAY = 24 * HOUR;
const LAKH = 100000;

// Small deterministic random generator so every demo run looks the same.
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedStructure(store) {
  const d = store.data;
  if (!d.wards.length) {
    d.wards = cfg.WARDS.map((w) => ({ ward: w, councillor: '', locality: '', wardOfficerId: null }));
  }
  if (!d.budget.length) {
    d.budget = [
      ['Salaries & establishment', 'జీతాలు & స్థాపన', false],
      ['Sanitation & solid waste', 'పారిశుధ్యం & ఘన వ్యర్థాలు', false],
      ['Water supply operation & maintenance', 'నీటి సరఫరా నిర్వహణ', false],
      ['Roads & drains maintenance', 'రోడ్లు & కాలువల నిర్వహణ', false],
      ['Street lighting & power', 'వీధి దీపాలు & విద్యుత్', false],
      ['Capital works', 'మూలధన పనులు', false],
      ['Green budget: plantation, nurseries, parks', 'హరిత బడ్జెట్: మొక్కలు, నర్సరీలు, పార్కులు', true],
      ['Urban poverty & welfare (MEPMA)', 'పట్టణ పేదరిక నిర్మూలన (మెప్మా)', false],
      ['Administration, IT & citizen services', 'పరిపాలన, ఐటీ & పౌర సేవలు', false],
    ].map(([en, te, green]) => ({ id: newId(), en, te, green, allocated: 0, spent: 0 }));
  }
}

function seedDemo(store) {
  const d = store.data;
  if (d.meta.demoSeeded) return;
  const r = rng(2026);
  const pick = (a) => a[Math.floor(r() * a.length)];
  const now = Date.now();
  const iso = (t) => new Date(t).toISOString();
  const day = (t) => iso(t).slice(0, 10);
  const wards = cfg.WARDS;
  const officerFor = (dept) => d.users.find((u) => u.role === 'officer' && u.department === dept);
  const chair = d.users.find((u) => u.role === 'chairperson');
  const comm = d.users.find((u) => u.role === 'commissioner');

  // Ward councillors and localities (sample).
  const localities = ['Old Town', 'Bus Stand Area', 'Gandhi Nagar', 'Ambedkar Colony', 'Vidya Nagar', 'Market Yard', 'Station Road', 'Indira Nagar', 'Teachers Colony', 'Lake View Colony', 'Shivaji Nagar', 'New Housing Board'];
  d.wards.forEach((w, i) => { w.councillor = `Councillor, Ward ${w.ward} (sample)`; w.locality = localities[i % localities.length]; });
  const w1 = d.users.find((u) => u.role === 'ward_officer' && u.ward === 1);
  if (w1) d.wards[0].wardOfficerId = w1.id;

  // Citizens.
  const names = ['Ravi Kumar', 'Lakshmi Devi', 'Srinivas Rao', 'Anitha Reddy', 'Mohammed Saleem', 'Padma', 'Venkatesh Goud', 'Swapna', 'Naresh Yadav', 'Fatima Begum', 'Raju', 'Kavitha'];
  const citizens = names.map((name, i) => {
    const u = { id: newId(), role: 'citizen', name, mobile: `90000${String(10000 + i).slice(-5)}`, ward: wards[i % wards.length], active: true, createdAt: iso(now - 40 * DAY) };
    d.users.push(u);
    return u;
  });

  // Grievances over the last 30 days.
  const remarks = {
    resolved: ['Work completed and verified on site', 'Cleared by sanitation team; photo on file', 'Repaired and tested', 'Issue fixed; area inspected by ward officer'],
    rejected: ['Not under municipal jurisdiction; forwarded to the concerned department', 'Duplicate of an earlier complaint'],
  };
  const descs = {
    garbage: 'Garbage not lifted for three days near the junction', drain: 'Drain overflowing onto the road after rain',
    streetlight: 'Four streetlights not working on this lane', water_supply: 'No water supply for two days in our street',
    road: 'Large potholes causing accidents', stray_dogs: 'Pack of stray dogs chasing children', mosquito: 'Mosquito menace, fogging needed',
    water_leak: 'Pipeline leaking and water wasted', toilet: 'Public toilet at bus stand not cleaned', encroachment: 'Footpath blocked by shop extensions',
    tree: 'Tree branch hanging dangerously over the road', property_tax: 'Wrong arrears shown on my tax bill', certificate: 'Birth certificate correction pending',
  };
  const cats = Object.keys(descs);
  for (let i = 0; i < 64; i++) {
    const c = cfg.categoryById(pick(cats));
    const who = pick(citizens);
    const created = now - Math.floor(r() * 30 * DAY) - HOUR;
    const due = created + c.sla * HOUR;
    const roll = r();
    const age = now - created;
    let status = 'submitted';
    if (age > c.sla * HOUR * 0.6 || roll > 0.5) status = roll < 0.72 ? 'resolved' : roll < 0.77 ? 'rejected' : roll < 0.9 ? 'in_progress' : 'assigned';
    const officer = officerFor(c.dept);
    const history = [{ at: iso(created), by: who.name, role: 'citizen', status: 'submitted', remark: 'Complaint registered' }];
    let resolvedAt = null, feedback = null, assignedTo = null;
    if (status !== 'submitted') {
      assignedTo = officer ? officer.id : null;
      history.push({ at: iso(created + 2 * HOUR), by: comm.name, role: 'commissioner', status: 'assigned', remark: `Assigned to ${officer ? officer.name : 'officer'}` });
    }
    if (['in_progress', 'resolved'].includes(status)) history.push({ at: iso(created + 5 * HOUR), by: officer ? officer.name : 'Officer', role: 'officer', status: 'in_progress', remark: 'Work started' });
    if (status === 'resolved' || status === 'rejected') {
      const t = Math.min(now - HOUR, created + c.sla * HOUR * (0.25 + r() * 1.05));
      if (status === 'resolved') resolvedAt = iso(t);
      history.push({ at: iso(t), by: officer ? officer.name : 'Officer', role: 'officer', status, remark: pick(remarks[status]) });
      if (status === 'resolved' && r() < 0.75) feedback = { rating: r() < 0.15 ? 3 : r() < 0.55 ? 4 : 5, comment: '', at: iso(t + 3 * HOUR) };
    }
    const seq = store.nextSeq('grievance');
    d.grievances.push({
      id: newId(), number: `PS-${new Date(created).getFullYear()}-${String(seq).padStart(6, '0')}`,
      citizenId: who.id, citizenName: who.name, citizenMobile: who.mobile,
      category: c.id, department: c.dept, ward: pick(wards), location: `${pick(localities)}, near ${pick(['temple', 'school', 'bus stop', 'water tank', 'ration shop', 'community hall'])}`,
      lat: null, lng: null, description: descs[c.id], hasPhoto: false, status, assignedTo,
      createdAt: iso(created), updatedAt: history[history.length - 1].at, dueAt: iso(due), resolvedAt, feedback, reopenCount: 0, history,
    });
  }

  // Service applications.
  const apps = [['water_connection', 'verification'], ['trade_new', 'approved'], ['birth_cert', 'issued'], ['mutation', 'received'], ['septic', 'issued'], ['vendor_id', 'verification'], ['tree_permission', 'rejected']];
  apps.forEach(([sid, status], i) => {
    const s = cfg.serviceById(sid);
    const who = citizens[i];
    const created = now - (i + 1) * 2.5 * DAY;
    const seq = store.nextSeq('application');
    const history = [{ at: iso(created), by: who.name, role: 'citizen', status: 'received', remark: 'Application submitted online' }];
    if (status !== 'received') history.push({ at: iso(created + DAY), by: officerFor(s.dept).name, role: 'officer', status, remark: status === 'rejected' ? 'Tree is healthy; pruning allowed instead of cutting' : status === 'verification' ? 'Field verification scheduled' : 'Documents verified' });
    d.applications.push({
      id: newId(), number: `SR-${new Date(created).getFullYear()}-${String(seq).padStart(6, '0')}`, service: sid, department: s.dept,
      citizenId: who.id, name: who.name, mobile: who.mobile, ward: who.ward, details: `Online application for ${s.en.toLowerCase()}`,
      status, createdAt: iso(created), updatedAt: history[history.length - 1].at, dueAt: iso(created + s.slaDays * DAY), history,
    });
  });

  // Development works.
  [
    ['CC road, Ward 4 main street (1.2 km)', 'roads', 4, 'Finance Commission grant', 85, 'in_progress', 62, -70, 50],
    ['Storm-water drain, bus stand to lake bund (2.4 km)', 'drains', 7, 'AMRUT 2.0', 240, 'in_progress', 35, -120, 120],
    ['Integrated vegetable and non-veg market', 'buildings', null, 'State special development fund', 450, 'tendered', 0, -20, 330],
    ['Vaikuntha Dhamam (crematorium) modernisation', 'buildings', 11, 'General funds', 60, 'completed', 100, -200, -15],
    ['LED streetlights on three main corridors', 'lighting', null, 'General funds', 38, 'completed', 100, -150, -40],
    ['Park and open gym, Teachers Colony', 'greenery', 9, 'General funds', 25, 'in_progress', 80, -60, 20],
    ['Dry resource collection centre', 'sanitation', 2, 'SBM-U 2.0', 32, 'sanctioned', 0, -10, 150],
    ['Pipeline extension to new colonies, Ward 12', 'water', 12, 'AMRUT 2.0', 120, 'stalled', 20, -180, -5],
  ].forEach(([title, type, ward, scheme, lakh, status, progress, startDays, targetDays]) => {
    const spent = Math.round(lakh * LAKH * (progress / 100) * 0.95);
    d.works.push({
      id: newId(), title, type, ward: ward && wards.includes(ward) ? ward : null, scheme, sanctioned: lakh * LAKH, spent,
      status, progress, contractor: status === 'proposed' || status === 'sanctioned' ? '' : 'Sample Contractors (demo)',
      startDate: day(now + startDays * DAY), targetDate: day(now + targetDays * DAY), public: true,
      updates: [{ at: iso(now + startDays * DAY), by: comm.name, note: 'Work order issued', progress: 0 },
        ...(progress ? [{ at: iso(now - 7 * DAY), by: comm.name, note: status === 'stalled' ? 'Stalled: road-cutting permission awaited from R&B' : `Progress updated to ${progress}%`, progress }] : [])],
      createdAt: iso(now + startDays * DAY), updatedAt: iso(now - 7 * DAY),
    });
  });

  // Council meetings and resolutions.
  const res = (subject, decision) => ({ no: store.nextSeq('resolution'), subject, decision, notes: '' });
  d.meetings.push(
    {
      id: newId(), type: 'council', date: iso(now - 40 * DAY), venue: 'Council Hall', status: 'held', published: true, createdAt: iso(now - 50 * DAY),
      agenda: ['Adoption of 100-day agenda and Citizen Charter', 'Formation of ward committees', 'Pre-monsoon drain desilting plan'],
      minutes: 'Chaired by the Chairperson. 26 of 30 members present. All agenda items discussed.',
      resolutions: [res('100-day agenda and Citizen Charter with service deadlines adopted', 'passed'), res('Ward committees to be formed in all wards within 45 days', 'passed'), res('₹42 lakh approved for pre-monsoon desilting', 'passed')],
    },
    {
      id: newId(), type: 'council', date: iso(now - 10 * DAY), venue: 'Council Hall', status: 'held', published: true, createdAt: iso(now - 20 * DAY),
      agenda: ['Property-tax drive progress', 'Integrated market tender', 'Green budget allocation'],
      minutes: 'Chaired by the Chairperson. 24 of 30 members present.',
      resolutions: [res('Integrated market tender approved', 'passed'), res('10% of budget earmarked for greenery', 'passed'), res('Proposal to rename Market Road', 'deferred')],
    },
    {
      id: newId(), type: 'council', date: iso(now + 18 * DAY), venue: 'Council Hall', status: 'scheduled', published: true, createdAt: iso(now - 2 * DAY),
      agenda: ['Review of complaint resolution on Praja Seva', 'Water supply schedule for summer', 'Budget revision'], minutes: '', resolutions: [],
    },
  );

  // Ward committee members (first four wards) and meetings.
  const memberNames = ['K. Sai Teja', 'P. Mounika', 'M. Narsimha', 'B. Sarojini', 'S. Prakash', 'R. Jyothi', 'A. Yadagiri', 'T. Shirisha'];
  wards.slice(0, 4).forEach((w) => cfg.COMMITTEE_TYPES.forEach((t, j) => {
    for (let k = 0; k < 2; k++) d.committeeMembers.push({ id: newId(), ward: w, type: t.id, name: memberNames[(w + j + k) % memberNames.length], mobile: '', createdAt: iso(now - 30 * DAY) });
  }));
  wards.slice(0, 3).forEach((w, i) => d.committeeMeetings.push({
    id: newId(), ward: w, date: day(now - (5 + i * 4) * DAY), attendees: 18 + i * 3,
    issues: 'Garbage point at the junction; irregular water timings; dark stretch near school',
    actions: 'Garbage point cleared; water timings fixed at 6–8 am; two LED lights added', by: chair.name, createdAt: iso(now - (5 + i * 4) * DAY),
  }));

  // Chairperson's field inspections.
  [[3, 'Vegetable market back lane', 'Garbage pile and blocked drain behind the market', 'high'], [7, 'Lake bund road', 'Drain work slow; debris left on the road', 'medium'], [5, 'Government school junction', 'Two streetlights off near the school gate', 'medium'], [1, 'Bus stand', 'Public toilet clean; water tank needs repair', 'low']]
    .forEach(([w, loc, findings, severity], i) => {
      if (!wards.includes(w)) return;
      d.inspections.push({ id: newId(), ward: w, date: day(now - (i * 3 + 1) * DAY), location: loc, findings, severity, by: chair.name, byId: chair.id, grievanceId: null, createdAt: iso(now - (i * 3 + 1) * DAY) });
    });

  // Budget amounts (₹ lakh) and KPI entries.
  const amounts = [[1450, 1040], [620, 410], [540, 330], [480, 260], [310, 205], [960, 380], [520, 240], [180, 95], [140, 88]];
  d.budget.forEach((b, i) => { const [a, s] = amounts[i] || [100, 40]; b.allocated = a * LAKH; b.spent = s * LAKH; });
  const months = [day(now - 35 * DAY).slice(0, 7), day(now - 5 * DAY).slice(0, 7)];
  [['door_to_door', 88, 94], ['segregation', 41, 52], ['water_hours', 1, 1.5], ['streetlights', 93, 96], ['building_on_time', 92, 97], ['sapling_survival', 78, 81]]
    .forEach(([kpi, a, b]) => { d.kpiEntries.push({ id: newId(), kpi, month: months[0], value: a, by: comm.name }, { id: newId(), kpi, month: months[1], value: b, by: comm.name }); });

  // More property assessments with some payments.
  for (let i = 7; i <= 60; i++) {
    const ward = wards[i % wards.length];
    const annual = 800 + Math.floor(r() * 30) * 100;
    const arrears = r() < 0.4 ? Math.floor(r() * 20) * 100 : 0;
    const p = { assessmentNo: `10${String(i).padStart(8, '0')}`, ownerName: `${pick(names)} (sample)`, ward, address: `H.No. ${i}-${Math.floor(r() * 200)}, Ward ${ward}`, annualTax: annual, arrears, payments: [] };
    if (r() < 0.55) p.payments.push({ receiptNo: `RCPT-${String(store.nextSeq('receipt')).padStart(7, '0')}`, amount: annual + (r() < 0.5 ? arrears : 0), at: iso(now - Math.floor(r() * 60) * DAY), paidBy: p.ownerName, mode: 'counter' });
    d.properties.push(p);
  }

  // Action plan progress.
  d.actions.forEach((a, i) => { a.status = i < 3 ? 'done' : i < 6 ? 'in_progress' : 'not_started'; });

  d.announcements.push(
    { id: newId(), ward: null, by: 'Municipality', type: 'event', createdAt: iso(now - 2 * DAY), title: 'Council meeting on ' + day(now + 18 * DAY), titleTe: 'కౌన్సిల్ సమావేశం', body: 'Agenda: complaint resolution review, summer water schedule, budget revision. Citizens may attend from the gallery.' },
    { id: newId(), ward: null, by: 'Revenue', type: 'notice', createdAt: iso(now - 6 * DAY), title: 'Property tax: 5% rebate for early payment', titleTe: 'ఆస్తి పన్ను: ముందస్తు చెల్లింపుపై రాయితీ', body: 'Pay the full year\'s tax online through Praja Seva before the due date to receive the rebate notified by the Government (sample notice).' },
    { id: newId(), ward: null, by: 'Engineering', type: 'tender', createdAt: iso(now - 9 * DAY), title: 'Tender: integrated vegetable and non-veg market', titleTe: 'టెండర్: సమీకృత మార్కెట్', body: 'Sealed bids invited through the state e-procurement portal. Last date and documents on the portal (sample notice).' },
  );

  d.meta.demoSeeded = true;
  store.audit(null, 'seed.demo', 'Demo activity created');
  store.flush();
}

module.exports = { seedStructure, seedDemo };
