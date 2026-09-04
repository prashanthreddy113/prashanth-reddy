import { useState } from 'react'
import Modal from './Modal'
import { api } from '../lib/api'
import { money, todayIso } from '../lib/format'

export default function PaymentModal({ student, onClose, onSaved }) {
  const [amount, setAmount] = useState(student.balance > 0 ? String(student.balance) : '')
  const [paidOn, setPaidOn] = useState(todayIso())
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    if (!amount || Number(amount) <= 0) { setError('Enter an amount greater than zero.'); return }
    setBusy(true); setError('')
    try {
      const saved = await api.addPayment(student.id, { amount: Number(amount), paidOn, note: note.trim() || null })
      onSaved(saved)
    } catch (err) { setError(err.message) }
    finally { setBusy(false) }
  }

  return (
    <Modal title={`Record payment · ${student.name}`} onClose={onClose} size="narrow">
      <div className="summary-box">
        <div><div className="k">Total fee</div><div className="v">{money(student.totalFee)}</div></div>
        <div><div className="k">Paid so far</div><div className="v">{money(student.totalPaid)}</div></div>
        <div><div className="k">Balance</div><div className="v" style={{ color: student.balance > 0 ? 'var(--red)' : 'var(--green)' }}>{money(Math.max(0, student.balance))}</div></div>
      </div>
      <form onSubmit={submit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="field">
          <label>Amount received<span className="req">*</span></label>
          <input type="number" min="1" step="1" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus inputMode="decimal" />
        </div>
        <div className="field">
          <label>Payment date</label>
          <input type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} />
        </div>
        <div className="field">
          <label>Note<span className="opt">(optional)</span></label>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Cash, UPI, September fee" />
        </div>
        {error && <div className="alert error">{error}</div>}
        <div className="form-actions">
          <button type="button" className="btn" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" className="btn success" disabled={busy}>{busy ? 'Saving…' : 'Save payment'}</button>
        </div>
      </form>
    </Modal>
  )
}
