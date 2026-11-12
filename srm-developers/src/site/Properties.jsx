import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useStore } from '../lib/store'
import { configurations } from '../lib/derive'
import { ConfigCard } from '../components/Cards'
import { Empty } from '../components/ui'

export default function Properties() {
  const { projects, units, settings } = useStore()
  const [sp, setSp] = useSearchParams()
  const f = {
    category: sp.get('category') || '', config: sp.get('config') || '', budget: sp.get('budget') || '',
    status: sp.get('status') || '', sort: sp.get('sort') || 'price', avail: sp.get('avail') || '', lease: sp.get('lease') || '',
  }
  const set = (k, v) => { const n = new URLSearchParams(sp); v ? n.set(k, v) : n.delete(k); if (k === 'category') n.delete('config'); setSp(n, { replace: true }) }
  const all = useMemo(() => configurations(projects, units, settings.taxes), [projects, units, settings.taxes])
  const types = [...new Set(all.filter((c) => !f.category || c.project.category === f.category).map((c) => c.config))]
  let list = all.filter((c) => {
    if (f.category && c.project.category !== f.category) return false
    if (f.config && c.config !== f.config) return false
    if (f.status && c.project.status !== f.status) return false
    if (f.avail && !c.available) return false
    if (f.lease && !c.leasable) return false
    if (f.budget) {
      const [lo, hi] = f.budget.split('-').map(Number)
      if (!c.available || c.maxPrice < lo || c.minPrice > hi) return false
    }
    return true
  })
  list = [...list].sort((a, b) =>
    f.sort === 'price' ? (a.minPrice || 1e12) - (b.minPrice || 1e12) : f.sort === 'price-d' ? b.minPrice - a.minPrice : f.sort === 'size' ? b.maxArea - a.maxArea : b.available - a.available)

  return (
    <>
      <section className="page-hero"><div className="wrap"><span className="eyebrow light">Search</span><h1>Find your property</h1><p className="lead">Live prices and availability across all SRM projects.</p></div></section>
      <section className="wrap section search-layout">
        <aside className="filters card pad">
          <h3>Filters</h3>
          <label>Category<select value={f.category} onChange={(e) => set('category', e.target.value)}><option value="">All</option><option>Residential</option><option>Commercial</option><option>Plots</option></select></label>
          <label>Type<select value={f.config} onChange={(e) => set('config', e.target.value)}><option value="">All types</option>{types.map((t) => <option key={t}>{t}</option>)}</select></label>
          <label>Budget<select value={f.budget} onChange={(e) => set('budget', e.target.value)}>
            <option value="">Any</option><option value="0-10000000">Under ₹1 Cr</option><option value="10000000-20000000">₹1 – 2 Cr</option><option value="20000000-50000000">₹2 – 5 Cr</option><option value="50000000-999999999">₹5 Cr+</option>
          </select></label>
          <label>Status<select value={f.status} onChange={(e) => set('status', e.target.value)}><option value="">Any</option>{[...new Set(projects.map((p) => p.status))].map((s) => <option key={s}>{s}</option>)}</select></label>
          <label className="check"><input type="checkbox" checked={!!f.avail} onChange={(e) => set('avail', e.target.checked ? '1' : '')} /> Only available</label>
          <label className="check"><input type="checkbox" checked={!!f.lease} onChange={(e) => set('lease', e.target.checked ? '1' : '')} /> Available for lease</label>
          <button className="btn btn-ghost btn-sm" onClick={() => setSp({})}>Clear filters</button>
        </aside>
        <div>
          <div className="row-between mb">
            <b>{list.length} results</b>
            <select value={f.sort} onChange={(e) => set('sort', e.target.value)} aria-label="Sort">
              <option value="price">Price: low to high</option><option value="price-d">Price: high to low</option><option value="size">Size: largest</option><option value="avail">Most available</option>
            </select>
          </div>
          {list.length ? <div className="grid-3">{list.map((c) => <ConfigCard key={c.key} c={c} />)}</div> : <Empty>No properties match these filters. Try widening your budget.</Empty>}
        </div>
      </section>
    </>
  )
}
