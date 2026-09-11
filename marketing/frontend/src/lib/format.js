let currency = 'INR'
let countryCode = '91'
export function setCurrency(code) { if (code) currency = code }
export function setCountryCode(code) { if (code) countryCode = code }
export function getCountryCode() { return countryCode }

export function money(value, { compact = false } = {}) {
  const n = Number(value || 0)
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0, notation: compact ? 'compact' : 'standard' }).format(n)
  } catch {
    return `${currency} ${n.toFixed(0)}`
  }
}

export function fmtDate(iso) {
  if (!iso) return '—'
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function fmtDateShort(iso) {
  if (!iso) return '—'
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
}

export function fmtDateTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export function timeAgo(iso) {
  if (!iso) return ''
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  const days = Math.floor(diff / 86400)
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  return fmtDateShort(iso.slice(0, 10))
}

export function todayIso() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function addDaysIso(iso, days) {
  const [y, m, d] = (iso || todayIso()).split('-').map(Number)
  const dt = new Date(y, m - 1, d + Number(days || 0))
  const pad = (n) => String(n).padStart(2, '0')
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`
}

export function daysBetween(fromIso, toIso) {
  const a = new Date(fromIso.slice(0, 10)), b = new Date(toIso.slice(0, 10))
  return Math.round((b - a) / 86400000)
}

export function followUpText(state, iso) {
  if (state === 'Overdue') { const d = -daysBetween(iso, todayIso()); return `${d} day${d === 1 ? '' : 's'} overdue` }
  if (state === 'Today') return 'Follow up today'
  if (state === 'Upcoming' || state === 'Later') return `Follow up ${fmtDateShort(iso)}`
  if (state === 'Closed') return ''
  return 'No follow-up set'
}

export const STATUS = {
  New: { label: 'New', tone: 'blue', hint: 'Just captured' },
  FollowUp: { label: 'Follow-up', tone: 'amber', hint: 'Needs another visit or call' },
  Negotiation: { label: 'Negotiation', tone: 'purple', hint: 'Discussing price / quantity' },
  Converted: { label: 'Converted', tone: 'green', hint: 'Became a customer' },
  Lost: { label: 'Lost', tone: 'grey', hint: 'Not going ahead' },
}
export const STATUS_ORDER = ['New', 'FollowUp', 'Negotiation', 'Converted', 'Lost']

export const INTEREST = {
  1: { label: 'Not interested', short: 'None', tone: 'grey' },
  2: { label: 'Low interest', short: 'Low', tone: 'grey' },
  3: { label: 'Medium interest', short: 'Medium', tone: 'amber' },
  4: { label: 'High interest', short: 'High', tone: 'orange' },
  5: { label: 'Ready to buy', short: 'Hot', tone: 'red' },
}

export const ACTIVITY = {
  Visit: { label: 'Visit', icon: '📍' },
  Call: { label: 'Call', icon: '📞' },
  WhatsApp: { label: 'WhatsApp', icon: '💬' },
  Meeting: { label: 'Meeting', icon: '🤝' },
  Note: { label: 'Note', icon: '📝' },
  StatusChange: { label: 'Status changed', icon: '🔁' },
  Assignment: { label: 'Reassigned', icon: '👤' },
}

/** tel: link – dial exactly what was captured. */
export function telLink(mobile) { return `tel:${mobile?.length === 10 ? `+${countryCode}${mobile}` : mobile}` }

/** wa.me needs the international number without "+". */
export function whatsappLink(mobile, text) {
  if (!mobile) return '#'
  const digits = String(mobile).replace(/\D/g, '')
  const intl = digits.length === 10 ? `${countryCode}${digits}` : digits
  return `https://wa.me/${intl}${text ? `?text=${encodeURIComponent(text)}` : ''}`
}

export function mapLink(lat, lng) { return `https://www.google.com/maps?q=${lat},${lng}` }
export function directionsLink(lat, lng) { return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}` }

export function fmtMobile(m) {
  if (!m) return ''
  const s = String(m)
  return s.length === 10 ? `${s.slice(0, 5)} ${s.slice(5)}` : s
}
