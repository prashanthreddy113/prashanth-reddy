// Demo backend: the same API as the live one, kept in this browser's localStorage.
// Seeded with the real Yukktha catalogue and store settings plus sample orders,
// customers, staff and expenses so every screen can be tried without logging in.
const KEY = 'yka_demo_v2';
const NOW = { __now: true };

const rid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const iso = (d) => new Date(d).toISOString();
const day = 86400000;

function seeded(n) { let x = n; return () => { x = (x * 9301 + 49297) % 233280; return x / 233280; }; }

async function buildSeed() {
  const [sarees, pj] = await Promise.all([
    fetch('data/demo-sarees.json').then((r) => r.json()),
    fetch('data/demo-project.json').then((r) => r.json())
  ]);
  const rnd = seeded(42);
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const now = Date.now();
  const db = { project: pj.project, colls: {} };
  db.project.paymentConfig = { upiId: 'yukktha@upi', payeeName: 'Yukktha Sarees', bankName: '', accountNumber: '', ifsc: '', razorpayKeyId: '', invoicePrefix: 'YK-' };
  db.colls.sarees = sarees.map((s) => { const o = { ...s }; o.id = o._id; delete o._id; return o; });
  db.colls.banners = pj.banners.map((b) => { const o = { ...b }; o.id = o._id; delete o._id; return o; });

  const names = ['Lakshmi Reddy', 'Anitha Rao', 'Sravani K', 'Divya Sharma', 'Padma Priya', 'Keerthi Varma', 'Swathi M', 'Bhavana Goud', 'Harika P', 'Meghana Reddy', 'Sowmya N', 'Ramya Krishna'];
  db.colls.customers = names.map((n, i) => ({ id: rid(), name: n, mobile: '+9198' + String(48000000 + i * 731157).slice(0, 8), details: i % 3 === 0 ? 'Prefers Kanjivaram, bridal shopping' : '', createdAt: iso(now - (90 - i * 5) * day) }));

  db.colls.employees = [
    { name: 'Saritha', designation: 'Store Manager', phone: '+919849012345', salary: 28000, joinedOn: '2024-03-01', store: 'New Nallakunta', status: 'active', commissionPercent: 1 },
    { name: 'Ravi Kumar', designation: 'Sales Associate', phone: '+919866054321', salary: 16000, joinedOn: '2025-01-15', store: 'New Nallakunta', status: 'active', commissionPercent: 2 },
    { name: 'Mounika', designation: 'Sales Associate', phone: '+919912345678', salary: 15000, joinedOn: '2025-06-10', store: 'Jubilee Hills', status: 'active', commissionPercent: 2 },
    { name: 'Prasad', designation: 'Tailor / Fall & Pico', phone: '+919700011122', salary: 14000, joinedOn: '2024-11-20', store: 'Jubilee Hills', status: 'active', commissionPercent: 0 },
    { name: 'Venkatesh', designation: 'Delivery & Helper', phone: '+919555443322', salary: 12000, joinedOn: '2025-08-01', store: 'New Nallakunta', status: 'active', commissionPercent: 0 }
  ].map((e) => ({ id: rid(), ...e, createdAt: iso(now - 200 * day) }));

  // attendance for the last 14 days: one doc per date, map of employeeId -> status
  db.colls.attendance = [];
  for (let d = 14; d >= 1; d--) {
    const date = new Date(now - d * day).toISOString().slice(0, 10);
    const marks = {}; db.colls.employees.forEach((e) => { const r = rnd(); marks[e.id] = r < 0.86 ? 'present' : r < 0.93 ? 'half' : 'absent'; });
    db.colls.attendance.push({ id: date, date, marks });
  }

  const priced = db.colls.sarees.filter((s) => Number(s.sellPrice) > 0);
  const statuses = ['completed', 'completed', 'completed', 'completed', 'paid', 'confirmed', 'preparing', 'ready', 'pending_payment', 'cancelled'];
  db.colls.orders = [];
  for (let i = 0; i < 46; i++) {
    const c = pick(db.colls.customers); const n = rnd() < 0.8 ? 1 : 2; const items = [];
    for (let k = 0; k < n; k++) {
      const s = pick(priced); const price = Math.round(Number(s.sellPrice) * (1 - (Number(s.discountPercent) || 0) / 100));
      items.push({ itemId: s.id, name: s.name, qty: 1, price, imageUrl: s.imageUrl });
    }
    const subtotal = items.reduce((a, b) => a + b.price * b.qty, 0);
    const store = rnd() < 0.55; const sp = pick(db.colls.employees.slice(0, 3));
    db.colls.orders.push({
      id: rid(), items, subtotal, couponDiscount: 0, total: subtotal,
      status: store ? 'completed' : pick(statuses), source: store ? 'store' : 'online',
      paymentMethod: store ? pick(['cash', 'upi', 'card']) : pick(['gpay', 'phonepe', 'card', 'cod']),
      customerName: c.name, customerPhone: c.mobile, customerAddress: store ? '' : 'Hyderabad, Telangana', customerPincode: store ? '' : '5000' + (10 + i % 80),
      salesperson: store ? sp.name : '', salespersonId: store ? sp.id : '',
      invoiceNo: 'YK-' + String(1001 + i), createdAt: iso(now - Math.floor(rnd() * 60) * day - Math.floor(rnd() * 10) * 3600000)
    });
  }

  db.colls.coupons = [
    { id: rid(), code: 'YUKK10', discountType: 'percent', discountValue: 10, expiresAt: iso(now + 20 * day), used: false, createdAt: iso(now - 5 * day) },
    { id: rid(), code: 'FEST500', discountType: 'amount', discountValue: 500, expiresAt: iso(now + 40 * day), used: false, createdAt: iso(now - 2 * day) },
    { id: rid(), code: 'BRIDE15', discountType: 'percent', discountValue: 15, expiresAt: iso(now - 3 * day), used: true, createdAt: iso(now - 30 * day) }
  ];

  const exp = [['Rent', 'Shop rent — New Nallakunta', 45000], ['Rent', 'Shop rent — Jubilee Hills', 65000], ['Electricity', 'TSSPDCL bill', 6200], ['Salaries', 'Staff salaries', 85000], ['Marketing', 'Instagram ads', 8000], ['Packaging', 'Saree boxes & bags', 3500], ['Maintenance', 'AC service', 2400], ['Transport', 'Courier charges', 4100]];
  db.colls.expenses = [];
  [1, 0].forEach((m) => exp.forEach((e, i) => {
    const dt = new Date(); dt.setMonth(dt.getMonth() - m); dt.setDate(Math.min(28, 2 + i * 3));
    if (dt.getTime() > now) return;
    db.colls.expenses.push({ id: rid(), category: e[0], note: e[1], amount: e[2], paidVia: pick(['bank', 'upi', 'cash']), date: dt.toISOString().slice(0, 10), createdAt: iso(dt) });
  }));

  db.colls.suppliers = [
    { id: rid(), name: 'Sri Lakshmi Silks', place: 'Kanchipuram', phone: '+919443012345', gstin: '', specialty: 'Kanjivaram, Kuppadam', balance: 85000 },
    { id: rid(), name: 'Varanasi Weaves Co.', place: 'Varanasi', phone: '+919415098765', gstin: '', specialty: 'Banarasi', balance: 0 },
    { id: rid(), name: 'Gadwal Handlooms', place: 'Gadwal', phone: '+919440076543', gstin: '', specialty: 'Soft silk, cotton', balance: 22000 }
  ];
  db.colls.purchases = [
    { id: rid(), supplierId: db.colls.suppliers[0].id, supplierName: db.colls.suppliers[0].name, billNo: 'SLS-221', date: iso(now - 20 * day).slice(0, 10), pieces: 12, amount: 185000, paid: 100000, note: 'Wedding season stock' },
    { id: rid(), supplierId: db.colls.suppliers[2].id, supplierName: db.colls.suppliers[2].name, billNo: 'GH-87', date: iso(now - 8 * day).slice(0, 10), pieces: 20, amount: 62000, paid: 40000, note: '' }
  ];
  // sample reviews (demo only — never shown on the website)
  const rv = [[5, 'Even more beautiful in person', 'The zari is rich and the colour is exactly as shown. Wore it for my cousin’s wedding and got so many compliments.', 'approved'],
    [4, 'Lovely drape', 'Soft silk, easy to drape for a full day. Blouse piece was a perfect match.', 'approved'],
    [5, 'Perfect for Varalakshmi vratham', 'Beautiful border and pallu. Packing was neat and it reached in 3 days.', 'pending'],
    [3, 'Good, colour slightly darker', 'Quality is good but the shade is a little darker than the photo.', 'pending']];
  db.colls.reviews = rv.map((r, i) => { const s = priced[i * 3]; const c = db.colls.customers[i];
    return { id: rid(), productId: s.id, productName: s.name, rating: r[0], title: r[1], text: r[2], name: c.name.split(' ')[0] + ' ' + (c.name.split(' ')[1] || 'K')[0] + '.', uid: 'demo-' + i, status: r[3], verified: r[3] === 'approved', createdAt: iso(now - (i + 1) * 2 * day) }; });
  db.colls.payroll = []; db.colls.stockMoves = []; db.colls.users = []; db.colls.invites = [];
  return db;
}

