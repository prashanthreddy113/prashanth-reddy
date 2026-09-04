import { useState } from 'react'
import Modal from './Modal'

export default function ConfirmDialog({ title, message, confirmLabel = 'Confirm', danger, onConfirm, onClose }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const go = async () => {
    setBusy(true); setError('')
    try { await onConfirm(); onClose() }
    catch (e) { setError(e.message || 'Something went wrong') }
    finally { setBusy(false) }
  }

  return (
    <Modal title={title} onClose={onClose} size="narrow">
      <p>{message}</p>
      {error && <div className="alert error">{error}</div>}
      <div className="form-actions">
        <button className="btn" onClick={onClose} disabled={busy}>Cancel</button>
        <button className={`btn ${danger ? 'danger' : 'primary'}`} onClick={go} disabled={busy}>{busy ? 'Working…' : confirmLabel}</button>
      </div>
    </Modal>
  )
}
