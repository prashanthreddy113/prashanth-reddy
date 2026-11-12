import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../lib/store'
import { bookingTotals } from '../lib/pricing'
import { Badge, Field, Progress, Stat, Tabs } from '../components/ui'
import { fmtDate, fmtDateTime, inr, inrShort, num, todayISO } from '../lib/format'
import { printReceipt, printAllotment } from '../admin/printables'

export default function Portal() {
  const { bookings, customers } = useStore()
  const [id, setId] = useState(() => sessionStorage.getItem('srm-portal') || '')
  const [f, setF] = useState({ code: '', phone: '' })
  const [err, setErr] = useState('')
  const booking = bookings.find((b) => b.id === id)
  const demo = bookings.find((b) => b.status === 'Active' && b.plan === 'clp')
  const demoCust = demo && customers.find((c) => c.id === demo.customerId)

  const login = (e) => {
    e.preventDefault()
    const b = bookings.find((x) => x.code.toLowerCase() === f.code.trim().toLowerCase())
    const c = b && customers.find((x) => x.id === b.customerId)
    if (!b || !c || c.phone.slice(-10) !== f.phone.replace(/\D/g, '').slice(-10)) return setErr('Booking ID and mobile number do not match our records.')
    sessionStorage.setItem('srm-portal', b.id)
    setId(b.id)
  }
  if (!booking)
    return (
      <>
        <section className="page-hero"><div className="wrap"><span className="eyebrow light">Customer portal</span><h1>Your home, at your fingertips</h1><p className="lead">Payment schedule, receipts, construction updates and service requests — 24×7.</p></div></section>
        <section className="wrap section">
          <form className="card pad login-card" onSubmit={login}>
            <h2>Sign in</h2>
            <Field label="Booking ID"><input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} placeholder="SRM-BK-1001" /></Field>
            <Field label="Registered mobile"><input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} inputMode="tel" /></Field>
            {err && <p className="err">{err}</p>}
            <button className="btn btn-primary">Sign in</button>
            {demo && <p className="small muted">Demo: <button type="button" className="link" onClick={() => setF({ code: demo.code, phone: demoCust.phone })}>use {demo.code} / {demoCust.phone}</button></p>}
          </form>
        </section>
      </>
    )
  return <PortalHome booking={booking} onLogout={() => { sessionStorage.removeItem('srm-portal'); setId('') }} />
}

