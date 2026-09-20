import { rng, uid } from './rng'
import { towns } from './towns'
import { captains } from './captains'

const r = rng(2026)
const RIDER_NAMES = ['Lakshmi', 'Ravi', 'Shabana', 'Anjaneyulu', 'Padma', 'Swathi', 'Mounika', 'Bhaskar', 'Sunitha', 'Anil', 'Pooja', 'Vijay', 'Amma', 'Sudha', 'Rafiq', 'Kavya']
const STATUS_WEIGHTS = ['finished', 'finished', 'finished', 'finished', 'finished', 'finished', 'finished', 'cancelled', 'unfulfilled']
const HOUR_WEIGHTS = [1, 1, 1, 1, 2, 4, 8, 12, 14, 12, 11, 10, 9, 8, 9, 10, 12, 14, 13, 10, 7, 5, 3, 2]

function pickHour() {
  const total = HOUR_WEIGHTS.reduce((a, b) => a + b, 0)
  let x = r() * total
  for (let h = 0; h < 24; h++) { x -= HOUR_WEIGHTS[h]; if (x <= 0) return h }
  return 12
}
function jitter(center, km) {
  const dLat = (r() * 2 - 1) * (km / 111)
  const dLng = (r() * 2 - 1) * (km / (111 * Math.cos((center.lat * Math.PI) / 180)))
  return { lat: +(center.lat + dLat).toFixed(5), lng: +(center.lng + dLng).toFixed(5) }
}
function distKm(a, b) {
  const R = 6371, dLat = ((b.lat - a.lat) * Math.PI) / 180, dLng = ((b.lng - a.lng) * Math.PI) / 180
  const x = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(x))
}
function quote(town, service, km, hour, size) {
  const f = town.fares[service]
  let fare = service === 'parcel'
    ? ({ s: 30, m: 50, l: 80 }[size] + Math.max(0, km - 5) * f.perKm)
    : f.base + km * f.perKm
  fare = Math.max(f.min, fare)
  const night = hour >= 22 || hour < 5
  if (night) fare *= 1 + f.nightPct / 100
  return { fare: Math.round(fare / 5) * 5, night }
}

const verified = captains.filter((c) => c.status === 'verified' || c.status === 'blocked')
const now = new Date()
const todayStr = now.toISOString().slice(0, 10)

