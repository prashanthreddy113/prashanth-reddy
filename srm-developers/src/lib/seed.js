// Demo data for SRM Developers. Everything here is sample content that the
// admin can edit (or wipe with Settings → Reset) — replace RERA numbers,
// prices and project details with the real ones before going live.
import { addDays, toISO, uid } from './format'
import { costSheet, planFor, schedule } from './pricing'

export const DEFAULT_TAXES = {
  gstResidential: 5,
  gstCommercial: 12,
  stampDuty: 5.5,
  transferDuty: 1.5,
  registration: 0.5,
}

export const COMPANY = {
  name: 'SRM Developers',
  tagline: 'Building landmarks in Narsingi',
  phone: '+91 90000 12345',
  whatsapp: '919000012345',
  email: 'sales@srmdevelopers.in',
  address: 'SRM Experience Centre, Narsingi Main Road, Near ORR Exit 18, Narsingi, Hyderabad, Telangana 500089',
  hours: 'Mon–Sun, 9:30 AM – 7:30 PM',
}

export const LOCATION_ADVANTAGES = [
  ['ORR Narsingi exit', '2 min'],
  ['Financial District', '10 min'],
  ['Kokapet / Neopolis', '8 min'],
  ['Gachibowli', '15 min'],
  ['HITEC City', '22 min'],
  ['RGI Airport (via ORR)', '30 min'],
  ['International schools', '5 min'],
  ['Multi-speciality hospitals', '10 min'],
]

export const AMENITY_ICONS = {
  'Clubhouse': '🏛️', 'Swimming pool': '🏊', 'Gym': '🏋️', "Kids' play area": '🛝', 'Jogging track': '🏃',
  'Indoor games': '🎱', 'Party hall': '🎉', 'Landscaped gardens': '🌳', '24×7 security': '🛡️',
  'Power backup': '⚡', 'EV charging': '🔌', 'Rainwater harvesting': '💧', 'Yoga deck': '🧘',
  'Tennis court': '🎾', 'Cricket practice nets': '🏏', 'Mini theatre': '🎬', 'Co-working lounge': '💻',
  'Food court': '🍽️', 'High-speed elevators': '🛗', 'Ample parking': '🅿️', 'Central AC': '❄️',
  'Gated layout': '🚧', 'Black-top roads': '🛣️', 'Underground drainage': '🚰', 'Avenue plantation': '🌴',
  'Conference centre': '📊', 'Retail atrium': '🛍️', 'Fire safety': '🧯', 'Smart home': '🏠',
}

