import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api, inr } from '../api'
import { useT } from '../i18n'
import { Toggle } from './Onboarding'

// A collection is a name, an optional banner and an ordered list of products. The order is the shop's "Featured" sort.
export default function CollectionEdit() {
  const { t } = useT(); const nav = useNavigate(); const { id } = useParams()
  const fileRef = useRef<HTMLInputElement>(null)
  const [f, setF] = useState({ title: '', titleTe: '', description: '', bannerUrl: '', sortOrder: 0, isActive: true })
  const [slug, setSlug] = useState(''); const [selected, setSelected] = useState<string[]>([])
  const [products, setProducts] = useState<any[]>([]); const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [shopUrl, setShopUrl] = useState('')

  useEffect(() => {
    api('/api/admin/products?pageSize=1000').then(r => setProducts(r.items.filter((p: any) => p.isActive)))
    api('/api/admin/store').then(s => setShopUrl(s.storefrontUrl))
    if (id) api(`/api/admin/collections/${id}`).then(c => {
      setF({ title: c.title, titleTe: c.titleTe ?? '', description: c.description ?? '', bannerUrl: c.bannerUrl ?? '', sortOrder: c.sortOrder, isActive: c.isActive })
      setSlug(c.slug); setSelected(c.productIds)
    })
  }, [id])

  async function upload(files: FileList | null) {
    if (!files?.[0]) return
    setBusy(true)
    try { const form = new FormData(); form.append('file', files[0]); const r = await api('/api/admin/products/images', { form }); setF(x => ({ ...x, bannerUrl: r.url })) }
    catch (e: any) { setErr(e.message) } finally { setBusy(false) }
  }

  async function save() {
    setErr(''); setBusy(true)
    try {
      const body = { ...f, titleTe: f.titleTe || null, description: f.description || null, bannerUrl: f.bannerUrl || null, productIds: selected }
      if (id) await api(`/api/admin/collections/${id}`, { method: 'PUT', body }); else await api('/api/admin/collections', { body })
      nav('/collections')
    } catch (e: any) { setErr(e.message) } finally { setBusy(false) }
  }

  async function remove() {
    if (!id || !confirm(t('confirmDelete'))) return
    await api(`/api/admin/collections/${id}`, { method: 'DELETE' }); nav('/collections')
  }

  const byId = new Map(products.map(p => [p.id, p]))
  const toggle = (pid: string) => setSelected(s => s.includes(pid) ? s.filter(x => x !== pid) : [...s, pid])
  const move = (i: number, d: number) => setSelected(s => { const n = [...s]; const j = i + d; if (j < 0 || j >= n.length) return s; [n[i], n[j]] = [n[j], n[i]]; return n })
  const others = products.filter(p => !selected.includes(p.id) && (!q || p.name.toLowerCase().includes(q.toLowerCase())))

  return <div className="page">
    <h1>{id ? f.title || '…' : t('addCollection')}</h1>
    <div className="card">
      <label>{t('collectionTitle')}</label><input value={f.title} onChange={e => setF({ ...f, title: e.target.value })} placeholder="Yanai Motif Sarees" />
      <label>{t('collectionTitleTe')}</label><input value={f.titleTe} onChange={e => setF({ ...f, titleTe: e.target.value })} placeholder="యానై మోటిఫ్ చీరలు" />
      <label>{t('description')}</label><textarea value={f.description} onChange={e => setF({ ...f, description: e.target.value })} />
      <label>{t('banner')}</label>
      <div className="photos">
        {f.bannerUrl && <img src={f.bannerUrl} alt="" style={{ width: 144 }} onClick={() => setF({ ...f, bannerUrl: '' })} />}
        {!f.bannerUrl && <div className="add" onClick={() => fileRef.current?.click()}>+</div>}
      </div>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={e => upload(e.target.files)} />
      <div className="grid2">
        <div><label>{t('displayOrder')}</label><input type="number" value={f.sortOrder} onChange={e => setF({ ...f, sortOrder: +e.target.value })} /></div>
      </div>
      <div style={{ height: 8 }} />
      <Toggle label={t('showInShop')} on={f.isActive} set={v => setF({ ...f, isActive: v })} />
      {slug && shopUrl && <p className="muted" style={{ wordBreak: 'break-all', marginTop: 8 }}>{shopUrl}/collections/{slug}</p>}
    </div>

    <div className="card">
      <div className="row between"><b>{t('collectionProducts')}</b><span className="chip">{t('selectedCount').replace('{n}', String(selected.length))}</span></div>
      <p className="muted">{t('collectionOrderHint')}</p>
      <div className="list">
        {selected.map((pid, i) => { const p = byId.get(pid); if (!p) return null
          return <div className="item" key={pid}>
            <img className="thumb" src={p.images[0] ?? ''} alt="" style={{ width: 48, height: 48 }} />
            <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div><div className="muted">{inr(p.price)}</div></div>
            <button className="btn sm ghost" disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
            <button className="btn sm ghost" disabled={i === selected.length - 1} onClick={() => move(i, 1)}>↓</button>
            <button className="btn sm ghost" onClick={() => toggle(pid)}>✕</button>
          </div> })}
      </div>
    </div>

    <div className="card">
      <b>+ {t('products')}</b>
      <input placeholder={t('search')} value={q} onChange={e => setQ(e.target.value)} style={{ marginTop: 8 }} />
      <div className="list" style={{ maxHeight: 360, overflowY: 'auto', marginTop: 8 }}>
        {others.map(p => <label className="item" key={p.id} style={{ margin: 0, cursor: 'pointer', color: 'var(--ink)', fontWeight: 500 }}>
          <input type="checkbox" checked={false} onChange={() => toggle(p.id)} style={{ width: 20, height: 20, flex: 'none' }} />
          <img className="thumb" src={p.images[0] ?? ''} alt="" style={{ width: 48, height: 48 }} />
          <div style={{ flex: 1, minWidth: 0 }}><div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div><div className="muted">{inr(p.price)}{p.fabric ? ` · ${p.fabric}` : ''}</div></div>
        </label>)}
      </div>
    </div>

    {err && <p className="err">{err}</p>}
    <button className="btn" disabled={busy || !f.title.trim()} onClick={save}>{t('save')}</button>
    <div style={{ height: 8 }} /><button className="btn ghost" onClick={() => nav('/collections')}>{t('cancel')}</button>
    {id && <><div style={{ height: 8 }} /><button className="btn ghost" style={{ color: 'var(--bad)' }} onClick={remove}>{t('delete')}</button></>}
  </div>
}
