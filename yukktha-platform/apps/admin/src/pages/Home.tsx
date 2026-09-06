import { useEffect, useState } from 'react'
import { api, inr } from '../api'
import { useT } from '../i18n'

// MK-6: the weekly card. Everything the owner needs in one glance.
export default function Home() {
  const { t, lang, setLang } = useT()
  const [s, setS] = useState<any>(null); const [sum, setSum] = useState<any>(null); const [copied, setCopied] = useState(false)
  useEffect(() => { api('/api/admin/store').then(setS); api('/api/admin/summary?days=7').then(setSum) }, [])
  if (!s || !sum) return <div className="page muted">…</div>
  const daysLeft = Math.max(0, Math.ceil((new Date(s.trialEndsAt).getTime() - Date.now()) / 86400000))
  const copy = () => { navigator.clipboard.writeText(s.storefrontUrl); setCopied(true); setTimeout(() => setCopied(false), 1500) }
  return <div className="page">
    <div className="topbar"><h1 style={{ margin: 0 }}>{s.name}</h1><button className="lang" onClick={() => setLang(lang === 'te' ? 'en' : 'te')}>{lang === 'te' ? 'EN' : 'తె'}</button></div>
    {s.status === 0 && <div className="card" style={{ background: '#FFF2DC', borderColor: '#F2A93B' }}><b>{t('trialEnds')}: {daysLeft} {t('daysLeft')}</b></div>}
    {!s.storefrontOpen && <div className="card" style={{ background: '#FFE4EB' }}><b>Shop is closed — subscription needs payment.</b></div>}
    <div className="card">
      <div className="muted">{t('storeLink')}</div>
      <div style={{ fontWeight: 700, wordBreak: 'break-all' }}>{s.storefrontUrl}</div>
      <div className="row" style={{ marginTop: 10 }}>
        <button className="btn sm secondary" onClick={copy}>{copied ? t('copied') : t('copyLink')}</button>
        <button className="btn sm wa" onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(s.name + '\n' + s.storefrontUrl)}`)}>{t('share')}</button>
        <a className="btn sm ghost" href={s.storefrontUrl} target="_blank" rel="noreferrer">{t('openStore')}</a>
      </div>
    </div>
    <h2>{t('thisWeek')}</h2>
    <div className="grid2">
      <div className="card"><div className="muted">{t('orders')}</div><div className="big">{sum.orders}</div></div>
      <div className="card"><div className="muted">{t('revenue')}</div><div className="big">{inr(sum.revenue)}</div></div>
      <div className="card"><div className="muted">{t('pending')}</div><div className="big" style={{ color: sum.pending ? 'var(--warn)' : 'inherit' }}>{sum.pending}</div></div>
      <div className="card"><div className="muted">{t('newCustomers')}</div><div className="big">{sum.newCustomers}</div></div>
    </div>
    {sum.topProducts?.length > 0 && <div className="card"><div className="muted">{t('topProducts')}</div>
      <div className="list">{sum.topProducts.map((p: any) => <div className="item" key={p.name}><span style={{ flex: 1 }}>{p.name}</span><b>{p.qty}</b></div>)}</div></div>}
    <div className="card">
      <div className="muted">{t('referralCode')}</div><div className="big" style={{ letterSpacing: 2 }}>{s.referralCode}</div>
      <p className="muted" style={{ marginTop: 6 }}>{t('referralHint')}</p>
    </div>
  </div>
}
