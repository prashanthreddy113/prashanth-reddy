/**
 * In-memory mock store. Everything api.js reads/writes goes through here so a real
 * backend can replace api.js function by function without touching the pages.
 * Mutations are kept in memory for the session (a reload resets to seed data).
 */
import { towns as seedTowns } from './towns'
import { captains as seedCaptains } from './captains'
import { rides as seedRides, parcels as seedParcels } from './rides'
import { settlements as seedSettlements } from './settlements'
import { company, terms, templates, users, auditLog, sosEvents } from './settings'
import { commission } from './commission'
import { rng } from './rng'

const clone = (x) => JSON.parse(JSON.stringify(x))
const r = rng(5)

function seedPosition(captain, town) {
  const km = town.radiusKm * 0.6
  return {
    lat: +(town.center.lat + (r() * 2 - 1) * (km / 111)).toFixed(5),
    lng: +(town.center.lng + (r() * 2 - 1) * (km / (111 * Math.cos((town.center.lat * Math.PI) / 180)))).toFixed(5),
  }
}

export const store = {
  towns: clone(seedTowns),
  captains: clone(seedCaptains),
  rides: clone(seedRides),
  parcels: clone(seedParcels),
  settlements: clone(seedSettlements),
  company: clone(company),
  terms: clone(terms),
  templates: clone(templates),
  users: clone(users),
  auditLog: clone(auditLog),
  sosEvents: clone(sosEvents),
  commission: clone(commission),
}

for (const c of store.captains) {
  const town = store.towns.find((t) => t.id === c.townId)
  c.pos = seedPosition(c, town)
}

let auditSeq = 100
export function audit(by, action, target, detail) {
  store.auditLog.unshift({ id: `aud_${auditSeq++}`, at: new Date().toISOString(), by, action, target, detail })
}
