import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate, NavLink, useLocation } from 'react-router-dom'
import { I18nProvider, useT } from './i18n'
import { session } from './api'
import Login from './pages/Login'
import Onboarding from './pages/Onboarding'
import Home from './pages/Home'
import Products from './pages/Products'
import ProductEdit from './pages/ProductEdit'
import Orders from './pages/Orders'
import Settings from './pages/Settings'
import './styles.css'

function TabBar() {
  const { t } = useT()
  const tabs = [['/', '🏠', 'home'], ['/products', '🧵', 'products'], ['/orders', '📦', 'orders'], ['/settings', '⚙️', 'settings']] as const
  return <nav className="tabbar">{tabs.map(([to, icon, k]) =>
    <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => isActive ? 'active' : ''}><span>{icon}</span>{t(k)}</NavLink>)}</nav>
}

function Private({ children }: { children: React.ReactElement }) {
  const loc = useLocation()
  if (!session.token) return <Navigate to="/login" state={{ from: loc }} replace />
  return <>{children}<TabBar /></>
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <I18nProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/onboarding" element={<Private><Onboarding /></Private>} />
          <Route path="/" element={<Private><Home /></Private>} />
          <Route path="/products" element={<Private><Products /></Private>} />
          <Route path="/products/new" element={<Private><ProductEdit /></Private>} />
          <Route path="/products/:id" element={<Private><ProductEdit /></Private>} />
          <Route path="/orders" element={<Private><Orders /></Private>} />
          <Route path="/settings" element={<Private><Settings /></Private>} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </BrowserRouter>
    </I18nProvider>
  </React.StrictMode>
)
