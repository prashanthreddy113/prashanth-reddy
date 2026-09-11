import { useState } from 'react'
import Modal from './Modal'
import { api } from '../lib/api'
import { useToast } from '../lib/toast'
import { IconSparkle, IconWhatsapp } from './Icons'

const PURPOSES = [
  ['reminder', 'Due-date reminder'],
  ['overdue', 'Overdue notice'],
  ['welcome', 'Welcome message'],
  ['thanks', 'Thank you for payment'],
  ['custom', 'Custom (describe below)'],
]
const LANGUAGES = ['English', 'Telugu', 'Hindi', 'Tenglish (Telugu in English letters)', 'Hinglish (Hindi in English letters)']

/** Let Claude write a personalised WhatsApp message for this student, then open WhatsApp with it. */
export default function AiMessageModal({ student, onClose }) {
  const [purpose, setPurpose] = useState(student.status === 'Overdue' ? 'overdue' : 'reminder')
  const [language, setLanguage] = useState('English')
  const [instructions, setInstructions] = useState('')
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const toast = useToast()

  const generate = async () => {
    setBusy(true); setError('')
    try {
      const r = await api.aiDraft(student.id, { purpose, language: language.split(' ')[0], instructions: instructions.trim() || null })
      setText(r.text)
    } catch (e) { setError(e.message) }
    finally { setBusy(false) }
  }

  const digits = student.mobile.replace(/[^0-9]/g, '')
  const waLink = `https://wa.me/${digits.length === 10 ? '91' + digits : digits}?text=${encodeURIComponent(text)}`

  const copy = async () => {
    try { await navigator.clipboard.writeText(text); toast.success('Message copied') } catch { toast.error('Could not copy') }
  }

  return (
    <Modal title={`AI message · ${student.name}`} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="field">
            <label>Purpose</label>
            <select value={purpose} onChange={(e) => setPurpose(e.target.value)}>
              {PURPOSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Language</label>
            <select value={language} onChange={(e) => setLanguage(e.target.value)}>
              {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
        </div>
        <div className="field">
          <label>Anything specific to mention<span className="opt">(optional)</span></label>
          <input value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="e.g. Room is closed on Sunday; offer a 2-day extension; mention the new timings" maxLength={500} />
        </div>
        <div className="form-actions" style={{ justifyContent: 'flex-start' }}>
          <button type="button" className="btn primary" onClick={generate} disabled={busy}><IconSparkle width={15} height={15} /> {busy ? 'Writing…' : text ? 'Write again' : 'Write message'}</button>
        </div>
        {error && <div className="alert error">{error}</div>}
        <div className="field">
          <label>Message<span className="opt">(edit before sending)</span></label>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={7} placeholder="The message appears here. You can edit it before sending." />
          <span className="help">{text.length} characters · sent to {student.mobile}</span>
        </div>
        <div className="form-actions" style={{ justifyContent: 'space-between' }}>
          <button type="button" className="btn" onClick={copy} disabled={!text}>Copy</button>
          <div className="row">
            <button type="button" className="btn" onClick={onClose}>Close</button>
            <a className={`btn success ${text ? '' : 'disabled'}`} href={text ? waLink : undefined} target="_blank" rel="noreferrer" aria-disabled={!text} onClick={(e) => { if (!text) e.preventDefault() }}><IconWhatsapp width={15} height={15} /> Open WhatsApp</a>
          </div>
        </div>
      </div>
    </Modal>
  )
}
