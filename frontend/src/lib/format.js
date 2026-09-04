let currency = 'INR'
export function setCurrency(code) { if (code) currency = code }

export function money(value) {
  const n = Number(value || 0)
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n)
  } catch {
    return `${currency} ${n.toFixed(0)}`
  }
}

export function fmtDate(iso) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function todayIso() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function addMonths(iso, months) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1 + Number(months || 0), 1)
  const lastDay = new Date(dt.getFullYear(), dt.getMonth() + 1, 0).getDate()
  dt.setDate(Math.min(d, lastDay))
  const pad = (n) => String(n).padStart(2, '0')
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`
}

export const STATUS = {
  Active: { label: 'Active', tone: 'green', hint: 'Subscription is running' },
  DueSoon: { label: 'Due soon', tone: 'amber', hint: 'Due within the next few days' },
  DueToday: { label: 'Due today', tone: 'red', hint: 'Due date is today' },
  Overdue: { label: 'Overdue', tone: 'red', hint: 'Due date has passed' },
  Inactive: { label: 'Inactive', tone: 'grey', hint: 'Student has left' },
}

export function dueText(student) {
  if (!student.isActive) return 'Left'
  const d = student.daysUntilDue
  if (d < 0) return `${Math.abs(d)} day${Math.abs(d) === 1 ? '' : 's'} overdue`
  if (d === 0) return 'Due today'
  if (d === 1) return 'Due tomorrow'
  return `in ${d} days`
}
