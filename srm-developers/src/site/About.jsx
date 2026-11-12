import { Link } from 'react-router-dom'
import { LogoMark } from '../components/Logo'
import { useStore } from '../lib/store'

export default function About() {
  const { settings } = useStore()
  return (
    <>
      <section className="page-hero alt"><div className="wrap"><span className="eyebrow light">About us</span><h1>Building Narsingi's skyline, one landmark at a time</h1></div></section>
      <section className="wrap section about-grid">
        <div>
          <h2>Who we are</h2>
          <p className="prose">SRM Developers is a Hyderabad real-estate developer focused on the Narsingi – Kokapet – Financial District growth corridor. We build gated residential communities, garden villas and plotted developments, and Grade-A commercial offices and high-street retail.</p>
          <p className="prose">Our promise is simple: clear titles, transparent pricing, quality construction and on-time delivery — backed by a CRM team that stays with you long after the keys are handed over.</p>
          <div className="values">
            {[['🎯', 'Mission', 'Create homes and workplaces that appreciate in value and in quality of life.'], ['🔭', 'Vision', 'Be West Hyderabad\'s most trusted name in real estate.'], ['💜', 'Values', 'Integrity, transparency, craftsmanship and customer-first service.']].map(([i, t, d]) => (
              <div key={t} className="perk"><span>{i}</span><h3>{t}</h3><p>{d}</p></div>
            ))}
          </div>
        </div>
        <div className="about-logo card pad">
          <LogoMark size={140} />
          <h3>Our logo</h3>
          <p className="small muted">A home-shaped emblem holding three rising towers — S, R and M — under the Narsingi sun. The violet-to-amber gradient stands for growth from dawn to dusk.</p>
        </div>
      </section>
      <section className="wrap section" id="nri">
        <div className="lease-band">
          <div><span className="eyebrow light">NRI desk</span><h2>Invest from anywhere in the world</h2><p>Live video site tours, digital documentation, NRE/NRO payment guidance, Power-of-Attorney registration and property management after handover.</p></div>
          <ul>
            <li><b>Video walkthrough</b><span>Any time zone, any day</span></li>
            <li><b>NRI home loans</b><span>Tie-ups with SBI, HDFC & ICICI</span></li>
            <li><b>Leasing & rentals</b><span>We find tenants and collect rent</span></li>
            <li><b>Contact</b><span>{settings.company.email}</span></li>
          </ul>
        </div>
      </section>
      <section className="wrap section">
        <h2>Leadership team</h2>
        <div className="grid-4 mt">
          {settings.team.map((t, i) => (
            <div key={t.id} className="team-card"><span className="avatar" style={{ '--h': i * 60 }}>{t.name.split(' ').map((x) => x[0]).join('')}</span><b>{t.name}</b><small>{t.role}</small></div>
          ))}
        </div>
        <p className="mt"><Link className="btn btn-primary" to="/contact">Get in touch</Link></p>
      </section>
    </>
  )
}
