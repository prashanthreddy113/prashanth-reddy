/**
 * API layer. Every function is async and returns plain JSON, so swapping the mock for
 * `fetch(BASE + path)` is a one-line change per function. The intended REST endpoint for
 * the ASP.NET Core backend (docs/04-ARCHITECTURE.md) is noted above each function.
 *
 * Auth: the backend issues a JWT on POST /api/auth/login; send it as `Authorization: Bearer`.
 */
import { store, audit } from '../mock/store'
import { rng } from '../mock/rng'
import { createRemoteApi } from './remote'

const TOKEN_KEY = 'manabandi.token'
const USER_KEY = 'manabandi.user'
const LATENCY = 120

export const BUILD_API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '')

export const session = {
  getToken: () => { try { return localStorage.getItem(TOKEN_KEY) } catch { return null } },
  getUser: () => { try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null') } catch { return null } },
  save: (token, user) => { try { localStorage.setItem(TOKEN_KEY, token); localStorage.setItem(USER_KEY, JSON.stringify(user)) } catch { /* ignore */ } },
  clear: () => { try { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY) } catch { /* ignore */ } },
}

export class ApiError extends Error {
  constructor(message, status = 400) { super(message); this.status = status }
}

const clone = (x) => JSON.parse(JSON.stringify(x))
const wait = (ms = LATENCY) => new Promise((res) => setTimeout(res, ms))
const currentUserName = () => session.getUser()?.name || 'system'
const currentUserEmail = () => session.getUser()?.email || 'system'
const inTown = (townId) => (x) => !townId || townId === 'all' || x.townId === townId
const today = () => new Date().toISOString().slice(0, 10)
const day = (iso) => iso.slice(0, 10)
const median = (arr) => { if (!arr.length) return 0; const s = [...arr].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2 }
const live = rng(11)

