import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useToast } from '../lib/toast'
import { timeAgo, telLink, whatsappLink } from '../lib/format'
import Modal from '../components/Modal'
import ConfirmDialog from '../components/ConfirmDialog'
import { IconPlus, IconEdit, IconPhone, IconWhatsapp } from '../components/Icons'

export default function Users() {
  const toast = useToast()
  const { user: me } = useAuth()
  const [users, setUsers] = useState(null)
  const [projects, setProjects] = useState([])
  const [editing, setEditing] = useState(null)
  const [reset, setReset] = useState(null)
  const [confirm, setConfirm] = useState(null)

  const load = useCallback(async () => {
    try { const [u, p] = await Promise.all([api.users(), api.projects(true)]); setUsers(u); setProjects(p) }
    catch (e) { toast.error(e.message) }
  }, [toast])
  useEffect(() => { load() }, [load])

  if (!users) return <div className="empty">Loading…</div>

  return (
    <>
      <div className="toolbar">
        <p className="muted grow">Executives sign in on their phone, see only their own leads, and can capture leads only for the projects assigned here.</p>
        <button className="btn primary" onClick={() => setEditing({})}><IconPlus /> Add user</button>
      </div>
      <div className="cards-grid">
        {users.map((u) => (
          <div key={u.id} className={`card user-card ${u.isActive ? '' : 'inactive'}`}>
            <div className="card-body">
              <div className="row-between">
                <div className="row gap">
                  <div className="avatar">{u.displayName.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}</div>
                  <div>
                    <h2>{u.displayName}</h2>
                    <div className="muted small">@{u.username} · {u.role === 'Admin' ? 'Admin' : 'Executive'}{!u.isActive && <span className="badge grey" style={{ marginLeft: 6 }}>Inactive</span>}</div>
                  </div>
                </div>
                <div className="row gap">
                  {u.mobile && <><a className="icon-btn" href={telLink(u.mobile)} aria-label="Call"><IconPhone /></a><a className="icon-btn wa" href={whatsappLink(u.mobile)} target="_blank" rel="noreferrer" aria-label="WhatsApp"><IconWhatsapp /></a></>}
                  <button className="icon-btn" onClick={() => setEditing(u)} aria-label="Edit"><IconEdit /></button>
                </div>
              </div>
              {u.role === 'Executive' && (
                <>
                  <div className="mini-stats">
                    <Link to={`/leads?userId=${u.id}`}><strong>{u.leadCount}</strong><span>leads</span></Link>
                    <div><strong>{u.visitsThisMonth}</strong><span>visits / mo</span></div>
                    <Link to={`/leads?userId=${u.id}&minInterest=4&status=open`}><strong>{u.hotCount}</strong><span>hot</span></Link>
                    <Link to={`/leads?userId=${u.id}&status=Converted`}><strong>{u.convertedCount}</strong><span>won</span></Link>
                    <Link to={`/leads?userId=${u.id}&followUp=overdue`} className={u.overdueFollowUps ? 'text-red' : ''}><strong>{u.overdueFollowUps}</strong><span>overdue</span></Link>
                  </div>
                  <div className="chips" style={{ marginTop: 10 }}>
                    {u.projects.length === 0 && <span className="text-amber small">No project assigned – cannot capture leads yet</span>}
                    {u.projects.map((p) => <span key={p.id} className="project-chip"><span className="dot" style={{ background: p.color }} />{p.name}</span>)}
                  </div>
                </>
              )}
              <div className="muted small" style={{ marginTop: 10 }}>Last sign-in: {u.lastLoginAt ? timeAgo(u.lastLoginAt) : 'never'}</div>
            </div>
          </div>
        ))}
      </div>

      {editing && <UserModal user={editing} projects={projects} isSelf={editing.id === me.id} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load() }}
        onReset={editing.id ? () => setReset(editing) : null}
        onDelete={editing.id && editing.id !== me.id ? () => setConfirm({ title: 'Delete user', message: `Delete ${editing.displayName}? Only possible if they have no lead history – otherwise deactivate them.`, danger: true, confirmLabel: 'Delete', onConfirm: async () => { await api.deleteUser(editing.id); toast.success('User deleted'); setEditing(null); load() } }) : null} />}
      {reset && <ResetModal user={reset} onClose={() => setReset(null)} />}
      {confirm && <ConfirmDialog {...confirm} onClose={() => setConfirm(null)} />}
    </>
  )
}

