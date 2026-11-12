import { useState } from 'react'
import { useStore } from '../lib/store'
import { Field } from '../components/ui'
import { todayISO } from '../lib/format'

export default function Partners() {
  const { add, toast } = useStore()
  const [f, setF] = useState({ firm: '', name: '', phone: '', email: '', rera: '' })
  const [done, setDone] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const submit = (e) => {
    e.preventDefault()
    if (!f.firm || !f.name || !/\d{10}/.test(f.phone.replace(/\D/g, ''))) return toast('Firm, name and mobile are required', 'err')
    add('partners', { ...f, commissionPct: 2, status: 'Pending', createdAt: todayISO() })
    setDone(true)
  }
  return (
    <>
      <section className="page-hero alt"><div className="wrap"><span className="eyebrow light">Channel partners</span><h1>Grow with SRM Developers</h1><p className="lead">Industry-leading brokerage, fast payouts and a dedicated partner manager.</p></div></section>
      <section className="wrap section post-card card pad">
        <div>
          <h2>Partner benefits</h2>
          <ul className="ticks">
            <li>Up to 2.5% brokerage on residential & commercial sales</li>
            <li>Commission paid within 30 days of agreement</li>
            <li>Lead protection for 90 days on registered clients</li>
            <li>Marketing collateral, site-visit cabs and training</li>
            <li>Lease commission: one month's rent on commercial leases</li>
          </ul>
        </div>
        {done ? (
          <div className="sent"><div className="sent-icon">🤝</div><h3>Registration received</h3><p>Our partner manager will verify your RERA agent number and activate your account within 2 working days.</p></div>
        ) : (
          <form className="form-grid" onSubmit={submit}>
            <Field label="Firm name"><input value={f.firm} onChange={set('firm')} /></Field>
            <Field label="Contact person"><input value={f.name} onChange={set('name')} /></Field>
            <Field label="Mobile"><input value={f.phone} onChange={set('phone')} inputMode="tel" /></Field>
            <Field label="Email"><input type="email" value={f.email} onChange={set('email')} /></Field>
            <Field label="TS RERA agent no." span={2}><input value={f.rera} onChange={set('rera')} placeholder="A02400…" /></Field>
            <button className="btn btn-primary span-2">Register as partner</button>
          </form>
        )}
      </section>
    </>
  )
}