const mockApi = {
  // ---------------------------------------------------------------- auth
  /** POST /api/auth/login { email, password, otp? } → { token, user:{ id, name, email, role, townId } } */
  async login(email, password, otp) {
    await wait(400)
    const e = (email || '').trim().toLowerCase()
    const user = store.users.find((u) => u.email === e)
    if (!user || !password) throw new ApiError('Email or password is wrong', 401)
    if (otp && !/^\d{4,6}$/.test(otp)) throw new ApiError('OTP must be 4–6 digits', 401)
    return { token: `mock.${btoa(e)}.${Date.now()}`, user: clone(user) }
  },

  // ---------------------------------------------------------------- towns / service areas
  towns: {
    /** GET /api/towns */
    async list() { await wait(); return clone(store.towns) },
    /** GET /api/towns/{id} */
    async get(id) { await wait(); const t = store.towns.find((x) => x.id === id); if (!t) throw new ApiError('Town not found', 404); return clone(t) },
    /** PUT /api/towns/{id}  (centre, radius, extendedRadius, enforceRadius, night hours, support phone, fares, landmarks) */
    async save(town) {
      await wait(300)
      const i = store.towns.findIndex((x) => x.id === town.id)
      if (i < 0) throw new ApiError('Town not found', 404)
      const before = store.towns[i]
      if (before.radiusKm !== town.radiusKm) audit(currentUserName(), 'town.radius', town.id, `Service radius ${before.radiusKm} → ${town.radiusKm} km`)
      else audit(currentUserName(), 'town.save', town.id, 'Service area updated')
      store.towns[i] = clone(town)
      return clone(store.towns[i])
    },
    /** POST /api/towns */
    async create({ nameEn, nameTe, center }) {
      await wait(300)
      const id = nameEn.toLowerCase().replace(/[^a-z]/g, '').slice(0, 6) + store.towns.length
      const town = {
        id, nameEn, nameTe: nameTe || nameEn, district: 'Sangareddy', state: 'Telangana', enabled: false,
        center, radiusKm: 8, extendedRadiusKm: 20, enforceRadius: true, nightStart: '22:00', nightEnd: '05:00',
        supportPhone: '', missedCallNo: '', launchedAt: null,
        fares: clone(store.towns[0].fares), landmarks: [],
      }
      store.towns.push(town)
      audit(currentUserName(), 'town.create', id, nameEn)
      return clone(town)
    },
  },

  // ---------------------------------------------------------------- captains
  captains: {
    /** GET /api/captains?town=&vehicle=&status=&q= */
    async list({ townId, vehicleType, status, q } = {}) {
      await wait()
      let rows = store.captains.filter(inTown(townId))
      if (vehicleType) rows = rows.filter((c) => c.vehicleType === vehicleType)
      if (status === 'online') rows = rows.filter((c) => c.online)
      else if (status) rows = rows.filter((c) => c.status === status)
      if (q) { const s = q.toLowerCase(); rows = rows.filter((c) => c.name.toLowerCase().includes(s) || c.phone.includes(s) || c.vehicleNo.toLowerCase().includes(s)) }
      return clone(rows)
    },
    /** GET /api/captains/{id} */
    async get(id) { await wait(); const c = store.captains.find((x) => x.id === id); if (!c) throw new ApiError('Captain not found', 404); return clone(c) },
    /** POST /api/captains  (multipart: fields + documents) → captain */
    async create(data) {
      await wait(400)
      const id = `cap_${String(store.captains.length + 1).padStart(4, '0')}`
      const town = store.towns.find((t) => t.id === data.townId) || store.towns[0]
      const c = {
        id, status: 'pending', online: false, rating: null, trips: 0, tripsToday: 0,
        joinedAt: today(), verificationScore: data.verificationScore ?? 0, lang: 'te',
        pos: { ...town.center }, rejectReason: null, blockReason: null, ...data,
      }
      store.captains.unshift(c)
      audit(currentUserName(), 'captain.create', id, c.name)
      return clone(c)
    },
    /** POST /api/captains/{id}/verify  → runs KYC checks with the provider (DigiLocker / Sarathi / Vahan / face match) */
    async runVerification(docs) {
      await wait(2000) // simulated provider round-trip
      const aadhaarOk = !!docs.aadhaar?.number
      const dlValid = docs.dl?.validTill ? docs.dl.validTill >= today() : false
      const nameScore = docs.dl?.nameMatchScore ?? (docs.aadhaar?.name && docs.dl?.name ? fuzzy(docs.aadhaar.name, docs.dl.name) : 0)
      const rcValid = docs.rc?.validTill ? docs.rc.validTill >= today() : false
      const insuranceValid = docs.rc?.insuranceTill ? docs.rc.insuranceTill >= today() : false
      const ownerIsCaptain = docs.rc?.ownerIsCaptain ?? (docs.rc?.ownerName && docs.aadhaar?.name ? fuzzy(docs.rc.ownerName, docs.aadhaar.name) >= 85 : false)
      const faceScore = docs.selfie?.faceMatchScore ?? 70 + Math.floor(live() * 29)
      const liveness = docs.selfie?.liveness ?? true
      return {
        checks: buildChecks({ aadhaarOk, verifiedVia: docs.aadhaar?.verifiedVia || 'Aadhaar OTP', dlValid, dlValidTill: docs.dl?.validTill, nameScore, rcValid, insuranceValid, rcValidTill: docs.rc?.validTill, insuranceTill: docs.rc?.insuranceTill, ownerIsCaptain, consentLetter: !!docs.rc?.consentLetter, faceScore, liveness, police: docs.police?.status || 'not_started' }),
        docs: { ...docs, aadhaar: { ...docs.aadhaar, verifiedVia: docs.aadhaar?.verifiedVia || 'Aadhaar OTP' }, dl: { ...docs.dl, nameMatchScore: nameScore }, rc: { ...docs.rc, ownerIsCaptain }, selfie: { ...docs.selfie, faceMatchScore: faceScore, liveness } },
      }
    },
    /** Pure helper (no endpoint): compute check chips from stored docs. */
    checks(c) {
      const d = c.docs
      return buildChecks({
        aadhaarOk: !!d.aadhaar.verifiedVia, verifiedVia: d.aadhaar.verifiedVia,
        dlValid: d.dl.validTill >= today(), dlValidTill: d.dl.validTill, nameScore: d.dl.nameMatchScore,
        rcValid: d.rc.validTill >= today(), insuranceValid: d.rc.insuranceTill >= today(), rcValidTill: d.rc.validTill, insuranceTill: d.rc.insuranceTill,
        ownerIsCaptain: d.rc.ownerIsCaptain, consentLetter: d.rc.consentLetter,
        faceScore: d.selfie.faceMatchScore, liveness: d.selfie.liveness, police: d.police.status,
      })
    },
    /** POST /api/captains/{id}/approve */
    async approve(id) { return setStatus(id, 'verified', 'captain.approve', 'Approved') },
    /** POST /api/captains/{id}/reject { reason } */
    async reject(id, reason) { return setStatus(id, 'rejected', 'captain.reject', reason, { rejectReason: reason }) },
    /** POST /api/captains/{id}/block { reason } */
    async block(id, reason) { return setStatus(id, 'blocked', 'captain.block', reason, { blockReason: reason, online: false }) },
    /** POST /api/captains/{id}/unblock */
    async unblock(id) { return setStatus(id, 'verified', 'captain.unblock', 'Unblocked', { blockReason: null }) },
    /** POST /api/captains/{id}/request-reupload { documents:[...], note } → sends SMS/WhatsApp to captain */
    async requestReupload(id, documents, note) {
      await wait(300)
      audit(currentUserName(), 'captain.reupload', id, `${documents.join(', ')} — ${note || 'no note'}`)
      return { ok: true }
    },
    /** POST /api/captains/{id}/documents/consent-letter (multipart) */
    async uploadConsentLetter(id) {
      await wait(400)
      const c = store.captains.find((x) => x.id === id)
      if (c) c.docs.rc.consentLetter = true
      audit(currentUserName(), 'captain.consent', id, 'Owner consent letter uploaded')
      return clone(c)
    },
    /** PATCH /api/captains/{id}/police-verification { status } */
    async setPolice(id, status) {
      await wait()
      const c = store.captains.find((x) => x.id === id)
      if (c) c.docs.police.status = status
      return clone(c)
    },
  },

  // ---------------------------------------------------------------- live
  live: {
    /** GET /api/live/captains?town=  (SignalR hub `live` in production; positions every 5–20 s) */
    async captains(townId) {
      await wait(50)
      const rows = store.captains.filter((c) => c.online).filter(inTown(townId))
      for (const c of rows) {
        c.pos = { lat: +(c.pos.lat + (live() - 0.5) * 0.0012).toFixed(5), lng: +(c.pos.lng + (live() - 0.5) * 0.0012).toFixed(5) }
      }
      return clone(rows)
    },
    /** GET /api/live/requests?town=  → rides+parcels in searching / assigned / on_trip */
    async requests(townId) {
      await wait(50)
      const rows = [...store.rides, ...store.parcels].filter((x) => ['searching', 'assigned', 'on_trip'].includes(x.status)).filter(inTown(townId))
      // mock progression: sometimes move a request forward
      if (live() < 0.25 && rows.length) {
        const x = rows[Math.floor(live() * rows.length)]
        const next = { searching: 'assigned', assigned: 'on_trip', on_trip: 'finished' }[x.status]
        const type = { assigned: 'accepted', on_trip: 'started', finished: 'finished' }[next]
        if (next === 'assigned') { const cs = store.captains.filter((c) => c.online && c.townId === x.townId); if (cs.length) x.captainId = cs[Math.floor(live() * cs.length)].id }
        if (next === 'finished') { x.fareFinal = x.fareQuoted; x.paid = true; x.finishedAt = new Date().toISOString() }
        x.status = next
        x.events.push({ type, at: new Date().toISOString() })
      }
      return clone(rows.sort((a, b) => (a.requestedAt < b.requestedAt ? 1 : -1)))
    },
  },

  // ---------------------------------------------------------------- dashboard
  /** GET /api/admin/dashboard?town=  → { kpis, series14d, byHourToday, attention } */
  async dashboard(townId) {
    await wait()
    const all = [...store.rides, ...store.parcels].filter(inTown(townId))
    const t = today()
    const todayRows = all.filter((x) => day(x.requestedAt) === t)
    const finished = todayRows.filter((x) => x.status === 'finished')
    const requested = todayRows.filter((x) => x.status !== 'searching')
    const accepted = requested.filter((x) => x.captainId)
    const caps = store.captains.filter(inTown(townId))
    const ratings = finished.filter((x) => x.rating).map((x) => x.rating)
    const kpis = {
      ridesToday: todayRows.filter((x) => x.kind === 'ride').length,
      parcelsToday: todayRows.filter((x) => x.kind === 'parcel').length,
      grossToday: finished.reduce((s, x) => s + (x.fareFinal || 0), 0),
      // platform revenue = commission earned on finished trips, from the commission rules
      revenueToday: finished.reduce((s, x) => { const c = store.captains.find((k) => k.id === x.captainId); return s + resolveCommission({ townId: x.townId, service: x.service, fare: x.fareFinal || 0, joinedAt: c?.joinedAt }).commission }, 0),
      captainsOnline: caps.filter((c) => c.online).length,
      captainsTotal: caps.filter((c) => c.status === 'verified').length,
      fulfilment: requested.length ? (accepted.length / requested.length) * 100 : 0,
      medianPickup: median(todayRows.filter((x) => x.pickupMinutes).map((x) => x.pickupMinutes)),
      cancellations: requested.length ? (todayRows.filter((x) => x.status === 'cancelled').length / requested.length) * 100 : 0,
      avgRating: ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0,
    }
    const series14d = []
    for (let i = 13; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i); const k = d.toISOString().slice(0, 10)
      const rows = all.filter((x) => day(x.requestedAt) === k)
      series14d.push({ day: k, label: d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }), rides: rows.filter((x) => x.kind === 'ride').length, parcels: rows.filter((x) => x.kind === 'parcel').length })
    }
    const byHourToday = Array.from({ length: 24 }, (_, h) => ({ hour: h, label: `${h}:00`, rides: todayRows.filter((x) => new Date(x.requestedAt).getHours() === h && x.kind === 'ride').length, parcels: todayRows.filter((x) => new Date(x.requestedAt).getHours() === h && x.kind === 'parcel').length }))
    const attention = {
      pendingCaptains: caps.filter((c) => c.status === 'pending'),
      sos: store.sosEvents.filter(inTown(townId)).filter((s) => !s.resolved),
      unfulfilled: todayRows.filter((x) => x.status === 'unfulfilled'),
      lowRated: caps.filter((c) => c.status === 'verified' && c.rating && c.rating < 4.2),
      searchingLong: todayRows.filter((x) => x.status === 'searching' && Date.now() - new Date(x.requestedAt) > 90000),
    }
    return clone({ kpis, series14d, byHourToday, attention })
  },

  // ---------------------------------------------------------------- rides & parcels
  trips: {
    /** GET /api/rides?from=&to=&status=&town=&service=  and  GET /api/parcels?... */
    async list(kind, { townId, from, to, status, service, q } = {}) {
      await wait()
      let rows = (kind === 'parcel' ? store.parcels : store.rides).filter(inTown(townId))
      if (from) rows = rows.filter((x) => day(x.requestedAt) >= from)
      if (to) rows = rows.filter((x) => day(x.requestedAt) <= to)
      if (status) rows = rows.filter((x) => x.status === status)
      if (service) rows = rows.filter((x) => x.service === service)
      if (q) { const s = q.toLowerCase(); rows = rows.filter((x) => x.id.includes(s) || x.riderName.toLowerCase().includes(s) || x.pickup.name.toLowerCase().includes(s) || x.drop.name.toLowerCase().includes(s)) }
      return clone(rows)
    },
    /** GET /api/rides/{id} · GET /api/parcels/{id} (includes ride_events) */
    async get(id) { await wait(); const x = [...store.rides, ...store.parcels].find((r) => r.id === id); if (!x) throw new ApiError('Not found', 404); return clone(x) },
  },

  // ---------------------------------------------------------------- analytics
  /** GET /api/admin/analytics?town=&days=30 */
  async analytics(townId, days = 30) {
    await wait(200)
    const all = [...store.rides, ...store.parcels].filter(inTown(townId))
    const perDay = []
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i); const k = d.toISOString().slice(0, 10)
      const rows = all.filter((x) => day(x.requestedAt) === k)
      const fin = rows.filter((x) => x.status === 'finished')
      const req = rows.filter((x) => x.status !== 'searching')
      perDay.push({
        day: k, label: d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
        rides: rows.filter((x) => x.kind === 'ride').length, parcels: rows.filter((x) => x.kind === 'parcel').length,
        revenue: fin.reduce((s, x) => s + (x.fareFinal || 0), 0),
        fulfilment: req.length ? Math.round((req.filter((x) => x.captainId).length / req.length) * 100) : null,
        medianPickup: +median(rows.filter((x) => x.pickupMinutes).map((x) => x.pickupMinutes)).toFixed(1),
      })
    }
    const window = all.filter((x) => day(x.requestedAt) >= perDay[0].day)
    const byService = ['bike', 'auto', 'parcel'].map((s) => ({ service: s, count: window.filter((x) => x.service === s).length, revenue: window.filter((x) => x.service === s && x.status === 'finished').reduce((a, x) => a + x.fareFinal, 0) }))
    const byTown = store.towns.map((t) => ({ townId: t.id, town: t.nameEn, rides: window.filter((x) => x.townId === t.id && x.kind === 'ride').length, parcels: window.filter((x) => x.townId === t.id && x.kind === 'parcel').length, revenue: window.filter((x) => x.townId === t.id && x.status === 'finished').reduce((a, x) => a + x.fareFinal, 0) }))
    const heatmap = Array.from({ length: 7 }, (_, dow) => Array.from({ length: 24 }, (_, h) => window.filter((x) => { const d = new Date(x.requestedAt); return d.getDay() === dow && d.getHours() === h }).length))
    const captainStats = {}
    for (const x of window.filter((x) => x.status === 'finished' && x.captainId)) {
      const s = (captainStats[x.captainId] ||= { trips: 0, revenue: 0, ratings: [] })
      s.trips++; s.revenue += x.fareFinal; if (x.rating) s.ratings.push(x.rating)
    }
    const leaderboard = Object.entries(captainStats).map(([id, s]) => { const c = store.captains.find((k) => k.id === id); return { captainId: id, name: c?.name, townId: c?.townId, vehicleType: c?.vehicleType, trips: s.trips, revenue: s.revenue, rating: s.ratings.length ? +(s.ratings.reduce((a, b) => a + b, 0) / s.ratings.length).toFixed(2) : null } }).sort((a, b) => b.trips - a.trips).slice(0, 12)
    const lmCount = {}
    for (const x of window) for (const p of [x.pickup, x.drop]) if (p.name !== 'GPS pin') lmCount[p.name] = (lmCount[p.name] || { name: p.name, nameTe: p.nameTe, pickups: 0, drops: 0 }), p === x.pickup ? lmCount[p.name].pickups++ : lmCount[p.name].drops++
    const topLandmarks = Object.values(lmCount).sort((a, b) => b.pickups + b.drops - a.pickups - a.drops).slice(0, 10)
    // retention: per ISO week, riders whose first trip was that week vs riders seen before
    const firstSeen = {}
    for (const x of [...all].sort((a, b) => (a.requestedAt < b.requestedAt ? -1 : 1))) if (!firstSeen[x.riderPhone]) firstSeen[x.riderPhone] = day(x.requestedAt)
    const weeks = {}
    for (const x of window) {
      const d = new Date(x.requestedAt); const wk = new Date(d); wk.setDate(d.getDate() - d.getDay()); const k = wk.toISOString().slice(0, 10)
      const w = (weeks[k] ||= { week: k, label: `w/c ${wk.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}`, newRiders: new Set(), repeatRiders: new Set() })
      if (firstSeen[x.riderPhone] >= k) w.newRiders.add(x.riderPhone); else w.repeatRiders.add(x.riderPhone)
    }
    const retention = Object.values(weeks).sort((a, b) => (a.week < b.week ? -1 : 1)).map((w) => ({ week: w.week, label: w.label, newRiders: w.newRiders.size, repeatRiders: w.repeatRiders.size }))
    const cod = store.parcels.filter(inTown(townId)).filter((p) => p.codAmount > 0 && day(p.requestedAt) >= perDay[0].day)
    const codSummary = { collected: cod.filter((p) => p.codCollected).reduce((a, p) => a + p.codAmount, 0), pending: cod.filter((p) => !p.codCollected && p.status !== 'cancelled' && p.status !== 'unfulfilled').reduce((a, p) => a + p.codAmount, 0), parcels: cod.length }
    return clone({ perDay, byService, byTown, heatmap, leaderboard, topLandmarks, retention, codSummary })
  },

  // ---------------------------------------------------------------- settlements
  settlements: {
    /** GET /api/settlements?town=&period=  (commission column is derived server-side from the commission rules) */
    async list(townId) {
      await wait()
      return clone(store.settlements.map((s) => {
        const captain = store.captains.find((c) => c.id === s.captainId)
        const lines = Object.entries(s.byService).filter(([, amt]) => amt > 0).map(([service, amt]) => {
          const res = resolveCommission({ townId: captain.townId, service, fare: amt, joinedAt: captain.joinedAt })
          return { service, amount: amt, pct: res.pct, commission: res.commission, rule: res.rule }
        })
        const commissionAmt = lines.reduce((a, l) => a + l.commission, 0)
        const gross = s.cashCollected + s.upiEarned
        // Payout due = what we owe the captain: UPI earned + incentive − commission − COD cash held for shops
        return { ...s, captain, lines, commissionPct: gross ? +((commissionAmt / gross) * 100).toFixed(1) : 0, commission: commissionAmt, payout: s.upiEarned + s.incentive - commissionAmt - s.codHeld }
      }).filter((s) => inTown(townId)(s.captain)))
    },
    /** POST /api/settlements/{id}/pay { utr } */
    async markPaid(id, utr) {
      await wait(300)
      const s = store.settlements.find((x) => x.id === id)
      if (!s) throw new ApiError('Not found', 404)
      s.status = 'paid'; s.paidAt = new Date().toISOString(); s.utr = utr || `UTR${Math.floor(Math.random() * 1e9)}`
      audit(currentUserName(), 'settlement.paid', s.captainId, s.utr)
      return clone(s)
    },
  },

  // ---------------------------------------------------------------- commission (owner edits; town managers read-only)
  commission: {
    /**
     * GET /api/config/commission → { defaultRule, serviceOverrides, townOverrides }
     * GET /api/config/commission?town=&service=&captainId= → the resolved rule for one captain/trip
     *     (the captain app calls this to print the commission line on every ride and on Earnings)
     */
    async get() { await wait(); return clone(store.commission) },
    /** PUT /api/config/commission { defaultRule, serviceOverrides }  (town overrides have their own routes below) */
    async save({ defaultRule, serviceOverrides }) {
      await wait(300)
      const before = store.commission
      const who = currentUserEmail()
      const on = today()
      if (defaultRule) {
        const d = before.defaultRule
        const changes = []
        if (d.pct !== defaultRule.pct) changes.push(`default ${d.pct}% → ${defaultRule.pct}%`)
        if (d.freeMonths !== defaultRule.freeMonths) changes.push(`free months ${d.freeMonths} → ${defaultRule.freeMonths}`)
        if (d.freePct !== defaultRule.freePct) changes.push(`free-period % ${d.freePct} → ${defaultRule.freePct}`)
        if (d.effectiveFrom !== defaultRule.effectiveFrom) changes.push(`effective from ${d.effectiveFrom} → ${defaultRule.effectiveFrom}`)
        for (const ch of changes) audit(who, 'commission.default', 'default', `${who} changed ${ch} on ${on}`)
        store.commission.defaultRule = clone(defaultRule)
      }
      if (serviceOverrides) {
        for (const svc of ['bike', 'auto', 'parcel']) {
          const a = before.serviceOverrides[svc], b = serviceOverrides[svc]
          if (a !== b) audit(who, 'commission.service', svc, `${who} changed ${svc} ${a ?? 'default'}${a == null ? '' : '%'} → ${b ?? 'default'}${b == null ? '' : '%'} on ${on}`)
        }
        store.commission.serviceOverrides = clone(serviceOverrides)
      }
      return clone(store.commission)
    },
    /** POST /api/config/commission/towns { townId, service, pct, freeMonths, freePct, effectiveFrom, status, note } */
    async addTownOverride(o) {
      await wait(300)
      const row = { ...o, id: `co_${Date.now()}` }
      store.commission.townOverrides.push(row)
      audit(currentUserEmail(), 'commission.town', row.townId, `${currentUserEmail()} added ${row.townId}/${row.service} ${row.pct}% (free ${row.freeMonths} m @ ${row.freePct}%) from ${row.effectiveFrom} on ${today()}`)
      return clone(row)
    },
    /** PUT /api/config/commission/towns/{id} */
    async updateTownOverride(o) {
      await wait(300)
      const i = store.commission.townOverrides.findIndex((x) => x.id === o.id)
      if (i < 0) throw new ApiError('Override not found', 404)
      const a = store.commission.townOverrides[i]
      store.commission.townOverrides[i] = clone(o)
      audit(currentUserEmail(), 'commission.town', o.townId, `${currentUserEmail()} changed ${o.townId}/${a.service} ${a.pct}% → ${o.townId}/${o.service} ${o.pct}% (${o.status}) on ${today()}`)
      return clone(o)
    },
    /** DELETE /api/config/commission/towns/{id} */
    async deleteTownOverride(id) {
      await wait(200)
      const a = store.commission.townOverrides.find((x) => x.id === id)
      store.commission.townOverrides = store.commission.townOverrides.filter((x) => x.id !== id)
      if (a) audit(currentUserEmail(), 'commission.town', a.townId, `${currentUserEmail()} deleted ${a.townId}/${a.service} ${a.pct}% override on ${today()}`)
      return { ok: true }
    },
    /** Pure resolver — same logic the backend runs. { townId, service, fare, joinedAt, on? } → { pct, commission, captainGets, rule, reason } */
    resolve: (args) => resolveCommission(args),
  },

  // ---------------------------------------------------------------- settings (owner only)
  settings: {
    /** GET /api/admin/settings/company · PUT same */
    async company() { await wait(); return clone(store.company) },
    async saveCompany(data) { await wait(300); Object.assign(store.company, data); audit(currentUserName(), 'settings.company', 'company', 'Company details / commission updated'); return clone(store.company) },
    /** GET /api/admin/terms · POST /api/admin/terms { version, te, en } */
    async terms() { await wait(); return clone(store.terms) },
    async publishTerms({ version, te, en }) {
      await wait(400)
      store.terms = { ...store.terms, currentVersion: version, publishedAt: today(), te, en, versions: [...store.terms.versions, { version, publishedAt: today(), by: currentUserName() }] }
      audit(currentUserName(), 'terms.publish', `v${version}`, 'Telugu + English')
      return clone(store.terms)
    },
    /** GET /api/admin/templates · PUT /api/admin/templates/{id} */
    async templates() { await wait(); return clone(store.templates) },
    async saveTemplate(t) { await wait(300); const i = store.templates.findIndex((x) => x.id === t.id); if (i >= 0) store.templates[i] = clone(t); else store.templates.push({ ...t, id: `tpl_${store.templates.length + 1}` }); return clone(store.templates) },
    /** GET /api/admin/users · POST /api/admin/users { name, email, role, townId } · DELETE /api/admin/users/{id} */
    async users() { await wait(); return clone(store.users) },
    async addUser(u) { await wait(300); const row = { id: `usr_${store.users.length + 1}`, lastLogin: null, ...u }; store.users.push(row); audit(currentUserName(), 'user.add', row.email, `${row.role}${row.townId ? ' · ' + row.townId : ''}`); return clone(row) },
    async removeUser(id) { await wait(200); const u = store.users.find((x) => x.id === id); store.users = store.users.filter((x) => x.id !== id); if (u) audit(currentUserName(), 'user.remove', u.email, ''); return { ok: true } },
    /** GET /api/admin/audit?limit=100 */
    async audit() { await wait(); return clone(store.auditLog) },
  },
}