export const PROJECTS = [
  {
    id: 'p_skyline', slug: 'srm-skyline-residences', name: 'SRM Skyline Residences',
    category: 'Residential', type: 'Apartments', art: 'tower',
    palette: ['#7c3aed', '#ec4899'],
    tagline: 'Gated-community 2 & 3 BHK apartments with skyline views',
    description:
      'Four G+20 towers on 5.2 acres with 70% open space, a 40,000 sq ft clubhouse and uninterrupted views of the Narsingi skyline. Vastu-compliant homes with large balconies, three-side ventilation and smart-home provisions — minutes from the Financial District.',
    status: 'Under Construction', possession: 'Dec 2028', rera: 'P024000-SAMPLE-01',
    land: '5.2 acres', structure: '4 towers · G+20 · 320 homes', configs: '2 & 3 BHK · 1,240 – 1,850 sq ft',
    progress: 42, featured: true,
    baseRate: 7800, floorRise: 25, plc: 100, plcFacings: ['East'], parking: 300000, clubFee: 250000,
    maintenance: 3, areaUnit: 'sq ft',
    amenities: ['Clubhouse', 'Swimming pool', 'Gym', "Kids' play area", 'Jogging track', 'Indoor games', 'Party hall', 'Yoga deck', 'Mini theatre', 'EV charging', 'Power backup', '24×7 security', 'Rainwater harvesting', 'Smart home'],
    highlights: ['70% open space', 'IGBC green building', '3-side ventilated homes', '2 car parks for 3 BHK'],
  },
  {
    id: 'p_gardenia', slug: 'srm-gardenia-villas', name: 'SRM Gardenia Villas',
    category: 'Residential', type: 'Villas', art: 'villa',
    palette: ['#059669', '#84cc16'],
    tagline: 'Ready-to-move 4 BHK triplex villas in a private garden enclave',
    description:
      '96 East & West facing triplex villas on 12 acres with private gardens, home theatre provision, a lift shaft in every villa and a resort-style clubhouse. Move in today — occupancy certificate received.',
    status: 'Ready to Move', possession: 'Ready', rera: 'P024000-SAMPLE-02',
    land: '12 acres', structure: '96 triplex villas', configs: '4 BHK · 3,800 – 4,500 sq ft',
    progress: 100, featured: true,
    baseRate: 10500, floorRise: 0, plc: 250, plcFacings: ['East', 'North'], parking: 0, clubFee: 500000,
    maintenance: 4, areaUnit: 'sq ft',
    amenities: ['Clubhouse', 'Swimming pool', 'Gym', 'Tennis court', 'Cricket practice nets', 'Landscaped gardens', "Kids' play area", 'Jogging track', '24×7 security', 'Power backup', 'EV charging', 'Smart home'],
    highlights: ['Occupancy certificate received', 'Private garden in every villa', 'Lift provision', 'Only 96 families'],
  },
  {
    id: 'p_trade', slug: 'srm-trade-tower', name: 'SRM Trade Tower',
    category: 'Commercial', type: 'Office space', art: 'office',
    palette: ['#0284c7', '#06b6d4'],
    tagline: 'Grade-A office spaces for sale & lease on the Narsingi–Kokapet corridor',
    description:
      'A LEED-ready G+15 business address with 1,200 to 3,600 sq ft office floors (combinable up to full floors), high-speed elevators, 100% power backup and a business lounge. Buy for steady rental yield or lease ready-to-fit-out space for your team.',
    status: 'New Launch', possession: 'Jun 2029', rera: 'P024000-SAMPLE-03',
    land: '2.1 acres', structure: 'G+15 · 60 office units', configs: 'Offices · 1,200 – 3,600 sq ft',
    progress: 12, featured: true, leaseRate: 75,
    baseRate: 9500, floorRise: 30, plc: 0, plcFacings: [], parking: 400000, clubFee: 0,
    maintenance: 5, areaUnit: 'sq ft',
    amenities: ['High-speed elevators', 'Central AC', 'Power backup', 'Conference centre', 'Co-working lounge', 'Food court', 'Ample parking', 'Fire safety', 'EV charging', '24×7 security'],
    highlights: ['Pre-leased options with ~7% yield', 'Full-floor plates of 9,000 sq ft', 'Metro corridor (proposed)', '1:1000 parking ratio'],
  },
  {
    id: 'p_galleria', slug: 'srm-galleria', name: 'SRM Galleria',
    category: 'Commercial', type: 'Retail & showrooms', art: 'retail',
    palette: ['#f59e0b', '#ef4444'],
    tagline: 'High-street retail, F&B and showrooms on Narsingi Main Road',
    description:
      'A G+2 high-street destination with 120 ft road frontage, double-height showrooms, a central atrium and F&B terraces. Surrounded by 25,000+ new homes — perfect for brands, clinics, cafés and franchise outlets.',
    status: 'Ready to Move', possession: 'Ready', rera: 'P024000-SAMPLE-04',
    land: '1.4 acres', structure: 'G+2 · 30 shops & showrooms', configs: 'Retail · 400 – 3,000 sq ft',
    progress: 100, featured: true, leaseRate: 120,
    baseRate: 14000, floorRise: 0, plc: 1500, plcFacings: ['Main road'], parking: 0, clubFee: 0,
    maintenance: 6, areaUnit: 'sq ft',
    amenities: ['Retail atrium', 'Food court', 'Ample parking', 'Central AC', 'Power backup', 'Fire safety', 'High-speed elevators', '24×7 security'],
    highlights: ['120 ft main-road frontage', 'Double-height showrooms', 'Ready for fit-out', 'Brand-anchored footfall'],
  },
  {
    id: 'p_enclave', slug: 'srm-elite-enclave', name: 'SRM Elite Enclave',
    category: 'Plots', type: 'Open plots', art: 'plot',
    palette: ['#db2777', '#f97316'],
    tagline: 'HMDA-approved gated villa plots off the Narsingi–Shankarpally road',
    description:
      'A 22-acre gated plotted development with 40 ft & 60 ft black-top roads, underground electrical and drainage, avenue plantation and a clubhouse — build your dream home at your own pace.',
    status: 'Under Development', possession: 'Mar 2027', rera: 'P024000-SAMPLE-05',
    land: '22 acres', structure: '120 villa plots', configs: 'Plots · 200 – 500 sq yd',
    progress: 68, featured: false,
    baseRate: 55000, floorRise: 0, plc: 3000, plcFacings: ['East', 'Corner'], parking: 0, clubFee: 200000,
    maintenance: 0, areaUnit: 'sq yd',
    amenities: ['Gated layout', 'Black-top roads', 'Underground drainage', 'Avenue plantation', 'Clubhouse', "Kids' play area", '24×7 security', 'Rainwater harvesting'],
    highlights: ['HMDA approved', 'Clear title & bank-loan ready', '60 ft main avenue', 'Corner & East plots available'],
  },
]

