import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { useToast } from '../lib/toast'
import { useBranch } from '../lib/branch'
import { fmtDate, STATUS } from '../lib/format'
import Modal from '../components/Modal'
import ConfirmDialog from '../components/ConfirmDialog'
import StudentFormModal from '../components/StudentFormModal'
import { IconSnow, IconPlus } from '../components/Icons'

function AcTag({ ac }) { return <span className={`ac-tag ${ac ? '' : 'non'}`}>{ac ? <><IconSnow width={10} height={10} /> AC</> : 'NON-AC'}</span> }

export default function Seats() {
  const { branchId, activeBranches, branches, setSelected } = useBranch()
  const [localBranch, setLocalBranch] = useState(null)
  const branch = branchId || localBranch || activeBranches[0]?.id || branches[0]?.id || null
  const branchObj = branches.find((b) => b.id === branch)

  const [seats, setSeats] = useState(null)
  const [sections, setSections] = useState([])
  const [quota, setQuota] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [selected, setSeat] = useState(null)
  const [assignSeat, setAssignSeat] = useState(null)
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
    run(() => api.setSeatCapacity({ branchId: branch, totalSeats: n, section: totalForm.section || null, isAc: totalForm.isAc }), `${branchObj?.name || 'Branch'} now has ${n} seat${n === 1 ? '' : 's'}`)
  }
  const addSection = (e) => {
    e.preventDefault()
    if (!secForm.name.trim()) { toast.error('Give the floor / room / section a name'); return }
    run(() => api.addSeatSection({ branchId: branch, name: secForm.name.trim(), seats: Number(secForm.seats), isAc: secForm.isAc }), `Added ${secForm.seats} seats in "${secForm.name.trim()}"`).then((ok) => ok && setSecForm({ name: '', seats: 10, isAc: true }))
  }
  const openSeat = (s) => { setSeat(s); setSeatForm({ label: s.label || '', section: s.section || '', isAc: s.isAc }) }
  const saveSeat = (isActive) => run(() => api.updateSeat(selected.id, { label: seatForm.label, section: seatForm.section, isAc: seatForm.isAc, isActive }), `Seat ${selected.number} updated`).then((ok) => ok && setSeat(null))

  if (!branches.length) return <div className="alert warn">Create a branch first on the <Link to="/branches"><strong>Branches</strong></Link> page.</div>
  if (error && !seats) return <div className="alert error">{error}</div>
  if (!seats) return <div className="loading"><div className="spinner" />Loading seats…</div>

  return (
    <>
      <div className="page-head">
        <div>
          <h2 className="row" style={{ gap: 10 }}>
            {branchObj?.name || 'Seats'}
            {!branchId && branches.length > 1 && (
              <select value={branch || ''} onChange={(e) => setLocalBranch(Number(e.target.value))} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #cbd5e1', font: 'inherit' }}>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            )}
          </h2>
          <p>{seats.length} seats · {sections.filter((s) => s.name).length} section{sections.filter((s) => s.name).length === 1 ? '' : 's'} · {quota?.acSeats ?? 0} AC · {quota?.nonAcSeats ?? 0} non-AC{!branchId && branches.length > 1 ? ' · pick a branch above or in the top bar' : ''}</p>
        </div>
        <div className="legend">
          <span><span className="dot green" />Free</span>
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
              <div className="empty"><strong>No seats in {branchObj?.name} yet</strong>Set a total on the right, or add floors / rooms / sections one by one.</div>
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
                    <div key={s.id} className={`seat ${s.isOccupied ? `occupied ${s.studentStatus || ''}` : ''} ${!s.isActive ? 'inactive' : ''}`} onClick={() => openSeat(s)}
                      title={s.isOccupied ? `${s.studentName} · due ${fmtDate(s.studentDueDate)}` : s.isActive ? 'Free seat' : 'Disabled'}>
                      <div className="no">{s.number}</div>
                      {s.isOccupied ? <div className="who">{s.studentGender === 'Female' ? <span className="gender-tag Female" style={{ marginRight: 4, marginLeft: 0 }}>F</span> : null}{s.studentName}</div> : <div className="tag">{s.isActive ? 'Free' : 'Disabled'}</div>}
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
                  <label>Total seats in {branchObj?.name}</label>
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
                <span className="help">Seat numbers continue from the branch's highest seat, so every seat stays unique within the branch.</span>
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
              <div className="card-head"><h3>Women's reservation</h3><Link to="/branches" className="btn sm">Change</Link></div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div className="kv">
                  <span className="k">Reserved share</span><span className="v">{quota.femaleReservationPercent}% · {quota.reservedForWomen} of {quota.active} seats</span>
                  <span className="k">Women seated</span><span className="v">{quota.womenSeated}</span>
                  <span className="k">Open to men/others</span><span className="v">{quota.generalCapacity} seats · {quota.generalOccupied} taken</span>
                  <span className="k">Still open to men</span><span className="v" style={{ color: quota.generalFree > 0 ? 'var(--green)' : 'var(--red)' }}>{quota.generalFree}</span>
                  <span className="k">AC free / Non-AC free</span><span className="v">{quota.acFree} / {quota.nonAcFree}</span>
                </div>
                <div className="progress"><span style={{ width: `${quota.generalCapacity ? Math.min(100, Math.round((quota.generalOccupied / quota.generalCapacity) * 100)) : 0}%`, background: quota.quotaExceeded ? 'var(--red)' : 'var(--navy)' }} /></div>
                {quota.quotaExceeded && <div className="alert warn">More men/others are seated than the reservation allows. Existing seats are kept; no new seats go to men until the count drops.</div>}
              </div>
            </div>
          )}
        </div>
      </div>

      {selected && (
        <Modal title={`Seat ${selected.number} · ${branchObj?.name}`} onClose={() => setSeat(null)} size="narrow">
          {selected.isOccupied ? (
            <div className="alert info">Occupied by <Link to={`/students/${selected.studentId}`}><strong>{selected.studentName}</strong></Link>{selected.studentStatus && <> · {STATUS[selected.studentStatus]?.label} (due {fmtDate(selected.studentDueDate)})</>}</div>
          ) : selected.isActive ? (
            <button className="btn primary" onClick={() => { setAssignSeat(selected.number); setSeat(null) }}>Register a student on this seat</button>
          ) : <div className="alert warn">This seat is disabled and cannot be assigned.</div>}
          <div className="form-grid">
            <div className="field"><label>Section</label><input value={seatForm.section} onChange={(e) => setSeatForm({ ...seatForm, section: e.target.value })} placeholder="e.g. Room A" maxLength={80} /></div>
            <div className="field"><label>Label<span className="opt">(optional)</span></label><input value={seatForm.label} onChange={(e) => setSeatForm({ ...seatForm, label: e.target.value })} placeholder="Window, Near door" maxLength={50} /></div>
            <div className="field full"><label style={{ display: 'flex', alignItems: 'center', gap: 8 }}><input type="checkbox" checked={seatForm.isAc} onChange={(e) => setSeatForm({ ...seatForm, isAc: e.target.checked })} /> Air-conditioned seat</label></div>
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

      {assignSeat && <StudentFormModal presetSeat={assignSeat} presetBranchId={branch} onClose={() => setAssignSeat(null)} onSaved={(s) => { setAssignSeat(null); toast.success(`${s.name} registered on seat ${s.seatNumber}`); load() }} />}
    </>
  )
}
