import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'
import { useToast } from '../lib/toast'
import { fmtDate } from '../lib/format'
import { useBranch } from '../lib/branch'
import { paymentToast } from './Dashboard'
import StudentTable from '../components/StudentTable'
import StudentFormModal from '../components/StudentFormModal'
import PaymentModal from '../components/PaymentModal'
import RenewModal from '../components/RenewModal'
import { IconPlus, IconSearch, IconPrint } from '../components/Icons'

const STATUS_OPTIONS = [
  ['', 'All statuses'], ['Overdue', 'Overdue'], ['DueToday', 'Due today'], ['DueSoon', 'Due soon'], ['Active', 'Running'], ['Inactive', 'Left'],
]

export default function Students() {
  const [students, setStudents] = useState(null)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [includeInactive, setIncludeInactive] = useState(true)
  const [modal, setModal] = useState(null)
  const toast = useToast()
  const { branchId, current, multi } = useBranch()

  const load = useCallback(async () => {
    try {
      setStudents(await api.students({ status: status || undefined, includeInactive, branchId }))
      setError('')
    } catch (e) { setError(e.message) }
  }, [status, includeInactive, branchId])

  useEffect(() => { load() }, [load])

  const visible = useMemo(() => {
    if (!students) return []
    const q = search.trim().toLowerCase()
    if (!q) return students
    return students.filter((s) => s.name.toLowerCase().includes(q) || s.mobile.includes(q) || String(s.seatNumber || '') === q || (s.study || '').toLowerCase().includes(q) || (s.address || '').toLowerCase().includes(q))
  }, [students, search])

  const onSaved = (student, wasEdit) => {
    setModal(null)
    if (wasEdit) toast.success('Student updated'); else paymentToast(toast, student, `${student.name} registered`)
    load()
  }

  return (
    <>
      <div className="card">
        <div className="card-head">
          <div className="toolbar" style={{ flex: 1 }}>
            <div className="search">
              <IconSearch />
              <input placeholder="Search name, mobile, seat, course, address…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              {STATUS_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <label className="row" style={{ fontSize: 13, gap: 6 }}>
              <input type="checkbox" checked={includeInactive} onChange={(e) => setIncludeInactive(e.target.checked)} /> Show left students
            </label>
          </div>
          <div className="row">
            <button className="btn" onClick={() => window.print()} title="Print list"><IconPrint /> Print</button>
            <button className="btn primary" onClick={() => setModal({ type: 'add' })}><IconPlus /> Add student</button>
          </div>
        </div>
        {error && <div className="alert error" style={{ margin: 16 }}>{error}</div>}
        {students === null ? <div className="loading"><div className="spinner" />Loading…</div> : (
          <>
            <div style={{ padding: '8px 20px 0' }} className="muted">{visible.length} student{visible.length === 1 ? '' : 's'}{current ? ` in ${current.name}` : multi ? ' across all branches' : ''}</div>
            <StudentTable
              students={visible}
              showBranch={!current && multi}
              onEdit={(s) => setModal({ type: 'edit', student: s })}
              onPay={(s) => setModal({ type: 'pay', student: s })}
              onRenew={(s) => setModal({ type: 'renew', student: s })}
            />
          </>
        )}
      </div>

      {modal?.type === 'add' && <StudentFormModal onClose={() => setModal(null)} onSaved={onSaved} />}
      {modal?.type === 'edit' && <StudentFormModal student={modal.student} onClose={() => setModal(null)} onSaved={onSaved} />}
      {modal?.type === 'pay' && <PaymentModal student={modal.student} onClose={() => setModal(null)} onSaved={(s) => { setModal(null); paymentToast(toast, s); load() }} />}
      {modal?.type === 'renew' && <RenewModal student={modal.student} onClose={() => setModal(null)} onSaved={(s) => { setModal(null); paymentToast(toast, s, `Renewed until ${fmtDate(s.dueDate)}`); load() }} />}
    </>
  )
}
