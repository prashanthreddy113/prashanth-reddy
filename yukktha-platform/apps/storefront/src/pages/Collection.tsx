import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { api, inr } from '../api'
import { useStore } from '../main'
import ProductCard from './ProductCard'

const SORTS: [string, string, string][] = [
  ['featured', 'Featured', 'ఫీచర్డ్'],
  ['best-selling', 'Best selling', 'ఎక్కువగా అమ్ముడైనవి'],
  ['price-asc', 'Price, low to high', 'ధర: తక్కువ నుండి ఎక్కువ'],
  ['price-desc', 'Price, high to low', 'ధర: ఎక్కువ నుండి తక్కువ'],
  ['created-desc', 'Newest first', 'కొత్తవి ముందు'],
  ['created-asc', 'Oldest first', 'పాతవి ముందు'],
  ['title-asc', 'Alphabetically, A-Z', 'అక్షర క్రమం, A-Z'],
  ['title-desc', 'Alphabetically, Z-A', 'అక్షర క్రమం, Z-A'],
]
const MULTI = ['color', 'fabric', 'occasion'] as const
const FILTER_KEYS = ['inStock', 'minPrice', 'maxPrice', ...MULTI, 'q']

// Saree colour names that CSS does not know; anything else is tried as a CSS colour, then falls back to a neutral swatch.
const SWATCH: Record<string, string> = {
  'rani pink': '#E0115F', 'bottle green': '#006A4E', 'mustard': '#E1AD01', 'peach': '#FFCBA4', 'mango yellow': '#F4BB44', 'onion pink': '#E8A0A8',
  'wine': '#722F37', 'rust': '#B7410E', 'parrot green': '#7FBF3F', 'off white': '#F5F1E6', 'cream': '#FFFDD0', 'copper': '#B87333', 'mehendi': '#6B7B2B',
  'multicolour': 'conic-gradient(red, orange, yellow, green, blue, violet, red)', 'multicolor': 'conic-gradient(red, orange, yellow, green, blue, violet, red)',
}
function swatch(v: string) {
  const k = v.toLowerCase()
  if (SWATCH[k]) return SWATCH[k]
  const css = k.replace(/\s+/g, '')
  return typeof CSS !== 'undefined' && CSS.supports('color', css) ? css : '#D9D4E8'
}