// ---------------------------------------------------------------- helpers
function addMonths(iso, n) { const d = new Date(iso); d.setMonth(d.getMonth() + n); return d.toISOString().slice(0, 10) }

/** Commission resolution. Order: town+service → town all → service override → default. */
export function resolveCommission({ townId, service, fare = 0, joinedAt, on }, rules) {
  const cfg = rules || store.commission
  const date = on || today()
  const active = (o) => o.status !== 'disabled' && (!o.effectiveFrom || o.effectiveFrom <= date)
  let rule, ruleName
  const ts = cfg.townOverrides.find((o) => o.townId === townId && o.service === service && active(o))
  const ta = cfg.townOverrides.find((o) => o.townId === townId && o.service === 'all' && active(o))
  if (ts) { rule = ts; ruleName = `Town override · ${townId} / ${service}` }
  else if (ta) { rule = ta; ruleName = `Town override · ${townId} / all services` }
  else if (cfg.serviceOverrides[service] != null) { rule = { ...cfg.defaultRule, pct: cfg.serviceOverrides[service] }; ruleName = `Service override · ${service}` }
  else { rule = cfg.defaultRule; ruleName = 'Default rule' }
  if (rule.effectiveFrom && rule.effectiveFrom > date && rule === cfg.defaultRule) { return { pct: 0, commission: 0, captainGets: fare, rule: ruleName, reason: `Default rule is effective only from ${rule.effectiveFrom}` } }
  let pct = rule.pct
  let reason = `${ruleName}: ${pct}%`
  if (joinedAt && rule.freeMonths > 0) {
    const freeTill = addMonths(joinedAt, rule.freeMonths)
    if (date < freeTill) { pct = rule.freePct ?? 0; reason = `${ruleName}: captain joined ${joinedAt}, inside ${rule.freeMonths} free month(s) (till ${freeTill}) → ${pct}%` }
    else reason += ` (free period ended ${freeTill})`
  }
  const commission = Math.round((fare * pct) / 100)
  return { pct, commission, captainGets: fare - commission, rule: ruleName, reason }
}

