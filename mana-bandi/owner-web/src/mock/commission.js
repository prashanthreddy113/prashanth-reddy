/**
 * Commission rules. Resolution order (first match wins):
 *   town+service override → town "all" override → per-service override → default rule.
 * Each rule: { pct, freeMonths, freePct, effectiveFrom }. A rule whose effectiveFrom is in the future is skipped.
 * A captain inside their free period (joinedAt + freeMonths) pays freePct instead of pct.
 */
export const commission = {
  defaultRule: { pct: 10, freeMonths: 3, freePct: 0, effectiveFrom: '2026-07-01' },
  serviceOverrides: { bike: null, auto: null, parcel: 8 }, // % or null = use default
  townOverrides: [
    { id: 'co_1', townId: 'zhb', service: 'all', pct: 10, freeMonths: 3, freePct: 0, effectiveFrom: '2026-08-15', status: 'active', note: 'Launch offer' },
    { id: 'co_2', townId: 'nkd', service: 'parcel', pct: 6, freeMonths: 0, freePct: 0, effectiveFrom: '2026-10-01', status: 'scheduled', note: 'Shop subscription pilot' },
  ],
}
