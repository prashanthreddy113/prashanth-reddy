import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, session } from '../api'
import { useT } from '../i18n'

// PL-2: phone → OTP → store created (or logged in) in under 2 minutes.
export default function Login() {
  const { t, lang, setLang } = useT()
  const nav = useNavigate()
  const [mode, setMode] = useState<'login' | 'signup'>('signup')
  const [step, setStep] = useState<1 | 2>(1)
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [storeName, setStoreName] = useState('')
  const [referral, setReferral] = useState('')
  const [devCode, setDevCode] = useState<string | null>(null)
  const [stores, setStores] = useState<{ slug: string; name: string }[] | null>(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  async function sendOtp() {
    setErr(''); setBusy(true)
    try { const r = await api('/api/auth/otp', { body: { phone } }); setDevCode(r.devCode ?? null); setStep(2) }
    catch (e: any) { setErr(e.message) } finally { setBusy(false) }
  }
  async function finish(slug?: string) {
    setErr(''); setBusy(true)
    try {
      const r = mode === 'signup'
        ? await api('/api/auth/signup', { body: { phone, code, storeName, referralCode: referral || null, language: lang === 'te' ? 1 : 0 } })
        : await api('/api/auth/login', { body: { phone, code, storeSlug: slug ?? null } })
      if (r.chooseStore) { setStores(r.chooseStore); return }
      session.set(r.token, r.storeSlug)
      nav(r.onboardingCompleted ? '/' : '/onboarding', { replace: true })
    } catch (e: any) { setErr(e.message) } finally { setBusy(false) }
  }

  return (
    <div className="page" style={{ paddingTop: 48 }}>
      <div className="topbar"><div className="big" style={{ color: 'var(--brand)' }}>{t('appName')}</div>
        <button className="lang" onClick={() => setLang(lang === 'te' ? 'en' : 'te')}>{lang === 'te' ? 'English' : 'తెలుగు'}</button></div>
      <h1>{mode === 'signup' ? t('signup') : t('login')}</h1>
      <div className="card">
        {step === 1 && <>
          {mode === 'signup' && <><label>{t('storeName')}</label><input value={storeName} onChange={e => setStoreName(e.target.value)} placeholder="Sri Lakshmi Sarees" /></>}
          <label>{t('phone')}</label>
          <input inputMode="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="98765 43210" />
          {mode === 'signup' && <><label>{t('referral')}</label><input value={referral} onChange={e => setReferral(e.target.value.toUpperCase())} /></>}
          <div style={{ height: 14 }} />
          <button className="btn" disabled={busy || phone.length < 10 || (mode === 'signup' && storeName.trim().length < 2)} onClick={sendOtp}>{t('sendOtp')}</button>
        </>}
        {step === 2 && !stores && <>
          <label>{t('enterOtp')} — {phone}</label>
          <input inputMode="numeric" maxLength={6} value={code} onChange={e => setCode(e.target.value)} autoFocus />
          {devCode && <p className="muted">Dev mode code: <b>{devCode}</b></p>}
          <div style={{ height: 14 }} />
          <button className="btn" disabled={busy || code.length < 6} onClick={() => finish()}>{t('verify')}</button>
          <div style={{ height: 8 }} /><button className="btn ghost" onClick={() => setStep(1)}>{t('cancel')}</button>
        </>}
        {stores && <div className="list">{stores.map(s => <div className="item" key={s.slug}><b style={{ flex: 1 }}>{s.name}</b><button className="btn sm" onClick={() => finish(s.slug)}>{t('login')}</button></div>)}</div>}
        {err && <p className="err">{err}</p>}
      </div>
      <p className="muted" style={{ textAlign: 'center' }}>
        <a href="#" onClick={e => { e.preventDefault(); setMode(mode === 'signup' ? 'login' : 'signup'); setStep(1); setErr('') }}>{mode === 'signup' ? t('haveStore') : t('newStore')}</a>
      </p>
    </div>
  )
}
