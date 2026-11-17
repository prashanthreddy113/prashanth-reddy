import { Link, Route, Routes } from 'react-router-dom'
import SiteLayout from './site/SiteLayout'
import Home from './site/Home'
import Segment from './site/Segment'
import Projects from './site/Projects'
import ProjectDetail from './site/ProjectDetail'
import Properties from './site/Properties'
import Resale from './site/Resale'
import Tools from './site/Tools'
import Compare from './site/Compare'
import About from './site/About'
import Contact from './site/Contact'
import Partners from './site/Partners'
import Portal from './site/Portal'
import AdminLayout from './admin/AdminLayout'
import Dashboard from './admin/Dashboard'
import Leads from './admin/Leads'
import Visits from './admin/Visits'
import Bookings, { BookingDetail } from './admin/Bookings'
import Inventory from './admin/Inventory'
import ProjectsAdmin from './admin/ProjectsAdmin'
import Collections from './admin/Collections'
import Leasing from './admin/Leasing'
import { Customers, Listings, PartnersAdmin, Tickets } from './admin/Network'
import Settings from './admin/Settings'

export default function App() {
  return (
    <Routes>
      <Route element={<SiteLayout />}>
        <Route index element={<Home />} />
        <Route path="residential" element={<Segment category="Residential" />} />
        <Route path="commercial" element={<Segment category="Commercial" />} />
        <Route path="projects" element={<Projects />} />
        <Route path="projects/:slug" element={<ProjectDetail />} />
        <Route path="properties" element={<Properties />} />
        <Route path="resale" element={<Resale />} />
        <Route path="tools" element={<Tools />} />
        <Route path="compare" element={<Compare />} />
        <Route path="about" element={<About />} />
        <Route path="contact" element={<Contact />} />
        <Route path="partners" element={<Partners />} />
        <Route path="portal" element={<Portal />} />
        <Route path="*" element={<div className="wrap section center"><h1>Page not found</h1><p className="mt"><Link className="btn btn-primary" to="/">Go home</Link></p></div>} />
      </Route>
      <Route path="admin" element={<AdminLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="leads" element={<Leads />} />
        <Route path="visits" element={<Visits />} />
        <Route path="bookings" element={<Bookings />} />
        <Route path="bookings/:id" element={<BookingDetail />} />
        <Route path="customers" element={<Customers />} />
        <Route path="projects" element={<ProjectsAdmin />} />
        <Route path="inventory" element={<Inventory />} />
        <Route path="collections" element={<Collections />} />
        <Route path="leasing" element={<Leasing />} />
        <Route path="partners" element={<PartnersAdmin />} />
        <Route path="listings" element={<Listings />} />
        <Route path="tickets" element={<Tickets />} />
        <Route path="settings" element={<Settings />} />
      </Route>
    </Routes>
  )
}
