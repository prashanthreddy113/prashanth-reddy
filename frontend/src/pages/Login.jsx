import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { apiUrl, BUILD_API_URL } from '../lib/api'

export default function Login() {
  const { login, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [server, setServer] = useState(apiUrl.get())
  const [showServer, setShowServer] = useState(!apiUrl.isConfigured())

  if (isAuthenticated) return <Navigate to={location.state?.from || '/'} replace />

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true); setError('')
    try {
      if (showServer) apiUrl.set(server)
      await login(username.trim(), password)
      navigate(location.state?.from || '/', { replace: true })
    } catch (err) {
      setError(err.message || 'Login failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <div className="logo">📖</div>
        <div>
          <h1>BrightLoop Reading Room</h1>
          <p className="muted">Sign in to manage students, seats and dues.</p>
        </div>
        <div className="field">
          <label>Username</label>
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoFocus required />
        </div>
        <div className="field">
          <label>Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        </div>
        {showServer ? (
          <div className="field">
            <label>API server URL</label>
            <input value={server} onChange={(e) => setServer(e.target.value)} placeholder={BUILD_API_URL || 'https://your-api.onrender.com'} inputMode="url" />
            <span className="help">Where the .NET API is hosted. Saved in this browser{BUILD_API_URL ? `; leave blank to use ${BUILD_API_URL}` : ''}.</span>
          </div>
        ) : null}
        {error && <div className="alert error">{error}</div>}
        <button className="btn primary" type="submit" disabled={busy} style={{ padding: 11 }}>{busy ? 'Signing in…' : 'Sign in'}</button>
        <p className="hint">
          Admin access only.{' '}
          <a href="#server" onClick={(e) => { e.preventDefault(); setShowServer((v) => !v) }}>{showServer ? 'Hide server settings' : 'Change API server'}</a>
        </p>
      </form>
    </div>
  )
}
