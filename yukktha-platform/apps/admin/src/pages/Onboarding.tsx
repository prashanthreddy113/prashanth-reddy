import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useT } from '../i18n'

// AD-3: three steps, then the owner is on their own. Step 1 reuses the product form; steps 2–3 are inline.
export default function Onboarding() {
  const { t } = useT(); const nav = useNavigate()
  const [step, setStep] = useState(1)
  const [count, setCount] = useState(0)
  const [store, setStore] = useState<any>(null)
  const [d, setD] = useState({ codEnabled: true, localDeliveryEnabled: false, localDeliveryCharge: 50, courierEnabled: false, courierCharge: 100 })
  useEffect(() => { api('/api/admin/products').then(r => setCount(r.total)); api('/api/admin/store').then(setStore) }, [step])

  async function saveDelivery() {
    await api('/api/admin/store', { method: 'PUT', body: { ...store, ...d } }); setStep(3)
  }
  async function done() { await api('/api/admin/store/onboarding/complete', { method: 'POST' }); nav('/', { replace: true }) }
  const share = () => {
    const text = `${store.name}\n${store.storefrontUrl}`
    if (navigator.share) navigator.share({ text }); else window.open(`https://wa.me/?text=${encodeURIComponent(text)}`)
  }

  return <div className="page">
    <h1>{t('onboard_title')}</h1>
    <div className="steps">{[1, 2, 3].map(i => <i key={i} className={i <= step ? 'on' : ''} />)}</div>
    {step === 1 && <div className="card">
      <h2>1. {t('onboard_1')}</h2>
      <p className="muted">{count} / 3</p>
      <div style={{ height: 10 }} />
      <button className="btn" onClick={() => nav('/products/new?back=/onboarding')}>{t('addProduct')}</button>
      <div style={{ height: 8 }} />
      <button className="btn ghost" disabled={count < 1} onClick={() => setStep(2)}>{t('next')}</button>
    </div>}
    {step === 2 && store && <div className="card">
      <h2>2. {t('onboard_2')}</h2>
      <Toggle label={t('cod')} on={d.codEnabled} set={v => setD({ ...d, codEnabled: v })} />
      <Toggle label={t('localDelivery')} on={d.localDeliveryEnabled} set={v => setD({ ...d, localDeliveryEnabled: v })} />
      {d.localDeliveryEnabled && <><label>{t('charge')}</label><input type="number" value={d.localDeliveryCharge} onChange={e => setD({ ...d, localDeliveryCharge: +e.target.value })} /></>}
      <Toggle label={t('courier')} on={d.courierEnabled} set={v => setD({ ...d, courierEnabled: v })} />
      {d.courierEnabled && <><label>{t('charge')}</label><input type="number" value={d.courierCharge} onChange={e => setD({ ...d, courierCharge: +e.target.value })} /></>}
      <div style={{ height: 14 }} /><button className="btn" onClick={saveDelivery}>{t('next')}</button>
    </div>}
    {step === 3 && store && <div className="card">
      <h2>3. {t('onboard_3')}</h2>
      <p><b>{store.storefrontUrl}</b></p>
      <div style={{ height: 10 }} /><button className="btn wa" onClick={share}>{t('share')}</button>
      <div style={{ height: 8 }} /><button className="btn" onClick={done}>{t('onboard_done')}</button>
    </div>}
    <p className="muted" style={{ textAlign: 'center' }}><a href="#" onClick={e => { e.preventDefault(); done() }}>{t('onboard_skip')}</a></p>
  </div>
}

export function Toggle({ label, on, set }: { label: string; on: boolean; set: (v: boolean) => void }) {
  return <div className="row between" style={{ padding: '10px 0', borderTop: '1px solid var(--line)' }}>
    <span style={{ fontWeight: 600 }}>{label}</span>
    <button type="button" onClick={() => set(!on)} aria-pressed={on} style={{ width: 50, height: 30, borderRadius: 30, border: 0, background: on ? 'var(--ok)' : '#CFCBE3', position: 'relative', cursor: 'pointer' }}>
      <i style={{ position: 'absolute', top: 3, left: on ? 23 : 3, width: 24, height: 24, borderRadius: 24, background: '#fff', transition: 'left .15s' }} /></button>
  </div>
}
