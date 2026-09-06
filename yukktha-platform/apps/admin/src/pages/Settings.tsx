import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { api, session } from '../api'
import { useT } from '../i18n'
import { Toggle } from './Onboarding'

export default function Settings() {
  const { t, lang, setLang } = useT(); const nav = useNavigate()
  const [s, setS] = useState<any>(null); const [saved, setSaved] = useState(false); const [plans, setPlans] = useState<any[]>([])
  useEffect(() => { api('/api/admin/store').then(setS); api('/api/admin/store/plans').then(setPlans) }, [])
  if (!s) return <div className="page muted">…</div>
  const set = (patch: any) => setS({ ...s, ...patch })
  async function save() { await api('/api/admin/store', { method: 'PUT', body: s }); setSaved(true); setTimeout(() => setSaved(false), 1500) }
  const planName = plans.find(p => p.tier === s.plan)?.name ?? s.plan

  return <div className="page">
    <h1>{t('settings')}</h1>
    <div className="card">
      <div className="row between"><div><div className="muted">{t('plan')}</div><b>{planName}</b></div>
        <Link className="btn sm" to="/billing">{t('billing')}</Link></div>
    </div>
    <div className="card">
      <label>{t('storeName')}</label><input value={s.name} onChange={e => set({ name: e.target.value })} />
      <label>{t('whatsappNumber')}</label><input value={s.whatsAppNumber ?? ''} onChange={e => set({ whatsAppNumber: e.target.value })} />
      <label>{t('address')}</label><textarea value={s.address ?? ''} onChange={e => set({ address: e.target.value })} />
      <label>{t('instagram')}</label><input value={s.instagramHandle ?? ''} onChange={e => set({ instagramHandle: e.target.value })} placeholder="@" />
      <label>GSTIN</label><input value={s.gstin ?? ''} onChange={e => set({ gstin: e.target.value })} />
      <label>{t('themeColor')}</label><input type="color" value={s.themeColor} onChange={e => set({ themeColor: e.target.value })} style={{ height: 48 }} />
    </div>
    <div className="card">
      <Toggle label={t('cod')} on={s.codEnabled} set={v => set({ codEnabled: v })} />
      <Toggle label={t('localDelivery')} on={s.localDeliveryEnabled} set={v => set({ localDeliveryEnabled: v })} />
      {s.localDeliveryEnabled && <><label>{t('charge')}</label><input type="number" value={s.localDeliveryCharge} onChange={e => set({ localDeliveryCharge: +e.target.value })} /></>}
      <Toggle label={t('courier')} on={s.courierEnabled} set={v => set({ courierEnabled: v })} />
      {s.courierEnabled && <><label>{t('charge')}</label><input type="number" value={s.courierCharge} onChange={e => set({ courierCharge: +e.target.value })} /></>}
      {!s.features.delivery && <p className="muted"><Link to="/billing">{t('upgrade')}</Link> → {t('localDelivery')}, {t('courier')}</p>}
    </div>
    <div className="card">
      <Toggle label={t('googleReview')} on={s.googleReviewPromptEnabled} set={v => set({ googleReviewPromptEnabled: v })} />
      {s.googleReviewPromptEnabled && <><label>{t('googleReviewUrl')}</label><input value={s.googleReviewUrl ?? ''} onChange={e => set({ googleReviewUrl: e.target.value })} placeholder="https://g.page/r/…/review" /></>}
    </div>
    <div className="card">
      <label>{t('language')}</label>
      <div className="row"><button className={'btn sm ' + (lang === 'te' ? '' : 'secondary')} onClick={() => { setLang('te'); set({ defaultLanguage: 1 }) }}>తెలుగు</button><button className={'btn sm ' + (lang === 'en' ? '' : 'secondary')} onClick={() => { setLang('en'); set({ defaultLanguage: 0 }) }}>English</button></div>
    </div>
    <button className="btn" onClick={save}>{saved ? '✓' : t('save')}</button>
    <div style={{ height: 8 }} /><button className="btn ghost" onClick={() => { session.clear(); nav('/login') }}>{t('logout')}</button>
  </div>
}
