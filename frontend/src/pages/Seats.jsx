import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { useToast } from '../lib/toast'
import { useBranch } from '../lib/branch'
import { fmtDate, STATUS } from '../lib/format'
import Modal from '../components/Modal'
import ConfirmDialog from '../components/ConfirmDialog'
import StudentFormModal from '../components/StudentFormModal'
import TransferSeatModal from '../components/TransferSeatModal'
import { IconSnow, IconPlus } from '../components/Icons'

function AcTag({ ac }) { return <span className={`ac-tag ${ac ? '' : 'non'}`}>{ac ? <><IconSnow width={10} height={10} /> AC</> : 'NON-AC'}</span> }

export default function Seats() {
  const { branchId, branches, loaded } = useBranch()
  const branch = branchId
  const branchObj = { name: 'the reading room' }

  const [seats, setSeats] = useState(null)
  const [sections, setSections] = useState([])
  const [quota, setQuota] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [selected, setSeat] = useState(null)
  const [assignSeat, setAssignSeat] = useState(null)
  const [transfer, setTransfer] = useState(null)
  const [vacate, setVacate] = useState(null)
  const [seatForm, setSeatForm] = useState({ label: '', section: '', isAc: false })
  const [mode, setMode] = useState('total')
  const [capacity, setCapacity] = useState('')
  const [totalForm, setTotalForm] = useState({ section: '', isAc: false })
  const [secForm, setSecForm] = useState({ name: '', seats: 10, isAc: true })
  const [secModal, setSecModal] = useState(null)
  const toast = useToast()

  const load = useCallback(async () => {
    if (!branch) { setSeats([]); return }
    try {
      const [list, secs, q] = await Promise.all([api.seats(branch), api.seatSections(branch), api.seatSummary(branch).catch(() => null)])
      setSeats(list); setSections(secs); setQuota(q); setCapacity(String(list.length)); setError('')
    } catch (e) { setError(e.message) }
  }, [branch])
  useEffect(() => { load() }, [load])

  const grouped = useMemo(() => {
    if (!seats) return []
    const map = new Map()
    for (const s of seats) { const k = s.section || ''; if (!map.has(k)) map.set(k, []); map.get(k).push(s) }
    return [...map.entries()].sort((a, b) => (a[0] === '' ? 1 : b[0] === '' ? -1 : a[0].localeCompare(b[0])))
  }, [seats])

  const run = async (fn, okMsg) => {
    setBusy(true)
    try { await fn(); if (okMsg) toast.success(okMsg); await load(); return true }
    catch (err) { toast.error(err.message); return false }
    finally { setBusy(false) }
  }

  const saveCapacity = (e) => {
    e.preventDefault()
    const n = Number(capacity)
    if (!Number.isInteger(n) || n < 0) { toast.error('Enter a whole number of seats'); return }
    run(() => api.setSeatCapacity({ branchId: branch, totalSeats: n, section: totalForm.section || null, isAc: totalForm.isAc }), `The room now has ${n} seat${n === 1 ? '' : 's'}`)
  }
  const addSection = (e) => {
    e.preventDefault()
    if (!secForm.name.trim()) { toast.error('Give the floor / room / section a name'); return }
    run(() => api.addSeatSection({ branchId: branch, name: secForm.name.trim(), seats: Number(secForm.seats), isAc: secForm.isAc }), `Added ${secForm.seats} seats in "${secForm.name.trim()}"`).then((ok) => ok && setSecForm({ name: '', seats: 10, isAc: true }))
  }
  const openSeat = (s) => { setSeat(s); setSeatForm({ label: s.label || '', section: s.section || '', isAc: s.isAc, reservedForWomen: s.reservedForWomen }) }
  const saveSeat = (isActive) => run(() => api.updateSeat(selected.id, { label: seatForm.label, section: seatForm.section, isAc: seatForm.isAc, reservedForWomen: seatForm.reservedForWomen, isActive }), `Seat ${selected.number} updated`).then((ok) => ok && setSeat(null))
  const reapply = () => run(() => api.applySeatReservation(branch), 'Reserved seats re-applied from the percentage')

  if (loaded && !branches.length) return <div className="alert error">The API has no room record yet. Restart the API once; it creates it automatically.</div>
  if (error && !seats) return <div className="alert error">{error}</div>
  if (!seats || !branch) return <div className="loading"><div className="spinner" />Loading seats…</div>

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Seat map</h2>
          <p>{seats.length} seats · {sections.filter((s) => s.name).length} section{sections.filter((s) => s.name).length === 1 ? '' : 's'} · {quota?.acSeats ?? 0} AC · {quota?.nonAcSeats ?? 0} non-AC</p>
          {quota && (
            <div className="row" style={{ gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              <span className="badge green" style={{ fontSize: 13 }}>{quota.free} seats available in total</span>
              <span className="badge navy">{quota.generalFree} open to anyone</span>
              <span className="badge" style={{ color: '#be185d', background: '#fce7f3', borderColor: '#f9a8d4' }}>{quota.reservedFree} women only</span>
              <span className="badge grey">{quota.acFree} AC · {quota.nonAcFree} non-AC free</span>
            </div>
          )}
        </div>
        <div className="legend">
          <span><span className="dot green" />Free (anyone)</span>
          <span><span className="dot pink-light" />Reserved for women</span>
          <span><span className="dot pink-dark" />Occupied by a woman</span>
          <span><span className="dot" style={{ background: '#e8eef7', borderColor: '#c9d6e8' }} />Occupied</span>
          <span><span className="dot amber" />Due soon</span>
          <span><span className="dot red" />Overdue</span>
          <span><span className="dot grey" />Disabled</span>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-head"><div><h3>Seat map</h3><span className="muted">Click a seat to register a student on it, label it, move it to a section, or disable it.</span></div></div>
          <div className="card-body">
            {seats.length === 0 ? (
              <div className="empty"><strong>No seats yet</strong>Set a total on the right, or add floors / rooms / sections one by one.</div>
            ) : grouped.map(([name, list]) => (
              <div key={name || '__none'}>
                <div className="section-head">
                  <h4>{name || 'Unsectioned seats'} {name && <AcTag ac={list.every((s) => s.isAc)} />}</h4>
                  <div className="row" style={{ gap: 6 }}>
                    <span className="meta">{list.filter((s) => s.isOccupied).length}/{list.filter((s) => s.isActive).length} occupied</span>
                    {name && <button className="btn sm ghost" onClick={() => setSecModal({ name, newName: name, isAc: list.every((s) => s.isAc), addSeats: 0 })}>Edit section</button>}
                  </div>
                </div>
                <div className="seat-grid" style={{ marginTop: 10 }}>
                  {list.map((s) => (
                    <div key={s.id} className={`seat ${s.isOccupied ? `occupied ${s.studentStatus || ''}` : ''} ${s.isOccupied && s.studentGender === 'Female' ? 'woman' : ''} ${!s.isOccupied && s.reservedForWomen ? 'reserved' : ''} ${!s.isActive ? 'inactive' : ''}`} onClick={() => openSeat(s)}
                      title={s.isOccupied ? `${s.studentName} · due ${fmtDate(s.studentDueDate)}${s.reservedForWomen ? ' · reserved for women' : ''}` : s.isActive ? (s.reservedForWomen ? 'Free · reserved for women' : 'Free · anyone can book') : 'Disabled'}>
                      {s.reservedForWomen && <span className="rsv">W</span>}
                      <div className="no">{s.number}</div>
                      {s.isOccupied ? <div className="who">{s.studentName}</div> : <div className="tag">{s.isActive ? (s.reservedForWomen ? 'Women only' : 'Free') : 'Disabled'}</div>}
                      <div className="sec">{s.isAc ? 'AC' : 'Non-AC'}{s.label ? ` · ${s.label}` : ''}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="card">
            <div className="card-head">
              <h3>Set up seats</h3>
              <div className="tabs" style={{ borderBottom: 'none' }}>
                <button className={mode === 'total' ? 'active' : ''} onClick={() => setMode('total')}>Total seats</button>
                <button className={mode === 'section' ? 'active' : ''} onClick={() => setMode('section')}>Floor / room / section</button>
              </div>
            </div>
            {mode === 'total' ? (
              <form className="card-body" onSubmit={saveCapacity} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="field">
                  <label>Total seats in the reading room</label>
                  <input type="number" min="0" max="10000" value={capacity} onChange={(e) => setCapacity(e.target.value)} />
                  <span className="help">Increasing adds new seat numbers. Decreasing removes the highest-numbered seats if they are free.</span>
                </div>
                <div className="form-grid">
                  <div className="field"><label>Section for new seats<span className="opt">(optional)</span></label><input value={totalForm.section} onChange={(e) => setTotalForm({ ...totalForm, section: e.target.value })} placeholder="e.g. Main hall" /></div>
                  <div className="field"><label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 24 }}><input type="checkbox" checked={totalForm.isAc} onChange={(e) => setTotalForm({ ...totalForm, isAc: e.target.checked })} /> New seats are AC</label></div>
                </div>
                <button className="btn primary" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save total'}</button>
              </form>
            ) : (
              <form className="card-body" onSubmit={addSection} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="field"><label>Floor / room / section name</label><input value={secForm.name} onChange={(e) => setSecForm({ ...secForm, name: e.target.value })} placeholder="e.g. Ground floor · Room A" maxLength={80} /></div>
                <div className="form-grid">
                  <div className="field"><label>Number of seats</label><input type="number" min="1" max="5000" value={secForm.seats} onChange={(e) => setSecForm({ ...secForm, seats: e.target.value })} /></div>
                  <div className="field"><label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 24 }}><input type="checkbox" checked={secForm.isAc} onChange={(e) => setSecForm({ ...secForm, isAc: e.target.checked })} /> Air-conditioned</label></div>
                </div>
                <span className="help">Seat numbers continue from the highest existing seat, so every seat number stays unique.</span>
                <button className="btn primary" type="submit" disabled={busy}><IconPlus /> {busy ? 'Adding…' : 'Add section'}</button>
              </form>
            )}
          </div>

          {sections.length > 0 && (
            <div className="card">
              <div className="card-head"><h3>Sections</h3></div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Section</th><th>Type</th><th className="num">Seats</th><th className="num">Free</th></tr></thead>
                  <tbody>{sections.map((s) => (
                    <tr key={s.name || '__none'}><td className="primary">{s.name || <span className="muted">Unsectioned</span>}</td><td><AcTag ac={s.acSeats === s.total && s.total > 0} />{s.acSeats > 0 && s.acSeats < s.total ? <span className="secondary" style={{ marginLeft: 6 }}>mixed</span> : null}</td><td className="num">{s.total}</td><td className="num" style={{ color: s.free ? 'var(--green)' : 'var(--red)' }}>{s.free}</td></tr>
                  ))}</tbody>
                </table>
              </div>
            </div>
          )}

          {quota && (
            <div className="card">
              <div className="card-head"><h3>Women's reservation</h3><div className="row" style={{ gap: 6 }}><button className="btn sm" onClick={reapply} disabled={busy} title="Re-mark reserved seats from the percentage">Re-apply</button><Link to="/settings" className="btn sm">Change %</Link></div></div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div className="kv">
                  <span className="k">Reserved share</span><span className="v">{quota.femaleReservationPercent}% · {quota.reservedForWomen} of {quota.active} seats</span>
                  <span className="k">Reserved seats free</span><span className="v" style={{ color: '#be185d' }}>{quota.reservedFree}</span>
                  <span className="k">Women seated</span><span className="v">{quota.womenSeated} <span className="secondary">({quota.womenOnReservedSeats} on reserved seats)</span></span>
                  <span className="k">Open to anyone</span><span className="v">{quota.generalCapacity} seats · {quota.generalFree} free</span>
                  <span className="k">AC free / Non-AC free</span><span className="v">{quota.acFree} / {quota.nonAcFree}</span>
                </div>
                <p className="muted" style={{ fontSize: 12 }}>Light pink seats can only be given to women. Every other seat can be booked by men or women. Click a seat to change its reservation; “Re-apply” re-marks seats from the percentage.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {selected && (
        <Modal title={`Seat ${selected.number}`} onClose={() => setSeat(null)} size="narrow">
          {selected.isOccupied ? (
            <>
              <div className="alert info">Occupied by <Link to={`/students/${selected.studentId}`}><strong>{selected.studentName}</strong></Link>{selected.studentStatus && <> · {STATUS[selected.studentStatus]?.label} (due {fmtDate(selected.studentDueDate)})</>}</div>
              <div className="row">
                <button className="btn" onClick={async () => { const st = await api.student(selected.studentId).catch(() => null); if (st) { setTransfer(st); setSeat(null) } }}>Transfer {selected.studentName?.split(' ')[0]} to another seat</button>
                <button className="btn danger" onClick={() => { setVacate({ id: selected.studentId, name: selected.studentName, number: selected.number }); setSeat(null) }}>Vacate seat</button>
              </div>
            </>
          ) : selected.isActive ? (
            <button className="btn primary" onClick={() => { setAssignSeat(selected.number); setSeat(null) }}>Register a student on this seat</button>
          ) : <div className="alert warn">This seat is disabled and cannot be assigned.</div>}
          <div className="form-grid">
            <div className="field"><label>Section</label><input value={seatForm.section} onChange={(e) => setSeatForm({ ...seatForm, section: e.target.value })} placeholder="e.g. Room A" maxLength={80} /></div>
            <div className="field"><label>Label<span className="opt">(optional)</span></label><input value={seatForm.label} onChange={(e) => setSeatForm({ ...seatForm, label: e.target.value })} placeholder="Window, Near door" maxLength={50} /></div>
            <div className="field full"><label style={{ display: 'flex', alignItems: 'center', gap: 8 }}><input type="checkbox" checked={seatForm.isAc} onChange={(e) => setSeatForm({ ...seatForm, isAc: e.target.checked })} /> Air-conditioned seat</label></div>
            <div className="field full"><label style={{ display: 'flex', alignItems: 'center', gap: 8 }}><input type="checkbox" checked={!!seatForm.reservedForWomen} onChange={(e) => setSeatForm({ ...seatForm, reservedForWomen: e.target.checked })} /> Reserved for women (only women can be given this seat)</label></div>
          </div>
          <div className="form-actions" style={{ justifyContent: 'space-between' }}>
            {selected.isActive
              ? <button className="btn danger" disabled={busy || selected.isOccupied} title={selected.isOccupied ? 'Move the student first' : ''} onClick={() => saveSeat(false)}>Disable seat</button>
              : <button className="btn success" disabled={busy} onClick={() => saveSeat(true)}>Enable seat</button>}
            <button className="btn primary" disabled={busy} onClick={() => saveSeat(selected.isActive)}>Save</button>
          </div>
        </Modal>
      )}

      {secModal && (
        <Modal title={`Section · ${secModal.name}`} onClose={() => setSecModal(null)} size="narrow">
          <div className="form-grid">
            <div className="field full"><label>Name</label><input value={secModal.newName} onChange={(e) => setSecModal({ ...secModal, newName: e.target.value })} maxLength={80} /></div>
            <div className="field"><label>Add more seats</label><input type="number" min="0" max="5000" value={secModal.addSeats} onChange={(e) => setSecModal({ ...secModal, addSeats: e.target.value })} /></div>
            <div className="field"><label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 24 }}><input type="checkbox" checked={secModal.isAc} onChange={(e) => setSecModal({ ...secModal, isAc: e.target.checked })} /> Air-conditioned</label></div>
          </div>
          <div className="form-actions" style={{ justifyContent: 'space-between' }}>
            <button className="btn danger" disabled={busy} onClick={() => setSecModal({ ...secModal, confirmDelete: true })}>Remove section</button>
            <button className="btn primary" disabled={busy} onClick={() => run(() => api.updateSeatSection({ branchId: branch, name: secModal.name, newName: secModal.newName, isAc: secModal.isAc, addSeats: Number(secModal.addSeats || 0) }), 'Section updated').then((ok) => ok && setSecModal(null))}>Save</button>
          </div>
          {secModal.confirmDelete && (
            <ConfirmDialog title={`Remove "${secModal.name}"?`} message="All free seats in this section are deleted. Occupied seats block the removal." confirmLabel="Remove section" danger
              onClose={() => setSecModal({ ...secModal, confirmDelete: false })} onConfirm={async () => { await api.deleteSeatSection(branch, secModal.name); toast.info('Section removed'); setSecModal(null); load() }} />
          )}
        </Modal>
      )}

      {transfer && <TransferSeatModal student={transfer} onClose={() => setTransfer(null)} onSaved={(u) => { setTransfer(null); toast.success(`${u.name} moved to seat ${u.seatNumber}`); load() }} />}
      {vacate && (
        <ConfirmDialog title={`Vacate seat ${vacate.number}?`} message={`${vacate.name} stays an active member without a seat. Seat ${vacate.number} becomes free immediately.`} confirmLabel="Vacate seat"
          onClose={() => setVacate(null)} onConfirm={async () => { await api.vacateSeat(vacate.id); toast.info(`Seat ${vacate.number} vacated`); load() }} />
      )}
      {assignSeat && <StudentFormModal presetSeat={assignSeat} presetBranchId={branch} onClose={() => setAssignSeat(null)} onSaved={(s) => { setAssignSeat(null); toast.success(`${s.name} registered on seat ${s.seatNumber}`); load() }} />}
    </>
  )
}
