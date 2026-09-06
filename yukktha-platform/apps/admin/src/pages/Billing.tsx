import { useEffect, useState } from 'react'
import { api, inr } from '../api'
import { useT } from '../i18n'

// BL-1/BL-2/BL-3: pick a plan, authorise UPI autopay or a card with Razorpay Checkout, see the trial/grace state.
const STATUS = ['Trial', 'Active', 'PastDue', 'Suspended', 'Closed']

export default function Billing() {
  const { t } = useT()
  const [b, setB] = useState<any>(null); const [busy, setBusy] = useState<number | null>(null); const [err, setErr] = useState('')
  const load = () => api('/api/admin/billing').then(setB)
  useEffect(() => { load() }, [])
  if (!b) return <div className="page muted">…</div>

  const days = (d: string) => Math.max(0, Math.ceil((new Date(d).getTime() - Date.now()) / 86400000))
  const fmt = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  const statusName = STATUS[b.status] ?? b.status
  const current = b.plans.find((p: any) => p.tier === b.plan)

  async function choose(tier: number) {
    setBusy(tier); setErr('')
    try {
      const r = await api('/api/admin/billing/subscribe', { body: { plan: tier } })
      if (r.devMode) { setB(r.billing); return }
      await openCheckout(r)
    } catch (e: any) { setErr(e.message) } finally { setBusy(null) }
  }

  function openCheckout(r: any) {
    return new Promise<void>((resolve, reject) => {
      const start = () => {
        const rz = new (window as any).Razorpay({
          key: r.keyId, subscription_id: r.subscriptionId, name: 'Yukktha', description: t('planMandate'),
          theme: { color: '#6C3FE0' },
          handler: async (res: any) => {
            try { setB(await api('/api/admin/billing/verify', { body: { razorpayPaymentId: res.razorpay_payment_id, razorpaySubscriptionId: res.razorpay_subscription_id, razorpaySignature: res.razorpay_signature } })); resolve() }
            catch (e) { reject(e) }
          },
          modal: { ondismiss: () => resolve() },
        })
        rz.open()
      }
      if ((window as any).Razorpay) return start()
      const s = document.createElement('script'); s.src = 'https://checkout.razorpay.com/v1/checkout.js'; s.onload = start; s.onerror = () => reject(new Error(t('checkoutFailed'))); document.body.appendChild(s)
    })
  }

  async function cancel() {
    if (!confirm(t('cancelConfirm'))) return
    setErr('')
    try { setB(await api('/api/admin/billing/cancel', { body: {} })) } catch (e: any) { setErr(e.message) }
  }

  return <div className="page">
    <h1>{t('billing')}</h1>

    {!b.storefrontOpen && <div className="card" style={{ background: '#FFE4EB', borderColor: '#E0607E' }}>
      <b>{t('shopClosed')}</b><div className="muted" style={{ marginTop: 4 }}>{t('closed_' + b.closedReason)}</div></div>}

    <div className="card">
      <div className="row between">
        <div><div className="muted">{t('currentPlan')}</div><b>{current?.name ?? '—'}</b> <span className={'chip ' + (b.status === 1 ? 'ok' : b.status === 0 ? 'warn' : 'bad')}>{t('sub_' + statusName)}</span></div>
        <div style={{ textAlign: 'right' }}>
          {b.status === 0 && <><div className="muted">{t('trialEnds')}</div><b>{days(b.trialEndsAt)} {t('daysLeft')}</b></>}
          {b.status === 1 && b.currentPeriodEndsAt && <><div className="muted">{t('renewsOn')}</div><b>{fmt(b.currentPeriodEndsAt)}</b></>}
          {b.status === 2 && b.currentPeriodEndsAt && <><div className="muted">{t('graceUntil')}</div><b>{fmt(new Date(new Date(b.currentPeriodEndsAt).getTime() + b.graceDays * 86400000).toISOString())}</b></>}
        </div>
      </div>
      <div className="muted" style={{ marginTop: 10 }}>
        {b.paymentMethodAttached ? '✓ ' + t('paymentMethodAdded') : t('noPaymentMethod')}
        {!b.razorpayConfigured && <span> · {t('devBilling')}</span>}
      </div>
    </div>

    <h2>{b.paymentMethodAttached ? t('changePlan') : t('choosePlan')}</h2>
    <p className="muted">{b.status === 0 ? t('trialChargeNote') : t('chargeNowNote')}</p>
    {err && <div className="card" style={{ background: '#FFE4EB' }}>{err}</div>}
    <div className="list">
      {b.plans.map((p: any) => {
        const isCurrent = p.tier === b.plan && b.paymentMethodAttached
        return <div className="card" key={p.tier} style={isCurrent ? { borderColor: 'var(--brand)' } : undefined}>
          <div className="row between">
            <div><b style={{ fontSize: 18 }}>{p.name}</b><div className="muted">{inr(p.monthlyInr)} {t('perMonth')}</div></div>
            <button className={'btn sm ' + (isCurrent ? 'secondary' : '')} disabled={busy !== null || isCurrent} onClick={() => choose(p.tier)}>
              {busy === p.tier ? '…' : isCurrent ? t('currentPlan') : b.paymentMethodAttached ? t('switch') : t('choose')}</button>
          </div>
          <ul className="features">{p.features.map((f: string) => <li key={f}>{t('feat_' + f)}</li>)}</ul>
        </div>
      })}
    </div>

    {b.hasSubscription && b.status !== 3 && <><div style={{ height: 8 }} /><button className="btn ghost" onClick={cancel}>{t('cancelPlan')}</button></>}
  </div>
}
