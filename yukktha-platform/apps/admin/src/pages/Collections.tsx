import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { useT } from '../i18n'

export default function Collections() {
  const { t, lang } = useT()
  const [items, setItems] = useState<any[] | null>(null)
  useEffect(() => { api('/api/admin/collections').then(setItems) }, [])
  return <div className="page">
    <div className="topbar"><h1 style={{ margin: 0 }}>{t('collections')}</h1><Link className="btn sm" to="/collections/new">+ {t('addCollection')}</Link></div>
    <div className="card list">
      {items?.length === 0 && <p className="muted">{t('noCollections')}</p>}
      {items?.map(c => <Link className="item" key={c.id} to={`/collections/${c.id}`}>
        {c.bannerUrl ? <img className="thumb" src={c.bannerUrl} alt="" /> : <div className="thumb" />}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700 }}>{lang === 'te' && c.titleTe ? c.titleTe : c.title}</div>
          <div className="muted">{c.productCount} {t('products').toLowerCase()} · /collections/{c.slug}</div>
        </div>
        {!c.isActive && <span className="chip bad">{t('hiddenInShop')}</span>}
      </Link>)}
    </div>
    <Link className="btn ghost" to="/products">← {t('products')}</Link>
  </div>
}
