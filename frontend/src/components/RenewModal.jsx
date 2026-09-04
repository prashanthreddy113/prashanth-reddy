import { useState } from 'react'
import Modal from './Modal'
import { api } from '../lib/api'
import { money, todayIso, addMonths, fmtDate } from '../lib/format'

export default function RenewModal({ student, onClose, onSaved }) {
  const [months, setMonths] = useState(1)
  const [rate, setRate] = useState(String(student.amountPerMonth))
  const [paid, setPaid] = useState('')
  const [paidOn, setPaidOn] = useState(todayIso())
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const newDue = addMonths(student.joiningDate, Number(student.months) + Number(months || 0))
  const addedFee = Number(months || 0) * Number(rate || 0)

  const submit = async (e) => {
    e.preventDefault()
    if (!months || Number(months) < 1) { setError('Add at least 1 month.'); return }
    setBusy(true); setError('')
    try {
      const saved = await api.renewStudent(student.id, {
        months: Number(months),
        amountPerMonth: rate === '' ? null : Number(rate),
        paidAmount: paid === '' ? null : Number(paid),
        paidOn,
        note: note.trim() || null,
      })
      onSaved(saved)
    } catch (err) { setError(err.message) }
    finally { setBusy(false) }
  }

  return (
    <Modal title={`Renew subscription · ${student.name}`} onClose={onClose} size="narrow">
      <div className="alert info">Current due date: <strong>{fmtDate(student.dueDate)}</strong>. Renewing extends the plan from that date.</div>
      <form onSubmit={submit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="form-grid">
          <div className="field">
            <label>Add months<span className="req">*</span></label>
            <input type="number" min="1" max="120" value={months} onChange={(e) => setMonths(e.target.value)} autoFocus />
          </div>
          <div className="field">
            <label>Amount per month</label>
            <input type="number" min="0" step="1" value={rate} onChange={(e) => setRate(e.target.value)} inputMode="decimal" />
          </div>
          <div className="field">
            <label>Amount collected now<span className="opt">(optional)</span></label>
            <input type="number" min="0" step="1" value={paid} onChange={(e) => setPaid(e.target.value)} placeholder={String(addedFee)} inputMode="decimal" />
          </div>
          <div className="field">
            <label>Payment date</label>
            <input type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} />
          </div>
          <div className="field full">
            <label>Note<span className="opt">(optional)</span></label>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Renewed for October" />
          </div>
        </div>
        <div className="summary-box">
          <div><div className="k">New due date</div><div className="v">{fmtDate(newDue)}</div></div>
          <div><div className="k">Added fee</div><div className="v">{money(addedFee)}</div></div>
          <div><div className="k">New balance</div><div className="v">{money(Math.max(0, student.balance + addedFee - Number(paid || 0)))}</div></div>
        </div>
        {error && <div className="alert error">{error}</div>}
        <div className="form-actions">
          <button type="button" className="btn" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" className="btn primary" disabled={busy}>{busy ? 'Saving…' : 'Renew'}</button>
        </div>
      </form>
    </Modal>
  )
}
