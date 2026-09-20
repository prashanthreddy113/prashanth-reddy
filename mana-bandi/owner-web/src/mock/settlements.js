import { rng } from './rng'
import { captains } from './captains'

const r = rng(99)
const period = '2026-09-14 → 2026-09-20'

/**
 * Raw weekly figures per captain. Commission is NOT stored here — api.settlements.list()
 * computes it from the commission rules (see mock/commission.js) so owner edits apply.
 */
export const settlements = captains
  .filter((c) => c.status === 'verified' && c.trips > 0)
  .map((c, i) => {
    const cash = r.int(6, 40) * 100
    const upi = r.int(2, 22) * 100
    const gross = cash + upi
    const parcelShare = c.townId === 'zhb' ? 0.35 : 0.25
    const parcel = Math.round((gross * parcelShare) / 10) * 10
    const cod = c.townId === 'zhb' && i % 3 === 0 ? r.int(1, 8) * 100 : 0
    return {
      id: `stl_${c.id}`,
      captainId: c.id,
      period,
      cashCollected: cash,
      upiEarned: upi,
      // gross fares by service (sum = cash + upi)
      byService: { [c.vehicleType]: gross - parcel, parcel },
      codHeld: cod,
      incentive: r.chance(0.3) ? 100 : 0,
      status: i % 4 === 0 ? 'paid' : i % 7 === 3 ? 'on_hold' : 'due',
      paidAt: i % 4 === 0 ? '2026-09-19T10:30:00' : null,
      utr: i % 4 === 0 ? `UTR${r.int(100000000, 999999999)}` : null,
    }
  })
