import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, cart, inr, CartLine } from '../api'
import { useStore } from '../main'

// OR-1/OR-2: name, phone, address, delivery, payment. Online payment opens Razorpay Checkout; COD confirms directly.
export default function Checkout() {
  const store = useStore(); const te = store.defaultLanguage === 1
  const [lines, setLines] = useState<CartLine[]>(cart.get())
  const [f, setF] = useState({ name: '', phone: '', address: '', deliveryMode: store.localDeliveryEnabled ? 1 : store.courierEnabled ? 2 : 0, paymentMethod: store.codEnabled ? 0 : 1, notes: '', marketingOptIn: true })
  const [done, setDone] = useState<any>(null); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false)
  useEffect(() => { const u = () => setLines(cart.get()); window.addEventListener('cart', u); return () => window.removeEventListener('cart', u) }, [])

  const subtotal = lines.reduce((a, l) => a + l.price * l.qty, 0)
  const delivery = f.deliveryMode === 1 ? store.localDeliveryCharge : f.deliveryMode === 2 ? store.courierCharge : 0
  const setQty = (id: string, q: number) => cart.set(lines.map(l => l.variantId === id ? { ...l, qty: q } : l).filter(l => l.qty > 0))

  async function place() {
    setErr(''); setBusy(true)
    try {
      const r = await api('/api/store/checkout', { ...f, items: lines.map(l => ({ variantId: l.variantId, quantity: l.qty })) })
      if (r.razorpay) await payOnline(r)
      cart.clear(); setDone(r)
    } catch (e: any) { setErr(e.message) } finally { setBusy(false) }
  }
  function payOnline(r: any) {
    return new Promise<void>((resolve, reject) => {
      const s = document.createElement('script'); s.src = 'https://checkout.razorpay.com/v1/checkout.js'
      s.onload = () => new (window as any).Razorpay({ key: r.razorpay.keyId, amount: r.razorpay.amountPaise, currency: 'INR', name: store.name, description: `Order #${r.number}`,
        notes: { order_id: r.orderId }, prefill: { name: f.name, contact: f.phone }, theme: { color: store.themeColor },
        handler: () => resolve(), modal: { ondismiss: () => reject(new Error(te ? 'చెల్లింపు రద్దు చేయబడింది' : 'Payment cancelled')) } }).open()
      document.body.appendChild(s)
    })
  }

  if (done) return <div className="wrap"><div className="card" style={{ textAlign: 'center', marginTop: 30 }}>
    <div style={{ fontSize: 40 }}>✓</div><h2>{te ? 'ఆర్డర్ వచ్చింది' : 'Order placed'} #{done.number}</h2>
    <p className="muted">{te ? 'వాట్సాప్‌లో కన్ఫర్మేషన్ వస్తుంది.' : 'You will get a confirmation on WhatsApp.'}</p>
    <div style={{ height: 14 }} /><a className="btn wa" href={done.whatsAppLink} target="_blank" rel="noreferrer">{te ? 'వాట్సాప్‌లో చాట్' : 'Chat on WhatsApp'}</a>
    <div style={{ height: 8 }} /><Link className="btn ghost" to="/">{te ? 'షాపింగ్ కొనసాగించండి' : 'Continue shopping'}</Link>
  </div></div>

  if (lines.length === 0) return <div className="wrap"><p className="muted" style={{ textAlign: 'center', padding: 60 }}>{te ? 'బ్యాగ్ ఖాళీగా ఉంది' : 'Your bag is empty'}</p><Link className="btn" to="/">{te ? 'షాప్ చూడండి' : 'Browse shop'}</Link></div>

  return <div className="wrap">
    <div className="card">{lines.map(l => <div className="line" key={l.variantId}>
      <img src={l.image ?? ''} alt="" /><div style={{ flex: 1 }}><b>{l.productName}</b>{l.variantLabel && <div className="muted">{l.variantLabel}</div>}<div>{inr(l.price)}</div></div>
      <div className="opts" style={{ margin: 0 }}><button onClick={() => setQty(l.variantId, l.qty - 1)}>−</button><span style={{ padding: '9px 6px', fontWeight: 700 }}>{l.qty}</span><button onClick={() => setQty(l.variantId, l.qty + 1)}>+</button></div>
    </div>)}</div>
    <div className="card">
      <label>{te ? 'పేరు' : 'Name'}</label><input value={f.name} onChange={e => setF({ ...f, name: e.target.value })} />
      <label>{te ? 'మొబైల్ (వాట్సాప్)' : 'Mobile (WhatsApp)'}</label><input inputMode="tel" value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} />
      <label>{te ? 'డెలివరీ' : 'Delivery'}</label>
      <div className="opts">
        <button className={f.deliveryMode === 0 ? 'on' : ''} onClick={() => setF({ ...f, deliveryMode: 0 })}>{te ? 'షాప్‌లో తీసుకుంటాను' : 'Pickup'}</button>
        {store.localDeliveryEnabled && <button className={f.deliveryMode === 1 ? 'on' : ''} onClick={() => setF({ ...f, deliveryMode: 1 })}>{te ? 'లోకల్ డెలివరీ' : 'Local delivery'} {inr(store.localDeliveryCharge)}</button>}
        {store.courierEnabled && <button className={f.deliveryMode === 2 ? 'on' : ''} onClick={() => setF({ ...f, deliveryMode: 2 })}>{te ? 'కొరియర్' : 'Courier'} {inr(store.courierCharge)}</button>}
      </div>
      {f.deliveryMode !== 0 && <><label>{te ? 'చిరునామా' : 'Address'}</label><textarea value={f.address} onChange={e => setF({ ...f, address: e.target.value })} /></>}
      <label>{te ? 'చెల్లింపు' : 'Payment'}</label>
      <div className="opts">
        {store.codEnabled && <button className={f.paymentMethod === 0 ? 'on' : ''} onClick={() => setF({ ...f, paymentMethod: 0 })}>{te ? 'డెలివరీ వద్ద నగదు' : 'Cash on delivery'}</button>}
        {store.onlinePaymentEnabled && <button className={f.paymentMethod === 1 ? 'on' : ''} onClick={() => setF({ ...f, paymentMethod: 1 })}>UPI / Card</button>}
      </div>
      <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 500 }}><input type="checkbox" style={{ width: 'auto' }} checked={f.marketingOptIn} onChange={e => setF({ ...f, marketingOptIn: e.target.checked })} />{te ? 'కొత్త కలెక్షన్ వాట్సాప్‌లో పంపండి' : 'Send me new collections on WhatsApp'}</label>
    </div>
    <div className="card">
      <div className="line"><span style={{ flex: 1 }}>{te ? 'మొత్తం' : 'Subtotal'}</span><b>{inr(subtotal)}</b></div>
      {delivery > 0 && <div className="line"><span style={{ flex: 1 }}>{te ? 'డెలివరీ' : 'Delivery'}</span><b>{inr(delivery)}</b></div>}
      <div className="line" style={{ fontSize: 18 }}><span style={{ flex: 1 }}>{te ? 'చెల్లించాల్సినది' : 'Total'}</span><b>{inr(subtotal + delivery)}</b></div>
    </div>
    {err && <p className="err">{err}</p>}
    <button className="btn" disabled={busy || !f.name || f.phone.length < 10 || (f.deliveryMode !== 0 && !f.address)} onClick={place}>{te ? 'ఆర్డర్ చేయండి' : 'Place order'} · {inr(subtotal + delivery)}</button>
    <div style={{ height: 30 }} />
  </div>
}
