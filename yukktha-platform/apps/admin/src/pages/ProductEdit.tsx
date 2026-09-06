import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { useT } from '../i18n'

type Variant = { id?: string; color: string; size: string; priceOverride: number | null; stock: number }

// CT-1: photo → name → price → save. Variants are optional and collapsed by default.
export default function ProductEdit() {
  const { t } = useT(); const nav = useNavigate(); const { id } = useParams(); const [sp] = useSearchParams()
  const back = sp.get('back') || '/products'
  const fileRef = useRef<HTMLInputElement>(null)
  const [cats, setCats] = useState<any[]>([])
  const [f, setF] = useState({ name: '', description: '', price: '', compareAtPrice: '', categoryId: '', isActive: true, imageUrls: [] as string[] })
  const [variants, setVariants] = useState<Variant[]>([])
  const [stock, setStock] = useState(1)
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('')
  const [share, setShare] = useState<string | null>(null)

  useEffect(() => {
    api('/api/admin/categories').then(setCats)
    if (id) api(`/api/admin/products/${id}`).then(p => {
      setF({ name: p.name, description: p.description ?? '', price: String(p.price), compareAtPrice: p.compareAtPrice ? String(p.compareAtPrice) : '', categoryId: p.categoryId ?? '', isActive: p.isActive, imageUrls: p.images })
      const real = p.variants.filter((v: any) => !v.isDefault)
      if (real.length) setVariants(real.map((v: any) => ({ id: v.id, color: v.color ?? '', size: v.size ?? '', priceOverride: v.priceOverride, stock: v.stock })))
      else setStock(p.variants[0]?.stock ?? 1)
    })
  }, [id])

  async function upload(files: FileList | null) {
    if (!files) return
    setBusy(true)
    try {
      for (const file of Array.from(files)) {
        const form = new FormData(); form.append('file', file)
        const r = await api('/api/admin/products/images', { form })
        setF(x => ({ ...x, imageUrls: [...x.imageUrls, r.url] }))
      }
    } catch (e: any) { setErr(e.message) } finally { setBusy(false) }
  }

  async function save() {
    setErr(''); setBusy(true)
    try {
      const body = { ...f, price: +f.price, compareAtPrice: f.compareAtPrice ? +f.compareAtPrice : null, categoryId: f.categoryId || null,
        variants: variants.length ? variants.map(v => ({ ...v, color: v.color || null, size: v.size || null })) : [] }
      // When no variants, the API creates a default variant; carry stock through by sending one default-like variant.
      if (!variants.length) body.variants = [{ id: undefined, color: null, size: null, priceOverride: null, stock } as any]
      const r = id ? await api(`/api/admin/products/${id}`, { method: 'PUT', body }) : await api('/api/admin/products', { body })
      if (!id) { const info = await api('/api/admin/store'); setShare(`${info.storefrontUrl}/p/${r.slug}`) } else nav(back)
    } catch (e: any) { setErr(e.message) } finally { setBusy(false) }
  }

  if (share) return <div className="page"><div className="card" style={{ textAlign: 'center' }}>
    <div className="big">✓</div><p style={{ margin: '8px 0' }}>{f.name}</p><p className="muted" style={{ wordBreak: 'break-all' }}>{share}</p>
    <div style={{ height: 12 }} /><button className="btn wa" onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(f.name + '\n₹' + f.price + '\n' + share)}`)}>{t('share')} · WhatsApp</button>
    <div style={{ height: 8 }} /><button className="btn secondary" onClick={() => nav(back)}>{t('onboard_done')}</button>
  </div></div>

  return <div className="page">
    <h1>{id ? f.name || '…' : t('addProduct')}</h1>
    <div className="card">
      <label>{t('photos')}</label>
      <div className="photos">
        {f.imageUrls.map((u, i) => <img key={i} src={u} alt="" onClick={() => setF({ ...f, imageUrls: f.imageUrls.filter((_, j) => j !== i) })} />)}
        <div className="add" onClick={() => fileRef.current?.click()}>+</div>
      </div>
      <input ref={fileRef} type="file" accept="image/*" capture="environment" multiple hidden onChange={e => upload(e.target.files)} />
      <label>{t('productName')}</label><input value={f.name} onChange={e => setF({ ...f, name: e.target.value })} placeholder="కంచి పట్టు చీర / Kanchi pattu saree" />
      <div className="grid2">
        <div><label>{t('price')}</label><input inputMode="decimal" value={f.price} onChange={e => setF({ ...f, price: e.target.value })} /></div>
        <div><label>{t('comparePrice')}</label><input inputMode="decimal" value={f.compareAtPrice} onChange={e => setF({ ...f, compareAtPrice: e.target.value })} /></div>
      </div>
      <label>{t('category')}</label>
      <select value={f.categoryId} onChange={e => setF({ ...f, categoryId: e.target.value })}><option value="">—</option>{cats.map(c => <option key={c.id} value={c.id}>{c.nameTe ? `${c.nameTe} · ${c.nameEn}` : c.nameEn}</option>)}</select>
      <label>{t('description')}</label><textarea value={f.description} onChange={e => setF({ ...f, description: e.target.value })} />
    </div>
    <div className="card">
      <div className="row between"><b>{t('variants')}</b><button className="btn sm secondary" onClick={() => setVariants([...variants, { color: '', size: '', priceOverride: null, stock: 1 }])}>+ {t('addVariant')}</button></div>
      {variants.length === 0 && <><label>{t('stock')}</label><input type="number" min={0} value={stock} onChange={e => setStock(+e.target.value)} /></>}
      {variants.map((v, i) => <div key={i} className="row" style={{ marginTop: 8, alignItems: 'flex-end' }}>
        <div style={{ flex: 2 }}><label>{t('color')}</label><input value={v.color} onChange={e => upd(i, { color: e.target.value })} /></div>
        <div style={{ flex: 1 }}><label>{t('size')}</label><input value={v.size} onChange={e => upd(i, { size: e.target.value })} /></div>
        <div style={{ flex: 1 }}><label>{t('stock')}</label><input type="number" min={0} value={v.stock} onChange={e => upd(i, { stock: +e.target.value })} /></div>
        <button className="btn sm ghost" onClick={() => setVariants(variants.filter((_, j) => j !== i))}>✕</button>
      </div>)}
    </div>
    {err && <p className="err">{err}</p>}
    <button className="btn" disabled={busy || !f.name || !f.price} onClick={save}>{t('save')}</button>
    <div style={{ height: 8 }} /><button className="btn ghost" onClick={() => nav(back)}>{t('cancel')}</button>
  </div>
  function upd(i: number, patch: Partial<Variant>) { setVariants(variants.map((v, j) => j === i ? { ...v, ...patch } : v)) }
}
