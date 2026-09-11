import { useEffect, useRef, useState } from 'react'
import { api } from '../lib/api'
import { useAiStatus, AiUnavailable } from '../lib/ai'
import { useAuth } from '../lib/auth'
import { createRecognizer, isSpeechSupported, SPEECH_LANGS } from '../lib/speech'
import { IconSparkle, IconMic } from './Icons'

/**
 * "Smart fill" for the capture form: the executive dictates or types what happened at the shop,
 * the AI reads that plus the photos and fills the form fields.
 */
export default function AiAssist({ text, onText, photos, projectId, current, onApply }) {
  const status = useAiStatus()
  const { isAdmin } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState('')
  const [lang, setLang] = useState(() => { try { return localStorage.getItem('marketing.speechLang') || 'en-IN' } catch { return 'en-IN' } })
  const recRef = useRef(null)
  const baseRef = useRef('')

  useEffect(() => () => recRef.current?.abort(), [])

  if (status && !status.configured && !isAdmin) return null

  const toggleMic = () => {
    if (listening) { recRef.current?.stop(); return }
    baseRef.current = text ? text.trim() + ' ' : ''
    const rec = createRecognizer({
      lang,
      onResult: (finalText, interimText) => { onText(baseRef.current + finalText); setInterim(interimText) },
      onEnd: () => { setListening(false); setInterim('') },
      onError: (msg) => { setError(msg); setListening(false) },
    })
    if (!rec) { setError('Dictation is not supported in this browser. Type the note instead.'); return }
    recRef.current = rec
    setError('')
    try { rec.start(); setListening(true) } catch { setError('Could not start the microphone.') }
  }

  const run = async () => {
    if (!text?.trim() && photos.length === 0) { setError('Say or type a few words about the visit, or add a photo first.'); return }
    setBusy(true); setError(''); setResult(null)
    try {
      const suggestion = await api.aiCaptureAssist({
        text, projectId: projectId ? Number(projectId) : null, current,
        photos: photos.slice(0, 2).map((p) => ({ contentType: p.contentType, dataBase64: p.dataBase64 })),
      })
      const filled = onApply(suggestion)
      setResult({ ...suggestion, filled })
    } catch (e) { setError(e.message) }
    finally { setBusy(false) }
  }

  return (
    <section className="card ai-card">
      <div className="card-head">
        <h2><IconSparkle /> Smart fill</h2>
        <span className="muted small">AI reads your note and the photos</span>
      </div>
      <div className="card-body stack">
        {status && !status.configured ? <AiUnavailable /> : (
          <>
            <div className="field">
              <label>Tell what happened at the shop – any language</label>
              <div className="ai-input">
                <textarea rows={3} value={text} onChange={(e) => onText(e.target.value)}
                  placeholder="e.g. Venkatesh anna shop, Ameerpet. Wants 50 units if price under 600. Demo next Tuesday. Mobile 98765 43210" />
                {interim && <div className="interim">{interim}…</div>}
              </div>
              <div className="row gap wrap">
                {isSpeechSupported() && (
                  <>
                    <button type="button" className={`btn ${listening ? 'danger mic on' : ''}`} onClick={toggleMic}><IconMic /> {listening ? 'Stop' : 'Dictate'}</button>
                    <select value={lang} onChange={(e) => { setLang(e.target.value); try { localStorage.setItem('marketing.speechLang', e.target.value) } catch { /* ignore */ } }} className="lang-select" aria-label="Dictation language">
                      {SPEECH_LANGS.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
                    </select>
                  </>
                )}
                <button type="button" className="btn ai" onClick={run} disabled={busy || listening}><IconSparkle /> {busy ? 'Reading…' : 'Fill form with AI'}</button>
              </div>
            </div>
            {error && <div className="alert error">{error}</div>}
            {result && (
              <div className="ai-result">
                <div><strong>✨ {result.summary}</strong></div>
                {result.filled.length > 0 && <div className="muted small">Filled: {result.filled.join(', ')}. Check the fields below before saving.</div>}
                {result.signboardText && <div className="small">Signboard: <em>{result.signboardText}</em></div>}
                {result.observations?.length > 0 && <ul className="ai-list">{result.observations.map((o, i) => <li key={i}>{o}</li>)}</ul>}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  )
}
