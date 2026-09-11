import { useEffect, useRef, useState } from 'react'
import { api } from '../lib/api'
import { IconSparkle } from '../components/Icons'

const SUGGESTIONS = [
  'Who is overdue and how much does each one owe?',
  'What needs my attention today?',
  'How much did we collect this month, and what did we spend?',
  'Which seats are free for women right now?',
  'Who joined in the last 30 days?',
  'Draft a polite Telugu reminder for everyone due tomorrow',
  'Which students have been overdue the longest?',
  'How many AC seats are free?',
]

const STORAGE_KEY = 'studyroom.assistant.chat'

function loadSaved() {
  try { const v = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '[]'); return Array.isArray(v) ? v : [] } catch { return [] }
}

export default function Assistant() {
  const [status, setStatus] = useState(null)
  const [messages, setMessages] = useState(loadSaved)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const endRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => { api.aiStatus().then(setStatus).catch((e) => setStatus({ configured: false, error: e.message })) }, [])
  useEffect(() => { try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-40))) } catch { /* ignore */ } }, [messages])
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, [messages, busy])

  const ask = async (text) => {
    const question = (text ?? input).trim()
    if (!question || busy) return
    setInput('')
    setError('')
    const next = [...messages, { role: 'user', content: question }]
    setMessages(next)
    setBusy(true)
    try {
      const r = await api.aiChat(next.map(({ role, content }) => ({ role, content })))
      setMessages([...next, { role: 'assistant', content: r.reply }])
    } catch (e) {
      setError(e.message)
      setMessages(messages) // roll back the unanswered question so it can be re-sent
      setInput(question)
    } finally {
      setBusy(false)
      inputRef.current?.focus()
    }
  }

  const onKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask() }
  }

  const clear = () => { setMessages([]); setError(''); setInput(''); inputRef.current?.focus() }

  if (!status) return <div className="loading"><div className="spinner" />Loading…</div>

  return (
    <div className="chat-page">
      {!status.configured && (
        <div className="alert warn">
          <strong>The assistant is not connected yet.</strong> Create an API key at <a href="https://console.anthropic.com/" target="_blank" rel="noreferrer">console.anthropic.com</a>, set it as the <code>Anthropic__ApiKey</code> environment variable on the API server (Render → brightloop-api → Environment) and let it restart. Nothing else is needed.
        </div>
      )}

      <div className="card chat-card">
        <div className="card-head">
          <div>
            <h3 className="row" style={{ gap: 8 }}><IconSparkle width={18} height={18} /> Ask about your room</h3>
            <span className="muted">Answers come from today's live data: students, dues, seats, payments and expenses. It can also draft WhatsApp messages. It cannot change anything.</span>
          </div>
          <div className="row">
            {status.configured && <span className="badge grey" title="Model">{status.model}</span>}
            <button className="btn" onClick={clear} disabled={busy || messages.length === 0}>New chat</button>
          </div>
        </div>

        <div className="chat-log">
          {messages.length === 0 && (
            <div className="chat-empty">
              <div className="chat-hello">
                <div className="chat-avatar assistant"><IconSparkle width={16} height={16} /></div>
                <div>Hello! Ask me anything about the reading room. A few ideas:</div>
              </div>
              <div className="chat-suggestions">
                {SUGGESTIONS.map((s) => <button key={s} className="chat-chip" onClick={() => ask(s)} disabled={busy || !status.configured}>{s}</button>)}
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`chat-msg ${m.role}`}>
              <div className={`chat-avatar ${m.role}`}>{m.role === 'assistant' ? <IconSparkle width={16} height={16} /> : 'You'}</div>
              <div className="chat-bubble">{m.content}</div>
            </div>
          ))}
          {busy && (
            <div className="chat-msg assistant">
              <div className="chat-avatar assistant"><IconSparkle width={16} height={16} /></div>
              <div className="chat-bubble typing"><span /><span /><span /></div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        {error && <div className="alert error" style={{ margin: '0 16px 12px' }}>{error}</div>}

        <form className="chat-input" onSubmit={(e) => { e.preventDefault(); ask() }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKey}
            placeholder={status.configured ? 'Ask a question… (Enter to send, Shift+Enter for a new line)' : 'Connect the assistant first'}
            rows={2}
            disabled={busy || !status.configured}
            autoFocus
          />
          <button className="btn primary" disabled={busy || !input.trim() || !status.configured}>{busy ? 'Thinking…' : 'Ask'}</button>
        </form>
      </div>

      {messages.length > 0 && status.configured && (
        <div className="chat-suggestions" style={{ marginTop: 12 }}>
          {SUGGESTIONS.slice(0, 4).map((s) => <button key={s} className="chat-chip" onClick={() => ask(s)} disabled={busy}>{s}</button>)}
        </div>
      )}
    </div>
  )
}
