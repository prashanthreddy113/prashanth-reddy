import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { useAiStatus, AiUnavailable } from '../lib/ai'
import { useAuth } from '../lib/auth'
import { timeAgo, todayIso } from '../lib/format'
import { IconSparkle, IconRefresh } from './Icons'

const KEY = 'marketing.briefingDay'

/** Team briefing for admins, "your plan for today" for executives. The server caches it for an hour. */
export default function AiBriefing() {
  const status = useAiStatus()
  const { isAdmin } = useAuth()
  const [briefing, setBriefing] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = async (refresh = false) => {
    setBusy(true); setError('')
    try {
      setBriefing(await api.aiBriefing(refresh))
      try { localStorage.setItem(KEY, todayIso()) } catch { /* ignore */ }
    } catch (e) { setError(e.message) }
    finally { setBusy(false) }
  }

  // Once generated today, it is cached server-side, so re-opening the dashboard shows it without a new AI call.
  useEffect(() => {
    if (!status?.configured) return
    let day = null
    try { day = localStorage.getItem(KEY) } catch { /* ignore */ }
    if (day === todayIso()) load(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status?.configured])

  if (status && !status.configured && !isAdmin) return null

  return (
    <section className="card ai-card">
      <div className="card-head">
        <h2><IconSparkle /> {isAdmin ? "Today's briefing" : 'Your plan for today'}</h2>
        {briefing && <span className="muted small">{timeAgo(briefing.generatedAt)} <button className="btn sm ghost" onClick={() => load(true)} disabled={busy} title="Regenerate"><IconRefresh /></button></span>}
      </div>
      <div className="card-body stack">
        {status && !status.configured ? <AiUnavailable /> : !briefing ? (
          <>
            <p className="muted small">{isAdmin ? 'A short read on how the team is doing, what needs attention and what to do today.' : 'Which shops to visit or call today and why, based on your follow-ups and hot leads.'}</p>
            {error && <div className="alert error">{error}</div>}
            <button className="btn ai" onClick={() => load(false)} disabled={busy}><IconSparkle /> {busy ? 'Preparing…' : isAdmin ? 'Generate briefing' : 'Plan my day'}</button>
          </>
        ) : (
          <>
            {error && <div className="alert error">{error}</div>}
            <p className="ai-headline">{briefing.headline}</p>
            <div className="grid-2 even">
              {briefing.highlights?.length > 0 && <div><strong className="small text-green">Going well</strong><ul className="ai-list">{briefing.highlights.map((t, i) => <li key={i}>{t}</li>)}</ul></div>}
              {briefing.concerns?.length > 0 && <div><strong className="small text-amber">Needs attention</strong><ul className="ai-list">{briefing.concerns.map((t, i) => <li key={i}>{t}</li>)}</ul></div>}
            </div>
            {briefing.actions?.length > 0 && (
              <div>
                <strong className="small">{isAdmin ? 'Actions for today' : 'Your list'}</strong>
                <ol className="ai-actions">
                  {briefing.actions.map((a, i) => (
                    <li key={i}>
                      {a.leadId ? <Link to={`/leads/${a.leadId}`}><strong>{a.title}</strong></Link> : <strong>{a.title}</strong>}
                      <div className="muted small">{a.detail}</div>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  )
}
