import { useState } from 'react'
import { Link } from 'react-router-dom'
import Logo from '../components/Logo'
import { useStore } from '../lib/store'
import { Field } from '../components/ui'

export default function AdminLogin({ auth }) {
  const { settings } = useStore()
  const [f, setF] = useState({ email: '', pass: '' })
  const [err, setErr] = useState('')
  const submit = (e) => {
    e.preventDefault()
    if (!auth.login(f.email, f.pass, settings)) setErr('Invalid email or password')
  }
  return (
    <div className="admin-login">
      <div className="hero-bg"><span className="blob b1" /><span className="blob b2" /><span className="blob b3" /></div>
      <form className="login-card card pad" onSubmit={submit}>
        <Logo size={52} />
        <h2>Staff sign in</h2>
        <p className="muted small">Sales, CRM, collections and leasing console.</p>
        <Field label="Email"><input value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} autoFocus /></Field>
        <Field label="Password"><input type="password" value={f.pass} onChange={(e) => setF({ ...f, pass: e.target.value })} /></Field>
        {err && <p className="err">{err}</p>}
        <button className="btn btn-primary">Sign in</button>
        {settings.admin.password === 'srm@123' && <p className="small muted">Demo login: <button type="button" className="link" onClick={() => setF({ email: settings.admin.email, pass: settings.admin.password })}>{settings.admin.email} / {settings.admin.password}</button> — change it in Settings.</p>}
        <Link to="/" className="small">← Back to website</Link>
      </form>
    </div>
  )
}