function build(kind, dayOffset, seq) {
  const town = dayOffset === 0 || r.chance(0.6) ? towns[0] : towns[1]
  if (town.id === 'zhb' && dayOffset > 35) return null
  const service = kind === 'parcel' ? 'parcel' : r.chance(0.68) ? 'bike' : 'auto'
  const day = new Date(now); day.setDate(day.getDate() - dayOffset)
  const hour = dayOffset === 0 ? Math.min(pickHour(), now.getHours()) : pickHour()
  const minute = r.int(0, 59)
  const requested = new Date(day); requested.setHours(hour, minute, r.int(0, 59), 0)
  if (requested > now) requested.setTime(now.getTime() - r.int(60, 3600) * 1000)
  const pickupLm = r.pick(town.landmarks)
  const pickup = r.chance(0.6) ? { lat: pickupLm.lat, lng: pickupLm.lng, name: pickupLm.nameEn, nameTe: pickupLm.nameTe } : { ...jitter(town.center, town.radiusKm * 0.5), name: 'GPS pin', nameTe: 'GPS' }
  const dropLm = r.pick(town.landmarks.filter((l) => l.id !== pickupLm.id))
  const drop = r.chance(0.55) ? { lat: dropLm.lat, lng: dropLm.lng, name: dropLm.nameEn, nameTe: dropLm.nameTe } : { ...jitter(town.center, kind === 'parcel' ? town.extendedRadiusKm * 0.5 : town.radiusKm * 0.8), name: r.pick(['Village road', 'Colony', 'Near temple', 'Bidar road', 'Farm house']), nameTe: 'గ్రామం' }
  const km = Math.max(0.8, +distKm(pickup, drop).toFixed(1))
  const size = kind === 'parcel' ? r.pick(['s', 's', 'm', 'l']) : null
  const { fare, night } = quote(town, service, km, hour, size)
  let status = r.pick(STATUS_WEIGHTS)
  const ageMin = (now - requested) / 60000
  if (dayOffset === 0 && ageMin < 25 && status === 'finished') status = r.pick(['searching', 'assigned', 'on_trip', 'on_trip', 'finished'])
  const townCaptains = verified.filter((c) => c.townId === town.id && (kind === 'parcel' || c.vehicleType === service))
  const captain = status === 'searching' || status === 'unfulfilled' ? null : r.pick(townCaptains.length ? townCaptains : verified)
  const t = (m) => new Date(requested.getTime() + m * 60000).toISOString()
  const acceptMin = +(0.3 + r() * 2.5).toFixed(1)
  const pickupMin = acceptMin + +(2 + r() * (km > 6 ? 9 : 6)).toFixed(1)
  const tripMin = pickupMin + Math.round(km * 3 + r.int(1, 6))
  const events = [{ type: 'requested', at: t(0) }]
  if (status !== 'searching' && status !== 'unfulfilled') events.push({ type: 'accepted', at: t(acceptMin) })
  if (['on_trip', 'finished'].includes(status) || (status === 'cancelled' && r.chance(0.4))) events.push({ type: 'arrived', at: t(pickupMin) })
  if (['on_trip', 'finished'].includes(status)) events.push({ type: 'started', at: t(pickupMin + 1) })
  if (status === 'finished') events.push({ type: 'finished', at: t(tripMin) })
  if (status === 'cancelled') events.push({ type: 'cancelled', at: t(acceptMin + r.int(1, 4)), by: r.pick(['rider', 'captain']), reason: r.pick(['Rider not reachable', 'Changed plan', 'Captain too far', 'Booked by mistake']) })
  if (status === 'unfulfilled') events.push({ type: 'no_captain', at: t(1.5), reason: 'No captain accepted in 3 rounds (90 s)' })
  const payment = r.chance(0.72) ? 'cash' : 'upi'
  const riderName = r.pick(RIDER_NAMES)
  const base = {
    id: uid(kind === 'parcel' ? 'pcl' : 'ride', seq),
    kind,
    service,
    townId: town.id,
    riderName,
    riderPhone: `9${r.int(100000000, 999999999)}`,
    bookedFor: r.chance(0.12) ? { name: 'Family member', phone: `8${r.int(100000000, 999999999)}` } : null,
    bookedVia: r.pick(['app', 'app', 'app', 'voice', 'missed_call']),
    captainId: captain?.id || null,
    pickup, drop, distanceKm: km,
    fareQuoted: fare,
    fareFinal: status === 'finished' ? fare + (r.chance(0.1) ? 10 : 0) : null,
    night,
    payment,
    paid: status === 'finished',
    status,
    requestedAt: t(0),
    finishedAt: status === 'finished' ? t(tripMin) : null,
    pickupMinutes: ['on_trip', 'finished'].includes(status) ? pickupMin : null,
    rating: status === 'finished' && r.chance(0.7) ? r.pick([5, 5, 5, 4, 4, 3, 5]) : null,
    tip: status === 'finished' && r.chance(0.08) ? 10 : 0,
    otp: String(r.int(1000, 9999)),
    events,
  }
  if (kind === 'parcel') {
    Object.assign(base, {
      sender: { name: r.pick(['Shabana Textiles', 'Sri Lakshmi Kirana', 'Raju Medicals', riderName]), phone: base.riderPhone },
      receiver: { name: r.pick(RIDER_NAMES), phone: `7${r.int(100000000, 999999999)}` },
      size,
      payer: r.chance(0.45) ? 'receiver' : 'sender',
      photos: { pickup: status !== 'searching' && status !== 'unfulfilled', delivery: status === 'finished' },
      codAmount: r.chance(0.3) ? r.int(2, 18) * 100 : 0,
      codCollected: status === 'finished' ? r.chance(0.85) : false,
      pickupOtpVerified: ['on_trip', 'finished'].includes(status),
      deliveryOtpVerified: status === 'finished',
    })
  }
  return base
}

const all = []
let seq = 1
for (let d = 44; d >= 0; d--) {
  const growth = 1 + (44 - d) / 30
  const rideCount = Math.round((d === 0 ? now.getHours() * 2.2 : 34 * growth) + r.int(-5, 8))
  const parcelCount = Math.round((d === 0 ? now.getHours() * 0.9 : 13 * growth) + r.int(-3, 4))
  for (let i = 0; i < rideCount; i++) { const x = build('ride', d, seq++); if (x) all.push(x) }
  for (let i = 0; i < parcelCount; i++) { const x = build('parcel', d, seq++); if (x) all.push(x) }
}
all.sort((a, b) => (a.requestedAt < b.requestedAt ? 1 : -1))

export const rides = all.filter((x) => x.kind === 'ride')
export const parcels = all.filter((x) => x.kind === 'parcel')
export const allTrips = all
export { todayStr }
