import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useShortlist, useStore } from '../lib/store'
import { configurations } from '../lib/derive'
import { Empty } from '../components/ui'
import PropertyArt from '../components/PropertyArt'
import { inrShort, num } from '../lib/format'

export default function Compare() {
  const { projects, units, settings } = useStore()
  const { ids, toggle } = useShortlist()
  const all = useMemo(() => configurations(projects, units, settings.taxes), [projects, units, settings.taxes])
  const list = ids.map((id) => all.find((c) => c.key === id)).filter(Boolean)
  const rows = [
    ['Project', (c) => <Link to={`/projects/${c.project.slug}`}>{c.project.name}</Link>],
    ['Category', (c) => c.project.category],
    ['Status', (c) => c.project.status],
    ['Possession', (c) => c.project.possession],
    ['Size', (c) => `${num(c.minArea)}${c.maxArea > c.minArea ? ' – ' + num(c.maxArea) : ''} ${c.project.areaUnit}`],
    ['Price from', (c) => (c.available ? inrShort(c.minPrice) : 'Sold out')],
    ['Rate', (c) => `₹${num(c.project.baseRate)}/${c.project.areaUnit}`],
    ['Available', (c) => `${c.available} of ${c.total}`],
    ['Lease', (c) => (c.leasable ? `from ${inrShort(c.minRent)}/mo` : '—')],
    ['Land', (c) => c.project.land],
    ['Amenities', (c) => `${c.project.amenities.length} amenities`],
    ['RERA', (c) => c.project.rera],
  ]
  return (
    <>
      <section className="page-hero"><div className="wrap"><span className="eyebrow light">Shortlist</span><h1>Compare your shortlist</h1><p className="lead">Tap ♡ on any property to add it here (up to 4).</p></div></section>
      <section className="wrap section">
        {list.length === 0 ? <Empty>Your shortlist is empty. <Link to="/properties">Browse properties →</Link></Empty> : (
          <div className="table-wrap">
            <table className="table compare">
              <thead>
                <tr><th />{list.map((c) => (
                  <th key={c.key}>
                    <div className="cmp-head"><PropertyArt kind={c.project.art} palette={c.project.palette} seed={c.minArea} /><b>{c.config}</b>
                      <button className="btn btn-sm btn-ghost" onClick={() => toggle(c.key)}>Remove</button></div>
                  </th>))}
                </tr>
              </thead>
              <tbody>{rows.map(([l, fn]) => <tr key={l}><td className="muted">{l}</td>{list.map((c) => <td key={c.key}>{fn(c)}</td>)}</tr>)}</tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}
