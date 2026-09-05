import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { money, fmtDate, setCurrency } from '../lib/format'
import { useToast } from '../lib/toast'
import { useBranch } from '../lib/branch'
import StudentTable from '../components/StudentTable'
import StudentFormModal from '../components/StudentFormModal'
import PaymentModal from '../components/PaymentModal'
import RenewModal from '../components/RenewModal'
import TransferSeatModal from '../components/TransferSeatModal'
import ReadingRoomScene from '../components/ReadingRoomScene'
import DueAlertModal, { splitDue, shouldShowDueAlert, markDueAlertShown } from '../components/DueAlertModal'
import { IconPlus, IconSearch, IconBell } from '../components/Icons'

const FILTERS = [
  { key: 'attention', label: 'Needs attention' },
  { key: 'all', label: 'All active' },
  { key: 'Overdue', label: 'Overdue' },
  { key: 'DueToday', label: 'Due today' },
  { key: 'DueSoon', label: 'Due soon' },
  { key: 'Active', label: 'Running' },
  { key: 'Inactive', label: 'Left' },
]

export function paymentToast(toast, s, base = 'Payment recorded') {
  if (s?.receiptSent) toast.success(`${base} · WhatsApp receipt sent`)
  else if (s?.receiptError) toast.info(`${base} · receipt not sent: ${s.receiptError}`)
  else toast.success(base)
}

