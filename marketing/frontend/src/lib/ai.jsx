import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from './api'
import { useAuth } from './auth'

let cached = null
let inflight = null

/** AI availability (is a key configured, which model), fetched once per session. */
export function useAiStatus() {
  const [status, setStatus] = useState(cached)
  useEffect(() => {
    if (cached) return
    inflight ??= api.aiStatus().then((s) => { cached = s; return s }).catch(() => ({ configured: false }))
    inflight.then(setStatus)
  }, [])
  return status
}

export function invalidateAiStatus() { cached = null; inflight = null }

/** Shown inside AI cards when no key is set – admins get a link, executives a short note. */
export function AiUnavailable() {
  const { isAdmin } = useAuth()
  return (
    <div className="muted small">
      {isAdmin ? <>AI assistant is off. Add your Anthropic API key in <Link to="/settings">Settings → AI assistant</Link>.</> : 'AI assistant is not switched on yet – ask your admin.'}
    </div>
  )
}

export const AI_LANGS = [['en', 'English'], ['hinglish', 'Hinglish'], ['hi', 'हिन्दी'], ['te', 'తెలుగు'], ['ta', 'தமிழ்'], ['kn', 'ಕನ್ನಡ']]
