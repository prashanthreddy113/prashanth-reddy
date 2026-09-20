import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { useTown } from '../lib/town'

const NAV = [
  { to: '/', icon: '📊', label: 'Dashboard', end: true },
  { to: '/live', icon: '🗺️', label: 'Live map' },
  { to: '/areas', icon: '📍', label: 'Service areas' },
  { to: '/captains', icon: '🛺', label: 'Captains' },
  { to: '/rides', icon: '🏍️', label: 'Rides' },
  { to: '/parcels', icon: '📦', label: 'Parcels' },
  { to: '/analytics', icon: '📈', label: 'Analytics' },
  { to: '/settlements', icon: '🧾', label: 'Settlements' },
  { to: '/commission', icon: '💸', label: 'Commission' },
  { to: '/settings', icon: '⚙️', label: 'Settings', ownerOnly: true },
]

const TITLES = {
  '/': ['Dashboard', 'Today across bike, auto and parcel'],
  '/live': ['Live map', 'Online captains and trips in progress'],
  '/areas': ['Service areas', 'Where the app works: town centre, radius, fares, landmarks'],
  '/captains': ['Captains', 'Onboarding, KYC verification and status'],
  '/captains/new': ['Add captain', 'Register at the town hub in 10 minutes'],
  '/rides': ['Rides', 'Bike and auto trips'],
  '/parcels': ['Parcels', 'Shop → home, village → town, COD'],
  '/analytics': ['Analytics', 'Last 30 days'],
  '/settlements': ['Settlements', 'Weekly captain payouts'],
  '/commission': ['Commission', 'Default rule, per-service and per-town overrides'],
  '/settings': ['Settings', 'Company, commission, terms, templates, users'],
}

const ROLE_LABEL = { owner: 'Owner', town_manager: 'Town manager' }

export default function Layout() {
  const { user, logout, isOwner } = useAuth()
  const { towns, townId, setTownId, locked } = useTown()
  const [open, setOpen] = useState(false)
  const location = useLocation()

  useEffect(() => { setOpen(false) }, [location.pathname])

  const path = location.pathname
  const key = path.startsWith('/captains/') && path !== '/captains/new' ? '/captains' : path
  const [title, subtitle] = TITLES[key] || ['మన బండి', '']
  useEffect(() => { document.title = `${title} · మన బండి owner` }, [title])

  return (
    <div className="app">
      <div className={`backdrop ${open ? 'open' : ''}`} onClick={() => setOpen(false)} />
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="brand">
          <div className="logo te">మ</div>
          <div>
            <div className="name te">మన బండి</div>
            <div className="sub">Mana Bandi · Owner portal</div>
          </div>
        </div>
        <nav>
          {NAV.filter((n) => !n.ownerOnly || isOwner).map(({ to, icon, label, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => (isActive ? 'active' : '')}>
              <span className="ico" aria-hidden>{icon}</span> {label}
            </NavLink>
          ))}
        </nav>
        <div className="spacer" />
        <div className="sidebar-foot">
          <div className="tagline te">పిలిస్తే చాలు, బండి వస్తుంది</div>
          <button className="btn ghost light sm" onClick={logout}>Sign out</button>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <button className="menu-btn" onClick={() => setOpen(true)} aria-label="Open menu">☰</button>
          <div className="title">
            <h1>{title}</h1>
            {subtitle && <small>{subtitle}</small>}
          </div>
          <div className="topbar-right">
            <label className="town-select">
              <span>Town</span>
              <select value={townId} onChange={(e) => setTownId(e.target.value)} disabled={locked}>
                {!locked && <option value="all">All towns</option>}
                {towns.map((t) => <option key={t.id} value={t.id}>{t.nameEn} · <span className="te">{t.nameTe}</span></option>)}
              </select>
            </label>
            <div className="whoami">
              <div className="avatar">{(user?.name || '?').slice(0, 1)}</div>
              <div>
                <div className="who-name">{user?.name}</div>
                <div className={`role-pill role-${user?.role}`}>{ROLE_LABEL[user?.role] || user?.role}{user?.townId ? ` · ${towns.find((t) => t.id === user.townId)?.nameEn || user.townId}` : ''}</div>
              </div>
            </div>
          </div>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
