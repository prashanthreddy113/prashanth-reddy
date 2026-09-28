import { Link } from 'react-router-dom'
import { useStore } from '../main'

export function CollectionTiles({ collections, te }: { collections: any[]; te: boolean }) {
  return <div className="tiles">
    {collections.map(c => <Link key={c.id} className="tile" to={`/collections/${c.slug}`}>
      <div className="ti" style={c.imageUrl ? { backgroundImage: `url("${c.imageUrl}")` } : undefined} />
      <div className="tt"><b>{te && c.titleTe ? c.titleTe : c.title}</b><span className="muted">{c.productCount} {te ? 'ఉత్పత్తులు' : 'products'}</span></div>
    </Link>)}
  </div>
}

export default function Collections() {
  const store = useStore(); const te = store.defaultLanguage === 1
  return <div className="wrap">
    <nav className="crumbs"><Link to="/">{te ? 'హోమ్' : 'Home'}</Link> / <span>{te ? 'కలెక్షన్లు' : 'Collections'}</span></nav>
    <h1 className="ctitle">{te ? 'కలెక్షన్లు' : 'Collections'}</h1>
    <CollectionTiles collections={store.collections} te={te} />
    <div style={{ height: 16 }} />
    <Link className="btn ghost" to="/collections/all">{te ? 'అన్ని ఉత్పత్తులు చూడండి' : 'Shop all products'}</Link>
    <div style={{ height: 30 }} />
  </div>
}