function UserModal({ user, projects, isSelf, onClose, onSaved, onReset, onDelete }) {
  const toast = useToast()
  const creating = !user.id
  const [form, setForm] = useState({
    username: user.username || '', password: '', displayName: user.displayName || '', mobile: user.mobile || '', role: user.role || 'Executive',
    isActive: user.isActive ?? true, projectIds: user.projects?.map((p) => p.id) || [],
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  const toggle = (id) => set('projectIds', form.projectIds.includes(id) ? form.projectIds.filter((x) => x !== id) : [...form.projectIds, id])

  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setError('')
    try {
      if (creating) await api.createUser(form)
      else await api.updateUser(user.id, { displayName: form.displayName, mobile: form.mobile, role: form.role, isActive: form.isActive, projectIds: form.projectIds })
      toast.success(creating ? `Login created for ${form.displayName}` : 'User updated'); onSaved()
    } catch (err) { setError(err.message); setBusy(false) }
  }

  return (
    <Modal title={creating ? 'Add marketing user' : `Edit ${user.displayName}`} onClose={onClose}>
      <form onSubmit={submit} className="stack">
        {error && <div className="alert error">{error}</div>}
        <div className="form-grid">
          <div className="field"><label>Full name<span className="req">*</span></label><input value={form.displayName} onChange={(e) => set('displayName', e.target.value)} required autoFocus /></div>
          <div className="field"><label>Mobile</label><input type="tel" value={form.mobile} onChange={(e) => set('mobile', e.target.value)} /></div>
          <div className="field"><label>Username<span className="req">*</span></label><input value={form.username} onChange={(e) => set('username', e.target.value.toLowerCase())} required={creating} disabled={!creating} autoCapitalize="none" pattern="[a-z0-9._-]{3,64}" title="letters, numbers, dots, dashes, underscores" /></div>
          {creating && <div className="field"><label>Password<span className="req">*</span></label><input type="text" value={form.password} onChange={(e) => set('password', e.target.value)} required minLength={6} autoComplete="new-password" placeholder="min 6 characters" /></div>}
          <div className="field"><label>Role</label>
            <select value={form.role} onChange={(e) => set('role', e.target.value)} disabled={isSelf}><option value="Executive">Marketing executive</option><option value="Admin">Admin</option></select>
            <span className="help">Executives see only their own leads. Admins see everything and manage the team.</span>
          </div>
        </div>
        {form.role === 'Executive' && (
          <div className="field">
            <label>Projects / products they can market</label>
            {projects.length === 0 ? <span className="help">Create a project first.</span> : (
              <div className="check-list">
                {projects.map((p) => (
                  <label key={p.id} className={`check ${!p.isActive ? 'muted' : ''}`}><input type="checkbox" checked={form.projectIds.includes(p.id)} onChange={() => toggle(p.id)} /> <span className="dot" style={{ background: p.color }} /> {p.name}{!p.isActive ? ' (inactive)' : ''}</label>
                ))}
              </div>
            )}
          </div>
        )}
        {!creating && !isSelf && <label className="check"><input type="checkbox" checked={form.isActive} onChange={(e) => set('isActive', e.target.checked)} /> Active (can sign in)</label>}
        <div className="form-actions wrap">
          {onDelete && <button type="button" className="btn danger" onClick={onDelete}>Delete</button>}
          {onReset && <button type="button" className="btn" onClick={onReset}>Reset password</button>}
          <span className="grow" />
          <button type="button" className="btn" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" className="btn primary" disabled={busy}>{busy ? 'Saving…' : creating ? 'Create login' : 'Save'}</button>
        </div>
      </form>
    </Modal>
  )
}

function ResetModal({ user, onClose }) {
  const toast = useToast()
  const [pw, setPw] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setError('')
    try { await api.resetPassword(user.id, pw); toast.success(`Password reset for ${user.displayName}`); onClose() }
    catch (err) { setError(err.message); setBusy(false) }
  }
  return (
    <Modal title={`Reset password – ${user.displayName}`} onClose={onClose} size="narrow">
      <form onSubmit={submit} className="stack">
        {error && <div className="alert error">{error}</div>}
        <div className="field"><label>New password</label><input type="text" value={pw} onChange={(e) => setPw(e.target.value)} minLength={6} required autoFocus /><span className="help">Share it with them; they can change it later from Settings.</span></div>
        <div className="form-actions"><button type="button" className="btn" onClick={onClose}>Cancel</button><button className="btn primary" disabled={busy}>{busy ? 'Saving…' : 'Reset'}</button></div>
      </form>
    </Modal>
  )
}
