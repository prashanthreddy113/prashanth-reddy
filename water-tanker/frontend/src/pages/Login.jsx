import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { apiUrl, BUILD_API_URL } from '../lib/api'

const DEMO = [
  { label: 'Tanker operator', email: 'operator@demo.local', hint: 'Fleet, devices, invoices' },
  { label: 'RWA treasurer', email: 'rwa@demo.local', hint: 'Delivery proof, disputes, pay' },
]

export default function Login() {
  const { login, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [server, setServer] = useState(apiUrl.get())
  const [showServer, setShowServer] = useState(!apiUrl.isConfigured())

  if (isAuthenticated) return <Navigate to={location.state?.from || '/'} replace />

  const go = async (e, p) => {
    setBusy(true); setError('')
    try {
      if (showServer) apiUrl.set(server)
      await login(e.trim(), p)
      navigate(location.state?.from || '/', { replace: true })
    } catch (err) {
      setError(err.message || 'Login failed')
    } finally { setBusy(false) }
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={(e) => { e.preventDefault(); go(email, password) }}>
        <div className="logo">💧</div>
        <div>
          <h1>AquaProof</h1>
          <p className="muted">Metered, geo-tagged, quality-graded tanker deliveries. Sign in as an operator or RWA.</p>
        </div>
        <div className="field"><label>Email</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" autoFocus required /></div>
        <div className="field"><label>Password</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required /></div>
        {showServer && (
          <div className="field">
            <label>API server URL</label>
            <input value={server} onChange={(e) => setServer(e.target.value)} placeholder={BUILD_API_URL || 'https://your-api.onrender.com'} inputMode="url" />
            <span className="help">Where the .NET API is hosted. Saved in this browser.</span>
          </div>
        )}
        {error && <div className="alert error">{error}</div>}
        <button className="btn primary" type="submit" disabled={busy} style={{ padding: 11 }}>{busy ? 'Signing in…' : 'Sign in'}</button>
        <div className="demo">
          {DEMO.map((d) => (
            <button type="button" key={d.email} onClick={() => go(d.email, 'demo123')} disabled={busy}><b>{d.label}</b>{d.hint}</button>
          ))}
        </div>
        <p className="hint">
          Demo logins use password <code>demo123</code> (seeded when <code>Demo:Seed</code> is on).{' '}
          <a href="#server" onClick={(e) => { e.preventDefault(); setShowServer((v) => !v) }}>{showServer ? 'Hide server settings' : 'Change API server'}</a>
        </p>
      </form>
    </div>
  )
}