async function setStatus(id, status, action, detail, extra = {}) {
  await wait(300)
  const c = store.captains.find((x) => x.id === id)
  if (!c) throw new ApiError('Captain not found', 404)
  Object.assign(c, { status, ...extra })
  if (status === 'verified') c.rejectReason = null
  audit(currentUserName(), action, id, detail)
  return clone(c)
}

/** Very small fuzzy name match (0–100): token overlap + Levenshtein on the joined string. */
export function fuzzy(a = '', b = '') {
  const norm = (s) => s.toLowerCase().replace(/[^a-z ]/g, '').trim()
  const x = norm(a), y = norm(b)
  if (!x || !y) return 0
  if (x === y) return 100
  const tx = new Set(x.split(/\s+/)), ty = new Set(y.split(/\s+/))
  const overlap = [...tx].filter((t) => ty.has(t)).length / Math.max(tx.size, ty.size)
  const lev = levenshtein(x.replace(/\s/g, ''), y.replace(/\s/g, ''))
  const sim = 1 - lev / Math.max(x.length, y.length)
  return Math.round((overlap * 0.5 + sim * 0.5) * 100)
}
function levenshtein(a, b) {
  const m = a.length, n = b.length
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)])
  for (let j = 1; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
  return dp[m][n]
}

/**
 * Build the verification chips. Each check: { id, label, state: 'pass'|'fail'|'review'|'pending', note }.
 * "RC owner ≠ captain" is a review, never a hard block — a consent letter clears it.
 */
