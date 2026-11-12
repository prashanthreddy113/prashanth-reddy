import { useMemo } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { useStore } from '../lib/store'
import { configurations, projectSummary } from '../lib/derive'
import { ConfigCard, ProjectCard } from '../components/Cards'
import { EnquiryForm } from '../components/forms'
import PropertyArt from '../components/PropertyArt'
import { inrShort } from '../lib/format'

const COPY = {
  Residential: {
    eyebrow: 'Residential',
    title: 'Homes designed for the way Hyderabad lives',
    lead: 'From smart 2 BHKs for young professionals to 4 BHK garden villas and HMDA-approved plots — every SRM home sits inside a secure gated community in Narsingi.',
    art: ['tower', ['#7c3aed', '#ec4899']],
    perks: [
      ['🏊', 'Resort-style clubhouses', 'Pools, gyms, theatres and party halls for every family.'],
      ['🌳', '70% open spaces', 'Landscaped gardens, jogging tracks and play areas.'],
      ['🏦', 'Loans from 7.9%*', 'Pre-approved by SBI, HDFC, ICICI, Axis and LIC HFL.'],
      ['✈️', 'NRI desk', 'Video walkthroughs, PoA registration and NRE/NRO payments.'],
    ],
    purposes: ['Self use', 'Investment'],
    offer: '🎉 Festive offer: zero floor-rise on Skyline floors 2–8 + free modular kitchen on bookings this month.',
  },
  Commercial: {
    eyebrow: 'Commercial',
    title: 'Grow your business — or your rental income',
    lead: 'Grade-A offices and high-street retail on the Narsingi–Kokapet corridor, surrounded by tech parks and 25,000+ new homes. Buy for assured yield or lease ready space today.',
    art: ['office', ['#0284c7', '#f59e0b']],
    perks: [
      ['📈', '6–8% rental yield', 'Pre-leased options with blue-chip tenants available.'],
      ['🚇', 'Corridor connectivity', 'ORR, Financial District and the proposed metro line.'],
      ['🏬', 'Flexible sizes', 'From 400 sq ft kiosks to 9,000 sq ft full office floors.'],
      ['🔧', 'Leasing & fit-out desk', 'We find tenants, manage leases and support fit-outs.'],
    ],
    purposes: ['Buy – investment', 'Buy – own use', 'Lease'],
    offer: '💼 Lease launch: 3 months rent-free fit-out period on Trade Tower offices signed this quarter.',
  },
}

export default function Segment({ category }) {
  const { projects, units, settings } = useStore()
  const { openVisit } = useOutletContext()
  const c = COPY[category]
  const cats = category === 'Residential' ? ['Residential', 'Plots'] : ['Commercial']
  const ps = projects.filter((p) => cats.includes(p.category))
  const cfgs = useMemo(() => configurations(ps, units, settings.taxes), [ps, units, settings.taxes])
  const leasable = cfgs.filter((x) => x.leasable > 0)

  return (
    <>
      <section className={`seg-hero seg-${category.toLowerCase()}`}>
        <div className="wrap seg-grid">
          <div>
            <span className="eyebrow light">{c.eyebrow}</span>
            <h1>{c.title}</h1>
            <p className="lead">{c.lead}</p>
            <div className="row gap wrap-row">
              <button className="btn btn-white" onClick={() => openVisit(ps[0]?.id)}>Book site visit</button>
              <Link className="btn btn-glass" to={`/properties?category=${category}`}>Browse all {category.toLowerCase()} →</Link>
            </div>
          </div>
          <div className="seg-art"><PropertyArt kind={c.art[0]} palette={c.art[1]} seed={11} /></div>
        </div>
      </section>
      <div className="offer-strip"><div className="wrap">{c.offer}</div></div>

      <section className="wrap section">
        <div className="grid-4">
          {c.perks.map(([i, t, d]) => <div className="perk" key={t}><span>{i}</span><h3>{t}</h3><p>{d}</p></div>)}
        </div>
      </section>

      <section className="wrap section">
        <div className="section-head"><div><span className="eyebrow">Projects</span><h2>{category} projects</h2></div></div>
        <div className="grid-3">{ps.map((p) => <ProjectCard key={p.id} project={p} summary={projectSummary(p, units, settings.taxes)} />)}</div>
      </section>

      <section className="wrap section">
        <div className="section-head"><div><span className="eyebrow">Available now</span><h2>Pick your {category === 'Commercial' ? 'space' : 'home'}</h2></div></div>
        <div className="grid-4">{cfgs.map((x) => <ConfigCard key={x.key} c={x} />)}</div>
      </section>

      {category === 'Commercial' && leasable.length > 0 && (
        <section className="wrap section">
          <div className="lease-band">
            <div>
              <span className="eyebrow light">For lease</span>
              <h2>Ready-to-move spaces for lease</h2>
              <p>{leasable.reduce((s, x) => s + x.leasable, 0)} offices & shops available for lease from {inrShort(Math.min(...leasable.map((x) => x.minRent)))} per month.</p>
            </div>
            <ul>
              {leasable.map((x) => <li key={x.key}><b>{x.config}</b> in {x.project.name}<span>{x.leasable} units · from {inrShort(x.minRent)}/mo</span></li>)}
            </ul>
          </div>
        </section>
      )}

      <section className="wrap section cta-band">
        <div><span className="eyebrow light">Enquire</span><h2>Talk to our {category.toLowerCase()} specialist</h2><p>Get price lists, floor plans and current offers on WhatsApp.</p></div>
        <div className="cta-form"><EnquiryForm compact subject={`${category} enquiry`} purposeOptions={c.purposes} cta="Get details" /></div>
      </section>
    </>
  )
}
