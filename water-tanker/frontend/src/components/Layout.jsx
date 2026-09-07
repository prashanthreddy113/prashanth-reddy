import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { IconHome, IconDrop, IconTruck, IconCalendar, IconInvoice, IconAlert, IconBuilding, IconUsers, IconSettings, IconMenu } from './Icons'

const NAV = [
  { to: '/', label: 'Dashboard', icon: IconHome, roles: ['Admin', 'Operator', 'Rwa'], title: 'Dashboard' },
  { to: '/deliveries', label: 'Deliveries', icon: IconDrop, roles: ['Admin', 'Operator', 'Rwa'], title: 'Deliveries', sub: 'Every metered load with litres, quality, location and seal photo' },
  { to: '/bookings', label: 'Bookings', icon: IconCalendar, roles: ['Admin', 'Operator', 'Rwa'], title: 'Bookings', sub: 'Tanker requests and dispatch' },
  { to: '/invoices', label: 'Invoices', icon: IconInvoice, roles: ['Admin', 'Operator', 'Rwa'], title: 'Invoices', sub: 'Monthly statements built from verified deliveries' },
  { to: '/disputes', label: 'Disputes', icon: IconAlert, roles: ['Admin', 'Operator', 'Rwa'], title: 'Disputes', sub: 'Short loads, wrong site, quality complaints' },
  { to: '/fleet', label: 'Fleet & devices', icon: IconTruck, roles: ['Admin', 'Operator'], title: 'Fleet & devices', sub: 'Tankers and the sealed meters fitted to them' },
  { to: '/communities', label: 'Communities', icon: IconBuilding, roles: ['Admin', 'Operator', 'Rwa'], title: 'Communities', sub: 'Gated communities, geofences and rates' },
  { to: '/admin', label: 'Operators & users', icon: IconUsers, roles: ['Admin', 'Operator'], title: 'Operators & users' },
  { to: '/settings', label: 'Settings', icon: IconSettings, roles: ['Admin', 'Operator', 'Rwa'], title: 'Settings' },
]

export default function Layout() {
  const { user, role, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const items = NAV.filter((n) => n.roles.includes(role))
  const current = [...NAV].sort((a, b) => b.to.length - a.to.length).find((n) => n.to === '/' ? location.pathname === '/' : location.pathname.startsWith(n.to))
  const roleLabel = role === 'Rwa' ? 'Resident welfare association' : role === 'Operator' ? 'Tanker operator' : 'Platform admin'
  const scopeName = user?.communityName || user?.operatorName || 'AquaProof'

  return (
    <div className="app">
      <div className={`backdrop ${open ? 'open' : ''}`} onClick={() => setOpen(false)} />
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="brand">
          <div className="logo">💧</div>
          <div><div className="name">AquaProof</div><div className="sub">Verified tanker deliveries</div></div>
        </div>
        <div className="role"><b>{scopeName}</b>{roleLabel}</div>
        <nav>
          {items.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === '/'} onClick={() => setOpen(false)}><Icon />{label}</NavLink>
          ))}
        </nav>
        <div className="spacer" />
        <div className="user">
          <div className="who">{user?.displayName}<small>{user?.email}</small></div>
          <button onClick={logout}>Sign out</button>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <button className="menu-btn" onClick={() => setOpen(true)} aria-label="Menu"><IconMenu /></button>
          <div className="title"><h1>{current?.title || 'AquaProof'}</h1>{current?.sub && <small>{current.sub}</small>}</div>
        </header>
        <main className="content"><Outlet /></main>
      </div>
    </div>
  )
}
