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
      const s = await api.updateSettings({ ...form, dueSoonDays: Number(form.dueSoonDays), reminderHour: Number(form.reminderHour), overdueRepeatEveryDays: Number(form.overdueRepeatEveryDays), overdueStopAfterDays: Number(form.overdueStopAfterDays) })
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

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })

  return (
    <div className="grid-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
      <form className="card" onSubmit={save} style={{ gridColumn: '1 / -1' }}>
        <div className="card-head">
          <div>
            <h3>WhatsApp due-date reminders</h3>
            <span className="muted">Automatic messages through the WhatsApp Business API. Credentials are set on the server; see the Reminders page for status.</span>
          </div>
          <label className="row" style={{ gap: 8, fontWeight: 700 }}>
            <input type="checkbox" checked={!!form.remindersEnabled} onChange={set('remindersEnabled')} /> Enabled
          </label>
        </div>
        <div className="card-body">
          <div className="form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            <div className="field">
              <label>Remind this many days before due</label>
              <input value={form.reminderDaysBefore} onChange={set('reminderDaysBefore')} placeholder="5,1" />
              <span className="help">Comma-separated, e.g. 5,1 sends 5 days and 1 day before.</span>
            </div>
            <div className="field">
              <label>Send time (hour, 0–23)</label>
              <input type="number" min="0" max="23" value={form.reminderHour} onChange={set('reminderHour')} />
              <span className="help">In the room's time zone ({form.timeZoneId}).</span>
            </div>
            <div className="field">
              <label>After due date, repeat every (days)</label>
              <input type="number" min="0" max="60" value={form.overdueRepeatEveryDays} onChange={set('overdueRepeatEveryDays')} />
              <span className="help">0 = remind once, the day after the due date.</span>
            </div>
            <div className="field">
              <label>Stop overdue reminders after (days)</label>
              <input type="number" min="0" max="365" value={form.overdueStopAfterDays} onChange={set('overdueStopAfterDays')} />
            </div>
            <div className="field">
              <label>Template name</label>
              <input value={form.whatsAppTemplateName} onChange={set('whatsAppTemplateName')} />
              <span className="help">The approved template in WhatsApp Manager. Body variables: name, seat, due date, balance.</span>
            </div>
            <div className="field">
              <label>Template language code</label>
              <input value={form.whatsAppLanguageCode} onChange={set('whatsAppLanguageCode')} placeholder="en" />
            </div>
            <div className="field">
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 24 }}>
                <input type="checkbox" checked={!!form.remindOnDueDay} onChange={set('remindOnDueDay')} /> Also remind on the due date itself
              </label>
            </div>
          </div>
          <div className="form-actions" style={{ marginTop: 16 }}><button className="btn primary" disabled={busy}>{busy ? 'Saving…' : 'Save reminder settings'}</button></div>
        </div>
      </form>

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
