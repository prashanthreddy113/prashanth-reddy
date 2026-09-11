import { useEffect, useState } from 'react'
import { api, apiUrl, BUILD_API_URL } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useCompany } from '../lib/company'
import { useToast } from '../lib/toast'
import { prepareLogo } from '../lib/image'
import ConfirmDialog from '../components/ConfirmDialog'
import { CompanyLogo } from '../components/Layout'
import { invalidateAiStatus } from '../lib/ai'

export default function Settings() {
  const { isAdmin, user } = useAuth()
  const company = useCompany()
  const toast = useToast()
  const [s, setS] = useState(null)
  const [busy, setBusy] = useState(false)
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' })
  const [server, setServer] = useState(apiUrl.get())
  const [demo, setDemo] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [ai, setAi] = useState({ key: '', model: '' })
  const [aiStatus, setAiStatus] = useState(null)

  useEffect(() => {
    api.settings().then(setS).catch((e) => toast.error(e.message))
    if (isAdmin) { api.demoStatus().then(setDemo).catch(() => {}); api.aiStatus().then(setAiStatus).catch(() => {}) }
  }, [isAdmin, toast])

  const saveCompany = async (e) => {
    e.preventDefault(); setBusy(true)
    try { setS(await api.updateSettings(s)); await company.refresh(); toast.success('Company profile saved') }
    catch (err) { toast.error(err.message) } finally { setBusy(false) }
  }

  const uploadLogo = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy(true)
    try { const img = await prepareLogo(file); setS(await api.uploadLogo({ contentType: img.contentType, dataBase64: img.dataBase64 })); await company.refresh(); toast.success('Logo updated') }
    catch (err) { toast.error(err.message) } finally { setBusy(false) }
  }


  const saveAi = async (e) => {
    e.preventDefault(); setBusy(true)
    try {
      setS(await api.updateSettings({ ...s, anthropicApiKey: ai.key || null, aiModel: ai.model || s.aiModel }))
      setAi({ key: '', model: '' }); invalidateAiStatus(); setAiStatus(await api.aiStatus()); toast.success('AI settings saved')
    } catch (err) { toast.error(err.message) } finally { setBusy(false) }
  }
  const clearAiKey = async () => {
    setBusy(true)
    try { setS(await api.updateSettings({ ...s, clearAnthropicApiKey: true })); invalidateAiStatus(); setAiStatus(await api.aiStatus()); toast.success('API key removed') }
    catch (err) { toast.error(err.message) } finally { setBusy(false) }
  }

  const changePw = async (e) => {
    e.preventDefault()
    if (pw.next !== pw.confirm) { toast.error('New passwords do not match'); return }
    setBusy(true)
    try { await api.changePassword(pw.current, pw.next); toast.success('Password changed'); setPw({ current: '', next: '', confirm: '' }) }
    catch (err) { toast.error(err.message) } finally { setBusy(false) }
  }

  return (
    <div className="grid-2 even">
      {isAdmin && s && (
        <form className="card" onSubmit={saveCompany}>
          <div className="card-head"><h2>Company profile</h2><span className="muted">shown on the login page and in the app</span></div>
          <div className="card-body stack">
            <div className="row gap wrap">
              <CompanyLogo size={72} />
              <div className="stack" style={{ gap: 6 }}>
                <label className="btn sm">{s.hasLogo ? 'Change logo' : 'Upload logo'}<input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden onChange={uploadLogo} /></label>
                {s.hasLogo && <button type="button" className="btn sm ghost" onClick={async () => { setS(await api.removeLogo()); await company.refresh() }}>Remove logo</button>}
                <span className="help">PNG or SVG with a transparent background looks best. Max 1 MB.</span>
              </div>
            </div>
            <div className="form-grid">
              <div className="field full"><label>Company name</label><input value={s.companyName} onChange={(e) => setS({ ...s, companyName: e.target.value })} required maxLength={120} /></div>
              <div className="field full"><label>Tagline</label><input value={s.tagline || ''} onChange={(e) => setS({ ...s, tagline: e.target.value })} maxLength={200} placeholder="e.g. Smart field marketing" /></div>
              <div className="field"><label>Currency</label><input value={s.currency} onChange={(e) => setS({ ...s, currency: e.target.value })} maxLength={8} /></div>
              <div className="field"><label>Country code for mobiles</label><input value={s.defaultCountryCode} onChange={(e) => setS({ ...s, defaultCountryCode: e.target.value })} maxLength={6} /><span className="help">Used for WhatsApp links, e.g. 91 for India.</span></div>
              <div className="field"><label>Time zone</label><input value={s.timeZoneId} onChange={(e) => setS({ ...s, timeZoneId: e.target.value })} placeholder="Asia/Kolkata" /></div>
              <div className="field"><label>Default follow-up gap (days)</label><input type="number" min="0" max="60" value={s.defaultFollowUpDays} onChange={(e) => setS({ ...s, defaultFollowUpDays: Number(e.target.value) })} /></div>
              <div className="field"><label>"Hot lead" interest threshold</label><select value={s.hotInterestThreshold} onChange={(e) => setS({ ...s, hotInterestThreshold: Number(e.target.value) })}><option value={3}>3★ and above</option><option value={4}>4★ and above</option><option value={5}>5★ only</option></select></div>
            </div>
            <div className="form-actions"><button className="btn primary" disabled={busy}>{busy ? 'Saving…' : 'Save profile'}</button></div>
          </div>
        </form>
      )}

      <div className="stack">
      {isAdmin && s && (
        <form className="card ai-card" onSubmit={saveAi}>
          <div className="card-head"><h2>✨ AI assistant</h2><span className={`badge ${s.aiConfigured ? 'green' : 'grey'}`}>{s.aiConfigured ? `On · key from ${s.aiKeySource}` : 'Off'}</span></div>
          <div className="card-body stack">
            <p className="muted small">Powers Smart fill on the capture form (dictation + photo reading), lead insights with WhatsApp drafts, and the daily briefing. Uses Claude from Anthropic; you pay Anthropic per use. Get a key at console.anthropic.com.</p>
            <div className="form-grid">
              <div className="field full"><label>Anthropic API key</label>
                <input type="password" value={ai.key} onChange={(e) => setAi({ ...ai, key: e.target.value })} placeholder={s.aiConfigured ? '•••••••• (saved – enter a new key to replace)' : 'sk-ant-…'} autoComplete="off" disabled={s.aiKeySource === 'environment'} />
                {s.aiKeySource === 'environment' && <span className="help">The key is set by the server's Anthropic__ApiKey environment variable and cannot be changed here.</span>}
              </div>
              <div className="field"><label>Model</label>
                <select value={ai.model || s.aiModel} onChange={(e) => setAi({ ...ai, model: e.target.value })}>
                  <option value="claude-opus-5">Claude Opus 5 – best quality</option>
                  <option value="claude-sonnet-5">Claude Sonnet 5 – balanced</option>
                  <option value="claude-haiku-4-5">Claude Haiku 4.5 – fastest, lowest cost</option>
                </select>
              </div>
              <div className="field"><label>Usage this month</label><div className="pill">{aiStatus ? `${aiStatus.callsThisMonth} calls · ${Number(aiStatus.tokensThisMonth).toLocaleString('en-IN')} tokens` : '—'}</div></div>
            </div>
            <div className="form-actions">
              {s.aiConfigured && s.aiKeySource === 'settings' && <button type="button" className="btn danger" onClick={clearAiKey} disabled={busy} style={{ marginRight: 'auto' }}>Remove key</button>}
              <button className="btn primary" disabled={busy || (!ai.key && !ai.model)}>{busy ? 'Saving…' : 'Save AI settings'}</button>
            </div>
          </div>
        </form>
      )}
        <form className="card" onSubmit={changePw}>
          <div className="card-head"><h2>Your account</h2><span className="muted">@{user.username}</span></div>
          <div className="card-body stack">
            <div className="field"><label>Current password</label><input type="password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} required autoComplete="current-password" /></div>
            <div className="form-grid">
              <div className="field"><label>New password</label><input type="password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} required minLength={6} autoComplete="new-password" /></div>
              <div className="field"><label>Confirm</label><input type="password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} required minLength={6} autoComplete="new-password" /></div>
            </div>
            <div className="form-actions"><button className="btn primary" disabled={busy}>Change password</button></div>
          </div>
        </form>

        <div className="card">
          <div className="card-head"><h2>API server</h2></div>
          <div className="card-body stack">
            <div className="field"><label>API server URL</label><input value={server} onChange={(e) => setServer(e.target.value)} placeholder={BUILD_API_URL || 'https://your-api.onrender.com'} inputMode="url" />
              <span className="help">Currently using {apiUrl.effective() || 'the same origin (dev proxy)'}. Changing it signs you out.</span></div>
            <div className="form-actions"><button className="btn" onClick={() => { apiUrl.set(server); window.location.href = '/login' }}>Save & sign out</button></div>
          </div>
        </div>

        {isAdmin && demo && (
          <div className="card">
            <div className="card-head"><h2>Sample data</h2></div>
            <div className="card-body stack">
              <p className="muted small">{demo.loaded ? `${demo.leads} sample leads are loaded (executives ${demo.users.join(', ')} · password ${demo.password}). Remove them before going live.` : 'Load 30 sample leads, 3 projects and 3 executives to explore the tool. Everything is tagged so it can be removed in one click.'}</p>
              <div className="form-actions">
                {demo.loaded
                  ? <button className="btn danger" onClick={() => setConfirm({ title: 'Remove sample data', message: 'Delete all sample leads, projects and executives?', danger: true, confirmLabel: 'Remove', onConfirm: async () => { const r = await api.demoRemove(); toast.success(r.message); setDemo(await api.demoStatus()) } })}>Remove sample data</button>
                  : <button className="btn" disabled={busy} onClick={async () => { setBusy(true); try { const r = await api.demoSeed(); toast.success(r.message); setDemo(await api.demoStatus()) } catch (e) { toast.error(e.message) } finally { setBusy(false) } }}>Load sample data</button>}
              </div>
            </div>
          </div>
        )}
      </div>
      {confirm && <ConfirmDialog {...confirm} onClose={() => setConfirm(null)} />}
    </div>
  )
}
