import { useState } from 'react'
import { Link } from 'react-router-dom'
import Modal from './Modal'
import { money, fmtDate } from '../lib/format'

export const DUE_ALERT_KEY = 'studyroom.dueAlertShown'
const SNOOZE_KEY = 'studyroom.dueAlertSnoozedUntil'

export function splitDue(students) {
  const active = (students || []).filter((s) => s.isActive)
  return {
    overdue: active.filter((s) => s.daysUntilDue < 0).sort((a, b) => a.daysUntilDue - b.daysUntilDue),
    today: active.filter((s) => s.daysUntilDue === 0),
    tomorrow: active.filter((s) => s.daysUntilDue === 1),
  }
}

export function shouldShowDueAlert(todayIso) {
  try {
    if (sessionStorage.getItem(DUE_ALERT_KEY) === todayIso) return false
    if (localStorage.getItem(SNOOZE_KEY) === todayIso) return false
  } catch { /* storage unavailable */ }
  return true
}

export function markDueAlertShown(todayIso) {
  try { sessionStorage.setItem(DUE_ALERT_KEY, todayIso) } catch { /* ignore */ }
}

const GROUPS = [
  { key: 'overdue', title: 'Due date exceeded', tone: 'red', bg: 'var(--red-bg)', border: 'var(--red-border)', color: 'var(--red)', hint: (s) => `${Math.abs(s.daysUntilDue)} day${Math.abs(s.daysUntilDue) === 1 ? '' : 's'} overdue` },
  { key: 'today', title: 'Due today', tone: 'red', bg: '#fff1e6', border: '#fdba74', color: '#c2410c', hint: () => 'Due today' },
  { key: 'tomorrow', title: 'Due tomorrow', tone: 'amber', bg: 'var(--amber-bg)', border: 'var(--amber-border)', color: 'var(--amber)', hint: () => 'Due tomorrow' },
]

/** Pop-up shown once per sign-in: who is overdue, due today and due tomorrow, colour-coded. */
export default function DueAlertModal({ students, today, onClose }) {
  const groups = splitDue(students)
  const total = groups.overdue.length + groups.today.length + groups.tomorrow.length
  const [snooze, setSnooze] = useState(false)

  const close = () => {
    if (snooze) { try { localStorage.setItem(SNOOZE_KEY, today) } catch { /* ignore */ } }
    onClose()
  }

  return (
    <Modal title={`Due reminders · ${fmtDate(today)}`} onClose={close} size="wide">
      <div className="row" style={{ gap: 8 }}>
        <span className="badge red">{groups.overdue.length} exceeded</span>
        <span className="badge" style={{ color: '#c2410c', background: '#fff1e6', borderColor: '#fdba74' }}>{groups.today.length} due today</span>
        <span className="badge amber">{groups.tomorrow.length} due tomorrow</span>
        <span className="muted" style={{ marginLeft: 'auto', fontSize: 12 }}>{total} student{total === 1 ? '' : 's'} need a follow-up</span>
      </div>

      {total === 0 && <div className="empty"><strong>All clear</strong>Nobody is overdue, due today or due tomorrow.</div>}

      {GROUPS.map((g) => groups[g.key].length > 0 && (
        <div key={g.key} style={{ border: `1px solid ${g.border}`, background: g.bg, borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '10px 14px', fontWeight: 800, color: g.color, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{g.title}</span><span style={{ fontSize: 12, fontWeight: 700 }}>{groups[g.key].length}</span>
          </div>
          <div className="table-wrap" style={{ background: '#fff' }}>
            <table>
              <thead><tr><th>Seat</th><th>Student</th><th>Mobile</th><th>Due date</th><th></th><th className="num">Balance</th></tr></thead>
              <tbody>
                {groups[g.key].map((s) => (
                  <tr key={s.id}>
                    <td>{s.seatNumber ? <span className="seat-chip">{s.seatNumber}</span> : <span className="seat-chip none">—</span>}</td>
                    <td><Link to={`/students/${s.id}`} className="primary" onClick={close}>{s.name}</Link>{s.study && <div className="secondary">{s.study}</div>}</td>
                    <td><a href={`tel:${s.mobile}`}>{s.mobile}</a></td>
                    <td><strong>{fmtDate(s.dueDate)}</strong></td>
                    <td><span className="badge" style={{ color: g.color, background: g.bg, borderColor: g.border }}>{g.hint(s)}</span></td>
                    <td className="num">{s.balance > 0 ? <span className="neg">{money(s.balance)}</span> : <span className="pos">Paid</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      <div className="form-actions" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <label className="row" style={{ gap: 8, fontSize: 13 }}><input type="checkbox" checked={snooze} onChange={(e) => setSnooze(e.target.checked)} /> Don't show again today</label>
        <div className="row">
          <Link to="/reminders" className="btn" onClick={close}>Send WhatsApp reminders</Link>
          <button className="btn primary" onClick={close}>Got it</button>
        </div>
      </div>
    </Modal>
  )
}
