import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'

export default function Login() {
  const { login, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (isAuthenticated) return <Navigate to={location.state?.from || '/'} replace />

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true); setError('')
    try {
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
          <h1>Study Room Admin</h1>
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
        {error && <div className="alert error">{error}</div>}
        <button className="btn primary" type="submit" disabled={busy} style={{ padding: 11 }}>{busy ? 'Signing in…' : 'Sign in'}</button>
        <p className="hint">Admin access only. Contact the owner if you need an account.</p>
      </form>
    </div>
  )
}