function PortalHome({ booking: b, onLogout }) {
  const store = useStore()
  const { units, projects, customers, payments, updates, tickets, add, toast, settings } = store
  const u = units.find((x) => x.id === b.unitId)
  const p = projects.find((x) => x.id === b.projectId)
  const c = customers.find((x) => x.id === b.customerId)
  const t = bookingTotals(b, payments)
  const [tab, setTab] = useState('overview')
  const myPays = payments.filter((x) => x.bookingId === b.id).sort((a, z) => z.date.localeCompare(a.date))
  const myTickets = tickets.filter((x) => x.bookingId === b.id)
  const [tk, setTk] = useState({ category: 'Payment', subject: '', description: '' })
  const raise = (e) => {
    e.preventDefault()
    if (!tk.subject) return toast('Please add a subject', 'err')
    const next = Math.max(2000, ...tickets.map((x) => Number(x.code.split('-')[1]) || 0)) + 1
    add('tickets', { ...tk, code: `TKT-${next}`, bookingId: b.id, status: 'Open', createdAt: new Date().toISOString(), replies: [] })
    setTk({ category: 'Payment', subject: '', description: '' })
    toast('Request raised. Our CRM team will respond within 24 hours.')
  }
  return (
    <section className="wrap section portal">
      <div className="portal-head" style={{ '--c1': p.palette[0], '--c2': p.palette[1] }}>
        <div>
          <small>Welcome back</small>
          <h1>{c.name}</h1>
          <p>{p.name} · Unit <b>{u.no}</b> · {u.config} · {num(u.area)} {p.areaUnit} · Booking {b.code}</p>
        </div>
        <button className="btn btn-glass" onClick={onLogout}>Sign out</button>
      </div>
      <div className="grid-4 mt">
        <Stat label="Total payable" value={inrShort(b.payable)} tone="violet" icon="🏠" />
        <Stat label="Paid so far" value={inrShort(t.paid)} sub={`${Math.round((t.paid / b.payable) * 100)}%`} tone="green" icon="✅" />
        <Stat label="Balance" value={inrShort(t.balance)} tone="amber" icon="⏳" />
        <Stat label="Next due" value={t.nextDue ? inrShort(t.nextDue.balance) : '—'} sub={t.nextDue ? `${t.nextDue.name} · ${fmtDate(t.nextDue.dueDate)}` : 'All clear'} tone={t.overdue ? 'red' : 'cyan'} icon="📅" />
      </div>
      <Tabs value={tab} onChange={setTab} tabs={[['overview', 'Schedule'], ['payments', 'Receipts'], ['progress', 'Construction'], ['docs', 'Documents'], ['help', 'Service requests']]} />
      <div className="card pad">
        {tab === 'overview' && (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Milestone</th><th>%</th><th>Amount</th><th>Paid</th><th>Due date</th><th>Status</th></tr></thead>
              <tbody>{t.schedule.map((m) => (
                <tr key={m.index}><td>{m.name}</td><td>{m.pct}%</td><td>{inr(m.amount)}</td><td>{inr(m.paid)}</td><td>{fmtDate(m.dueDate)}</td><td><Badge>{m.status}</Badge></td></tr>
              ))}</tbody>
            </table>
            <p className="small muted mt">Pay by NEFT/RTGS to "SRM Developers – {p.name} Collection A/c" quoting {b.code}. {b.loan ? `Home loan: ${b.loan.bank} · ${inrShort(b.loan.amount)} · ${b.loan.status}.` : ''}</p>
          </div>
        )}
        {tab === 'payments' && (
          <table className="table">
            <thead><tr><th>Date</th><th>Amount</th><th>Mode</th><th>Reference</th><th /></tr></thead>
            <tbody>{myPays.map((x) => (
              <tr key={x.id}><td>{fmtDate(x.date)}</td><td>{inr(x.amount)}</td><td>{x.mode}</td><td>{x.ref}</td><td><button className="btn btn-sm btn-ghost" onClick={() => printReceipt(x, store)}>Receipt</button></td></tr>
            ))}</tbody>
          </table>
        )}
        {tab === 'progress' && (
          <div>
            <h3>{p.name} — {p.progress}% complete</h3>
            <Progress value={p.progress} palette={p.palette} />
            <div className="timeline mt">
              {updates.filter((x) => x.projectId === p.id).sort((a, z) => z.date.localeCompare(a.date)).map((x) => (
                <div key={x.id} className="tl-item"><span className="tl-dot" /><small>{fmtDate(x.date)}</small><h4>{x.title}</h4><p>{x.text}</p></div>
              ))}
            </div>
          </div>
        )}
        {tab === 'docs' && (
          <div className="docs">
            <button className="doc" onClick={() => printAllotment(b, store)}>📄<b>Allotment letter & cost sheet</b><small>Download / print</small></button>
            {myPays.slice(0, 1).map((x) => <button key={x.id} className="doc" onClick={() => printReceipt(x, store)}>🧾<b>Latest payment receipt</b><small>{fmtDate(x.date)}</small></button>)}
            <div className="doc muted">📑<b>Agreement of sale</b><small>Available after execution</small></div>
            <div className="doc muted">🏛️<b>RERA certificate</b><small>{p.rera}</small></div>
            <div className="doc muted">🏦<b>Bank NOC / tripartite</b><small>{b.loan ? 'Request via service desk' : 'Not applicable'}</small></div>
            <div className="doc muted">🔑<b>Possession letter</b><small>{p.status === 'Ready to Move' ? 'Request via service desk' : `Expected ${p.possession}`}</small></div>
          </div>
        )}
        {tab === 'help' && (
          <div className="help-grid">
            <form className="form-grid" onSubmit={raise}>
              <h3 className="span-2">Raise a request</h3>
              <Field label="Category"><select value={tk.category} onChange={(e) => setTk({ ...tk, category: e.target.value })}>{['Payment', 'Documentation', 'Construction', 'Customization', 'Loan', 'Handover', 'Other'].map((x) => <option key={x}>{x}</option>)}</select></Field>
              <Field label="Subject"><input value={tk.subject} onChange={(e) => setTk({ ...tk, subject: e.target.value })} /></Field>
              <Field label="Details" span={2}><textarea rows={3} value={tk.description} onChange={(e) => setTk({ ...tk, description: e.target.value })} /></Field>
              <button className="btn btn-primary span-2">Submit</button>
            </form>
            <div>
              <h3>Your requests</h3>
              {myTickets.length === 0 && <p className="muted">No requests yet.</p>}
              {myTickets.map((x) => (
                <div key={x.id} className="ticket">
                  <div className="row-between"><b>{x.code} · {x.subject}</b><Badge>{x.status}</Badge></div>
                  <small className="muted">{x.category} · {fmtDateTime(x.createdAt)}</small>
                  {x.replies.map((r, i) => <p key={i} className="reply"><b>{r.by}:</b> {r.text}</p>)}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <p className="small muted mt">Need help? Call {settings.company.phone} · <Link to="/contact">Contact us</Link> · Today {fmtDate(todayISO())}</p>
    </section>
  )
}
