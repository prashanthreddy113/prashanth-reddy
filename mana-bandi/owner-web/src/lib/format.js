export const inr = (n) => '₹' + Math.round(n || 0).toLocaleString('en-IN')
export const pct = (n, d = 0) => `${(n || 0).toFixed(d)}%`
export const num = (n) => (n || 0).toLocaleString('en-IN')

export function maskPhone(p) {
  if (!p) return ''
  const s = String(p).replace(/\D/g, '')
  return s.slice(0, 2) + 'XXXX' + s.slice(-4)
}

export function fmtTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}
export function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
}
export function fmtDateTime(iso) {
  if (!iso) return '—'
  return `${fmtDate(iso)} ${fmtTime(iso)}`
}
export const isoDay = (d) => new Date(d).toISOString().slice(0, 10)
export const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d }

export const SERVICE = {
  bike: { label: 'Bike', te: 'బైక్', emoji: '🏍️', color: '#FFC72C' },
  auto: { label: 'Auto', te: 'ఆటో', emoji: '🛺', color: '#128A46' },
  parcel: { label: 'Parcel', te: 'పార్సెల్', emoji: '📦', color: '#E8641B' },
}

// Chart palette: brand hues re-stepped so adjacent series survive colour-vision deficiency
// (validated with the dataviz palette checker; raw turmeric #FFC72C fails contrast on cream).
export const CHART = {
  rides: '#128A46',
  parcels: '#9A3412',
  bike: '#B58A00',
  auto: '#128A46',
  parcel: '#9A3412',
  revenue: '#0B5E2F',
  muted: '#8A8F98',
  grid: '#E9E4D6',
  cash: '#B58A00',
  upi: '#128A46',
}