// --- deterministic random ---
function rng(seed) {
  let a = seed
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function makeUnits(rand) {
  const units = []
  const pickStatus = (soldP, bookedP, holdP) => {
    const r = rand()
    if (r < soldP) return 'sold'
    if (r < soldP + bookedP) return 'booked'
    if (r < soldP + bookedP + holdP) return 'hold'
    return 'available'
  }
  // Skyline: 4 towers x 20 floors x 4 units
  const sk = [
    ['3 BHK', 1850, 'East'], ['2 BHK', 1240, 'West'], ['2 BHK', 1310, 'North'], ['3 BHK', 1650, 'East'],
  ]
  for (const tower of ['A', 'B', 'C', 'D'])
    for (let f = 1; f <= 20; f++)
      sk.forEach(([config, area, facing], i) => {
        const lowFloorBias = f < 8 ? 0.12 : 0
        units.push({
          id: `u_sk_${tower}${f}0${i + 1}`, projectId: 'p_skyline', tower, floor: f,
          no: `${tower}-${f}0${i + 1}`, config, area, facing,
          status: pickStatus(0.42 + lowFloorBias, 0.05, 0.03),
        })
      })
  // Gardenia: 96 villas in 2 phases
  for (let v = 1; v <= 96; v++) {
    const big = v % 3 === 0
    units.push({
      id: `u_gv_${v}`, projectId: 'p_gardenia', tower: v <= 48 ? 'Phase 1' : 'Phase 2', floor: 0,
      no: `V-${String(v).padStart(3, '0')}`, config: '4 BHK Villa', area: big ? 4500 : 3800,
      facing: ['East', 'West', 'North', 'West'][v % 4], status: pickStatus(0.62, 0.06, 0.03),
    })
  }
  // Trade Tower: 15 floors x 4 offices
  const tt = [[1200, 'North'], [2400, 'East'], [1800, 'West'], [3600, 'South']]
  for (let f = 1; f <= 15; f++)
    tt.forEach(([area, facing], i) => {
      const r = rand()
      units.push({
        id: `u_tt_${f}0${i + 1}`, projectId: 'p_trade', tower: 'Tower 1', floor: f,
        no: `T-${f}0${i + 1}`, config: 'Office', area, facing, forLease: true,
        status: r < 0.18 ? 'sold' : r < 0.26 ? 'booked' : r < 0.34 ? 'leased' : r < 0.38 ? 'hold' : 'available',
      })
    })
  // Galleria: G, 1, 2 x 10 shops
  const ga = [3000, 1200, 800, 400, 600, 600, 400, 800, 1200, 2200]
  for (let f = 0; f <= 2; f++)
    ga.forEach((area, i) => {
      const r = rand()
      units.push({
        id: `u_ga_${f}${i + 1}`, projectId: 'p_galleria', tower: 'Galleria', floor: f,
        no: `${f === 0 ? 'G' : f}-${String(i + 1).padStart(2, '0')}`,
        config: area >= 2000 ? 'Showroom' : 'Shop', area,
        facing: f === 0 && i < 5 ? 'Main road' : 'Atrium', forLease: true,
        status: r < 0.3 ? 'sold' : r < 0.55 ? 'leased' : r < 0.6 ? 'hold' : 'available',
      })
    })
  // Enclave: 120 plots
  const sizes = [200, 267, 300, 400, 500]
  for (let p = 1; p <= 120; p++) {
    units.push({
      id: `u_ee_${p}`, projectId: 'p_enclave', tower: p <= 60 ? 'Block A' : 'Block B', floor: 0,
      no: `P-${String(p).padStart(3, '0')}`, config: 'Plot', area: sizes[p % 5],
      facing: p % 10 === 0 ? 'Corner' : ['East', 'West', 'North', 'South'][p % 4],
      status: pickStatus(0.48, 0.07, 0.03),
    })
  }
  return units
}

const FIRST = ['Ravi', 'Sravani', 'Kiran', 'Lakshmi', 'Arjun', 'Divya', 'Suresh', 'Anusha', 'Venkat', 'Pooja', 'Rahul', 'Keerthi', 'Mahesh', 'Swathi', 'Naveen', 'Harika', 'Srinivas', 'Bhavana', 'Ajay', 'Meghana', 'Praveen', 'Sowmya', 'Vamsi', 'Ramya', 'Karthik', 'Nikhila', 'Sai', 'Deepika', 'Rohit', 'Tejaswi', 'Imran', 'Ayesha', 'John', 'Priya', 'Vikram', 'Neha']
const LAST = ['Reddy', 'Rao', 'Goud', 'Sharma', 'Naidu', 'Varma', 'Chowdary', 'Kumar', 'Yadav', 'Patel', 'Khan', 'Iyer', 'Gupta', 'Shetty', 'Menon']
export const SOURCES = ['Website', 'Walk-in', '99acres', 'MagicBricks', 'Housing.com', 'Referral', 'Channel partner', 'Instagram / Facebook', 'Google Ads', 'Hoarding']
export const STAGES = ['New', 'Contacted', 'Site visit', 'Negotiation', 'Booked', 'Lost']
export const TEAM = [
  { id: 't1', name: 'Ravi Teja', role: 'Sales Head', phone: '9000011111' },
  { id: 't2', name: 'Sneha Reddy', role: 'Senior Sales Manager', phone: '9000022222' },
  { id: 't3', name: 'Arjun Rao', role: 'Sales Manager – Commercial', phone: '9000033333' },
  { id: 't4', name: 'Priya Sharma', role: 'Sales Executive', phone: '9000044444' },
  { id: 't5', name: 'Kiran Goud', role: 'CRM & Collections', phone: '9000055555' },
]

export function buildSeed() {
  const rand = rng(20261112)
  const pick = (a) => a[Math.floor(rand() * a.length)]
  const phone = () => '9' + String(Math.floor(rand() * 1e9)).padStart(9, '0')
  const name = () => `${pick(FIRST)} ${pick(LAST)}`
  const today = toISO(new Date())
  const projects = PROJECTS.map((p) => ({ ...p }))
  const byId = Object.fromEntries(projects.map((p) => [p.id, p]))
  const units = makeUnits(rand)

  const partners = [
    ['Hyderabad Homes Realty', 'Mahesh Varma', 2],
    ['Cyberabad Property Point', 'Ayesha Khan', 2],
    ['Square Yards Partner – Gachibowli', 'Karthik Iyer', 1.5],
    ['NRI Nest Advisors', 'John Mathew', 2.5],
    ['Kokapet Realty Hub', 'Swathi Naidu', 2],
    ['TrustLand Consultants', 'Praveen Yadav', 1.5],
  ].map(([firm, person, pct], i) => ({
    id: `cp${i + 1}`, firm, name: person, phone: phone(), email: `${person.split(' ')[0].toLowerCase()}@example.com`,
    rera: `A024000-SAMPLE-${100 + i}`, commissionPct: pct, status: i === 5 ? 'Pending' : 'Approved',
    createdAt: addDays(today, -300 + i * 40),
  }))

  // Bookings for every booked / sold unit
  const customers = []
  const bookings = []
  const payments = []
  let code = 1001
  units.forEach((u) => {
    if (u.status !== 'sold' && u.status !== 'booked') return
    const p = byId[u.projectId]
    const c = { id: uid('c'), name: name(), phone: phone(), email: '', pan: '', address: 'Hyderabad', createdAt: '' }
    c.email = `${c.name.split(' ')[0].toLowerCase()}${Math.floor(rand() * 90 + 10)}@example.com`
    const ageDays = u.status === 'booked' ? Math.floor(rand() * 60) : 60 + Math.floor(rand() * 600)
    const date = addDays(today, -ageDays)
    c.createdAt = date
    customers.push(c)
    const discount = rand() < 0.3 ? (p.category === 'Plots' ? 1000 : 100) : 0
    const cs = costSheet(u, p, DEFAULT_TAXES, discount)
    const b = {
      id: uid('b'), code: `SRM-BK-${code++}`, unitId: u.id, projectId: p.id, customerId: c.id, date,
      plan: planFor(p), discount, lines: cs.lines, agreementValue: Math.round(cs.agreementValue),
      gst: Math.round(cs.gst), gstPct: cs.gstPct, payable: Math.round(cs.payable),
      partnerId: rand() < 0.35 ? pick(partners.slice(0, 5)).id : null, commissionPaid: rand() < 0.5,
      loan: rand() < 0.6 ? { bank: pick(['SBI', 'HDFC Bank', 'ICICI Bank', 'Axis Bank', 'LIC HFL']), amount: Math.round(cs.payable * 0.75 / 1e5) * 1e5, status: pick(['Sanctioned', 'Disbursing', 'Applied']) } : null,
      status: u.status === 'sold' && p.status === 'Ready to Move' && ageDays > 90 ? 'Registered' : 'Active',
      demands: {}, salesPerson: pick(TEAM.slice(0, 4)).id,
    }
    bookings.push(b)
    // Pay milestones that are due, with some customers falling behind.
    const sched = schedule(b, [])
    const behind = rand() < 0.12
    const lastDue = sched.filter((x) => x.dueDate <= today).length - 1
    sched.forEach((m, i) => {
      if (m.dueDate > today) return
      // A few customers have paid only part of their latest instalment.
      const amount = behind && i === lastDue && i > 0 ? Math.round(m.amount * (b.plan === 'clp' ? 0.4 : 0.85)) : m.amount
      payments.push({
        id: uid('pay'), bookingId: b.id, amount, date: addDays(m.dueDate, Math.floor(rand() * 10)),
        mode: pick(['NEFT', 'RTGS', 'Cheque', 'Home loan disbursement', 'UPI']),
        ref: `TXN${Math.floor(rand() * 1e8)}`, note: m.name,
      })
    })
  })
  payments.forEach((p) => { if (p.date > today) p.date = today })

  // Leases for leased commercial units
  const brands = ['Brew Republic Café', 'Apollo Pharmacy Franchise', 'FitZone Gym', 'Lenskart Store', 'Smile Dental Clinic', 'Tata Croma Express', 'Kidz Learning Centre', 'Pizza Hub', 'Naturals Salon', 'CodeCraft Technologies', 'FinEdge Advisors', 'Nimbus Analytics', 'BlueOak Architects', 'GreenGrid Energy']
  const leases = []
  const rentPayments = []
  units.filter((u) => u.status === 'leased').forEach((u, i) => {
    const p = byId[u.projectId]
    const start = addDays(today, -Math.floor(rand() * 500) - 30)
    const rent = Math.round((u.area * p.leaseRate) / 100) * 100
    const l = {
      id: uid('ls'), unitId: u.id, projectId: p.id, tenant: brands[i % brands.length], contact: name(), phone: phone(),
      start: start.slice(0, 8) + '01', months: pick([36, 60, 108]), rent, deposit: rent * 6, escalation: 5, lockIn: 36, status: 'Active',
    }
    leases.push(l)
    let m = new Date(l.start + 'T00:00:00')
    const now = new Date()
    while (m <= now) {
      const key = toISO(m).slice(0, 7)
      const late = key === today.slice(0, 7) || (rand() < 0.06)
      if (!late) rentPayments.push({ id: uid('rp'), leaseId: l.id, month: key, amount: rent, date: key + '-05', mode: 'NEFT' })
      m.setMonth(m.getMonth() + 1)
    }
  })

  // Leads
  const leads = []
  const availableConfigs = ['2 BHK', '3 BHK', '4 BHK Villa', 'Office', 'Shop', 'Showroom', 'Plot']
  for (let i = 0; i < 64; i++) {
    const p = pick(projects)
    const cfg = { p_skyline: pick(['2 BHK', '3 BHK']), p_gardenia: '4 BHK Villa', p_trade: 'Office', p_galleria: pick(['Shop', 'Showroom']), p_enclave: 'Plot' }[p.id] || pick(availableConfigs)
    const created = addDays(today, -Math.floor(rand() * 90))
    const stageR = rand()
    const stage = stageR < 0.25 ? 'New' : stageR < 0.48 ? 'Contacted' : stageR < 0.66 ? 'Site visit' : stageR < 0.8 ? 'Negotiation' : stageR < 0.9 ? 'Booked' : 'Lost'
    const n = name()
    leads.push({
      id: uid('ld'), name: n, phone: phone(), email: `${n.split(' ')[0].toLowerCase()}@example.com`,
      projectId: p.id, config: cfg, budget: pick(['50L – 80L', '80L – 1.2Cr', '1.2Cr – 2Cr', '2Cr – 3.5Cr', '3.5Cr+']),
      source: pick(SOURCES), stage, assignedTo: p.category === 'Commercial' ? 't3' : pick(['t1', 't2', 't4']),
      purpose: p.category === 'Commercial' ? pick(['Buy – investment', 'Lease', 'Buy – own use']) : pick(['Self use', 'Investment']),
      followUp: stage === 'Booked' || stage === 'Lost' ? '' : addDays(today, Math.floor(rand() * 10) - 3),
      createdAt: created, rating: pick(['Hot', 'Warm', 'Cold']),
      notes: [{ at: created + 'T10:30:00', by: 'System', text: `Enquiry received via ${pick(SOURCES)}.` }],
    })
  }

  // Site visits
  const visits = []
  leads.filter((l) => l.stage === 'Site visit' || l.stage === 'Negotiation' || l.stage === 'Booked').forEach((l, i) => {
    const offset = i % 3 === 0 ? Math.floor(rand() * 6) : -Math.floor(rand() * 30) - 1
    visits.push({
      id: uid('sv'), leadId: l.id, name: l.name, phone: l.phone, projectId: l.projectId,
      date: addDays(today, offset), time: pick(['10:30', '11:30', '13:00', '15:30', '17:00']),
      status: offset >= 0 ? 'Scheduled' : pick(['Completed', 'Completed', 'Completed', 'No show']),
      agent: l.assignedTo, pickup: rand() < 0.3, feedback: offset >= 0 ? '' : pick(['Liked the clubhouse, discussing with family', 'Wants higher floor, East facing', 'Comparing with Kokapet projects', 'Budget stretch — needs loan eligibility check', 'Very positive, wants cost sheet']),
    })
  })

  // Owner listings (resale / rent / lease marketplace)
  const ownerListings = [
    ['Sell', 'Residential', 'Apartment', '3 BHK resale in SRM Skyline Tower A, 12th floor', 1650, 15500000, 'Narsingi', 'Approved'],
    ['Rent', 'Residential', 'Villa', '4 BHK furnished villa for rent – Gardenia Phase 1', 3800, 145000, 'Narsingi', 'Approved'],
    ['Lease', 'Commercial', 'Office', 'Plug-and-play 2,400 sq ft office, 60 seats', 2400, 180000, 'Kokapet', 'Approved'],
    ['Sell', 'Plots', 'Plot', '300 sq yd East-facing plot, Elite Enclave Block A', 300, 17400000, 'Narsingi', 'Approved'],
    ['Rent', 'Residential', 'Apartment', '2 BHK semi-furnished near ORR', 1240, 38000, 'Puppalaguda', 'Approved'],
    ['Lease', 'Commercial', 'Shop', 'Ground-floor café space with outdoor seating', 800, 95000, 'Narsingi', 'Pending'],
    ['Sell', 'Residential', 'Apartment', '2 BHK resale, ready to move, park facing', 1310, 9900000, 'Manikonda', 'Pending'],
  ].map(([kind, category, ptype, title, area, price, locality, status], i) => ({
    id: uid('ol'), kind, category, ptype, title, area, price, locality, status,
    areaUnit: category === 'Plots' ? 'sq yd' : 'sq ft', ownerName: name(), phone: phone(),
    description: 'Owner-listed property, verified by the SRM team.', createdAt: addDays(today, -i * 6 - 2),
  }))

  const updates = [
    ['p_skyline', -12, 'Tower A & B: 9th slab completed', 'Slab casting for the 9th floor finished in Towers A and B. Tower C at 7th, Tower D at 6th floor.', 42],
    ['p_skyline', -58, 'Clubhouse foundation complete', 'Raft foundation for the 40,000 sq ft clubhouse completed ahead of schedule.', 36],
    ['p_trade', -20, 'Excavation & shoring done', 'Basement excavation and secant-pile shoring completed; raft work starting.', 12],
    ['p_enclave', -9, 'Black-top roads – Block A complete', '40 ft and 60 ft roads laid in Block A. Underground drainage 80% done in Block B.', 68],
    ['p_gardenia', -30, 'Handovers: 54 families moved in', 'Occupancy certificate received; handovers running every weekend.', 100],
    ['p_galleria', -15, 'New brands signed', 'A café chain, a pharmacy and a fitness studio have signed leases on the ground floor.', 100],
  ].map(([projectId, d, title, text, progress]) => ({ id: uid('up'), projectId, date: addDays(today, d), title, text, progress }))

  const booked = bookings.slice(0, 6)
  const tickets = [
    ['Documentation', 'Need copy of agreement of sale', 'Please share a scanned copy of my agreement of sale for the bank.', 'Open'],
    ['Payment', 'Payment receipt not received', 'Paid the 5th slab instalment via NEFT last week, receipt pending.', 'In progress'],
    ['Customization', 'Change of kitchen platform', 'Can we change the kitchen platform to an L-shape?', 'Open'],
    ['Loan', 'NOC for home loan', 'HDFC needs an NOC from the builder for disbursement.', 'Resolved'],
    ['Construction', 'Site visit to see my flat', 'Would like to visit the site this Sunday to see progress.', 'Open'],
    ['Handover', 'Snag list after handover', 'Two bathroom tiles cracked and a door lock is loose.', 'In progress'],
  ].map(([category, subject, description, status], i) => ({
    id: uid('tk'), code: `TKT-${2001 + i}`, bookingId: booked[i]?.id, category, subject, description, status,
    createdAt: addDays(today, -i * 3 - 1) + 'T11:00:00',
    replies: status !== 'Open' ? [{ by: 'SRM CRM', text: 'Thank you, we are looking into this.', at: addDays(today, -i * 3) + 'T12:00:00' }] : [],
  }))

  return {
    version: 1,
    settings: { company: { ...COMPANY }, taxes: { ...DEFAULT_TAXES }, team: TEAM.map((t) => ({ ...t })), admin: { email: 'admin@srmdevelopers.in', password: 'srm@123' } },
    projects, units, customers, bookings, payments, partners, leases, rentPayments, leads, visits, ownerListings, updates, tickets,
    enquiries: [],
  }
}
