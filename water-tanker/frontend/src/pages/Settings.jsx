import { useState } from 'react'
import { api, apiUrl, BUILD_API_URL } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useToast } from '../lib/toast'

export default function Settings() {
  const { user } = useAuth()
  const toast = useToast()
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' })
  const [server, setServer] = useState(apiUrl.get())

  const change = async (e) => {
    e.preventDefault()
    if (pw.next !== pw.confirm) return toast.error('Passwords do not match.')
    try { await api.changePassword(pw.current, pw.next); toast.success('Password changed.'); setPw({ current: '', next: '', confirm: '' }) } catch (err) { toast.error(err.message) }
  }

  return (
    <div className="grid-2">
      <div className="card">
        <div className="card-head"><h2>Your account</h2></div>
        <div className="card-body">
          <dl className="kv"><dt>Name</dt><dd>{user.displayName}</dd><dt>Email</dt><dd>{user.email}</dd><dt>Role</dt><dd>{user.role === 'Rwa' ? 'RWA' : user.role}</dd><dt>Scope</dt><dd>{user.communityName || user.operatorName || 'Platform'}</dd></dl>
          <form onSubmit={change} className="stack" style={{ marginTop: 18 }}>
            <h3>Change password</h3>
            <div className="field"><label>Current password</label><input type="password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} required /></div>
            <div className="field"><label>New password</label><input type="password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} minLength="6" required /></div>
            <div className="field"><label>Confirm new password</label><input type="password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} required /></div>
            <div className="form-actions"><button className="btn primary" type="submit">Update password</button></div>
          </form>
        </div>
      </div>
      <div className="card">
        <div className="card-head"><h2>API server</h2></div>
        <div className="card-body stack">
          <div className="field"><label>Override URL (this browser only)</label><input value={server} onChange={(e) => setServer(e.target.value)} placeholder={BUILD_API_URL || 'https://your-api.onrender.com'} /><span className="help">Build default: {BUILD_API_URL || 'Vite dev proxy'}. Leave blank to use it.</span></div>
          <div className="row"><button className="btn primary" onClick={() => { apiUrl.set(server); toast.success('Saved. Reloading…'); setTimeout(() => window.location.reload(), 600) }}>Save</button><button className="btn" onClick={() => { apiUrl.set(''); setServer(''); toast.success('Cleared.') }}>Clear</button></div>
          <h3 style={{ marginTop: 10 }}>Quality thresholds</h3>
          <p className="small muted">Grades follow IS 10500:2012. Good: TDS ≤ 500 mg/L and turbidity ≤ 1 NTU. Acceptable: TDS ≤ 2000 and turbidity ≤ 5. Anything above is Poor. Change them with the <code>Quality__*</code> environment variables on the API.</p>
        </div>
      </div>
    </div>
  )
}
