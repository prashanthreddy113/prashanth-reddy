import { useMemo, useState } from 'react'
import { Link, useNavigate, useOutletContext } from 'react-router-dom'
import { useStore } from '../lib/store'
import { projectSummary } from '../lib/derive'
import { ProjectCard } from '../components/Cards'
import PropertyArt from '../components/PropertyArt'
import { EnquiryForm } from '../components/forms'
import { AMENITY_ICONS, LOCATION_ADVANTAGES } from '../lib/seed'
import { fmtDate, num } from '../lib/format'

const TESTIMONIALS = [
  ['Harika & Vamsi', 'Skyline Residences, Tower B', 'The cost sheet was transparent to the last rupee and the CRM team sends construction photos every month. Booking our 3 BHK was the easiest big decision we made.'],
  ['Dr. Srinivas Rao', 'Galleria, Shop G-03', 'We opened our clinic within six weeks of possession. The footfall from the surrounding gated communities is fantastic.'],
  ['Nikhila Menon (NRI, Dallas)', 'Gardenia Villas', 'The NRI desk handled everything over video calls — site walkthrough, loan, registration via PoA. Truly hassle-free.'],
  ['CodeCraft Technologies', 'Trade Tower, 7th floor', 'Leasing a plug-and-play office 10 minutes from the Financial District saved our team hours of commute every week.'],
]

