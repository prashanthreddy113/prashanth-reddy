import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api, cart, inr } from '../api'
import { useStore } from '../main'

// WA-1/WA-2: "Order on WhatsApp" is the primary button; cart checkout is secondary.
export default function Product() {
  const { slug } = useParams(); const store = useStore(); const nav = useNavigate()
  const [p, setP] = useState<any>(null); const [sel, setSel] = useState<any>(null)
  useEffect(() => { api(`/api/store/products/${slug}`).then(x => { setP(x); setSel(x.variants.find((v: any) => v.inStock) ?? x.variants[0]) }) }, [slug])
  if (!p || !sel) return null
  const te = store.defaultLanguage === 1
  const colors = [...new Set(p.variants.map((v: any) => v.color).filter(Boolean))] as string[]
  const sizes = [...new Set(p.variants.map((v: any) => v.size).filter(Boolean))] as string[]
  const pick = (patch: any) => { const v = p.variants.find((v: any) => (patch.color ?? sel.color) == v.color && (patch.size ?? sel.size) == v.size); if (v) setSel(v) }
  const label = [sel.color, sel.size].filter(Boolean).join(' / ')
  const share = () => { const text = `${p.name}\n${inr(sel.price)}\n${p.shareUrl}`; navigator.share ? navigator.share({ text }) : window.open(`https://wa.me/?text=${encodeURIComponent(text)}`) }

  return <div className="wrap" style={{ paddingTop: 12 }}>
    <div className="gallery">{p.images.map((u: string, i: number) => <img key={i} src={u} alt="" />)}</div>
    <h1 style={{ fontSize: 22, margin: '14px 0 4px' }}>{p.name}</h1>
    <div style={{ fontSize: 22 }}><span className="price">{inr(sel.price)}</span>{p.compareAtPrice && <span className="was">{inr(p.compareAtPrice)}</span>}</div>
    {colors.length > 0 && <><label>{te ? 'రంగు' : 'Colour'}</label><div className="opts">{colors.map(c => <button key={c} className={sel.color === c ? 'on' : ''} onClick={() => pick({ color: c })}>{c}</button>)}</div></>}
    {sizes.length > 0 && <><label>{te ? 'సైజు' : 'Size'}</label><div className="opts">{sizes.map(s => { const v = p.variants.find((v: any) => v.size === s && v.color === sel.color); return <button key={s} disabled={v && !v.inStock} className={sel.size === s ? 'on' : ''} onClick={() => pick({ size: s })}>{s}</button> })}</div></>}
    {p.description && <p style={{ margin: '12px 0', whiteSpace: 'pre-wrap' }}>{p.description}</p>}
    <button className="btn ghost" onClick={share} style={{ marginTop: 8 }}>{te ? 'షేర్ చేయండి' : 'Share'}</button>
    <div style={{ height: 90 }} />
    <div className="sticky" style={{ margin: '0 -14px' }}>
      <a className="btn wa" href={sel.whatsAppLink} target="_blank" rel="noreferrer" aria-disabled={!sel.inStock} style={sel.inStock ? {} : { opacity: .45, pointerEvents: 'none' }}>
        {sel.inStock ? (te ? 'వాట్సాప్‌లో ఆర్డర్' : 'Order on WhatsApp') : (te ? 'అమ్ముడయింది' : 'Sold out')}</a>
      <button className="btn" disabled={!sel.inStock} onClick={() => { cart.add({ variantId: sel.id, productName: p.name, variantLabel: label || undefined, price: sel.price, qty: 1, image: p.images[0] }); nav('/checkout') }}>
        {te ? 'కొనండి' : 'Buy'}</button>
    </div>
  </div>
}
