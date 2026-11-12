import { useMemo } from 'react'
import { useStore } from '../lib/store'
import { bookingTotals } from '../lib/pricing'

/** Bookings joined with unit / project / customer and payment totals. */
export function useBookingRows() {
  const { bookings, units, projects, customers, payments } = useStore()
  return useMemo(() => {
    const U = Object.fromEntries(units.map((x) => [x.id, x]))
    const P = Object.fromEntries(projects.map((x) => [x.id, x]))
    const C = Object.fromEntries(customers.map((x) => [x.id, x]))
    const byB = {}
    for (const p of payments) (byB[p.bookingId] ||= []).push(p)
    return bookings.map((b) => ({ b, u: U[b.unitId], p: P[b.projectId], c: C[b.customerId], t: bookingTotals(b, byB[b.id] || []) }))
  }, [bookings, units, projects, customers, payments])
}

export const teamName = (settings, id) => settings.team.find((t) => t.id === id)?.name || '—'