export default function Dashboard() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('attention')
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(null)
  const [dueAlert, setDueAlert] = useState(false)
  const toast = useToast()
  const navigate = useNavigate()
  const { branchId } = useBranch()
  const current = null, multi = false

  const load = useCallback(async () => {
    try {
      const d = await api.dashboard(branchId)
      setCurrency(d.currency)
      setData(d)
      setError('')
    } catch (e) { setError(e.message) }
  }, [branchId])

  useEffect(() => { load() }, [load])

  // After sign-in: pop up who is overdue, due today and due tomorrow (once per session, snoozable for the day).
  useEffect(() => {
    if (!data) return
    const g = splitDue(data.students)
    if (g.overdue.length + g.today.length + g.tomorrow.length === 0) return
    if (shouldShowDueAlert(data.today)) { setDueAlert(true); markDueAlertShown(data.today) }
  }, [data])

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
    if (q) list = list.filter((s) => s.name.toLowerCase().includes(q) || s.mobile.includes(q) || String(s.seatNumber || '') === q || (s.study || '').toLowerCase().includes(q) || (s.branchName || '').toLowerCase().includes(q))
    return list
  }, [data, filter, search])

  const onSaved = (student, wasEdit) => {
    setModal(null)
    if (wasEdit) toast.success('Student updated')
    else paymentToast(toast, student, `${student.name} registered${student.seatNumber ? ` on seat ${student.seatNumber}` : ''}`)
    load()
  }

  if (error && !data) return <div className="alert error">{error} <button className="btn sm" onClick={load}>Retry</button></div>
  if (!data) return <div className="loading"><div className="spinner" />Loading dashboard…</div>

  const occupancy = data.seats.active ? Math.round((data.seats.occupied / data.seats.active) * 100) : 0

  return (
    <>
      <ReadingRoomScene
        title={data.roomName}
        subtitle={`Students due within ${data.dueSoonDays} days are highlighted below`}
        data={data}
      />

      <div className="page-head reveal">
        <div>
          <h2>Today at a glance</h2>
          <p>Overview of students, dues, seats and money.</p>
        </div>
        <div className="row">
          <button className="btn" onClick={() => setDueAlert(true)} title="Overdue, due today and due tomorrow">
            <IconBell /> Due alerts
            {(() => { const g = splitDue(data.students); const n = g.overdue.length + g.today.length + g.tomorrow.length; return n ? <span className="badge red" style={{ marginLeft: 4 }}>{n}</span> : null })()}
          </button>
          <button className="btn primary" onClick={() => setModal({ type: 'add' })}><IconPlus /> Add student</button>
        </div>
      </div>

      {data.seats.total === 0 && (
        <div className="alert warn">No seats configured yet. <Link to="/seats"><strong>Set up seats</strong></Link> so you can assign seat numbers while registering students.</div>
      )}

      <div className="stats reveal" style={{ animationDelay: '0.1s' }}>
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
          <span className="label">Seats available</span>
          <span className="value">{data.seats.free}<span style={{ fontSize: 14, color: 'var(--muted)', fontWeight: 600 }}> / {data.seats.active}</span></span>
          <span className="sub">{data.seats.generalFree} open to anyone · {data.seats.reservedFree} women only · {data.seats.acFree} AC free</span>
        </div>
        <div className="card stat green clickable" onClick={() => navigate('/expenses')}>
          <span className="label">Collected this month</span>
          <span className="value">{money(data.collectedThisMonth)}</span>
          <span className="sub">{money(data.totalCollected)} all time</span>
        </div>
        <div className="card stat red clickable" onClick={() => navigate('/expenses')}>
          <span className="label">Expenses this month</span>
          <span className="value">{money(data.expensesThisMonth)}</span>
          <span className="sub">{money(data.expensesAllTime)} all time</span>
        </div>
        <div className={`card stat ${data.netThisMonth >= 0 ? 'green' : 'red'} clickable`} onClick={() => navigate('/expenses')}>
          <span className="label">Net revenue this month</span>
          <span className="value">{money(data.netThisMonth)}</span>
          <span className="sub">{money(data.netAllTime)} all time · {money(data.totalOutstanding)} outstanding</span>
        </div>
      </div>

      <div className="card reveal" style={{ animationDelay: '0.25s' }}>
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
          showBranch={!current && multi}
          onEdit={(s) => setModal({ type: 'edit', student: s })}
          onPay={(s) => setModal({ type: 'pay', student: s })}
          onRenew={(s) => setModal({ type: 'renew', student: s })}
          onTransfer={(s) => setModal({ type: 'transfer', student: s })}
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
              <span><strong>{data.seats.free}</strong> free in total</span>
              <span className="muted">{data.seats.total - data.seats.active} disabled</span>
            </div>
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              <span className="badge green">{data.seats.generalFree} free · anyone</span>
              <span className="badge" style={{ color: '#be185d', background: '#fce7f3', borderColor: '#f9a8d4' }}>{data.seats.reservedFree} free · women only</span>
              <span className="badge navy">{data.seats.acFree} AC free</span>
              <span className="badge grey">{data.seats.nonAcFree} non-AC free</span>
              <span className="badge" style={{ color: '#be185d', background: '#fce7f3', borderColor: '#f9a8d4' }}>{data.seats.womenSeated} women seated</span>
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

      {dueAlert && <DueAlertModal students={data.students} today={data.today} onClose={() => setDueAlert(false)} />}
      {modal?.type === 'add' && <StudentFormModal onClose={() => setModal(null)} onSaved={onSaved} />}
      {modal?.type === 'edit' && <StudentFormModal student={modal.student} onClose={() => setModal(null)} onSaved={onSaved} />}
      {modal?.type === 'pay' && <PaymentModal student={modal.student} onClose={() => setModal(null)} onSaved={(s) => { setModal(null); paymentToast(toast, s); load() }} />}
      {modal?.type === 'transfer' && <TransferSeatModal student={modal.student} onClose={() => setModal(null)} onSaved={(s) => { setModal(null); toast.success(`${s.name} moved to seat ${s.seatNumber}`); load() }} />}
      {modal?.type === 'renew' && <RenewModal student={modal.student} onClose={() => setModal(null)} onSaved={(s) => { setModal(null); paymentToast(toast, s, `Renewed until ${fmtDate(s.dueDate)}`); load() }} />}
    </>
  )
}
