import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import Logo from '../components/Logo'
import { VisitModal } from '../components/forms'
import { useShortlist, useStore } from '../lib/store'
import { waLink } from '../lib/format'

const NAV = [
  ['/', 'Home'], ['/residential', 'Residential'], ['/commercial', 'Commercial'], ['/projects', 'Projects'],
  ['/properties', 'Search'], ['/resale', 'Resale & Rentals'], ['/tools', 'Calculators'], ['/about', 'About'], ['/contact', 'Contact'],
]

export default function SiteLayout() {
  const { settings } = useStore()
  const c = settings.company
  const [visit, setVisit] = useState(null)
  const [menu, setMenu] = useState(false)
  const { ids } = useShortlist()
  const loc = useLocation()
  useEffect(() => { setMenu(false); window.scrollTo(0, 0) }, [loc.pathname])
  const openVisit = (projectId = '') => setVisit({ projectId })

  return (
    <div className="site">
      <div className="topbar">
        <div className="wrap row-between">
          <span>📞 <a href={`tel:${c.phone.replace(/\s/g, '')}`}>{c.phone}</a> <span className="hide-sm">· ✉️ <a href={`mailto:${c.email}`}>{c.email}</a></span></span>
          <span className="hide-sm">🕘 {c.hours}</span>
          <span><Link to="/portal">Customer login</Link> · <Link to="/partners">Channel partners</Link></span>
        </div>
      </div>
      <header className="header">
        <div className="wrap row-between">
          <Link to="/" aria-label="SRM Developers home"><Logo size={46} /></Link>
          <nav className={`nav ${menu ? 'open' : ''}`}>
            {NAV.map(([to, label]) => (
              <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => (isActive ? 'on' : '')}>{label}</NavLink>
            ))}
            <Link to="/compare" className="nav-short">♥ Shortlist{ids.length ? ` (${ids.length})` : ''}</Link>
          </nav>
          <div className="header-cta">
            <button className="btn btn-primary btn-sm" onClick={() => openVisit()}>Book site visit</button>
            <button className="burger" onClick={() => setMenu(!menu)} aria-label="Menu">☰</button>
          </div>
        </div>
      </header>

      <main><Outlet context={{ openVisit }} /></main>

      <footer className="footer">
        <div className="wrap footer-grid">
          <div>
            <Logo size={52} light />
            <p className="footer-about">{c.tagline}. Premium residential communities, villas, open plots and Grade-A commercial spaces in Narsingi — West Hyderabad's fastest-growing address.</p>
            <div className="socials">
              {['Instagram', 'Facebook', 'YouTube', 'LinkedIn'].map((s) => <a key={s} href="#" onClick={(e) => e.preventDefault()}>{s}</a>)}
            </div>
          </div>
          <div>
            <h4>Explore</h4>
            <Link to="/residential">Residential homes</Link><Link to="/commercial">Commercial spaces</Link>
            <Link to="/projects">All projects</Link><Link to="/resale">Resale & rentals</Link><Link to="/resale#post">Post your property</Link>
          </div>
          <div>
            <h4>Services</h4>
            <Link to="/tools">EMI & cost calculators</Link><Link to="/portal">Customer portal</Link>
            <Link to="/partners">Channel partner program</Link><Link to="/about#nri">NRI desk</Link><Link to="/contact">Contact us</Link>
          </div>
          <div>
            <h4>Visit us</h4>
            <p>{c.address}</p>
            <p>📞 {c.phone}<br />✉️ {c.email}</p>
          </div>
        </div>
        <div className="wrap footer-bottom">
          <span>© {new Date().getFullYear()} {c.name}. All rights reserved.</span>
          <span>Project RERA numbers are shown on each project page. Images are artistic impressions. <Link to="/admin">Staff login</Link></span>
        </div>
      </footer>

      <a className="fab fab-wa" href={waLink(c.whatsapp, 'Hi SRM Developers, I would like to know more about your projects in Narsingi.')} target="_blank" rel="noreferrer" aria-label="WhatsApp">
        <svg viewBox="0 0 24 24" width="28" height="28" fill="#fff"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.3 2.2 2.2 0 0 0 .2-1.3c-.1-.1-.3-.2-.5-.3Z"/></svg>
      </a>
      <a className="fab fab-call" href={`tel:${c.phone.replace(/\s/g, '')}`} aria-label="Call">📞</a>
      {visit && <VisitModal projectId={visit.projectId} onClose={() => setVisit(null)} />}
    </div>
  )
}
