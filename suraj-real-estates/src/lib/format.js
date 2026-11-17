// Indian-style money and date helpers.
export const inr = (n) =>
  '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN')

/** Short form: ₹85 L, ₹1.25 Cr, ₹45,000 */
export function inrShort(n) {
  const v = Number(n) || 0
  const a = Math.abs(v)
  if (a >= 1e7) return `₹${trim(v / 1e7)} Cr`
  if (a >= 1e5) return `₹${trim(v / 1e5)} L`
  return inr(v)
}
const trim = (x) => (Math.round(x * 100) / 100).toString()

export const num = (n) => (Number(n) || 0).toLocaleString('en-IN')

export const todayISO = () => toISO(new Date())
export const toISO = (d) => {
  const x = new Date(d)
  const p = (k) => String(k).padStart(2, '0')
  return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}`
}
export const addDays = (iso, days) => {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return toISO(d)
}
export const addMonths = (iso, months) => {
  const d = new Date(iso + 'T00:00:00')
  d.setMonth(d.getMonth() + months)
  return toISO(d)
}
export const daysBetween = (a, b) =>
  Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000)

export function fmtDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso.length <= 10 ? iso + 'T00:00:00' : iso)
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}
export function fmtDateTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}
export const monthKey = (iso) => iso.slice(0, 7)
export const monthLabel = (key) =>
  new Date(key + '-01T00:00:00').toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })

export const uid = (p = 'id') => `${p}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-3)}`

export const waLink = (phone, text) =>
  `https://wa.me/${String(phone).replace(/\D/g, '').replace(/^(?!91)(\d{10})$/, '91$1')}?text=${encodeURIComponent(text)}`

export function emi(principal, annualRate, years) {
  const P = Number(principal) || 0
  const r = (Number(annualRate) || 0) / 12 / 100
  const n = Math.round((Number(years) || 0) * 12)
  if (!P || !n) return 0
  if (!r) return P / n
  return (P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
}