export async function createDemoBackend() {
  let db;
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; } };
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { console.warn('Demo data not saved (storage full?)', e); } };
  db = load();
  if (!db) { db = await buildSeed(); save(); }
  const coll = (c) => (db.colls[c] = db.colls[c] || []);
  const prep = (data) => { const o = {}; for (const k in data) { if (data[k] === undefined) continue; o[k] = data[k] === NOW ? new Date().toISOString() : data[k]; } return o; };
  const clone = (x) => JSON.parse(JSON.stringify(x));
  let session = null;
  const DEMO_USER = { uid: 'demo', email: 'owner@demo', role: 'super_admin', isOwner: true, label: 'Demo · Owner' };

  return {
    mode: 'demo', NOW,
    async signIn() { session = DEMO_USER; sessionStorage.setItem('yka_demo_session', '1'); return session; },
    async signOut() { session = null; sessionStorage.removeItem('yka_demo_session'); },
    async restore() { session = sessionStorage.getItem('yka_demo_session') ? DEMO_USER : null; return session; },
    session: () => session,
    async reset() { localStorage.removeItem(KEY); db = await buildSeed(); save(); },
    async list(c, opts) {
      let rows = coll(c);
      if (opts && opts.where) { const [f, op, v] = opts.where; rows = rows.filter((r) => op === 'array-contains' ? (r[f] || []).includes(v) : r[f] === v); }
      return clone(rows);
    },
    async get(c, id) { const r = coll(c).find((x) => x.id === id); return r ? clone(r) : null; },
    async add(c, data) { const id = rid(); coll(c).push({ id, ...prep({ createdAt: NOW, ...data }) }); save(); return id; },
    async set(c, id, data) { const r = coll(c).find((x) => x.id === id); if (r) Object.assign(r, prep(data)); else coll(c).push({ id, ...prep(data) }); save(); return id; },
    async update(c, id, patch) { const r = coll(c).find((x) => x.id === id); if (!r) throw new Error('Not found'); Object.assign(r, prep(patch)); save(); },
    async remove(c, id) { db.colls[c] = coll(c).filter((x) => x.id !== id); save(); },
    async getProject() { return clone(db.project); },
    async updateProject(patch) { Object.assign(db.project, prep(patch)); save(); }
  };
}
