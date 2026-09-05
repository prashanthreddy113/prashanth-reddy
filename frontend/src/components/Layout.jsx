import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { api } from '../lib/api'
import { setCurrency } from '../lib/format'
import { useBranch } from '../lib/branch'
import { IconDashboard, IconUsers, IconSeat, IconSettings, IconMenu, IconWhatsapp, IconMoney } from './Icons'

const NAV = [
  { to: '/', label: 'Dashboard', icon: IconDashboard, end: true },
  { to: '/students', label: 'Students', icon: IconUsers },
  { to: '/seats', label: 'Seats', icon: IconSeat },
  { to: '/reminders', label: 'Reminders', icon: IconWhatsapp },
  { to: '/expenses', label: 'Expenses', icon: IconMoney },
  { to: '/settings', label: 'Settings', icon: IconSettings },
]

const TITLES = {
  '/': ['Dashboard', 'Overview of students, dues and seats'],
  '/students': ['Students', 'Register, edit and manage members'],
  '/seats': ['Seats', 'Configure capacity and see who sits where'],
  '/reminders': ['WhatsApp reminders', 'Automatic due-date messages and history'],
  '/expenses': ['Expenses & revenue', 'Rent, bills and salaries against collections'],
  '/settings': ['Settings', 'Room preferences and your account'],
}

export default function Layout() {
  const { user, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const [roomName, setRoomName] = useState('BrightLoop Reading Room')
  const location = useLocation()
  useBranch()

  useEffect(() => { setOpen(false) }, [location.pathname])

  useEffect(() => {
    api.settings().then((s) => { setRoomName(s.roomName); setCurrency(s.currency); document.title = `${s.roomName} · Admin` }).catch(() => {})
  }, [])

  const key = location.pathname.startsWith('/students/') ? '/students' : location.pathname
  const [title, subtitle] = TITLES[key] || ['BrightLoop Reading Room', '']

  return (
    <div className="app">
      <div className={`backdrop ${open ? 'open' : ''}`} onClick={() => setOpen(false)} />
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="brand">
          <div className="logo">📖</div>
          <div>
            <div className="name">{roomName}</div>
            <div className="sub">Admin console</div>
          </div>
        </div>
        <nav>
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => (isActive ? 'active' : '')}>
              <Icon /> {label}
            </NavLink>
          ))}
        </nav>
        <div className="spacer" />
        <div className="user">
          <div className="who">
            {user?.displayName || user?.username}
            <small>@{user?.username}</small>
          </div>
          <button onClick={logout}>Sign out</button>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <button className="menu-btn" onClick={() => setOpen(true)} aria-label="Open menu"><IconMenu width={20} height={20} /></button>
          <div className="title">
            <h1>{title}</h1>
            {subtitle && <small>{subtitle}</small>}
          </div>

        </header>
        <main className="content">
          <Outlet context={{ roomName, setRoomName }} />
        </main>
      </div>
    </div>
  )
}
