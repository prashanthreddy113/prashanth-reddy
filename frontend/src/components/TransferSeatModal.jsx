import { useEffect, useMemo, useState } from 'react'
import Modal from './Modal'
import { api } from '../lib/api'
import { useBranch } from '../lib/branch'

/** Move a student to another seat in any branch; occupied seats can be swapped. */
export default function TransferSeatModal({ student, onClose, onSaved }) {
  const { branches } = useBranch()
  const [branchId, setBranchId] = useState(student.branchId)
  const [seats, setSeats] = useState([])
  const [seatNumber, setSeatNumber] = useState('')
  const [swap, setSwap] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { api.seats(branchId).then(setSeats).catch(() => setSeats([])); setSeatNumber('') }, [branchId])

  const isWoman = student.gender === 'Female'
  const options = useMemo(() => seats
    .filter((s) => s.isActive && s.id !== student.seatId && (isWoman || !s.reservedForWomen))
    .filter((s) => swap ? true : !s.isOccupied)
    .filter((s) => !(swap && s.isOccupied && student.seatNumber == null)) // nothing to swap with
    .filter((s) => !(swap && s.isOccupied && s.studentGender !== 'Female' && student.seatReservedForWomen)) // occupant may not take a reserved seat
  , [seats, student, isWoman, swap])

  const target = seats.find((s) => String(s.number) === String(seatNumber))

  const submit = async (e) => {
    e.preventDefault()
    if (!seatNumber) { setError('Choose the new seat.'); return }
    setBusy(true); setError('')
    try { onSaved(await api.transferSeat(student.id, { branchId: Number(branchId), seatNumber: Number(seatNumber), swap: swap && !!target?.isOccupied })) }
    catch (err) { setError(err.message) }
    finally { setBusy(false) }
  }

  return (
    <Modal title={`Transfer seat · ${student.name}`} onClose={onClose} size="narrow">
      <div className="alert info">Currently {student.seatNumber ? <>on seat <strong>{student.seatNumber}</strong></> : <>without a seat</>}.</div>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="field">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={swap} onChange={(e) => setSwap(e.target.checked)} disabled={!student.seatNumber} /> Swap with an occupied seat {student.seatNumber ? '' : '(needs a current seat)'}
          </label>
        </div>
        <div className="field">
          <label>New seat<span className="req">*</span></label>
          <select value={seatNumber} onChange={(e) => setSeatNumber(e.target.value)} autoFocus>
            <option value="">Select…</option>
            {options.map((s) => (
              <option key={s.id} value={s.number}>
                Seat {s.number}{s.section ? ` · ${s.section}` : ''}{s.isAc ? ' · AC' : ' · Non-AC'}{s.reservedForWomen ? ' · women only' : ''}{s.isOccupied ? ` · swap with ${s.studentName}` : ' · free'}
              </option>
            ))}
          </select>
          <span className="help">{options.length} seat{options.length === 1 ? '' : 's'} available{isWoman ? '' : ' (women-only seats hidden)'}.</span>
        </div>
        {target?.isOccupied && <div className="alert warn">{target.studentName} will move to {student.seatNumber ? `seat ${student.seatNumber}` : 'no seat'}.</div>}
        {error && <div className="alert error">{error}</div>}
        <div className="form-actions">
          <button type="button" className="btn" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="btn primary" disabled={busy}>{busy ? 'Moving…' : target?.isOccupied ? 'Swap seats' : 'Transfer'}</button>
        </div>
      </form>
    </Modal>
  )
}
