import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { money, fmtDate, setCurrency } from '../lib/format'
import { useToast } from '../lib/toast'
import StudentTable from '../components/StudentTable'
import StudentFormModal from '../components/StudentFormModal'
import PaymentModal from '../components/PaymentModal'
import RenewModal from '../components/RenewModal'
import { IconPlus, IconSearch } from '../components/Icons'

const FILTERS = [
  { key: 'attention', label: 'Needs attention' },
  { key: 'all', label: 'All active' },
  { key: 'Overdue', label: 'Overdue' },
  { key: 'DueToday', label: 'Due today' },
  { key: 'DueSoon', label: 'Due soon' },
  { key: 'Active', label: 'Running' },
  { key: 'Inactive', label: 'Left' },
]

export default function Dashboard() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('attention')
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(null) // { type: 'add'|'edit'|'pay'|'renew', student }
  const toast = useToast()
  const navigate = useNavigate()

  const load = useCallback(async () => {
    try {
      const d = await api.dashboard()
      setCurrency(d.currency)
      setData(d)
      setError('')
    } catch (e) { setError(e.message) }
  }, [])

  useEffect(() => { load() }, [load])

  const counts = useMemo(() => {
    if (!data) return {}
    const c = { all: data.activeStudents, Inactive: data.inactiveStudents, Overdue: data.overdueCount, DueToday: data.dueTodayCount, DueSoon: data.dueSoonCount, Active: 0 }
    c.Active = data.students.filter((s) => s.status === 'Active').length
    c.attention = c.Overdue + c.DueToday + c.DueSoon
    return c
  }, [data])

  const visible = useMemo(() => {
    if (!data) return []
    let list = data.students
    if (filter === 'attention') list = list.filter((s) => ['Overdue', 'DueToday', 'DueSoon'].includes(s.status))
    else if (filter === 'all') list = list.filter((s) => s.isActive)
    else list = list.filter((s) => s.status === filter)
    const q = search.trim().toLowerCase()
    if (q) list = list.filter((s) => s.name.toLowerCase().includes(q) || s.mobile.includes(q) || String(s.seatNumber || '') === q || (s.study || '').toLowerCase().includes(q))
    return list
  }, [data, filter, search])

  const onSaved = (student, wasEdit) => {
    setModal(null)
    toast.success(wasEdit ? 'Student updated' : `${student.name} registered${student.seatNumber ? ` on seat ${student.seatNumber}` : ''}`)
    load()
  }

  if (error && !data) return <div className="alert error">{error} <button className="btn sm" onClick={load}>Retry</button></div>
  if (!data) return <div className="loading"><div className="spinner" />Loading dashboard…</div>

  const occupancy = data.seats.active ? Math.round((data.seats.occupied / data.seats.active) * 100) : 0

  return (
    <>
      <div className="page-head">
        <div>
          <h2>{data.roomName}</h2>
          <p>Today is {fmtDate(data.today)} · students due within {data.dueSoonDays} days are highlighted</p>
        </div>
        <div className="row">
          <button className="btn primary" onClick={() => setModal({ type: 'add' })}><IconPlus /> Add student</button>
        </div>
      </div>

      {data.seats.total === 0 && (
        <div className="alert warn">No seats configured yet. <Link to="/seats"><strong>Set up seats</strong></Link> so you can assign seat numbers while registering students.</div>
      )}

      <div className="stats">
        <div className="card stat clickable" onClick={() => setFilter('all')}>
          <span className="label">Active students</span>
          <span className="value">{data.activeStudents}</span>
          <span className="sub">{data.femaleStudents} women · {data.inactiveStudents} left · {data.totalStudents} total</span>
        </div>
        <div className="card stat red clickable" onClick={() => setFilter('Overdue')}>
          <span className="label">Overdue</span>
          <span className="value">{data.overdueCount + data.dueTodayCount}</span>
          <span className="sub">{data.dueTodayCount} due today</span>
        </div>
        <div className="card stat amber clickable" onClick={() => setFilter('DueSoon')}>
          <span className="label">Due in {data.dueSoonDays} days</span>
          <span className="value">{data.dueSoonCount}</span>
          <span className="sub">Follow up before expiry</span>
        </div>
        <div className="card stat gold clickable" onClick={() => navigate('/seats')}>
          <span className="label">Seats</span>
          <span className="value">{data.seats.occupied}<span style={{ fontSize: 14, color: 'var(--muted)', fontWeight: 600 }}> / {data.seats.active}</span></span>
          <span className="sub">{data.seats.free} free · {data.seats.reservedForWomen > 0 ? `${data.seats.reservedForWomen} reserved for women` : `${occupancy}% occupied`}</span>
        </div>
        <div className="card stat green">
          <span className="label">Collected this month</span>
          <span className="value">{money(data.collectedThisMonth)}</span>
          <span className="sub">{money(data.totalCollected)} all time</span>
        </div>
        <div className="card stat red">
          <span className="label">Outstanding balance</span>
          <span className="value">{money(data.totalOutstanding)}</span>
          <span className="sub">Expected {money(data.expectedMonthlyRevenue)} / month</span>
        </div>
      </div>

      <div className="card">
          <div className="card-head">
            <div className="chips">
              {FILTERS.map((f) => (
                <button key={f.key} className={`chip ${filter === f.key ? 'active' : ''}`} onClick={() => setFilter(f.key)}>
                  {f.label}<span className="count">{counts[f.key] ?? 0}</span>
                </button>
              ))}
            </div>
            <div className="toolbar">
              <div className="search">
                <IconSearch />
                <input placeholder="Search name, mobile, seat…" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
            </div>
          </div>
          <div style={{ padding: '10px 20px 0' }}>
            <div className="legend">
              <span><span className="dot green" />Running</span>
              <span><span className="dot amber" />Due within {data.dueSoonDays} days</span>
              <span><span className="dot red" />Due today / overdue</span>
              <span><span className="dot grey" />Left</span>
            </div>
          </div>
          <StudentTable
            students={visible}
            onEdit={(s) => setModal({ type: 'edit', student: s })}
            onPay={(s) => setModal({ type: 'pay', student: s })}
            onRenew={(s) => setModal({ type: 'renew', student: s })}
            compact
          />
      </div>

      <div className="grid-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
          <div className="card">
            <div className="card-head"><h3>Seat occupancy</h3><Link to="/seats" className="btn sm">Manage</Link></div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="progress"><span style={{ width: `${occupancy}%` }} /></div>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span><strong>{data.seats.occupied}</strong> occupied</span>
                <span><strong>{data.seats.free}</strong> free</span>
                <span className="muted">{data.seats.total - data.seats.active} disabled</span>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-head"><h3>Recent payments</h3></div>
            <div className="card-body" style={{ paddingTop: 6, paddingBottom: 6 }}>
              {data.recentPayments.length === 0 ? <p className="muted" style={{ padding: '12px 0' }}>No payments recorded yet.</p> : (
                <div className="activity">
                  {data.recentPayments.map((p) => (
                    <div className="item" key={p.id}>
                      <div>
                        <Link to={`/students/${p.studentId}`} className="primary" style={{ fontWeight: 600 }}>{p.studentName}</Link>
                        <div className="secondary muted" style={{ fontSize: 12 }}>{fmtDate(p.paidOn)}{p.note ? ` · ${p.note}` : ''}</div>
                      </div>
                      <div className="amt">+{money(p.amount)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
      </div>

      {modal?.type === 'add' && <StudentFormModal onClose={() => setModal(null)} onSaved={onSaved} />}
      {modal?.type === 'edit' && <StudentFormModal student={modal.student} onClose={() => setModal(null)} onSaved={onSaved} />}
      {modal?.type === 'pay' && <PaymentModal student={modal.student} onClose={() => setModal(null)} onSaved={() => { setModal(null); toast.success('Payment recorded'); load() }} />}
      {modal?.type === 'renew' && <RenewModal student={modal.student} onClose={() => setModal(null)} onSaved={(s) => { setModal(null); toast.success(`Renewed until ${fmtDate(s.dueDate)}`); load() }} />}
    </>
  )
}
