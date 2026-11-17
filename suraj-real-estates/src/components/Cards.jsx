import { Link } from 'react-router-dom'
import PropertyArt from './PropertyArt'
import { Badge, Progress } from './ui'
import { inrShort, num } from '../lib/format'
import { useShortlist } from '../lib/store'

export function ProjectCard({ project: p, summary }) {
  return (
    <Link to={`/projects/${p.slug}`} className="pcard">
      <div className="pcard-art">
        <PropertyArt kind={p.art} palette={p.palette} seed={p.name.length} image={p.image} />
        <div className="pcard-tags"><Badge>{p.status}</Badge><Badge>{p.category}</Badge></div>
      </div>
      <div className="pcard-body">
        <h3>{p.name}</h3>
        <p className="muted">{p.tagline}</p>
        <div className="pcard-meta">
          <span>📐 {p.configs}</span>
          <span>🏗️ {p.structure}</span>
        </div>
        <Progress value={summary?.soldPct ?? 0} palette={p.palette} />
        <div className="pcard-foot">
          <div><small>Starting</small><b className="grad-text">{summary?.fromPrice ? inrShort(summary.fromPrice) : 'Sold out'}</b></div>
          <div className="right"><small>{summary?.soldPct ?? 0}% sold</small><b>{summary?.available ?? 0} available</b></div>
        </div>
      </div>
    </Link>
  )
}

export function ConfigCard({ c }) {
  const { has, toggle } = useShortlist()
  const p = c.project
  return (
    <div className="ccard">
      <Link to={`/projects/${p.slug}?config=${encodeURIComponent(c.config)}`} className="ccard-art">
        <PropertyArt kind={p.art} palette={p.palette} seed={c.config.length + c.minArea} image={p.image} />
        <span className="ccard-cfg">{c.config}</span>
      </Link>
      <button className={`heart ${has(c.key) ? 'on' : ''}`} onClick={() => toggle(c.key)} aria-label="Shortlist" title="Shortlist & compare">{has(c.key) ? '♥' : '♡'}</button>
      <div className="ccard-body">
        <div className="row-between"><Badge>{p.category}</Badge><Badge>{p.status}</Badge></div>
        <h4><Link to={`/projects/${p.slug}?config=${encodeURIComponent(c.config)}`}>{c.config} in {p.name}</Link></h4>
        <p className="muted small">📍 Narsingi, Hyderabad · {c.minArea === c.maxArea ? num(c.minArea) : `${num(c.minArea)} – ${num(c.maxArea)}`} {p.areaUnit}</p>
        <div className="ccard-price">
          {c.available ? <b className="grad-text">{inrShort(c.minPrice)}{c.maxPrice > c.minPrice ? ` – ${inrShort(c.maxPrice)}` : ''}</b> : <b className="muted">Sold out</b>}
          {c.leasable > 0 && <span className="lease-pill">Lease from {inrShort(c.minRent)}/mo</span>}
        </div>
        <p className="small"><span className={c.available ? 'dot-green' : 'dot-grey'} /> {c.available} of {c.total} available</p>
      </div>
    </div>
  )
}
