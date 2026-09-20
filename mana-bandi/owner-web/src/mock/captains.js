import { rng, uid } from './rng'

const FIRST = ['Srinivas', 'Anjaneyulu', 'Ramesh', 'Mahesh', 'Sai Kumar', 'Naveen', 'Raju', 'Venkatesh', 'Shiva', 'Prakash', 'Yadagiri', 'Rajesh', 'Suresh', 'Nagaraju', 'Balaji', 'Kiran', 'Mallesh', 'Sandeep', 'Imran', 'Sattar', 'Basavaraj', 'Manik', 'Shankar', 'Lingam', 'Narsimha', 'Chandu', 'Vinod', 'Krishna', 'Ganesh', 'Hanmanth']
const LAST = ['Goud', 'Reddy', 'Yadav', 'Naik', 'Patel', 'Rao', 'Kumar', 'Mudiraj', 'Khan', 'Swamy', 'Chary', 'Pasha']
const TE = { Srinivas: 'శ్రీనివాస్', Anjaneyulu: 'ఆంజనేయులు', Ramesh: 'రమేష్', Mahesh: 'మహేష్', 'Sai Kumar': 'సాయి కుమార్', Naveen: 'నవీన్', Raju: 'రాజు', Venkatesh: 'వెంకటేష్', Shiva: 'శివ', Prakash: 'ప్రకాష్', Yadagiri: 'యాదగిరి', Rajesh: 'రాజేష్', Suresh: 'సురేష్', Nagaraju: 'నాగరాజు', Balaji: 'బాలాజీ', Kiran: 'కిరణ్', Mallesh: 'మల్లేష్', Sandeep: 'సందీప్', Imran: 'ఇమ్రాన్', Sattar: 'సత్తార్', Basavaraj: 'బసవరాజ్', Manik: 'మాణిక్', Shankar: 'శంకర్', Lingam: 'లింగం', Narsimha: 'నరసింహ', Chandu: 'చందు', Vinod: 'వినోద్', Krishna: 'కృష్ణ', Ganesh: 'గణేష్', Hanmanth: 'హన్మంత్' }
const BIKES = ['Hero Splendor+', 'Honda Shine', 'Bajaj Platina', 'TVS Sport', 'Hero HF Deluxe', 'Honda Activa']
const AUTOS = ['Bajaj RE', 'Piaggio Ape', 'Mahindra Alfa']
const STATUSES = ['verified', 'verified', 'verified', 'verified', 'verified', 'verified', 'pending', 'pending', 'rejected', 'blocked']

const r = rng(42)

function makeDocs(i, status) {
  const nameMatch = status === 'pending' && i % 5 === 0 ? 68 : r.int(88, 100)
  const rcOwnerSame = !(i % 4 === 1)
  const faceScore = status === 'rejected' ? r.int(40, 60) : r.int(82, 99)
  const dlValidTill = status === 'rejected' && i % 2 ? '2025-11-30' : `${r.int(2027, 2033)}-0${r.int(1, 9)}-${r.int(10, 28)}`
  const rcValidTill = `${r.int(2027, 2038)}-0${r.int(1, 9)}-${r.int(10, 28)}`
  const insuranceTill = i % 7 === 3 ? '2026-08-31' : `2027-0${r.int(1, 9)}-${r.int(10, 28)}`
  return {
    aadhaar: { uploaded: true, number: `XXXX XXXX ${r.int(1000, 9999)}`, name: '', dob: `19${r.int(78, 99)}-0${r.int(1, 9)}-${r.int(10, 28)}`, verifiedVia: status === 'pending' && i % 3 === 0 ? null : 'DigiLocker' },
    dl: { uploaded: true, number: `TS${r.int(10, 36)} ${r.int(2015, 2024)}${r.int(1000000, 9999999)}`, validTill: dlValidTill, vehicleClass: 'MCWG', nameMatchScore: nameMatch },
    rc: { uploaded: true, number: '', ownerName: '', validTill: rcValidTill, insuranceTill, vehicleClass: '', ownerIsCaptain: rcOwnerSame, consentLetter: !rcOwnerSame && i % 8 === 1 },
    selfie: { uploaded: true, faceMatchScore: faceScore, liveness: status !== 'rejected' || i % 2 === 0 },
    bank: { uploaded: true, upi: `${r.int(70000, 99999)}${r.int(10000, 99999)}@ybl`, ifsc: 'SBIN0004321', accountLast4: String(r.int(1000, 9999)) },
    police: { status: status === 'verified' ? 'done' : i % 3 === 0 ? 'requested' : 'not_started' },
  }
}

export const captains = Array.from({ length: 58 }, (_, i) => {
  const first = FIRST[i % FIRST.length]
  const last = r.pick(LAST)
  const vehicleType = i % 3 === 2 ? 'auto' : 'bike'
  const townId = i % 5 === 0 || i % 5 === 3 ? 'zhb' : 'nkd'
  const status = STATUSES[i % STATUSES.length]
  const trips = status === 'verified' ? r.int(40, 640) : status === 'blocked' ? r.int(20, 200) : 0
  const online = status === 'verified' && r.chance(0.55)
  const docs = makeDocs(i, status)
  const name = `${first} ${last}`
  docs.aadhaar.name = name
  docs.rc.number = `TS${townId === 'nkd' ? '15' : '15'} ${String.fromCharCode(65 + (i % 26))}${String.fromCharCode(65 + ((i * 7) % 26))} ${r.int(1000, 9999)}`
  docs.rc.ownerName = docs.rc.ownerIsCaptain ? name : `${r.pick(FIRST)} ${last}`
  docs.rc.vehicleClass = vehicleType === 'auto' ? '3WT (Passenger)' : 'M-Cycle/Scooter'
  const rating = status === 'verified' ? (i % 9 === 4 ? 3.9 : Math.round((4.2 + r() * 0.75) * 10) / 10) : null
  return {
    id: uid('cap', i + 1),
    name,
    nameTe: TE[first] || first,
    phone: `9${r.int(100000000, 999999999)}`,
    vehicleType,
    vehicleModel: vehicleType === 'auto' ? r.pick(AUTOS) : r.pick(BIKES),
    vehicleNo: docs.rc.number,
    townId,
    status,
    online,
    joinedAt: `2026-0${r.int(5, 9)}-${r.int(10, 28)}`, // May–June joiners were onboarded before the July launch and are past their free months
    rating,
    trips,
    tripsToday: online ? r.int(0, 11) : 0,
    verificationScore: status === 'verified' ? r.int(86, 99) : status === 'rejected' ? r.int(35, 60) : r.int(60, 85),
    lang: r.pick(['te', 'te', 'te', 'hi', 'kn']),
    docs,
    rejectReason: status === 'rejected' ? r.pick(['Selfie does not match DL photo', 'DL expired', 'RC belongs to another person, no consent letter']) : null,
    blockReason: status === 'blocked' ? 'Rider complaint — overcharging (2 reports)' : null,
    // starting position: somewhere inside the town circle
    pos: null,
  }
})
