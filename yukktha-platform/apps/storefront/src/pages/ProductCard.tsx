import { Link } from 'react-router-dom'
import { inr } from '../api'

// Collection-page card: second photo on hover, "% off" and sold-out badges, fabric line.
export default function ProductCard({ p, te }: { p: any; te: boolean }) {
  const off = p.compareAtPrice && p.compareAtPrice > p.price ? Math.round((1 - p.price / p.compareAtPrice) * 100) : 0
  return <Link className="pcard" to={`/p/${p.slug}`}>
    <div className="ph">
      <img src={p.images[0] ?? ''} alt={p.name} loading="lazy" />
      {p.images[1] && <img className="alt" src={p.images[1]} alt="" loading="lazy" />}
      {!p.inStock ? <span className="sold">{te ? 'అమ్ముడయింది' : 'Sold out'}</span>
        : off > 0 && <span className="off">{off}% {te ? 'తగ్గింపు' : 'off'}</span>}
    </div>
    <div className="b">
      <div className="n">{p.name}</div>
      {p.fabric && <div className="f">{p.fabric}</div>}
      <div><span className="price">{inr(p.price)}</span>{off > 0 && <span className="was">{inr(p.compareAtPrice)}</span>}</div>
    </div>
  </Link>
}
