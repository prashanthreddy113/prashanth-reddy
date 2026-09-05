import { useState } from 'react'
import Modal from './Modal'
import { api } from '../lib/api'
import { fmtDate } from '../lib/format'

/** Edit a student's due date. The scheduled ("real") date stays visible; one click resets to it. */
export default function DueDateModal({ student, onClose, onSaved }) {
  const [dueDate, setDueDate] = useState(student.dueDate)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const save = async (value) => {
    setBusy(true); setError('')
    try { onSaved(await api.setDueDate(student.id, { dueDate: value, reason: reason.trim() || null })) }
    catch (err) { setError(err.message) }
    finally { setBusy(false) }
  }

  return (
    <Modal title={`Edit due date · ${student.name}`} onClose={onClose} size="narrow">
      <div className="summary-box" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div><div className="k">Real due date</div><div className="v">{fmtDate(student.scheduledDueDate)}</div><div className="help">Joining date + {student.months} month{student.months === 1 ? '' : 's'}</div></div>
        <div><div className="k">Currently used</div><div className="v" style={{ color: student.dueDateOverridden ? 'var(--amber)' : undefined }}>{fmtDate(student.dueDate)}</div><div className="help">{student.dueDateOverridden ? 'Edited by admin' : 'Same as real date'}</div></div>
      </div>
      <form onSubmit={(e) => { e.preventDefault(); save(dueDate) }} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="field">
          <label>New due date<span className="req">*</span></label>
          <input type="date" value={dueDate} min={student.joiningDate} onChange={(e) => setDueDate(e.target.value)} autoFocus />
          <span className="help">Reminders, the due popup, colours and all lists will follow this date.</span>
        </div>
        <div className="field">
          <label>Reason<span className="opt">(optional)</span></label>
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Away for a week, holiday adjustment" maxLength={300} />
        </div>
        {error && <div className="alert error">{error}</div>}
        <div className="form-actions" style={{ justifyContent: 'space-between' }}>
          <button type="button" className="btn" disabled={busy || !student.dueDateOverridden} onClick={() => save(null)} title="Go back to joining date + months">Reset to real date</button>
          <div className="row"><button type="button" className="btn" onClick={onClose} disabled={busy}>Cancel</button><button className="btn primary" disabled={busy || !dueDate}>{busy ? 'Saving…' : 'Save due date'}</button></div>
        </div>
      </form>
    </Modal>
  )
}
