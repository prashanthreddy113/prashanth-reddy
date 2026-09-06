import { useEffect, useState } from 'react'
import { api, inr } from '../api'
import { useT } from '../i18n'

const STATUSES = ['New', 'Confirmed', 'Packed', 'Shipped', 'Delivered', 'Cancelled'] as const
const CODE: Record<string, number> = { New: 0, Confirmed: 1, Packed: 2, Shipped: 3, Delivered: 4, Cancelled: 9 }
const NAME = Object.fromEntries(Object.entries(CODE).map(([k, v]) => [v, k]))

// OR-3: list with one-tap call/WhatsApp; WA-4: status change notifies the customer.
export default function Orders() {
  const { t } = useT()
  const [items, setItems] = useState<any[]>([]); const [open, setOpen] = useState<any>(null); const [tracking, setTracking] = useState('')
  const load = () => api('/api/admin/orders').then(r => setItems(r.items))
  useEffect(() => { load() }, [])

  async function setStatus(o: any, status: string) {
    const r = await api(`/api/admin/orders/${o.id}/status`, { method: 'PATCH', body: { status: CODE[status], trackingUrl: tracking || null } })
    setOpen(r); load()
  }
  const chip = (s: number) => s === 4 ? 'ok' : s === 9 ? 'bad' : s === 0 ? 'warn' : ''

  if (open) return <div className="page">
    <button className="btn sm ghost" onClick={() => setOpen(null)}>←</button>
    <h1 style={{ marginTop: 10 }}>{t('orderNo')} #{open.number} <span className={'chip ' + chip(open.status)}>{t('status_' + NAME[open.status])}</span></h1>
    <div className="card">
      <b>{open.customer.name}</b><div className="muted">{open.customer.phone}</div>
      {open.deliveryAddress && <div className="muted">{open.deliveryAddress}</div>}
      <div className="row" style={{ marginTop: 10 }}>
        <a className="btn sm secondary" href={`tel:${open.customer.phone}`}>{t('call')}</a>
        <a className="btn sm wa" href={`https://wa.me/${open.customer.phone.replace('+', '')}`} target="_blank" rel="noreferrer">{t('whatsapp')}</a>
      </div>
    </div>
    <div className="card list">
      {open.items.map((i: any, k: number) => <div className="item" key={k}><span style={{ flex: 1 }}>{i.quantity} × {i.productName}{i.variantLabel && <span className="muted"> ({i.variantLabel})</span>}</span><b>{inr(i.unitPrice * i.quantity)}</b></div>)}
      <div className="item"><span style={{ flex: 1 }}>{t('total')}</span><b>{inr(open.total)}</b></div>
      <div className="muted">{['COD', 'Online', 'WhatsApp'][open.paymentMethod]} · {['Pending', 'Paid', 'Failed', 'Refunded'][open.paymentStatus]} · {['Pickup', 'Local delivery', 'Courier'][open.deliveryMode]}</div>
    </div>
    <div className="card">
      <label>{t('markAs')}</label>
      <div className="row" style={{ flexWrap: 'wrap' }}>{STATUSES.map(s => <button key={s} className={'btn sm ' + (NAME[open.status] === s ? '' : 'secondary')} onClick={() => setStatus(open, s)}>{t('status_' + s)}</button>)}</div>
      <label>{t('tracking')}</label><input value={tracking} onChange={e => setTracking(e.target.value)} placeholder="https://…" />
    </div>
  </div>

  return <div className="page">
    <h1>{t('orders')}</h1>
    <div className="card list">
      {items.length === 0 && <p className="muted">{t('noOrders')}</p>}
      {items.map(o => <div className="item" key={o.id} onClick={() => { setOpen(o); setTracking(o.trackingUrl ?? '') }} style={{ cursor: 'pointer' }}>
        <div style={{ flex: 1 }}><b>#{o.number} · {o.customer.name}</b><div className="muted">{o.items.length} items · {new Date(o.createdAt).toLocaleDateString('en-IN')}</div></div>
        <div style={{ textAlign: 'right' }}><b>{inr(o.total)}</b><div><span className={'chip ' + chip(o.status)}>{t('status_' + NAME[o.status])}</span></div></div>
      </div>)}
    </div>
  </div>
}
