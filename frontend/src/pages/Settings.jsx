import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { api } from '../lib/api'
import { useToast } from '../lib/toast'
import { setCurrency } from '../lib/format'

export default function Settings() {
  const [form, setForm] = useState(null)
  const [busy, setBusy] = useState(false)
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' })
  const [pwBusy, setPwBusy] = useState(false)
  const toast = useToast()
  const { setRoomName } = useOutletContext()

  useEffect(() => { api.settings().then(setForm).catch((e) => toast.error(e.message)) }, [toast])

  const save = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      const s = await api.updateSettings({ ...form, dueSoonDays: Number(form.dueSoonDays) })
      setForm(s); setRoomName(s.roomName); setCurrency(s.currency)
      toast.success('Settings saved')
    } catch (err) { toast.error(err.message) }
    finally { setBusy(false) }
  }

  const changePassword = async (e) => {
    e.preventDefault()
    if (pw.next.length < 6) { toast.error('New password must be at least 6 characters'); return }
    if (pw.next !== pw.confirm) { toast.error('Passwords do not match'); return }
    setPwBusy(true)
    try {
      await api.changePassword(pw.current, pw.next)
      setPw({ current: '', next: '', confirm: '' })
      toast.success('Password changed')
    } catch (err) { toast.error(err.message) }
    finally { setPwBusy(false) }
  }

  if (!form) return <div className="loading"><div className="spinner" />Loading…</div>

  return (
    <div className="grid-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
      <form className="card" onSubmit={save}>
        <div className="card-head"><h3>Reading room</h3></div>
        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="field">
            <label>Room name</label>
            <input value={form.roomName} onChange={(e) => setForm({ ...form, roomName: e.target.value })} required maxLength={120} />
          </div>
          <div className="field">
            <label>Highlight students due within (days)</label>
            <input type="number" min="0" max="60" value={form.dueSoonDays} onChange={(e) => setForm({ ...form, dueSoonDays: e.target.value })} />
            <span className="help">Students whose due date falls within this many days are shown in amber on the dashboard.</span>
          </div>
          <div className="field">
            <label>Time zone</label>
            <input value={form.timeZoneId} onChange={(e) => setForm({ ...form, timeZoneId: e.target.value })} placeholder="Asia/Kolkata" />
            <span className="help">IANA time zone used to decide “today” for due dates.</span>
          </div>
          <div className="field">
            <label>Currency code</label>
            <input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} maxLength={3} placeholder="INR" />
          </div>
          <div className="form-actions"><button className="btn primary" disabled={busy}>{busy ? 'Saving…' : 'Save settings'}</button></div>
        </div>
      </form>

      <form className="card" onSubmit={changePassword}>
        <div className="card-head"><h3>Change password</h3></div>
        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="field">
            <label>Current password</label>
            <input type="password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} autoComplete="current-password" required />
          </div>
          <div className="field">
            <label>New password</label>
            <input type="password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} autoComplete="new-password" required minLength={6} />
          </div>
          <div className="field">
            <label>Confirm new password</label>
            <input type="password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} autoComplete="new-password" required />
          </div>
          <div className="form-actions"><button className="btn primary" disabled={pwBusy}>{pwBusy ? 'Updating…' : 'Update password'}</button></div>
        </div>
      </form>
    </div>
  )
}
