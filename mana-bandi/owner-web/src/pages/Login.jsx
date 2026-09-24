import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { USING_BACKEND } from '../lib/api'

export default function Login() {
  const { login, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState(USING_BACKEND ? '' : 'owner@manabandi.in')
  const [password, setPassword] = useState('')
  const [otp, setOtp] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (isAuthenticated) return <Navigate to="/" replace />

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await login(email, password, otp)
      navigate(location.state?.from || '/', { replace: true })
    } catch (err) {
      setError(err.message || 'Could not sign in')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login">
      <div className="login-art">
        <div className="login-logo te">మ</div>
        <h1 className="te">మన బండి</h1>
        <p className="te tagline-big">పిలిస్తే చాలు, బండి వస్తుంది</p>
        <p className="login-sub">Owner portal · Narayanakhed · Zaheerabad</p>
        <div className="login-services">
          <span className="svc svc-bike">🏍️ Bike</span>
          <span className="svc svc-auto">🛺 Auto</span>
          <span className="svc svc-parcel">📦 Parcel</span>
        </div>
      </div>
      <form className="login-card" onSubmit={submit}>
        <h2>Sign in</h2>
        <label className="field">
          <span>Email</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required />
        </label>
        <label className="field">
          <span>Password</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        </label>
        <label className="field">
          <span>OTP <small className="muted">(optional, if enabled for your account)</small></span>
          <input inputMode="numeric" placeholder="4–6 digits" value={otp} onChange={(e) => setOtp(e.target.value)} />
        </label>
        {error && <div className="form-error">{error}</div>}
        <button className="btn primary block" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        {!USING_BACKEND && <div className="login-hint">
          <div>Mock accounts (any password):</div>
          <code>owner@manabandi.in</code> — owner, all towns<br />
          <code>nkd@manabandi.in</code> — town manager, Narayanakhed<br />
          <code>zhb@manabandi.in</code> — town manager, Zaheerabad
        </div>}
      </form>
    </div>
  )
}
