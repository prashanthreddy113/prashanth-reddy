import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'
import { useToast } from '../lib/toast'
import { useBranch } from '../lib/branch'
import { money, fmtDate, todayIso } from '../lib/format'
import Modal from '../components/Modal'
import ConfirmDialog from '../components/ConfirmDialog'
import { IconPlus, IconEdit, IconTrash } from '../components/Icons'

const CATEGORIES = ['Rent', 'Electricity', 'Internet', 'Salary', 'Maintenance', 'Water', 'Furniture', 'Marketing', 'Other']

function monthRange(ym) {
  const [y, m] = ym.split('-').map(Number)
  const from = `${y}-${String(m).padStart(2, '0')}-01`
  const last = new Date(y, m, 0).getDate()
  return { from, to: `${y}-${String(m).padStart(2, '0')}-${String(last).padStart(2, '0')}` }
}

export default function Expenses() {
  const { branchId, current, branches, activeBranches, multi } = useBranch()
  const [month, setMonth] = useState(() => todayIso().slice(0, 7))
  const [summary, setSummary] = useState(null)
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(null)
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState('')
  const toast = useToast()

  const range = useMemo(() => monthRange(month), [month])

  const load = useCallback(async () => {
    try {
      const q = { branchId, from: range.from, to: range.to }
      const [s, r] = await Promise.all([api.expenseSummary(q), api.expenses(q)])
      setSummary(s); setRows(r); setError('')
    } catch (e) { setError(e.message) }
  }, [branchId, range])
  useEffect(() => { load() }, [load])

  const open = (x) => {
    setForm(x ? { branchId: x.branchId, category: x.category, title: x.title || '', amount: String(x.amount), paidOn: x.paidOn, note: x.note || '' }
      : { branchId: branchId || activeBranches[0]?.id || '', category: 'Rent', title: '', amount: '', paidOn: todayIso(), note: '' })
    setFormError(''); setModal({ type: 'edit', id: x?.id || null })
  }

  const save = async (e) => {
    e.preventDefault()
    if (!form.branchId) { setFormError('Select the branch.'); return }
    if (!form.amount || Number(form.amount) <= 0) { setFormError('Enter an amount greater than zero.'); return }
    setBusy(true); setFormError('')
    try {
      const payload = { ...form, branchId: Number(form.branchId), amount: Number(form.amount), title: form.title.trim() || null, note: form.note.trim() || null }
      if (modal.id) await api.updateExpense(modal.id, payload); else await api.createExpense(payload)
      toast.success(modal.id ? 'Expense updated' : 'Expense added')
      setModal(null); load()
    } catch (err) { setFormError(err.message) }
    finally { setBusy(false) }
  }

  if (error && !summary) return <div className="alert error">{error}</div>
  if (!summary || !rows) return <div className="loading"><div className="spinner" />Loading…</div>

  return (
    <>
      <div className="page-head">
        <div>
          <h2>{current ? current.name : multi ? 'All branches' : 'Expenses & revenue'}</h2>
          <p>Money collected from students minus rent, bills and salaries. Pick a month to review.</p>
        </div>
        <div className="row">
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} style={{ padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: 8 }} />
          <button className="btn primary" onClick={() => open(null)}><IconPlus /> Add expense</button>
        </div>
      </div>

      <div className="stats">
        <div className="card stat green"><span className="label">Collected</span><span className="value">{money(summary.collected)}</span><span className="sub">{fmtDate(summary.from)} – {fmtDate(summary.to)}</span></div>
        <div className="card stat red"><span className="label">Expenses</span><span className="value">{money(summary.expenses)}</span><span className="sub">{rows.length} entr{rows.length === 1 ? 'y' : 'ies'}</span></div>
        <div className={`card stat ${summary.net >= 0 ? 'green' : 'red'}`}><span className="label">Net revenue</span><span className="value">{money(summary.net)}</span><span className="sub">{summary.collected > 0 ? `${Math.round((summary.net / summary.collected) * 100)}% margin` : 'No collections yet'}</span></div>
        <div className={`card stat ${summary.netAllTime >= 0 ? 'green' : 'red'}`}><span className="label">Net all time</span><span className="value">{money(summary.netAllTime)}</span><span className="sub">{money(summary.collectedAllTime)} in · {money(summary.expensesAllTime)} out</span></div>
      </div>

      <div className="grid-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
        {summary.byCategory.length > 0 && (
          <div className="card">
            <div className="card-head"><h3>By category</h3></div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {summary.byCategory.map((c) => (
                <div key={c.category}>
                  <div className="row" style={{ justifyContent: 'space-between', fontSize: 13 }}><span>{c.category}</span><strong>{money(c.amount)}</strong></div>
                  <div className="progress"><span style={{ width: `${summary.expenses ? Math.round((c.amount / summary.expenses) * 100) : 0}%`, background: 'var(--red)' }} /></div>
                </div>
              ))}
            </div>
          </div>
        )}
        {summary.byBranch.length > 1 && (
          <div className="card">
            <div className="card-head"><h3>By branch</h3></div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Branch</th><th className="num">Collected</th><th className="num">Expenses</th><th className="num">Net</th></tr></thead>
                <tbody>{summary.byBranch.map((b) => (
                  <tr key={b.branchId}><td className="primary">{b.branchName}</td><td className="num pos">{money(b.collected)}</td><td className="num">{money(b.expenses)}</td><td className="num" style={{ color: b.net >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 700 }}>{money(b.net)}</td></tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-head"><h3>Expenses in {new Date(range.from).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</h3></div>
        {rows.length === 0 ? <div className="empty"><strong>No expenses recorded</strong>Add rent, electricity, salaries and other costs so the dashboard shows real revenue.</div> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Date</th><th>Category</th><th>Title</th>{!current && multi && <th>Branch</th>}<th>Note</th><th className="num">Amount</th><th></th></tr></thead>
              <tbody>{rows.map((x) => (
                <tr key={x.id}>
                  <td>{fmtDate(x.paidOn)}</td>
                  <td><span className="badge navy">{x.category}</span></td>
                  <td className="primary">{x.title || <span className="muted">—</span>}</td>
                  {!current && multi && <td>{x.branchName}</td>}
                  <td className="secondary">{x.note || ''}</td>
                  <td className="num" style={{ fontWeight: 700 }}>{money(x.amount)}</td>
                  <td><div className="row-actions"><button className="btn sm" onClick={() => open(x)} title="Edit"><IconEdit /></button><button className="btn sm danger" onClick={() => setModal({ type: 'delete', row: x })} title="Delete"><IconTrash /></button></div></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </div>

      {modal?.type === 'edit' && form && (
        <Modal title={modal.id ? 'Edit expense' : 'Add expense'} onClose={() => setModal(null)}>
          <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="form-grid">
              {branches.length > 1 && <div className="field"><label>Branch<span className="req">*</span></label><select value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}><option value="">Select…</option>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>}
              <div className="field"><label>Category</label><select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></div>
              <div className="field"><label>Amount<span className="req">*</span></label><input type="number" min="1" step="1" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} autoFocus inputMode="decimal" /></div>
              <div className="field"><label>Date</label><input type="date" value={form.paidOn} onChange={(e) => setForm({ ...form, paidOn: e.target.value })} /></div>
              <div className="field full"><label>Title<span className="opt">(optional)</span></label><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. September rent, Electricity bill" /></div>
              <div className="field full"><label>Note<span className="opt">(optional)</span></label><input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></div>
            </div>
            {formError && <div className="alert error">{formError}</div>}
            <div className="form-actions"><button type="button" className="btn" onClick={() => setModal(null)}>Cancel</button><button className="btn primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button></div>
          </form>
        </Modal>
      )}
      {modal?.type === 'delete' && (
        <ConfirmDialog title="Delete expense?" message={`Remove ${money(modal.row.amount)} (${modal.row.category}) from ${fmtDate(modal.row.paidOn)}?`} confirmLabel="Delete" danger onClose={() => setModal(null)} onConfirm={async () => { await api.deleteExpense(modal.row.id); toast.info('Expense deleted'); load() }} />
      )}
    </>
  )
}
