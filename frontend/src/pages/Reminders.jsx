import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { useToast } from '../lib/toast'
import { fmtDate, money } from '../lib/format'
import { IconWhatsapp, IconRefresh } from '../components/Icons'

const KIND = { DueSoon: ['Due soon', 'amber'], DueToday: ['Due today', 'red'], Overdue: ['Overdue', 'red'], Manual: ['Manual', 'navy'] }

function KindBadge({ kind }) {
  const [label, tone] = KIND[kind] || [kind, 'grey']
  return <span className={`badge ${tone}`}>{label}</span>
}

export default function Reminders() {
  const [status, setStatus] = useState(null)
  const [preview, setPreview] = useState([])
  const [logs, setLogs] = useState([])
  const [error, setError] = useState('')
  const [running, setRunning] = useState(false)
  const [sendingId, setSendingId] = useState(null)
  const [test, setTest] = useState(null)
  const [testing, setTesting] = useState(false)
  const toast = useToast()

  const testConnection = async () => {
    setTesting(true); setTest(null)
    try { setTest(await api.whatsappTest()) } catch (e) { setTest({ ok: false, error: e.message }) }
    finally { setTesting(false) }
  }

  const load = useCallback(async () => {
    try {
      const [s, p, l] = await Promise.all([api.reminderStatus(), api.reminderPreview(), api.reminderLogs({ days: 30 })])
      setStatus(s); setPreview(p); setLogs(l); setError('')
    } catch (e) { setError(e.message) }
  }, [])

  useEffect(() => { load() }, [load])

  const runNow = async () => {
    setRunning(true)
    try {
      const r = await api.reminderRun()
      const msg = `Sent ${r.sent}, failed ${r.failed}, skipped ${r.skipped} (already sent today)`
      r.failed > 0 ? toast.error(msg) : toast.success(msg)
      load()
    } catch (e) { toast.error(e.message) }
    finally { setRunning(false) }
  }

  const sendOne = async (c) => {
    setSendingId(c.studentId)
    try { await api.reminderSend(c.studentId); toast.success(`Sent to ${c.studentName}`); load() }
    catch (e) { toast.error(e.message) }
    finally { setSendingId(null) }
  }

  if (error && !status) return <div className="alert error">{error}</div>
  if (!status) return <div className="loading"><div className="spinner" />Loading…</div>

  const pending = preview.filter((c) => !c.alreadySentToday)

  return (
    <>
      {!status.whatsAppConfigured && (
        <div className="alert warn">
          <strong>WhatsApp is not connected yet.</strong> Set the <code>WhatsApp__PhoneNumberId</code> and <code>WhatsApp__AccessToken</code> environment variables on the API server (from Meta's WhatsApp Business platform), then restart it. Until then, use “Open WhatsApp” on a student's page to send reminders by hand.
        </div>
      )}
      {status.whatsAppConfigured && !status.enabled && (
        <div className="alert info">WhatsApp is connected but automatic reminders are switched off. Turn them on in <Link to="/settings"><strong>Settings</strong></Link>. You can still send manually below.</div>
      )}

      <div className="card">
        <div className="card-head">
          <div><h3>WhatsApp connection</h3><span className="muted">Checks the access token and phone number id against Meta without sending a message.</span></div>
          <button className="btn" onClick={testConnection} disabled={testing || !status.whatsAppConfigured}>{testing ? 'Testing…' : 'Test WhatsApp connection'}</button>
        </div>
        {test && (
          <div className="card-body" style={{ paddingTop: 12, paddingBottom: 12 }}>
            {test.ok ? <div className="alert info"><strong>Working.</strong> {test.detail}</div> : (
              <div className="alert error">
                <strong>Meta rejected the credentials:</strong> {test.error}
                {test.hints && <div style={{ marginTop: 6 }}>Likely cause: {test.hints}</div>}
                <div style={{ marginTop: 6 }}>Fix: in Meta for Developers open your app → WhatsApp → API Setup, generate a <strong>permanent System User token</strong> (Business settings → System users → Generate token, with <code>whatsapp_business_messaging</code> and <code>whatsapp_business_management</code>), paste it into <code>WhatsApp__AccessToken</code> on the API host without quotes or "Bearer ", copy the numeric <strong>Phone number ID</strong> into <code>WhatsApp__PhoneNumberId</code>, then redeploy and test again.</div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="stats">
        <div className={`card stat ${status.whatsAppConfigured ? 'green' : 'red'}`}>
          <span className="label">WhatsApp API</span>
          <span className="value" style={{ fontSize: 20 }}>{status.whatsAppConfigured ? 'Configured' : 'Not configured'}</span>
          <span className="sub">{status.phoneNumberId ? `Phone number id ${status.phoneNumberId}` : 'Set server environment variables'}</span>
        </div>
        <div className={`card stat ${status.enabled ? 'green' : 'grey'}`}>
          <span className="label">Automatic sending</span>
          <span className="value" style={{ fontSize: 20 }}>{status.enabled ? `Daily at ${String(status.reminderHour).padStart(2, '0')}:00` : 'Off'}</span>
          <span className="sub">{status.timeZoneId}{status.lastRunDate ? ` · last run ${fmtDate(status.lastRunDate)}` : ' · never run'}</span>
        </div>
        <div className={`card stat ${pending.length ? 'amber' : ''}`}>
          <span className="label">Waiting to send today</span>
          <span className="value">{pending.length}</span>
          <span className="sub">{preview.length - pending.length} already sent today</span>
        </div>
        <div className="card stat">
          <span className="label">Sent last 30 days</span>
          <span className="value">{logs.filter((l) => l.status === 'Sent').length}</span>
          <span className="sub">{logs.filter((l) => l.status === 'Failed').length} failed</span>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div>
            <h3>Today's reminders · {fmtDate(status.today)}</h3>
            <span className="muted">Students matched by your reminder rules. Nothing is sent until the scheduled hour, or when you press “Send all now”.</span>
          </div>
          <div className="row">
            <button className="btn" onClick={load}><IconRefresh /> Refresh</button>
            <button className="btn success" onClick={runNow} disabled={running || !pending.length}><IconWhatsapp width={15} height={15} /> {running ? 'Sending…' : `Send all now (${pending.length})`}</button>
          </div>
        </div>
        {preview.length === 0 ? <div className="empty"><strong>Nobody to remind today</strong>Students appear here on the days your rules match.</div> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Student</th><th>Mobile</th><th>Seat</th><th>Due date</th><th>Reason</th><th className="num">Balance</th><th>Message</th><th></th></tr></thead>
              <tbody>
                {preview.map((c) => (
                  <tr key={c.studentId} className={c.alreadySentToday ? 'row-Inactive' : ''}>
                    <td><Link to={`/students/${c.studentId}`} className="primary">{c.studentName}</Link></td>
                    <td>{c.mobile}</td>
                    <td>{c.seatNumber ? <span className="seat-chip">{c.seatNumber}</span> : <span className="muted">—</span>}</td>
                    <td>{fmtDate(c.dueDate)}</td>
                    <td><KindBadge kind={c.kind} /></td>
                    <td className="num">{c.balance > 0 ? <span className="neg">{money(c.balance)}</span> : <span className="pos">Paid</span>}</td>
                    <td><span className="secondary" title={c.message} style={{ display: 'inline-block', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>{c.message}</span></td>
                    <td><div className="row-actions">{c.alreadySentToday ? <span className="badge green">Sent today</span> : <button className="btn sm" disabled={sendingId === c.studentId} onClick={() => sendOne(c)}>Send</button>}</div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-head"><h3>History · last 30 days</h3><span className="muted">{logs.length} entries</span></div>
        {logs.length === 0 ? <div className="empty">No reminders sent yet.</div> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>When</th><th>Student</th><th>Mobile</th><th>Type</th><th>Status</th><th>Details</th></tr></thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id}>
                    <td>{new Date(l.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</td>
                    <td><Link to={`/students/${l.studentId}`} className="primary">{l.studentName}</Link></td>
                    <td>{l.mobile}</td>
                    <td><KindBadge kind={l.kind} /></td>
                    <td>{l.status === 'Sent' ? <span className="badge green">Sent</span> : <span className="badge red">Failed</span>}</td>
                    <td><span className="secondary" style={{ display: 'inline-block', maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', verticalAlign: 'middle' }} title={l.error || l.message}>{l.error || l.providerMessageId || l.message}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-head"><h3>If your server sleeps</h3></div>
        <div className="card-body muted" style={{ lineHeight: 1.6 }}>
          Free hosting tiers pause the API when idle, so the {String(status.reminderHour).padStart(2, '0')}:00 run may be missed until someone opens the app. To be safe, have an external scheduler (cron-job.org, UptimeRobot, GitHub Actions) call
          <code style={{ margin: '0 4px' }}>POST /api/reminders/run-external</code> once a day with the header <code>X-Reminder-Key</code> set to the server's <code>Reminders__TriggerKey</code>.
          {status.externalTriggerConfigured ? ' The trigger key is configured on this server.' : ' No trigger key is configured on this server yet.'}
        </div>
      </div>
    </>
  )
}
