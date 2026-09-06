import React, { createContext, useContext, useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import { api, cart } from './api'
import Home from './pages/Home'
import Product from './pages/Product'
import Checkout from './pages/Checkout'
import './styles.css'

export const StoreCtx = createContext<any>(null)
export const useStore = () => useContext(StoreCtx)

function Shell() {
  const [store, setStore] = useState<any>(null); const [closed, setClosed] = useState<string | null>(null)
  const [n, setN] = useState(0)
  useEffect(() => {
    api('/api/store').then(s => { setStore(s); document.title = s.name; document.documentElement.style.setProperty('--brand', s.themeColor) })
      .catch(e => setClosed(e.status === 503 ? e.data?.name || 'This shop' : '404'))
    const upd = () => setN(cart.get().reduce((a, l) => a + l.qty, 0)); upd(); window.addEventListener('cart', upd); return () => window.removeEventListener('cart', upd)
  }, [])
  if (closed === '404') return <div className="closed"><h2>Shop not found</h2></div>
  if (closed) return <div className="closed"><h2>{closed} is temporarily closed</h2><p className="muted">Please check back soon.</p></div>
  if (!store) return null
  return <StoreCtx.Provider value={store}>
    <header><div className="wrap">
      <Link to="/" className="logo">{store.logoUrl && <img src={store.logoUrl} alt="" />}{store.name}</Link>
      <Link to="/checkout" style={{ fontWeight: 700 }}>🛍 {n > 0 && <span className="badge">{n}</span>}</Link>
    </div></header>
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/p/:slug" element={<Product />} />
      <Route path="/checkout" element={<Checkout />} />
    </Routes>
    <footer className="wrap muted" style={{ padding: '30px 14px', textAlign: 'center' }}>
      {store.address && <div>{store.address}</div>}
      <a href={`https://wa.me/${store.whatsApp.replace('+', '')}`}>WhatsApp {store.whatsApp}</a>
      {store.instagramHandle && <> · <a href={`https://instagram.com/${store.instagramHandle.replace('@', '')}`}>Instagram</a></>}
    </footer>
  </StoreCtx.Provider>
}

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><BrowserRouter><Shell /></BrowserRouter></React.StrictMode>)