// Shopify-style collection page: banner, breadcrumb, filters (drawer on phones, sidebar on desktop), sort,
// product count, grid density and "load more". Every filter lives in the URL so a filtered page can be shared on WhatsApp.
export default function Collection() {
  const store = useStore(); const te = store.defaultLanguage === 1
  const { slug = 'all' } = useParams(); const [sp, setSp] = useSearchParams()
  const [data, setData] = useState<any>(null); const [items, setItems] = useState<any[]>([]); const [page, setPage] = useState(1)
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [drawer, setDrawer] = useState(false)
  const [cols, setCols] = useState(() => { try { return +(localStorage.getItem('yk_cols') || 0) || 4 } catch { return 4 } })
  const query = sp.toString(); const seq = useRef(0)

  useEffect(() => { setPage(1); load(1, false) }, [slug, query])
  useEffect(() => { document.body.style.overflow = drawer ? 'hidden' : ''; return () => { document.body.style.overflow = '' } }, [drawer])

  async function load(p: number, append: boolean) {
    const mine = ++seq.current   // a slower earlier response must not overwrite a newer filter's results
    setBusy(true); setErr('')
    try {
      const qs = new URLSearchParams(sp); qs.set('page', String(p))
      const r = await api(`/api/store/collections/${encodeURIComponent(slug)}?${qs}`)
      if (mine !== seq.current) return
      setData(r); setItems(x => append ? [...x, ...r.items] : r.items)
      if (!append) document.title = `${te && r.collection.titleTe ? r.collection.titleTe : r.collection.title} · ${store.name}`
    } catch (e: any) { if (mine === seq.current) setErr(e.status === 404 ? '404' : e.message) } finally { if (mine === seq.current) setBusy(false) }
  }

  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(sp)
    for (const [k, v] of Object.entries(patch)) v === null || v === '' ? next.delete(k) : next.set(k, v)
    setSp(next, { replace: true })
  }
  const list = (k: string) => (sp.get(k) || '').split(',').filter(Boolean)
  const toggle = (k: string, v: string) => { const l = list(k); set({ [k]: (l.includes(v) ? l.filter(x => x !== v) : [...l, v]).join(',') }) }
  const clearAll = () => { const next = new URLSearchParams(sp); FILTER_KEYS.forEach(k => next.delete(k)); setSp(next, { replace: true }) }
  const setCols_ = (n: number) => { setCols(n); try { localStorage.setItem('yk_cols', String(n)) } catch { } }

  if (err === '404') return <div className="wrap"><p className="muted" style={{ textAlign: 'center', padding: 60 }}>{te ? 'ఈ కలెక్షన్ లేదు' : 'This collection is not available'}</p><Link className="btn" to="/collections/all">{te ? 'అన్నీ చూడండి' : 'Browse all products'}</Link></div>
  if (!data) return err ? <div className="wrap"><p className="err" style={{ padding: 40 }}>{err}</p></div> : <div className="wrap"><p className="muted" style={{ padding: 40, textAlign: 'center' }}>…</p></div>

  const c = data.collection, f = data.facets
  const title = te && c.titleTe ? c.titleTe : c.title
  const labels: Record<string, Record<string, string>> = {}
  for (const k of MULTI) labels[k] = Object.fromEntries((f[k === 'color' ? 'colors' : k + 's'] as any[]).map(x => [x.value, x.label]))
  const chips: [string, string, () => void][] = [
    ...(sp.get('inStock') ? [[sp.get('inStock') === 'true' ? (te ? 'స్టాక్‌లో ఉన్నవి' : 'In stock') : (te ? 'అమ్ముడైనవి' : 'Out of stock'), 'inStock', () => set({ inStock: null })] as [string, string, () => void]] : []),
    ...((sp.get('minPrice') || sp.get('maxPrice')) ? [[`${inr(+(sp.get('minPrice') || f.priceMin))} – ${inr(+(sp.get('maxPrice') || f.priceMax))}`, 'price', () => set({ minPrice: null, maxPrice: null })] as [string, string, () => void]] : []),
    ...MULTI.flatMap(k => list(k).map(v => [labels[k][v] ?? v, k + v, () => toggle(k, v)] as [string, string, () => void])),
    ...(sp.get('q') ? [[`“${sp.get('q')}”`, 'q', () => set({ q: null })] as [string, string, () => void]] : []),
  ]
  const shown = items.length, total = data.total

  const filters = <div className="filters">
    <Group title={te ? 'లభ్యత' : 'Availability'}>
      <Check on={sp.get('inStock') === 'true'} onChange={() => set({ inStock: sp.get('inStock') === 'true' ? null : 'true' })} label={te ? 'స్టాక్‌లో ఉన్నవి' : 'In stock'} n={f.inStock} />
      <Check on={sp.get('inStock') === 'false'} onChange={() => set({ inStock: sp.get('inStock') === 'false' ? null : 'false' })} label={te ? 'అమ్ముడైనవి' : 'Out of stock'} n={f.outOfStock} />
    </Group>
    {f.priceMax > 0 && <Group title={te ? 'ధర' : 'Price'}>
      <PriceRange key={`${sp.get('minPrice')}-${sp.get('maxPrice')}`} min={f.priceMin} max={f.priceMax} lo={sp.get('minPrice')} hi={sp.get('maxPrice')} te={te}
        onApply={(lo, hi) => set({ minPrice: lo, maxPrice: hi })} />
    </Group>}
    {f.colors.length > 0 && <Group title={te ? 'రంగు' : 'Colour'}>
      {f.colors.map((x: any) => <Check key={x.value} on={list('color').includes(x.value)} onChange={() => toggle('color', x.value)} label={x.label} n={x.count}
        dot={swatch(x.label)} />)}
    </Group>}
    {f.fabrics.length > 0 && <Group title={te ? 'ఫ్యాబ్రిక్' : 'Fabric'}>
      {f.fabrics.map((x: any) => <Check key={x.value} on={list('fabric').includes(x.value)} onChange={() => toggle('fabric', x.value)} label={x.label} n={x.count} />)}
    </Group>}
    {f.occasions.length > 0 && <Group title={te ? 'సందర్భం' : 'Occasion'}>
      {f.occasions.map((x: any) => <Check key={x.value} on={list('occasion').includes(x.value)} onChange={() => toggle('occasion', x.value)} label={x.label} n={x.count} />)}
    </Group>}
  </div>

  return <div className="collection">
    {c.bannerUrl
      ? <div className="banner" style={{ backgroundImage: `url("${c.bannerUrl}")` }}><div className="wrap"><h1>{title}</h1></div></div>
      : null}
    <div className="wrap">
      <nav className="crumbs"><Link to="/">{te ? 'హోమ్' : 'Home'}</Link> / {slug !== 'all' && <><Link to="/collections">{te ? 'కలెక్షన్లు' : 'Collections'}</Link> / </>}<span>{title}</span></nav>
      {!c.bannerUrl && <h1 className="ctitle">{title}</h1>}
      {c.description && <p className="cdesc">{c.description}</p>}

      <div className="toolbar">
        <button className="fbtn" onClick={() => setDrawer(true)}>☰ {te ? 'ఫిల్టర్' : 'Filter'}{chips.length > 0 && <span className="badge">{chips.length}</span>}</button>
        <span className="muted count">{total} {te ? 'ఉత్పత్తులు' : total === 1 ? 'product' : 'products'}</span>
        <span className="spacer" />
        <div className="density" aria-label={te ? 'గ్రిడ్' : 'Grid'}>
          {[2, 3, 4].map(n => <button key={n} className={cols === n ? 'on' : ''} data-n={n} onClick={() => setCols_(n)} title={`${n}`}>{Array.from({ length: n }, (_, i) => <i key={i} />)}</button>)}
        </div>
        <label className="sort"><span>{te ? 'క్రమం' : 'Sort by'}</span>
          <select value={data.sort} onChange={e => set({ sort: e.target.value === 'featured' ? null : e.target.value })}>
            {SORTS.map(([v, en, tl]) => <option key={v} value={v}>{te ? tl : en}</option>)}
          </select></label>
      </div>

      {chips.length > 0 && <div className="chips">
        {chips.map(([label, k, off]) => <button key={k} onClick={off}>{label} ✕</button>)}
        <button className="clear" onClick={clearAll}>{te ? 'అన్నీ తీసివేయండి' : 'Clear all'}</button>
      </div>}

      <div className="clayout">
        <aside className="side">{filters}</aside>
        <div style={{ minWidth: 0 }}>
          <div className={`grid cols-${cols}`} style={{ opacity: busy && page === 1 ? .5 : 1 }}>
            {items.map(p => <ProductCard key={p.id} p={p} te={te} />)}
          </div>
          {total === 0 && <div className="empty">
            <p className="muted">{chips.length ? (te ? 'ఈ ఫిల్టర్లకు ఏమీ దొరకలేదు' : 'No products match these filters') : (te ? 'త్వరలో కొత్త కలెక్షన్' : 'New collection coming soon')}</p>
            {chips.length > 0 && <button className="btn ghost" onClick={clearAll}>{te ? 'ఫిల్టర్లు తీసివేయండి' : 'Clear filters'}</button>}
          </div>}
          {shown < total && <div className="more">
            <p className="muted">{te ? `${total} లో ${shown} చూపుతున్నాం` : `Showing ${shown} of ${total}`}</p>
            <div className="bar"><i style={{ width: `${(shown / total) * 100}%` }} /></div>
            <button className="btn ghost" disabled={busy} onClick={() => { const n = page + 1; setPage(n); load(n, true) }}>{busy ? '…' : te ? 'మరిన్ని చూపించు' : 'Load more'}</button>
          </div>}
        </div>
      </div>
    </div>

    {drawer && <div className="drawer" onClick={() => setDrawer(false)}>
      <div className="panel" onClick={e => e.stopPropagation()}>
        <div className="dh"><b>{te ? 'ఫిల్టర్' : 'Filter'}</b><button onClick={() => setDrawer(false)} aria-label="Close">✕</button></div>
        <div className="db">{filters}</div>
        <div className="df">
          <button className="btn ghost" onClick={clearAll}>{te ? 'తీసివేయండి' : 'Clear'}</button>
          <button className="btn" onClick={() => setDrawer(false)}>{te ? `${total} చూడండి` : `View ${total}`}</button>
        </div>
      </div>
    </div>}
  </div>
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return <details className="fgroup" open><summary>{title}</summary><div className="fbody">{children}</div></details>
}

