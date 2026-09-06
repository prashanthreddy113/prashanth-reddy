import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, inr } from '../api'
import { useT } from '../i18n'

export default function Products() {
  const { t } = useT()
  const [items, setItems] = useState<any[]>([]); const [q, setQ] = useState('')
  useEffect(() => { const h = setTimeout(() => api(`/api/admin/products?q=${encodeURIComponent(q)}`).then(r => setItems(r.items)), 250); return () => clearTimeout(h) }, [q])
  return <div className="page">
    <div className="topbar"><h1 style={{ margin: 0 }}>{t('products')}</h1><Link className="btn sm" to="/products/new">+ {t('addProduct')}</Link></div>
    <input placeholder={t('search')} value={q} onChange={e => setQ(e.target.value)} />
    <div className="card list" style={{ marginTop: 12 }}>
      {items.length === 0 && <p className="muted">{t('noProducts')}</p>}
      {items.map(p => <Link className="item" key={p.id} to={`/products/${p.id}`}>
        <img className="thumb" src={p.images[0] ?? ''} alt="" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
          <div className="muted">{inr(p.price)} · {p.variants.length > 1 ? `${p.variants.length} ${t('variants').toLowerCase()}` : ''}</div>
        </div>
        <span className={'chip ' + (p.inStock ? 'ok' : 'bad')}>{p.inStock ? t('inStock') : t('soldOut')}</span>
      </Link>)}
    </div>
  </div>
}
