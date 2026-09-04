import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { useToast } from '../lib/toast'
import { fmtDate, STATUS } from '../lib/format'
import Modal from '../components/Modal'
import StudentFormModal from '../components/StudentFormModal'

export default function Seats() {
  const [seats, setSeats] = useState(null)
  const [error, setError] = useState('')
  const [capacity, setCapacity] = useState('')
  const [busy, setBusy] = useState(false)
  const [selected, setSelected] = useState(null)
  const [assignSeat, setAssignSeat] = useState(null)
  const [label, setLabel] = useState('')
  const toast = useToast()

  const load = useCallback(async () => {
    try {
      const list = await api.seats()
      setSeats(list)
      setCapacity(String(list.length))
      setError('')
    } catch (e) { setError(e.message) }
  }, [])

  useEffect(() => { load() }, [load])

  const summary = useMemo(() => {
    if (!seats) return null
    const active = seats.filter((s) => s.isActive)
    const occupied = seats.filter((s) => s.isOccupied)
    return { total: seats.length, active: active.length, occupied: occupied.length, free: active.length - occupied.filter((s) => s.isActive).length,
      overdue: occupied.filter((s) => s.studentStatus === 'Overdue' || s.studentStatus === 'DueToday').length,
      dueSoon: occupied.filter((s) => s.studentStatus === 'DueSoon').length }
  }, [seats])

  const saveCapacity = async (e) => {
    e.preventDefault()
    const n = Number(capacity)
    if (!Number.isInteger(n) || n < 0) { toast.error('Enter a whole number of seats'); return }
    setBusy(true)
    try {
      const r = await api.setSeatCapacity(n)
      toast.success(`Room now has ${r.total} seat${r.total === 1 ? '' : 's'}`)
      load()
    } catch (err) { toast.error(err.message) }
    finally { setBusy(false) }
  }

  const openSeat = (seat) => { setSelected(seat); setLabel(seat.label || '') }

  const saveSeat = async (isActive) => {
    setBusy(true)
    try {
      await api.updateSeat(selected.id, { label, isActive })
      toast.success(`Seat ${selected.number} updated`)
      setSelected(null)
      load()
    } catch (err) { toast.error(err.message) }
    finally { setBusy(false) }
  }

  if (error && !seats) return <div className="alert error">{error}</div>
  if (!seats) return <div className="loading"><div className="spinner" />Loading seats…</div>

  return (
    <>
      <div className="grid-2">
        <div className="card">
          <div className="card-head">
            <div>
              <h3>Seat map</h3>
              <span className="muted">Click a seat to assign a student, rename it, or disable it.</span>
            </div>
            <div className="legend">
              <span><span className="dot green" />Free</span>
              <span><span className="dot" style={{ background: '#e8eef7', borderColor: '#c9d6e8' }} />Occupied</span>
              <span><span className="dot amber" />Due soon</span>
              <span><span className="dot red" />Overdue</span>
              <span><span className="dot grey" />Disabled</span>
            </div>
          </div>
          <div className="card-body">
            {seats.length === 0 ? (
              <div className="empty"><strong>No seats yet</strong>Enter the number of seats in your reading room on the right to create them.</div>
            ) : (
              <div className="seat-grid">
                {seats.map((s) => (
                  <div key={s.id}
                    className={`seat ${s.isOccupied ? `occupied ${s.studentStatus || ''}` : ''} ${!s.isActive ? 'inactive' : ''}`}
                    onClick={() => openSeat(s)} title={s.isOccupied ? `${s.studentName} · due ${fmtDate(s.studentDueDate)}` : s.isActive ? 'Free seat' : 'Disabled'}>
                    <div className="no">{s.number}</div>
                    {s.isOccupied ? <div className="who">{s.studentName}</div> : <div className="tag">{s.isActive ? 'Free' : 'Disabled'}</div>}
                    {s.label && <div className="tag">{s.label}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="card">
            <div className="card-head"><h3>Capacity</h3></div>
            <form className="card-body" onSubmit={saveCapacity} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="field">
                <label>Total seats in the room</label>
                <input type="number" min="0" max="10000" value={capacity} onChange={(e) => setCapacity(e.target.value)} />
                <span className="help">Increasing adds new seat numbers. Decreasing removes the highest-numbered seats if they are free.</span>
              </div>
              <button className="btn primary" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save capacity'}</button>
            </form>
          </div>

          {summary && (
            <div className="card">
              <div className="card-head"><h3>Summary</h3></div>
              <div className="card-body">
                <div className="kv">
                  <span className="k">Total seats</span><span className="v">{summary.total}</span>
                  <span className="k">Available</span><span className="v">{summary.active}</span>
                  <span className="k">Occupied</span><span className="v">{summary.occupied}</span>
                  <span className="k">Free</span><span className="v" style={{ color: 'var(--green)' }}>{summary.free}</span>
                  <span className="k">Due soon</span><span className="v" style={{ color: 'var(--amber)' }}>{summary.dueSoon}</span>
                  <span className="k">Overdue</span><span className="v" style={{ color: 'var(--red)' }}>{summary.overdue}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {selected && (
        <Modal title={`Seat ${selected.number}`} onClose={() => setSelected(null)} size="narrow">
          {selected.isOccupied ? (
            <div className="alert info">
              Occupied by <Link to={`/students/${selected.studentId}`}><strong>{selected.studentName}</strong></Link>
              {selected.studentStatus && <> · {STATUS[selected.studentStatus]?.label} (due {fmtDate(selected.studentDueDate)})</>}
            </div>
          ) : selected.isActive ? (
            <button className="btn primary" onClick={() => { setAssignSeat(selected.number); setSelected(null) }}>Register a student on this seat</button>
          ) : (
            <div className="alert warn">This seat is disabled and cannot be assigned.</div>
          )}
          <div className="field">
            <label>Label<span className="opt">(optional)</span></label>
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Window, AC hall, Cabin" maxLength={50} />
          </div>
          <div className="form-actions" style={{ justifyContent: 'space-between' }}>
            {selected.isActive
              ? <button className="btn danger" disabled={busy || selected.isOccupied} title={selected.isOccupied ? 'Move the student first' : ''} onClick={() => saveSeat(false)}>Disable seat</button>
              : <button className="btn success" disabled={busy} onClick={() => saveSeat(true)}>Enable seat</button>}
            <button className="btn primary" disabled={busy} onClick={() => saveSeat(selected.isActive)}>Save</button>
          </div>
        </Modal>
      )}

      {assignSeat && (
        <StudentFormModal presetSeat={assignSeat} onClose={() => setAssignSeat(null)} onSaved={(s) => { setAssignSeat(null); toast.success(`${s.name} registered on seat ${s.seatNumber}`); load() }} />
      )}
    </>
  )
}
