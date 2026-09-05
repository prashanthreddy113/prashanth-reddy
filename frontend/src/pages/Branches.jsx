import { useCallback, useEffect, useState } from 'react'
import { api } from '../lib/api'
import { useToast } from '../lib/toast'
import { useBranch } from '../lib/branch'
import { money } from '../lib/format'
import Modal from '../components/Modal'
import ConfirmDialog from '../components/ConfirmDialog'
import { IconPlus, IconEdit, IconTrash } from '../components/Icons'

const empty = { name: '', code: '', address: '', phone: '', isActive: true, femaleReservationPercent: '' }

export default function Branches() {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(empty)
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState('')
  const toast = useToast()
  const { reload, setSelected, branches } = useBranch()

  const load = useCallback(async () => {
    try { setRows(await api.branchSummary()); setError('') } catch (e) { setError(e.message) }
  }, [])
  useEffect(() => { load() }, [load])

  const open = (b) => {
    const full = b ? branches.find((x) => x.id === b.id) : null
    setForm(full ? { name: full.name, code: full.code || '', address: full.address || '', phone: full.phone || '', isActive: full.isActive, femaleReservationPercent: full.femaleReservationPercent ?? '' } : empty)
    setFormError('')
    setModal({ type: 'edit', id: b?.id || null })
  }

  const save = async (e) => {
    e.preventDefault()
    setBusy(true); setFormError('')
    try {
      const payload = { ...form, femaleReservationPercent: form.femaleReservationPercent === '' ? null : Number(form.femaleReservationPercent) }
      if (modal.id) await api.updateBranch(modal.id, payload); else await api.createBranch(payload)
      toast.success(modal.id ? 'Branch updated' : `Branch "${form.name}" created`)
      setModal(null); await reload(); load()
    } catch (err) { setFormError(err.message) }
    finally { setBusy(false) }
  }

  if (error && !rows) return <div className="alert error">{error}</div>
  if (!rows) return <div className="loading"><div className="spinner" />Loading…</div>

  return (
    <>
      <div className="page-head">
        <div><h2>{rows.length} branch{rows.length === 1 ? '' : 'es'}</h2><p>Each branch has its own seats, students, expenses and reservation share. Use the switcher in the top bar to view one branch everywhere.</p></div>
        <button className="btn primary" onClick={() => open(null)}><IconPlus /> Add branch</button>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Branch</th><th>Students</th><th>Overdue</th><th>Due soon</th><th>Seats</th><th>AC</th><th>Women</th><th className="num">Collected (month)</th><th className="num">Expenses</th><th className="num">Net</th><th className="num">Outstanding</th><th></th></tr></thead>
            <tbody>
              {rows.map((b) => (
                <tr key={b.id} className={b.isActive ? '' : 'row-Inactive'}>
                  <td>
                    <a href="#view" className="primary" onClick={(e) => { e.preventDefault(); setSelected(String(b.id)) }} title="View this branch">{b.name}</a>
                    <div className="secondary">{b.code || ''}{!b.isActive ? ' · inactive' : ''}</div>
                  </td>
                  <td>{b.activeStudents}</td>
                  <td>{b.overdue ? <span className="badge red">{b.overdue}</span> : <span className="muted">0</span>}</td>
                  <td>{b.dueSoon ? <span className="badge amber">{b.dueSoon}</span> : <span className="muted">0</span>}</td>
                  <td><strong>{b.seatsOccupied}</strong> / {b.seatsActive} <span className="secondary">({b.seatsFree} free)</span></td>
                  <td>{b.acSeats}</td>
                  <td>{b.womenSeated} <span className="secondary">/ {b.reservedForWomen} reserved</span></td>
                  <td className="num pos">{money(b.collectedThisMonth)}</td>
                  <td className="num">{money(b.expensesThisMonth)}</td>
                  <td className="num" style={{ color: b.netThisMonth >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 700 }}>{money(b.netThisMonth)}</td>
                  <td className="num">{b.outstanding > 0 ? <span className="neg">{money(b.outstanding)}</span> : <span className="muted">—</span>}</td>
                  <td><div className="row-actions">
                    <button className="btn sm" title="Edit" onClick={() => open(b)}><IconEdit /></button>
                    <button className="btn sm danger" title="Delete" onClick={() => setModal({ type: 'delete', branch: b })}><IconTrash /></button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modal?.type === 'edit' && (
        <Modal title={modal.id ? 'Edit branch' : 'New branch'} onClose={() => setModal(null)}>
          <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="form-grid">
              <div className="field"><label>Name<span className="req">*</span></label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required minLength={2} autoFocus placeholder="e.g. Kukatpally" /></div>
              <div className="field"><label>Short code<span className="opt">(optional)</span></label><input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} maxLength={20} placeholder="e.g. KPHB" /></div>
              <div className="field full"><label>Address<span className="opt">(optional)</span></label><input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
              <div className="field"><label>Phone<span className="opt">(optional)</span></label><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <div className="field"><label>Women's reservation for this branch (%)</label><input type="number" min="0" max="100" value={form.femaleReservationPercent} onChange={(e) => setForm({ ...form, femaleReservationPercent: e.target.value })} placeholder="Use global setting" /><span className="help">Leave empty to use the global percentage from Settings.</span></div>
              <div className="field full"><label style={{ display: 'flex', alignItems: 'center', gap: 8 }}><input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> Active (new students can be registered here)</label></div>
            </div>
            {formError && <div className="alert error">{formError}</div>}
            <div className="form-actions"><button type="button" className="btn" onClick={() => setModal(null)}>Cancel</button><button className="btn primary" disabled={busy}>{busy ? 'Saving…' : modal.id ? 'Save' : 'Create branch'}</button></div>
          </form>
        </Modal>
      )}
      {modal?.type === 'delete' && (
        <ConfirmDialog title={`Delete ${modal.branch.name}?`} message="Only a branch with no student records can be deleted. Its free seats are removed with it. To stop using a branch that has history, mark it inactive instead." confirmLabel="Delete branch" danger
          onClose={() => setModal(null)} onConfirm={async () => { await api.deleteBranch(modal.branch.id); toast.info('Branch deleted'); await reload(); load() }} />
      )}
    </>
  )
}