export default function Home() {
  const { projects, units, settings, updates } = useStore()
  const { openVisit } = useOutletContext()
  const nav = useNavigate()
  const [q, setQ] = useState({ category: 'Residential', config: '', budget: '' })
  const summaries = useMemo(() => Object.fromEntries(projects.map((p) => [p.id, projectSummary(p, units, settings.taxes)])), [projects, units, settings.taxes])
  const delivered = units.filter((u) => ['sold', 'booked', 'leased'].includes(u.status)).length
  const search = (e) => {
    e.preventDefault()
    const s = new URLSearchParams()
    if (q.category) s.set('category', q.category)
    if (q.config) s.set('config', q.config)
    if (q.budget) s.set('budget', q.budget)
    nav(`/properties?${s}`)
  }
  const configs = q.category === 'Commercial' ? ['Office', 'Shop', 'Showroom'] : q.category === 'Plots' ? ['Plot'] : ['2 BHK', '3 BHK', '4 BHK Villa']

  return (
    <>
      <section className="hero">
        <div className="hero-bg"><span className="blob b1" /><span className="blob b2" /><span className="blob b3" /></div>
        <div className="wrap hero-grid">
          <div className="hero-copy">
            <span className="eyebrow">✨ Narsingi · West Hyderabad</span>
            <h1>Homes that rise with you.<br /><span className="grad-text">Spaces that grow your business.</span></h1>
            <p className="lead">Gated-community apartments, garden villas, HMDA plots and Grade-A offices & retail — all on Hyderabad's most connected growth corridor, minutes from the Financial District and ORR.</p>
            <form className="search-box" onSubmit={search}>
              <div className="seg">
                {['Residential', 'Commercial', 'Plots'].map((c) => (
                  <button type="button" key={c} className={q.category === c ? 'on' : ''} onClick={() => setQ({ ...q, category: c, config: '' })}>{c}</button>
                ))}
              </div>
              <div className="search-row">
                <select value={q.config} onChange={(e) => setQ({ ...q, config: e.target.value })} aria-label="Type">
                  <option value="">All types</option>
                  {configs.map((c) => <option key={c}>{c}</option>)}
                </select>
                <select value={q.budget} onChange={(e) => setQ({ ...q, budget: e.target.value })} aria-label="Budget">
                  <option value="">Any budget</option>
                  <option value="0-10000000">Under ₹1 Cr</option>
                  <option value="10000000-20000000">₹1 – 2 Cr</option>
                  <option value="20000000-50000000">₹2 – 5 Cr</option>
                  <option value="50000000-999999999">₹5 Cr+</option>
                </select>
                <button className="btn btn-primary">Search</button>
              </div>
            </form>
            <div className="hero-actions">
              <button className="btn btn-glow" onClick={() => openVisit()}>📅 Book a free site visit</button>
              <Link className="btn btn-ghost" to="/tools">Calculate EMI →</Link>
            </div>
          </div>
          <div className="hero-art">
            <div className="hero-card hc1"><PropertyArt kind="tower" palette={['#7c3aed', '#ec4899']} seed={3} /></div>
            <div className="hero-card hc2"><PropertyArt kind="office" palette={['#0284c7', '#06b6d4']} seed={5} /></div>
            <div className="hero-card hc3"><PropertyArt kind="villa" palette={['#059669', '#84cc16']} seed={2} /></div>
            <div className="hero-chip chip1">🏆 RERA registered projects</div>
            <div className="hero-chip chip2">🔑 {num(delivered)}+ units sold & leased</div>
          </div>
        </div>
      </section>

      <section className="wrap stats-band">
        {[['5', 'Landmark projects'], ['40+', 'Acres developed'], [num(delivered) + '+', 'Happy families & businesses'], ['15+', 'Years of trust']].map(([v, l]) => (
          <div key={l}><b className="grad-text">{v}</b><span>{l}</span></div>
        ))}
      </section>

      <section className="wrap section">
        <div className="section-head">
          <div><span className="eyebrow">Our projects</span><h2>Featured developments in Narsingi</h2></div>
          <Link to="/projects" className="btn btn-ghost">View all projects →</Link>
        </div>
        <div className="grid-3">
          {projects.filter((p) => p.featured).map((p) => <ProjectCard key={p.id} project={p} summary={summaries[p.id]} />)}
        </div>
      </section>

      <section className="split-promo">
        <Link to="/residential" className="promo promo-res">
          <PropertyArt kind="tower" palette={['#7c3aed', '#db2777']} seed={9} />
          <div className="promo-copy">
            <span className="eyebrow light">Residential</span>
            <h2>Live in a 5-acre gated community</h2>
            <p>2 & 3 BHK apartments, 4 BHK garden villas and HMDA plots — with clubhouses, pools and 70% open space.</p>
            <span className="btn btn-white">Explore homes →</span>
          </div>
        </Link>
        <Link to="/commercial" className="promo promo-com">
          <PropertyArt kind="office" palette={['#0369a1', '#f59e0b']} seed={4} />
          <div className="promo-copy">
            <span className="eyebrow light">Commercial</span>
            <h2>Offices & retail that earn for you</h2>
            <p>Grade-A offices and high-street shops to buy for rental yield or lease for your business.</p>
            <span className="btn btn-white">Explore commercial →</span>
          </div>
        </Link>
      </section>

      <section className="wrap section">
        <div className="section-head center">
          <div><span className="eyebrow">Why Narsingi</span><h2>Everything West Hyderabad, minutes away</h2></div>
        </div>
        <div className="loc-grid">
          <div className="map-card">
            <NarsingiMap />
          </div>
          <div className="loc-list">
            {LOCATION_ADVANTAGES.map(([place, time], i) => (
              <div key={place} className="loc-item" style={{ '--i': i }}>
                <span className="loc-time">{time}</span><span>{place}</span>
              </div>
            ))}
            <p className="muted small">Approximate drive times in normal traffic.</p>
          </div>
        </div>
      </section>

      <section className="why">
        <div className="wrap">
          <div className="section-head center"><div><span className="eyebrow light">The SRM promise</span><h2>Why families & businesses choose SRM</h2></div></div>
          <div className="grid-4">
            {[
              ['🛡️', 'RERA & clear titles', 'Every project is RERA registered with bank-approved, litigation-free titles.'],
              ['💎', 'Transparent pricing', 'Itemised cost sheets online — GST, floor rise and charges, no surprises.'],
              ['🏗️', 'On-time delivery', 'Live construction updates every month in your customer portal.'],
              ['🤝', 'End-to-end support', 'Home-loan tie-ups, NRI desk, registration and after-sales service.'],
            ].map(([i, t, d]) => (
              <div className="why-card" key={t}><span className="why-icon">{i}</span><h3>{t}</h3><p>{d}</p></div>
            ))}
          </div>
        </div>
      </section>

      <section className="wrap section">
        <div className="section-head center"><div><span className="eyebrow">Lifestyle</span><h2>Amenities you'll love</h2></div></div>
        <div className="amenity-cloud">
          {Object.entries(AMENITY_ICONS).slice(0, 18).map(([a, i]) => <span key={a} className="amenity"><span>{i}</span>{a}</span>)}
        </div>
      </section>

      <section className="wrap section">
        <div className="section-head">
          <div><span className="eyebrow">Construction updates</span><h2>Progress you can track</h2></div>
          <Link to="/portal" className="btn btn-ghost">Customer portal →</Link>
        </div>
        <div className="grid-3">
          {[...updates].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3).map((u) => {
            const p = projects.find((x) => x.id === u.projectId)
            return (
              <div className="update-card" key={u.id} style={{ '--c1': p?.palette[0], '--c2': p?.palette[1] }}>
                <small>{fmtDate(u.date)} · {p?.name}</small>
                <h3>{u.title}</h3>
                <p>{u.text}</p>
              </div>
            )
          })}
        </div>
      </section>

      <section className="testi">
        <div className="wrap">
          <div className="section-head center"><div><span className="eyebrow">Testimonials</span><h2>Stories from our community</h2></div></div>
          <div className="grid-4">
            {TESTIMONIALS.map(([n, w, t]) => (
              <figure key={n} className="testi-card">
                <div className="stars">★★★★★</div>
                <blockquote>“{t}”</blockquote>
                <figcaption><b>{n}</b><span>{w}</span></figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      <section className="wrap section cta-band">
        <div>
          <span className="eyebrow light">Talk to us</span>
          <h2>Get the best price & a free cost sheet</h2>
          <p>Share your details and a relationship manager will call you back within 30 minutes.</p>
        </div>
        <div className="cta-form"><EnquiryForm compact subject="Home page enquiry" cta="Get call back" /></div>
      </section>
    </>
  )
}

export function NarsingiMap() {
  // Stylised (not to scale) map of the neighbourhood.
  const pins = [
    [190, 150, 'SRM Narsingi', true], [120, 70, 'Gachibowli'], [235, 75, 'Financial District'], [270, 130, 'Kokapet'],
    [70, 40, 'HITEC City'], [300, 220, 'To Airport'], [110, 200, 'Puppalaguda'], [55, 150, 'Manikonda'],
  ]
  return (
    <svg viewBox="0 0 360 260" className="nmap" role="img" aria-label="Map of Narsingi and surroundings (illustrative)">
      <defs>
        <linearGradient id="nm" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ede9fe" /><stop offset="1" stopColor="#fce7f3" /></linearGradient>
      </defs>
      <rect width="360" height="260" rx="18" fill="url(#nm)" />
      <ellipse cx="190" cy="140" rx="150" ry="105" fill="none" stroke="#f59e0b" strokeWidth="8" strokeDasharray="1 0" opacity=".8" />
      <text x="320" y="70" fontSize="10" fill="#b45309" fontWeight="700">ORR</text>
      <path d="M20 120 C 100 130, 160 150, 340 160" stroke="#a78bfa" strokeWidth="5" fill="none" />
      <path d="M190 20 C 185 100, 195 180, 200 250" stroke="#f9a8d4" strokeWidth="4" fill="none" />
      <path d="M40 220 Q 90 190 120 230" fill="#bae6fd" />
      {pins.map(([x, y, label, me]) => (
        <g key={label} transform={`translate(${x} ${y})`}>
          {me && <circle r="18" fill="#ec4899" opacity=".2" className="pulse" />}
          <circle r={me ? 8 : 5} fill={me ? '#ec4899' : '#7c3aed'} stroke="#fff" strokeWidth="2" />
          <text y={me ? -14 : -9} textAnchor="middle" fontSize={me ? 11 : 9} fontWeight={me ? 800 : 600} fill="#1e1b4b">{label}</text>
        </g>
      ))}
    </svg>
  )
}
