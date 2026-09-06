import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api, inr } from '../api'
import { useStore } from '../main'

export default function Home() {
  const store = useStore(); const [sp, setSp] = useSearchParams(); const cat = sp.get('c') || ''
  const [items, setItems] = useState<any[]>([])
  useEffect(() => { api(`/api/store/products${cat ? `?categoryId=${cat}` : ''}`).then(setItems) }, [cat])
  const te = store.defaultLanguage === 1
  return <div className="wrap">
    <div className="cats">
      <a className={!cat ? 'on' : ''} onClick={() => setSp({})}>{te ? 'అన్నీ' : 'All'}</a>
      {store.categories.map((c: any) => <a key={c.id} className={cat === c.id ? 'on' : ''} onClick={() => setSp({ c: c.id })}>{te && c.nameTe ? c.nameTe : c.nameEn}</a>)}
    </div>
    <div className="grid">
      {items.map(p => <Link className="pcard" key={p.id} to={`/p/${p.slug}`} style={{ position: 'relative' }}>
        <img src={p.images[0] ?? ''} alt={p.name} loading="lazy" />
        {!p.inStock && <span className="sold">{te ? 'అమ్ముడయింది' : 'Sold out'}</span>}
        <div className="b"><div className="n">{p.name}</div><div><span className="price">{inr(p.price)}</span>{p.compareAtPrice && <span className="was">{inr(p.compareAtPrice)}</span>}</div></div>
      </Link>)}
    </div>
    {items.length === 0 && <p className="muted" style={{ textAlign: 'center', padding: 40 }}>{te ? 'త్వరలో కొత్త కలెక్షన్' : 'New collection coming soon'}</p>}
  </div>
}