function Check({ on, onChange, label, n, dot }: { on: boolean; onChange: () => void; label: string; n: number; dot?: string }) {
  return <label className={'check' + (n === 0 && !on ? ' dim' : '')}>
    <input type="checkbox" checked={on} onChange={onChange} disabled={n === 0 && !on} />
    {dot && <i className="dot" style={{ background: dot }} />}
    <span>{label}</span><span className="n">({n})</span>
  </label>
}

function PriceRange({ min, max, lo, hi, te, onApply }: { min: number; max: number; lo: string | null; hi: string | null; te: boolean; onApply: (lo: string | null, hi: string | null) => void }) {
  const [a, setA] = useState(lo ?? ''); const [b, setB] = useState(hi ?? '')
  const apply = () => onApply(a && +a > min ? String(+a) : null, b && +b < max ? String(+b) : null)
  return <div>
    <p className="muted" style={{ fontSize: 13 }}>{te ? 'అత్యధిక ధర' : 'The highest price is'} {inr(max)}</p>
    <div className="prange">
      <label>₹<input inputMode="numeric" placeholder={String(Math.floor(min))} value={a} onChange={e => setA(e.target.value.replace(/\D/g, ''))} onBlur={apply} onKeyDown={e => e.key === 'Enter' && apply()} /></label>
      <span>–</span>
      <label>₹<input inputMode="numeric" placeholder={String(Math.ceil(max))} value={b} onChange={e => setB(e.target.value.replace(/\D/g, ''))} onBlur={apply} onKeyDown={e => e.key === 'Enter' && apply()} /></label>
    </div>
  </div>
}
