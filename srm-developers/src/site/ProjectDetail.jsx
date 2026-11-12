import { useMemo, useState } from 'react'
import { Link, useOutletContext, useParams, useSearchParams } from 'react-router-dom'
import { useStore } from '../lib/store'
import { configurations, projectSummary } from '../lib/derive'
import { costSheet, PLANS, planFor, unitRate } from '../lib/pricing'
import PropertyArt from '../components/PropertyArt'
import { Badge, Field, Modal, Progress, Tabs } from '../components/ui'
import { EnquiryForm } from '../components/forms'
import EmiCalculator from '../components/Emi'
import { AMENITY_ICONS, LOCATION_ADVANTAGES } from '../lib/seed'
import { fmtDate, inr, inrShort, num, waLink } from '../lib/format'
import { NarsingiMap } from './Home'

export default function ProjectDetail() {
  const { slug } = useParams()
  const [sp] = useSearchParams()
  const { projects, units, settings, updates } = useStore()
  const { openVisit } = useOutletContext()
  const p = projects.find((x) => x.slug === slug)
  const [tab, setTab] = useState(sp.get('config') ? 'units' : 'overview')
  const [unit, setUnit] = useState(null)
  const summary = useMemo(() => p && projectSummary(p, units, settings.taxes), [p, units, settings.taxes])
  const cfgs = useMemo(() => (p ? configurations([p], units, settings.taxes) : []), [p, units, settings.taxes])
  if (!p) return <div className="wrap section"><h2>Project not found</h2><Link to="/projects">Back to projects</Link></div>
  const pUpdates = updates.filter((u) => u.projectId === p.id).sort((a, b) => b.date.localeCompare(a.date))
  const share = waLink('', `Check out ${p.name} by SRM Developers, Narsingi: ${window.location.href}`)

  return (
    <div className="pd">
      <section className="pd-hero" style={{ '--c1': p.palette[0], '--c2': p.palette[1] }}>
        <PropertyArt kind={p.art} palette={p.palette} seed={7} image={p.image} />
        <div className="pd-hero-shade" />
        <div className="wrap pd-hero-copy">
          <div className="crumbs"><Link to="/">Home</Link> / <Link to={p.category === 'Commercial' ? '/commercial' : '/residential'}>{p.category}</Link> / {p.name}</div>
          <div className="row gap"><Badge>{p.status}</Badge><Badge>{p.category}</Badge><Badge tone="white">TS RERA: {p.rera}</Badge></div>
          <h1>{p.name}</h1>
          <p className="lead">{p.tagline}</p>
          <div className="pd-price">
            <div><small>Starting from</small><b>{summary.fromPrice ? inrShort(summary.fromPrice) : 'Sold out'}</b></div>
            {p.leaseRate && <div><small>Lease from</small><b>₹{p.leaseRate}/{p.areaUnit}/mo</b></div>}
            <div><small>Possession</small><b>{p.possession}</b></div>
            <div><small>Availability</small><b>{summary.available} units</b></div>
          </div>
          <div className="row gap wrap-row">
            <button className="btn btn-white" onClick={() => openVisit(p.id)}>📅 Book site visit</button>
            <button className="btn btn-glass" onClick={() => setTab('units')}>🏢 Check live availability</button>
            <button className="btn btn-glass" onClick={() => window.print()}>⬇ Brochure (PDF)</button>
            <a className="btn btn-glass" href={share} target="_blank" rel="noreferrer">Share on WhatsApp</a>
          </div>
        </div>
      </section>

      <div className="wrap pd-grid">
        <div>
          <div className="facts">
            {[['Land area', p.land], ['Structure', p.structure], ['Configurations', p.configs], ['Possession', p.possession], ['Sold', `${summary.soldPct}%`], ['Construction', `${p.progress}%`]].map(([k, v]) => (
              <div key={k}><small>{k}</small><b>{v}</b></div>
            ))}
          </div>
          <Tabs value={tab} onChange={setTab} tabs={[['overview', 'Overview'], ['prices', 'Prices'], ['units', 'Live availability'], ['amenities', 'Amenities'], ['location', 'Location'], ['updates', 'Construction']]} />

          {tab === 'overview' && (
            <div className="card pad">
              <h2>About {p.name}</h2>
              <p className="prose">{p.description}</p>
              <div className="highlights">
                {p.highlights.map((h) => <span key={h}>✔ {h}</span>)}
              </div>
              <h3 className="mt">Construction progress</h3>
              <Progress value={p.progress} palette={p.palette} />
              <p className="small muted">{p.progress}% complete · Possession {p.possession}</p>
              <h3 className="mt">Payment plan · {PLANS[planFor(p)].name}</h3>
              <div className="plan-steps">
                {PLANS[planFor(p)].steps.map(([n, pct]) => <div key={n}><b>{pct}%</b><span>{n}</span></div>)}
              </div>
            </div>
          )}

          {tab === 'prices' && (
            <div className="card pad">
              <h2>Configurations & prices</h2>
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Type</th><th>Size ({p.areaUnit})</th><th>Starting price*</th><th>Available</th>{p.leaseRate && <th>Lease from</th>}<th /></tr></thead>
                  <tbody>
                    {cfgs.map((c) => (
                      <tr key={c.key}>
                        <td><b>{c.config}</b></td>
                        <td>{c.minArea === c.maxArea ? num(c.minArea) : `${num(c.minArea)} – ${num(c.maxArea)}`}</td>
                        <td className="grad-text strong">{c.available ? inrShort(c.minPrice) : '—'}</td>
                        <td>{c.available} / {c.total}</td>
                        {p.leaseRate && <td>{c.leasable ? `${inrShort(c.minRent)}/mo` : '—'}</td>}
                        <td><button className="btn btn-sm btn-ghost" onClick={() => setTab('units')}>Pick unit</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="small muted">* Agreement value incl. {p.category === 'Plots' || p.status === 'Ready to Move' ? 'all charges (no GST applicable)' : 'GST'}; excludes stamp duty & registration. Base rate ₹{num(p.baseRate)}/{p.areaUnit}{p.floorRise ? `, floor rise ₹${p.floorRise}/${p.areaUnit} per floor` : ''}{p.plc ? `, PLC ₹${num(p.plc)}/${p.areaUnit} for ${p.plcFacings.join('/')}` : ''}.</p>
              <h3 className="mt">Home-loan EMI</h3>
              <EmiCalculator price={summary.fromPrice || 10000000} />
            </div>
          )}

          {tab === 'units' && <UnitPicker project={p} preset={sp.get('config')} onPick={setUnit} />}

          {tab === 'amenities' && (
            <div className="card pad">
              <h2>Amenities</h2>
              <div className="amenity-grid">
                {p.amenities.map((a) => <div key={a} className="amenity-tile"><span>{AMENITY_ICONS[a] || '✨'}</span>{a}</div>)}
              </div>
            </div>
          )}

          {tab === 'location' && (
            <div className="card pad">
              <h2>Location advantages</h2>
              <div className="loc-grid">
                <NarsingiMap />
                <div className="loc-list">
                  {LOCATION_ADVANTAGES.map(([pl, t]) => <div key={pl} className="loc-item"><span className="loc-time">{t}</span><span>{pl}</span></div>)}
                </div>
              </div>
              <a className="btn btn-ghost mt" href={`https://www.google.com/maps/search/${encodeURIComponent('Narsingi, Hyderabad')}`} target="_blank" rel="noreferrer">Open in Google Maps ↗</a>
            </div>
          )}

          {tab === 'updates' && (
            <div className="card pad">
              <h2>Construction updates</h2>
              {pUpdates.length === 0 && <p className="muted">Updates will be posted here every month.</p>}
              <div className="timeline">
                {pUpdates.map((u) => (
                  <div key={u.id} className="tl-item"><span className="tl-dot" /><small>{fmtDate(u.date)} · {u.progress}% complete</small><h4>{u.title}</h4><p>{u.text}</p></div>
                ))}
              </div>
            </div>
          )}
        </div>

        <aside className="pd-side">
          <div className="card pad sticky">
            <h3>Get the best offer</h3>
            <p className="small muted">Free cost sheet, floor plans & current offers on WhatsApp.</p>
            <EnquiryForm compact projectId={p.id} subject={`${p.name} enquiry`} purposeOptions={p.category === 'Commercial' ? ['Buy – investment', 'Buy – own use', 'Lease'] : ['Self use', 'Investment']} cta="Get cost sheet" />
          </div>
        </aside>
      </div>
      {unit && <UnitModal unit={unit} project={p} onClose={() => setUnit(null)} />}
    </div>
  )
}

function UnitPicker({ project: p, preset, onPick }) {
  const { units } = useStore()
  const pu = units.filter((u) => u.projectId === p.id)
  const towers = [...new Set(pu.map((u) => u.tower))]
  const [tower, setTower] = useState(towers[0])
  const [cfg, setCfg] = useState(preset || '')
  const cfgList = [...new Set(pu.map((u) => u.config))]
  const list = pu.filter((u) => u.tower === tower)
  const floors = [...new Set(list.map((u) => u.floor))].sort((a, b) => b - a)
  const flat = list[0]?.floor === 0 && floors.length === 1
  const cls = (u) => `unit u-${u.status} ${cfg && u.config !== cfg ? 'dim' : ''}`
  const label = { available: 'Available', hold: 'On hold', booked: 'Booked', sold: 'Sold', leased: 'Leased', blocked: 'Blocked' }
  return (
    <div className="card pad">
      <div className="row-between wrap-row gap">
        <h2>Live availability</h2>
        <div className="row gap wrap-row">
          <select value={tower} onChange={(e) => setTower(e.target.value)} aria-label="Tower">{towers.map((t) => <option key={t}>{t}</option>)}</select>
          <select value={cfg} onChange={(e) => setCfg(e.target.value)} aria-label="Configuration"><option value="">All types</option>{cfgList.map((c) => <option key={c}>{c}</option>)}</select>
        </div>
      </div>
      <div className="unit-legend">{Object.entries(label).map(([k, v]) => <span key={k}><i className={`u-${k}`} />{v}</span>)}</div>
      <p className="small muted">Tap a green unit to see its exact price, cost sheet and EMI.</p>
      {flat ? (
        <div className="unit-flat">
          {list.map((u) => (
            <button key={u.id} className={cls(u)} disabled={u.status !== 'available'} onClick={() => onPick(u)} title={`${u.no} · ${u.config} · ${num(u.area)} ${p.areaUnit} · ${u.facing}`}>
              <b>{u.no.replace(/^\w-0*/, '')}</b><small>{u.area}</small>
            </button>
          ))}
        </div>
      ) : (
        <div className="unit-stack">
          {floors.map((f) => (
            <div key={f} className="unit-row">
              <span className="floor">{f === 0 ? 'G' : f}</span>
              {list.filter((u) => u.floor === f).map((u) => (
                <button key={u.id} className={cls(u)} disabled={u.status !== 'available'} onClick={() => onPick(u)} title={`${u.no} · ${u.config} · ${num(u.area)} ${p.areaUnit} · ${u.facing}`}>
                  <b>{u.no}</b><small>{u.config} · {num(u.area)}</small>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function UnitModal({ unit: u, project: p, onClose }) {
  const { settings, submitEnquiry, toast } = useStore()
  const cs = costSheet(u, p, settings.taxes)
  const r = unitRate(u, p)
  const [mode, setMode] = useState('buy')
  const [f, setF] = useState({ name: '', phone: '' })
  const rent = p.leaseRate ? u.area * p.leaseRate : 0
  const request = (e) => {
    e.preventDefault()
    if (!f.name || !/\d{10}/.test(f.phone.replace(/\D/g, ''))) return toast('Enter name and 10-digit mobile', 'err')
    submitEnquiry({ ...f, projectId: p.id, config: u.config, purpose: mode === 'lease' ? 'Lease' : '', subject: mode === 'lease' ? `Lease request for ${u.no}` : `Requested to block unit ${u.no}`, message: mode === 'lease' ? `Rent ${inr(rent)}/month` : `Agreement value ${inr(cs.agreementValue)}` })
    toast(mode === 'lease' ? 'Lease request sent! Our commercial team will call you.' : `Unit ${u.no} requested. We'll call you to complete the booking.`)
    onClose()
  }
  return (
    <Modal title={`${p.name} · Unit ${u.no}`} onClose={onClose} wide>
      <div className="unit-modal">
        <div>
          <div className="facts small-facts">
            {[['Type', u.config], ['Area', `${num(u.area)} ${p.areaUnit}`], ['Facing', u.facing], ['Floor', u.floor === 0 ? (p.category === 'Commercial' ? 'Ground' : '—') : u.floor], ['Rate', `₹${num(r.total)}/${p.areaUnit}`], ['Tower/Block', u.tower]].map(([k, v]) => <div key={k}><small>{k}</small><b>{v}</b></div>)}
          </div>
          {u.forLease && p.leaseRate && <Tabs value={mode} onChange={setMode} tabs={[['buy', 'Buy'], ['lease', 'Lease']]} />}
          {mode === 'buy' ? (
            <table className="table cost">
              <tbody>
                {cs.lines.map(([l, v]) => <tr key={l}><td>{l}</td><td className="num">{inr(v)}</td></tr>)}
                <tr className="sub"><td>Agreement value</td><td className="num">{inr(cs.agreementValue)}</td></tr>
                {cs.gst > 0 && <tr><td>GST @ {cs.gstPct}%</td><td className="num">{inr(cs.gst)}</td></tr>}
                <tr className="total"><td>Total payable to SRM</td><td className="num">{inr(cs.payable)}</td></tr>
                {cs.maintenance > 0 && <tr className="muted"><td>Maintenance deposit (24 months, at possession)</td><td className="num">{inr(cs.maintenance)}</td></tr>}
                <tr className="muted"><td>Stamp duty & transfer @ {cs.stampPct}% (est., to Govt.)</td><td className="num">{inr(cs.stamp)}</td></tr>
                <tr className="muted"><td>Registration @ {settings.taxes.registration}% (est., to Govt.)</td><td className="num">{inr(cs.registration)}</td></tr>
                <tr className="total alt"><td>All-inclusive estimate</td><td className="num">{inr(cs.allIn)}</td></tr>
              </tbody>
            </table>
          ) : (
            <table className="table cost">
              <tbody>
                <tr><td>Monthly rent ({num(u.area)} × ₹{p.leaseRate})</td><td className="num">{inr(rent)}</td></tr>
                <tr><td>Security deposit (6 months)</td><td className="num">{inr(rent * 6)}</td></tr>
                <tr><td>Maintenance (₹{p.maintenance}/{p.areaUnit}/mo)</td><td className="num">{inr(u.area * p.maintenance)}</td></tr>
                <tr className="total"><td>Annual rent (year 1)</td><td className="num">{inr(rent * 12)}</td></tr>
                <tr className="muted"><td>Escalation 5% per year · lock-in 3 years · GST 18% on rent extra</td><td /></tr>
              </tbody>
            </table>
          )}
        </div>
        <div>
          {mode === 'buy' && <EmiCalculator price={cs.payable} />}
          <form className="form-grid compact mt" onSubmit={request}>
            <Field label="Name"><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
            <Field label="Mobile"><input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} inputMode="tel" /></Field>
            <button className="btn btn-primary span-2">{mode === 'lease' ? 'Request lease terms' : `Block unit ${u.no}`}</button>
          </form>
          <p className="small muted mt">Prices are indicative and subject to change. Final cost sheet is issued at booking.</p>
        </div>
      </div>
    </Modal>
  )
}
