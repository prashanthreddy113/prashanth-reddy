import { costSheet } from './pricing'

/** Group a project's units by configuration with live price / availability. */
export function configurations(projects, units, taxes) {
  const byP = Object.fromEntries(projects.map((p) => [p.id, p]))
  const map = new Map()
  for (const u of units) {
    const p = byP[u.projectId]
    if (!p) continue
    const key = `${p.id}|${u.config}`
    if (!map.has(key)) map.set(key, { key, project: p, config: u.config, total: 0, available: 0, leasable: 0, minArea: Infinity, maxArea: 0, minPrice: Infinity, maxPrice: 0, minRent: Infinity })
    const c = map.get(key)
    c.total++
    c.minArea = Math.min(c.minArea, u.area)
    c.maxArea = Math.max(c.maxArea, u.area)
    if (u.status === 'available') {
      c.available++
      const price = costSheet(u, p, taxes).payable
      c.minPrice = Math.min(c.minPrice, price)
      c.maxPrice = Math.max(c.maxPrice, price)
      if (u.forLease && p.leaseRate) {
        c.leasable++
        c.minRent = Math.min(c.minRent, u.area * p.leaseRate)
      }
    }
  }
  return [...map.values()].map((c) => ({
    ...c,
    minPrice: isFinite(c.minPrice) ? c.minPrice : 0,
    minRent: isFinite(c.minRent) ? c.minRent : 0,
  }))
}

export function projectSummary(project, units, taxes) {
  const us = units.filter((u) => u.projectId === project.id)
  const count = (s) => us.filter((u) => u.status === s).length
  const avail = us.filter((u) => u.status === 'available')
  const prices = avail.map((u) => costSheet(u, project, taxes).payable)
  return {
    total: us.length,
    available: avail.length,
    sold: count('sold') + count('booked'),
    leased: count('leased'),
    hold: count('hold'),
    soldPct: us.length ? Math.round(((count('sold') + count('booked') + count('leased')) / us.length) * 100) : 0,
    fromPrice: prices.length ? Math.min(...prices) : 0,
  }
}
