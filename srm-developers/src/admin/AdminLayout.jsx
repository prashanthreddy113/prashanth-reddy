import { useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import Logo from '../components/Logo'
import { useAdminAuth, useStore } from '../lib/store'
import AdminLogin from './AdminLogin'
import { todayISO } from '../lib/format'

export default function AdminLayout() {
  const auth = useAdminAuth()
  const s = useStore()
  const [open, setOpen] = useState(false)
  const loc = useLocation()
  if (!auth.ok) return <AdminLogin auth={auth} />
  const today = todayISO()
  const counts = {
    leads: s.leads.filter((l) => l.stage === 'New').length,
    visits: s.visits.filter((v) => v.date === today && v.status === 'Scheduled').length,
    tickets: s.tickets.filter((t) => t.status === 'Open').length,
    listings: s.ownerListings.filter((l) => l.status === 'Pending').length + s.partners.filter((p) => p.status === 'Pending').length,
  }
  const groups = [
    ['Overview', [['/admin', '📊', 'Dashboard']]],
    ['Sales', [['/admin/leads', '🎯', 'Leads & CRM', counts.leads], ['/admin/visits', '📅', 'Site visits', counts.visits], ['/admin/bookings', '📝', 'Bookings'], ['/admin/customers', '👥', 'Customers']]],
    ['Inventory', [['/admin/projects', '🏗️', 'Projects'], ['/admin/inventory', '🏢', 'Inventory']]],
    ['Finance', [['/admin/collections', '💰', 'Collections'], ['/admin/leasing', '🔑', 'Leasing & rent']]],
    ['Network', [['/admin/partners', '🤝', 'Channel partners'], ['/admin/listings', '🏷️', 'Marketplace', counts.listings]]],
    ['Service', [['/admin/tickets', '🛠️', 'Service requests', counts.tickets], ['/admin/settings', '⚙️', 'Settings']]],
  ]
  return (
    <div className="admin">
      <aside className={`side ${open ? 'open' : ''}`}>
        <Link to="/admin" className="side-logo"><Logo size={38} light sub={false} /></Link>
        <nav onClick={() => setOpen(false)}>
          {groups.map(([g, items]) => (
            <div key={g} className="side-group">
              <span>{g}</span>
              {items.map(([to, i, l, n]) => (
                <NavLink key={to} to={to} end={to === '/admin'} className={({ isActive }) => (isActive ? 'on' : '')}>
                  <i>{i}</i>{l}{n ? <em>{n}</em> : null}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="side-foot">
          <Link to="/" target="_blank">🌐 View website</Link>
          <button onClick={auth.logout}>⎋ Sign out</button>
        </div>
      </aside>
      <div className="admin-main">
        <header className="admin-top">
          <button className="burger dark" onClick={() => setOpen(!open)} aria-label="Menu">☰</button>
          <span className="crumb">{loc.pathname.replace('/admin', 'Admin').split('/').join(' / ') || 'Admin'}</span>
          <span className="who"><span className="avatar sm">SA</span>SRM Admin</span>
        </header>
        <div className="admin-body"><Outlet /></div>
      </div>
    </div>
  )
}
