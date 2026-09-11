import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { useAiStatus, AiUnavailable, AI_LANGS } from '../lib/ai'
import { useAuth } from '../lib/auth'
import { useToast } from '../lib/toast'
import { whatsappLink } from '../lib/format'
import { IconSparkle, IconWhatsapp, IconRefresh } from './Icons'

const PURPOSES = [['followup', 'Follow-up'], ['thanks', 'Thank you'], ['offer', 'Offer'], ['reminder', 'Reminder'], ['reconnect', 'Reconnect']]

/** Lead summary, next best action and a ready WhatsApp message, in the language the shop owner prefers. */
export default function AiInsight({ lead }) {
  const status = useAiStatus()
  const { isAdmin } = useAuth()
  const toast = useToast()
  const [insight, setInsight] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [lang, setLang] = useState(() => { try { return localStorage.getItem('marketing.msgLang') || 'en' } catch { return 'en' } })
  const [purpose, setPurpose] = useState('followup')
  const [message, setMessage] = useState('')
  const [drafting, setDrafting] = useState(false)

  useEffect(() => { setInsight(null); setMessage('') }, [lead.id])

  if (status && !status.configured && !isAdmin) return null

  const analyse = async (refresh = false) => {
    setBusy(true); setError('')
    try {
      const r = await api.aiInsight(lead.id, { language: lang, refresh: refresh ? 'true' : '' })
      setInsight(r); setMessage(r.whatsAppMessage || '')
    } catch (e) { setError(e.message) }
    finally { setBusy(false) }
  }

  const draft = async (nextLang = lang, nextPurpose = purpose) => {
    setDrafting(true); setError('')
    try { const r = await api.aiMessage(lead.id, { language: nextLang, purpose: nextPurpose }); setMessage(r.message) }
    catch (e) { setError(e.message) }
    finally { setDrafting(false) }
  }

  const pickLang = (code) => { setLang(code); try { localStorage.setItem('marketing.msgLang', code) } catch { /* ignore */ } if (insight) draft(code, purpose) }
  const pickPurpose = (p) => { setPurpose(p); if (insight) draft(lang, p) }
  const copy = async () => { try { await navigator.clipboard.writeText(message); toast.success('Message copied') } catch { toast.error('Could not copy') } }

  const tone = insight?.priority === 'High' ? 'red' : insight?.priority === 'Low' ? 'grey' : 'amber'

  return (
    <section className="card ai-card">
      <div className="card-head">
        <h2><IconSparkle /> AI insight</h2>
        {insight && <button className="btn sm ghost" onClick={() => analyse(true)} disabled={busy} title="Regenerate"><IconRefresh /></button>}
      </div>
      <div className="card-body stack">
        {status && !status.configured ? <AiUnavailable /> : !insight ? (
          <>
            <p className="muted small">Summarises the history, suggests the next step and drafts a WhatsApp message for this shop.</p>
            {error && <div className="alert error">{error}</div>}
            <button className="btn ai" onClick={() => analyse(false)} disabled={busy}><IconSparkle /> {busy ? 'Thinking…' : 'Analyse this lead'}</button>
          </>
        ) : (
          <>
            {error && <div className="alert error">{error}</div>}
            <div className="row gap wrap"><span className={`badge ${tone}`}>{insight.priority} priority</span></div>
            <p>{insight.summary}</p>
            <div className="ai-next"><strong>Next best action</strong><div>{insight.nextBestAction}</div></div>
            {insight.talkingPoints?.length > 0 && <div><strong className="small">Talking points</strong><ul className="ai-list">{insight.talkingPoints.map((t, i) => <li key={i}>{t}</li>)}</ul></div>}
            {insight.risks?.length > 0 && <div><strong className="small text-amber">Watch out</strong><ul className="ai-list">{insight.risks.map((t, i) => <li key={i}>{t}</li>)}</ul></div>}
            <div className="ai-msg">
              <div className="row-between wrap"><strong className="small"><IconWhatsapp /> WhatsApp message</strong></div>
              <div className="chips">{AI_LANGS.map(([code, label]) => <button key={code} className={`chip ${lang === code ? 'active' : ''}`} onClick={() => pickLang(code)} disabled={drafting}>{label}</button>)}</div>
              <div className="chips">{PURPOSES.map(([p, label]) => <button key={p} className={`chip ${purpose === p ? 'active' : ''}`} onClick={() => pickPurpose(p)} disabled={drafting}>{label}</button>)}</div>
              <textarea rows={4} value={drafting ? 'Writing…' : message} onChange={(e) => setMessage(e.target.value)} disabled={drafting} />
              <div className="row gap wrap">
                <a className="btn wa" href={whatsappLink(lead.mobile, message)} target="_blank" rel="noreferrer"><IconWhatsapp /> Send on WhatsApp</a>
                <button className="btn" onClick={copy} disabled={drafting}>Copy</button>
                <button className="btn ghost" onClick={() => draft()} disabled={drafting}><IconRefresh /> Rewrite</button>
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  )
}
