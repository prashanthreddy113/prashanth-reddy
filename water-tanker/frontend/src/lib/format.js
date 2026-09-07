const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })
const inr2 = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 })
const num = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 })

export const money = (v) => inr.format(Number(v || 0))
export const money2 = (v) => inr2.format(Number(v || 0))
export const litres = (v) => `${num.format(Math.round(Number(v || 0)))} L`
export const kl = (v) => `${(Number(v || 0) / 1000).toFixed(1)} kL`
export const n = (v) => num.format(Number(v || 0))

export const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
export const fmtTime = (iso) => iso ? new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'
export const fmtDateTime = (iso) => iso ? `${fmtDate(iso)}, ${fmtTime(iso)}` : '—'
export const ago = (iso) => {
  if (!iso) return 'never'
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`
  return `${Math.floor(s / 86400)} d ago`
}
export const toLocalInput = (d) => { const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 16) }

export const gradeLabel = { Good: 'Good', Acceptable: 'Acceptable', Poor: 'Poor', Unknown: 'Not graded' }
export const statusLabel = {
  InProgress: 'Pumping', Completed: 'Awaiting verification', Verified: 'Verified', Disputed: 'Disputed', Discarded: 'Discarded',
  Requested: 'Requested', Accepted: 'Accepted', Dispatched: 'On the way', Delivered: 'Delivered', Cancelled: 'Cancelled',
  Draft: 'Draft', Issued: 'Due', Paid: 'Paid', Open: 'Open', Resolved: 'Resolved', Rejected: 'Rejected',
}
export const statusTone = {
  InProgress: 'blue', Completed: 'amber', Verified: 'green', Disputed: 'red', Discarded: 'grey',
  Requested: 'amber', Accepted: 'blue', Dispatched: 'blue', Delivered: 'green', Cancelled: 'grey',
  Draft: 'grey', Issued: 'amber', Paid: 'green', Open: 'red', Resolved: 'green', Rejected: 'grey',
  Good: 'green', Acceptable: 'amber', Poor: 'red', Unknown: 'grey',
}
