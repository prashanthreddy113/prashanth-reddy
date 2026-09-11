import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { useCompany } from '../lib/company'
import { IconHome, IconLeads, IconPlus, IconBell, IconMore, IconUsers, IconBox, IconSettings, IconLogout } from './Icons'

const TITLES = [
  ['/leads/new', ['New lead', 'Capture a shop visit']],
  ['/leads/', ['Lead', 'Shop details and follow-ups']],
  ['/leads', ['Leads', 'Every shop your team has visited']],
  ['/followups', ['Follow-ups', 'Who to call or visit next']],
  ['/projects', ['Projects & products', 'What the team is marketing']],
  ['/users', ['Marketing team', 'Executives and their projects']],
  ['/settings', ['Settings', 'Company profile and your account']],
  ['/', ['Dashboard', 'How marketing is going']],
]

export function CompanyLogo({ size = 36 }) {
  const { logoUrl, initials } = useCompany()
  return logoUrl
    ? <img src={logoUrl} alt="" className="company-logo" style={{ width: size, height: size }} />
    : <div className="company-logo initials" style={{ width: size, height: size, fontSize: size * 0.4 }}>{initials}</div>
}

export default function Layout() {
  const { user, logout, isAdmin } = useAuth()
  const company = useCompany()
  const location = useLocation()
  const navigate = useNavigate()
  const [more, setMore] = useState(false)

  useEffect(() => { setMore(false); window.scrollTo(0, 0) }, [location.pathname])

  const [title, subtitle] = (TITLES.find(([p]) => p === '/' ? location.pathname === '/' : location.pathname.startsWith(p)) || TITLES.at(-1))[1]
  const isDetail = /^\/leads\/\d+/.test(location.pathname)

  const primary = [
    { to: '/', label: 'Home', icon: IconHome, end: true },
    { to: '/leads', label: 'Leads', icon: IconLeads },
    { to: '/followups', label: 'Follow-ups', icon: IconBell },
  ]
  const adminNav = isAdmin ? [
    { to: '/projects', label: 'Projects', icon: IconBox },
    { to: '/users', label: 'Team', icon: IconUsers },
  ] : []
  const tail = [{ to: '/settings', label: 'Settings', icon: IconSettings }]

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <CompanyLogo size={40} />
          <div>
            <div className="name">{company.companyName}</div>
            <div className="sub">{company.tagline || 'Field marketing'}</div>
          </div>
        </div>
        <Link to="/leads/new" className="btn accent block new-lead"><IconPlus /> New lead</Link>
        <nav>
          {[...primary, ...adminNav, ...tail].map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => (isActive ? 'active' : '')}><Icon /> {label}</NavLink>
          ))}
        </nav>
        <div className="spacer" />
        <div className="user">
          <div className="who">
            {user?.displayName || user?.username}
            <small>{isAdmin ? 'Admin' : 'Marketing executive'}</small>
          </div>
          <button onClick={logout} aria-label="Sign out" title="Sign out"><IconLogout /></button>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          {isDetail && <button className="icon-btn back" onClick={() => navigate(-1)} aria-label="Back">‹</button>}
          <div className="mobile-brand"><CompanyLogo size={30} /></div>
          <div className="title">
            <h1>{title}</h1>
            {subtitle && <small>{subtitle}</small>}
          </div>
          {!location.pathname.startsWith('/leads/new') && <Link to="/leads/new" className="btn accent topbar-new"><IconPlus /> New lead</Link>}
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>

      <nav className="bottom-nav">
        {primary.slice(0, 2).map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => (isActive ? 'active' : '')}><Icon /><span>{label}</span></NavLink>
        ))}
        <NavLink to="/leads/new" className="add" aria-label="New lead"><span className="add-btn"><IconPlus width={24} height={24} /></span><span>Add</span></NavLink>
        <NavLink to="/followups" className={({ isActive }) => (isActive ? 'active' : '')}><IconBell /><span>Follow-ups</span></NavLink>
        <button type="button" className={more ? 'active' : ''} onClick={() => setMore(true)}><IconMore /><span>More</span></button>
      </nav>

      {more && (
        <div className="sheet-backdrop" onClick={() => setMore(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-user">
              <CompanyLogo size={40} />
              <div><strong>{user?.displayName}</strong><small>{isAdmin ? 'Admin' : 'Marketing executive'} · {company.companyName}</small></div>
            </div>
            {[...adminNav, ...tail].map(({ to, label, icon: Icon }) => (
              <Link key={to} to={to} className="sheet-item"><Icon /> {label}</Link>
            ))}
            <button className="sheet-item" onClick={logout}><IconLogout /> Sign out</button>
          </div>
        </div>
      )}
    </div>
  )
}