export function buildChecks(v) {
  const c = []
  c.push({ id: 'aadhaar', label: 'Aadhaar verified', state: v.aadhaarOk ? 'pass' : 'pending', note: v.aadhaarOk ? `via ${v.verifiedVia}` : 'OTP / DigiLocker not completed' })
  c.push({ id: 'dl_valid', label: 'DL valid till', state: v.dlValid ? 'pass' : 'fail', note: v.dlValidTill || 'unknown' })
  c.push({ id: 'dl_name', label: 'DL name matches Aadhaar', state: v.nameScore >= 85 ? 'pass' : v.nameScore >= 65 ? 'review' : 'fail', note: `fuzzy score ${v.nameScore}/100` })
  c.push({ id: 'rc_valid', label: 'RC valid / not expired', state: v.rcValid ? 'pass' : 'fail', note: v.rcValidTill || 'unknown' })
  c.push({ id: 'insurance', label: 'Insurance valid', state: v.insuranceValid ? 'pass' : 'fail', note: v.insuranceTill || 'unknown' })
  c.push({ id: 'rc_owner', label: 'RC owner = captain', state: v.ownerIsCaptain ? 'pass' : v.consentLetter ? 'pass' : 'review', note: v.ownerIsCaptain ? 'same person' : v.consentLetter ? 'consent letter on file' : 'Vehicle belongs to someone else — needs owner consent letter' })
  c.push({ id: 'face', label: 'Selfie matches Aadhaar/DL photo', state: v.faceScore >= 80 ? 'pass' : v.faceScore >= 65 ? 'review' : 'fail', note: `face match ${v.faceScore}/100` })
  c.push({ id: 'liveness', label: 'Liveness passed', state: v.liveness ? 'pass' : 'fail', note: v.liveness ? 'blink + turn detected' : 'retake selfie' })
  c.push({ id: 'police', label: 'Police verification (manual)', state: v.police === 'done' ? 'pass' : v.police === 'requested' ? 'review' : 'pending', note: { done: 'certificate received', requested: 'applied at PS, awaiting', not_started: 'not started' }[v.police] || '' })
  return c
}

/** With VITE_API_URL set the portal talks to the real backend; without it, to the mock store above. */
export const USING_BACKEND = !!BUILD_API_URL
export const api = USING_BACKEND
  ? createRemoteApi({ baseUrl: BUILD_API_URL, session, buildChecks, resolveCommission, ApiError })
  : mockApi
