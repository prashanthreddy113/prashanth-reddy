import { useStore } from '../lib/store'
import { EnquiryForm } from '../components/forms'
import { NarsingiMap } from './Home'
import { waLink } from '../lib/format'

export default function Contact() {
  const { settings } = useStore()
  const c = settings.company
  return (
    <>
      <section className="page-hero"><div className="wrap"><span className="eyebrow light">Contact</span><h1>Visit our Experience Centre</h1><p className="lead">See model apartments, material samples and live project walkthroughs.</p></div></section>
      <section className="wrap section contact-grid">
        <div className="card pad">
          <h2>Send us a message</h2>
          <EnquiryForm subject="Contact page" purposeOptions={['Buy a home', 'Buy commercial space', 'Lease a space', 'Channel partner', 'Customer support', 'Careers']} cta="Send message" />
        </div>
        <div className="contact-side">
          <div className="card pad">
            <h3>SRM Experience Centre</h3>
            <p>{c.address}</p>
            <p>🕘 {c.hours}</p>
            <div className="row gap wrap-row mt">
              <a className="btn btn-primary btn-sm" href={`tel:${c.phone.replace(/\s/g, '')}`}>📞 {c.phone}</a>
              <a className="btn btn-ghost btn-sm" href={waLink(c.whatsapp, 'Hi SRM Developers!')} target="_blank" rel="noreferrer">WhatsApp</a>
              <a className="btn btn-ghost btn-sm" href={`mailto:${c.email}`}>Email</a>
            </div>
          </div>
          <div className="card pad"><NarsingiMap /><a className="btn btn-ghost btn-sm mt" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/search/${encodeURIComponent('Narsingi, Hyderabad')}`}>Directions ↗</a></div>
        </div>
      </section>
    </>
  )
}
