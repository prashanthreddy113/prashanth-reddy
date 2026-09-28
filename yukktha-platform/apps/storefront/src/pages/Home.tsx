import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { useStore } from '../main'
import ProductCard from './ProductCard'
import { CollectionTiles } from './Collections'

export default function Home() {
  const store = useStore(); const [sp, setSp] = useSearchParams(); const cat = sp.get('c') || ''
  const [items, setItems] = useState<any[]>([])
  useEffect(() => { api(`/api/store/products${cat ? `?categoryId=${cat}` : ''}`).then(setItems) }, [cat])
  const te = store.defaultLanguage === 1
  return <div className="wrap">
    {store.collections.length > 0 && !cat && <>
      <div className="shead"><h2>{te ? 'కలెక్షన్లు' : 'Shop by collection'}</h2><Link to="/collections/all">{te ? 'అన్నీ చూడండి →' : 'View all →'}</Link></div>
      <CollectionTiles collections={store.collections} te={te} />
    </>}
    <div className="cats">
      <a className={!cat ? 'on' : ''} onClick={() => setSp({})}>{te ? 'అన్నీ' : 'All'}</a>
      {store.categories.map((c: any) => <a key={c.id} className={cat === c.id ? 'on' : ''} onClick={() => setSp({ c: c.id })}>{te && c.nameTe ? c.nameTe : c.nameEn}</a>)}
    </div>
    <div className="grid">
      {items.map(p => <ProductCard key={p.id} p={p} te={te} />)}
    </div>
    {items.length === 0 && <p className="muted" style={{ textAlign: 'center', padding: 40 }}>{te ? 'త్వరలో కొత్త కలెక్షన్' : 'New collection coming soon'}</p>}
  </div>
}
