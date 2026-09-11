import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { useToast } from '../lib/toast'
import { money } from '../lib/format'
import Modal from '../components/Modal'
import ConfirmDialog from '../components/ConfirmDialog'
import { IconPlus, IconEdit } from '../components/Icons'

const COLORS = ['#4f46e5', '#0ea5e9', '#16a34a', '#f97316', '#e11d48', '#9333ea', '#0d9488', '#ca8a04', '#64748b']

export default function Projects() {
  const toast = useToast()
  const [projects, setProjects] = useState(null)
  const [users, setUsers] = useState([])
  const [editing, setEditing] = useState(null)
  const [confirm, setConfirm] = useState(null)

  const load = useCallback(async () => {
    try { const [p, u] = await Promise.all([api.projects(true), api.users()]); setProjects(p); setUsers(u.filter((x) => x.role === 'Executive')) }
    catch (e) { toast.error(e.message) }
  }, [toast])
  useEffect(() => { load() }, [load])

  if (!projects) return <div className="empty">Loading…</div>

  return (
    <>
      <div className="toolbar">
        <p className="muted grow">Each project or product you market. Assign executives here or from the Team page.</p>
        <button className="btn primary" onClick={() => setEditing({})}><IconPlus /> New project</button>
      </div>
      {projects.length === 0 && <div className="empty card"><strong>No projects yet</strong>Create your first product or campaign so executives can start capturing leads against it.</div>}
      <div className="cards-grid">
        {projects.map((p) => (
          <div key={p.id} className={`card project-card ${p.isActive ? '' : 'inactive'}`} style={{ borderTopColor: p.color }}>
            <div className="card-body">
              <div className="row-between">
                <div><h2>{p.name}</h2>{p.description && <p className="muted small">{p.description}</p>}</div>
                <button className="icon-btn" onClick={() => setEditing(p)} aria-label="Edit"><IconEdit /></button>
              </div>
              {!p.isActive && <span className="badge grey" style={{ marginTop: 6 }}>Inactive</span>}
              <div className="mini-stats">
                <Link to={`/leads?projectId=${p.id}`}><strong>{p.leadCount}</strong><span>leads</span></Link>
                <Link to={`/leads?projectId=${p.id}&minInterest=4&status=open`}><strong>{p.hotCount}</strong><span>hot</span></Link>
                <Link to={`/leads?projectId=${p.id}&status=Converted`}><strong>{p.convertedCount}</strong><span>won</span></Link>
                <div><strong>{money(p.pipelineValue, { compact: true })}</strong><span>pipeline</span></div>
              </div>
              {p.targetLeads ? <><div className="progress"><span style={{ width: `${Math.min(100, (p.leadCount / p.targetLeads) * 100)}%`, background: p.color }} /></div><small className="muted">{p.leadCount} / {p.targetLeads} lead target</small></> : null}
              <div className="muted small" style={{ marginTop: 10 }}>
                {p.executives.length ? <>Team: {p.executives.map((e) => e.displayName).join(', ')}</> : <span className="text-amber">No executive assigned yet</span>}
              </div>
            </div>
          </div>
        ))}
      </div>

      {editing && <ProjectModal project={editing} users={users} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load() }}
        onDelete={editing.id ? () => setConfirm({ title: 'Delete project', message: `Delete "${editing.name}"? Only possible when it has no leads.`, danger: true, confirmLabel: 'Delete', onConfirm: async () => { await api.deleteProject(editing.id); toast.success('Project deleted'); setEditing(null); load() } }) : null} />}
      {confirm && <ConfirmDialog {...confirm} onClose={() => setConfirm(null)} />}
    </>
  )
}

function ProjectModal({ project, users, onClose, onSaved, onDelete }) {
  const toast = useToast()
  const [form, setForm] = useState({
    name: project.name || '', description: project.description || '', color: project.color || COLORS[0], targetLeads: project.targetLeads ?? '',
    isActive: project.isActive ?? true, executiveIds: project.executives?.map((e) => e.id) || [],
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  const toggle = (id) => set('executiveIds', form.executiveIds.includes(id) ? form.executiveIds.filter((x) => x !== id) : [...form.executiveIds, id])

  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setError('')
    const data = { ...form, targetLeads: form.targetLeads === '' ? null : Number(form.targetLeads) }
    try { project.id ? await api.updateProject(project.id, data) : await api.createProject(data); toast.success('Project saved'); onSaved() }
    catch (err) { setError(err.message); setBusy(false) }
  }

  return (
    <Modal title={project.id ? 'Edit project' : 'New project / product'} onClose={onClose}>
      <form onSubmit={submit} className="stack">
        {error && <div className="alert error">{error}</div>}
        <div className="field"><label>Name<span className="req">*</span></label><input value={form.name} onChange={(e) => set('name', e.target.value)} required autoFocus placeholder="e.g. Solar Water Heater" /></div>
        <div className="field"><label>Description</label><input value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="What is being marketed, to whom" /></div>
        <div className="form-grid">
          <div className="field"><label>Lead target <span className="opt">optional</span></label><input type="number" min="1" value={form.targetLeads} onChange={(e) => set('targetLeads', e.target.value)} placeholder="e.g. 100" /></div>
          <div className="field"><label>Colour</label><div className="swatches">{COLORS.map((c) => <button type="button" key={c} className={form.color === c ? 'on' : ''} style={{ background: c }} onClick={() => set('color', c)} aria-label={c} />)}</div></div>
        </div>
        <div className="field">
          <label>Executives on this project</label>
          {users.length === 0 ? <span className="help">No executives yet – add them on the Team page.</span> : (
            <div className="check-list">
              {users.map((u) => (
                <label key={u.id} className={`check ${!u.isActive ? 'muted' : ''}`}><input type="checkbox" checked={form.executiveIds.includes(u.id)} onChange={() => toggle(u.id)} /> {u.displayName}{!u.isActive ? ' (inactive)' : ''}</label>
              ))}
            </div>
          )}
        </div>
        {project.id && <label className="check"><input type="checkbox" checked={form.isActive} onChange={(e) => set('isActive', e.target.checked)} /> Active (executives can capture leads)</label>}
        <div className="form-actions">
          {onDelete && <button type="button" className="btn danger" onClick={onDelete} style={{ marginRight: 'auto' }}>Delete</button>}
          <button type="button" className="btn" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" className="btn primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </Modal>
  )
}
