import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../lib/store'
import { Badge, Field, Modal, Stat, Tabs } from '../components/ui'
import { fmtDate, fmtDateTime, inr, inrShort, num, todayISO, waLink } from '../lib/format'
import { useBookingRows } from './hooks'

export function PartnersAdmin() {
  const s = useStore()
  const rows = useBookingRows()
  const [edit, setEdit] = useState(null)
  const stats = useMemo(() => Object.fromEntries(s.partners.map((p) => {
    const bs = rows.filter((r) => r.b.partnerId === p.id && r.b.status !== 'Cancelled')
    const earned = bs.reduce((a, r) => a + (r.b.agreementValue * p.commissionPct) / 100, 0)
    const paid = bs.filter((r) => r.b.commissionPaid).reduce((a, r) => a + (r.b.agreementValue * p.commissionPct) / 100, 0)
    return [p.id, { count: bs.length, sales: bs.reduce((a, r) => a + r.b.agreementValue, 0), earned, paid }]
  })), [s.partners, rows])
  const tot = Object.values(stats).reduce((a, x) => ({ sales: a.sales + x.sales, earned: a.earned + x.earned, paid: a.paid + x.paid, count: a.count + x.count }), { sales: 0, earned: 0, paid: 0, count: 0 })
  return (
    <div className="page">
      <div className="page-head"><div><h1>Channel partners</h1><p className="muted">Broker network, approvals and commission payouts.</p></div><button className="btn btn-primary" onClick={() => setEdit({ firm: '', name: '', phone: '', email: '', rera: '', commissionPct: 2, status: 'Approved' })}>+ Add partner</button></div>
      <div className="grid-4">
        <Stat tone="violet" icon="🤝" label="Partners" value={s.partners.length} sub={`${s.partners.filter((p) => p.status === 'Pending').length} pending approval`} />
        <Stat tone="blue" icon="📝" label="Partner bookings" value={tot.count} sub={inrShort(tot.sales)} />
        <Stat tone="green" icon="✅" label="Commission paid" value={inrShort(tot.paid)} />
        <Stat tone="amber" icon="⏳" label="Commission payable" value={inrShort(tot.earned - tot.paid)} />
      </div>
      <div className="card table-wrap mt">
        <table className="table">
          <thead><tr><th>Firm</th><th>Contact</th><th>RERA</th><th className="num">Rate</th><th className="num">Bookings</th><th className="num">Sales</th><th className="num">Payable</th><th>Status</th><th /></tr></thead>
          <tbody>{s.partners.map((p) => {
            const x = stats[p.id]
            return (
              <tr key={p.id}>
                <td><b>{p.firm}</b><br /><small className="muted">since {fmtDate(p.createdAt)}</small></td><td>{p.name}<br /><small className="muted">{p.phone}</small></td><td className="small">{p.rera}</td>
                <td className="num">{p.commissionPct}%</td><td className="num">{x.count}</td><td className="num">{inrShort(x.sales)}</td><td className="num">{inrShort(x.earned - x.paid)}</td>
                <td><Badge>{p.status}</Badge></td>
                <td className="nowrap">
                  {p.status === 'Pending' && <button className="btn btn-sm btn-primary" onClick={() => { s.update('partners', p.id, { status: 'Approved' }); s.toast(`${p.firm} approved`) }}>Approve</button>}
                  <button className="btn btn-sm btn-ghost" onClick={() => setEdit(p)}>Edit</button>
                </td>
              </tr>
            )
          })}</tbody>
        </table>
      </div>
      {edit && (
        <Modal title={edit.id ? `Edit · ${edit.firm}` : 'Add partner'} onClose={() => setEdit(null)}>
          <form className="form-grid" onSubmit={(e) => { e.preventDefault(); if (!edit.firm) return; edit.id ? s.update('partners', edit.id, { ...edit, commissionPct: Number(edit.commissionPct) }) : s.add('partners', { ...edit, commissionPct: Number(edit.commissionPct), createdAt: todayISO() }); setEdit(null) }}>
            {[['firm', 'Firm'], ['name', 'Contact person'], ['phone', 'Phone'], ['email', 'Email'], ['rera', 'RERA agent no.']].map(([k, l]) => <Field key={k} label={l}><input value={edit[k]} onChange={(e) => setEdit({ ...edit, [k]: e.target.value })} /></Field>)}
            <Field label="Commission %"><input type="number" step="0.25" value={edit.commissionPct} onChange={(e) => setEdit({ ...edit, commissionPct: e.target.value })} /></Field>
            <Field label="Status"><select value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value })}>{['Pending', 'Approved', 'Suspended'].map((x) => <option key={x}>{x}</option>)}</select></Field>
            <button className="btn btn-primary span-2">Save</button>
          </form>
        </Modal>
      )}
    </div>
  )
}

export function Listings() {
  const s = useStore()
  const [tab, setTab] = useState('Pending')
  const list = s.ownerListings.filter((l) => tab === 'All' || l.status === tab)
  return (
    <div className="page">
      <div className="page-head"><div><h1>Marketplace listings</h1><p className="muted">Owner-submitted resale, rental and lease listings. Approved listings appear on the website.</p></div></div>
      <Tabs value={tab} onChange={setTab} tabs={['Pending', 'Approved', 'Rejected', 'All']} />
      <div className="card table-wrap">
        <table className="table">
          <thead><tr><th>Listing</th><th>Type</th><th className="num">Area</th><th className="num">Price</th><th>Owner</th><th>Submitted</th><th>Status</th><th /></tr></thead>
          <tbody>
            {list.length === 0 && <tr><td colSpan={8} className="muted">No listings.</td></tr>}
            {list.map((l) => (
              <tr key={l.id}>
                <td><b>{l.title}</b><br /><small className="muted">{l.locality} · {l.description}</small></td>
                <td><Badge>{l.kind}</Badge> {l.ptype}</td><td className="num">{num(l.area)} {l.areaUnit}</td>
                <td className="num">{l.kind === 'Sell' ? inrShort(l.price) : `${inr(l.price)}/mo`}</td>
                <td>{l.ownerName}<br /><small className="muted">{l.phone}</small></td><td>{fmtDate(l.createdAt)}</td><td><Badge>{l.status}</Badge></td>
                <td className="nowrap">
                  {l.status !== 'Approved' && <button className="btn btn-sm btn-primary" onClick={() => s.update('ownerListings', l.id, { status: 'Approved' })}>Approve</button>}
                  {l.status !== 'Rejected' && <button className="btn btn-sm btn-ghost" onClick={() => s.update('ownerListings', l.id, { status: 'Rejected' })}>Reject</button>}
                  <a className="btn btn-sm btn-ghost" href={waLink(l.phone, `Hi ${l.ownerName}, this is SRM Developers regarding your listing "${l.title}".`)} target="_blank" rel="noreferrer">💬</a>
                  <button className="btn btn-sm btn-ghost" onClick={() => confirm('Delete listing?') && s.remove('ownerListings', l.id)}>✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function Tickets() {
  const s = useStore()
  const rows = useBookingRows()
  const [tab, setTab] = useState('Open')
  const [open, setOpen] = useState(null)
  const list = s.tickets.filter((t) => tab === 'All' || t.status === tab).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const R = (id) => rows.find((r) => r.b.id === id)
  const t = open && s.tickets.find((x) => x.id === open)
  const [reply, setReply] = useState('')
  return (
    <div className="page">
      <div className="page-head"><div><h1>Service requests</h1><p className="muted">Raised by customers from the portal.</p></div></div>
      <Tabs value={tab} onChange={setTab} tabs={['Open', 'In progress', 'Resolved', 'All']} />
      <div className="card table-wrap">
        <table className="table">
          <thead><tr><th>Ticket</th><th>Customer</th><th>Category</th><th>Subject</th><th>Raised</th><th>Status</th></tr></thead>
          <tbody>
            {list.length === 0 && <tr><td colSpan={6} className="muted">No requests.</td></tr>}
            {list.map((x) => {
              const r = R(x.bookingId)
              return (
                <tr key={x.id} className="click" onClick={() => setOpen(x.id)}>
                  <td><b>{x.code}</b></td><td>{r?.c?.name}<br /><small className="muted">{r?.b.code} · {r?.u?.no}</small></td><td>{x.category}</td><td>{x.subject}</td><td>{fmtDateTime(x.createdAt)}</td><td><Badge>{x.status}</Badge></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {t && (
        <Modal title={`${t.code} · ${t.subject}`} onClose={() => setOpen(null)}>
          <p className="muted small">{t.category} · {fmtDateTime(t.createdAt)} · {R(t.bookingId)?.c?.name} ({R(t.bookingId)?.b.code && <Link to={`/admin/bookings/${t.bookingId}`}>{R(t.bookingId).b.code}</Link>})</p>
          <p className="box">{t.description}</p>
          {t.replies.map((r, i) => <p key={i} className="reply"><b>{r.by}</b> <small className="muted">{fmtDateTime(r.at)}</small><br />{r.text}</p>)}
          <form className="form-grid" onSubmit={(e) => { e.preventDefault(); if (!reply.trim()) return; s.update('tickets', t.id, (x) => ({ replies: [...x.replies, { by: 'SRM CRM', text: reply.trim(), at: new Date().toISOString() }], status: x.status === 'Open' ? 'In progress' : x.status })); setReply('') }}>
            <Field label="Reply to customer" span={2}><textarea rows={3} value={reply} onChange={(e) => setReply(e.target.value)} /></Field>
            <div className="span-2 row gap"><button className="btn btn-primary">Send reply</button>
              <select value={t.status} onChange={(e) => s.update('tickets', t.id, { status: e.target.value })}>{['Open', 'In progress', 'Resolved'].map((x) => <option key={x}>{x}</option>)}</select></div>
          </form>
        </Modal>
      )}
    </div>
  )
}

export function Customers() {
  const s = useStore()
  const rows = useBookingRows()
  const [q, setQ] = useState('')
  const by = useMemo(() => {
    const m = {}
    rows.forEach((r) => { (m[r.b.customerId] ||= []).push(r) })
    return m
  }, [rows])
  const list = s.customers.filter((c) => !q || `${c.name} ${c.phone} ${c.email} ${c.pan}`.toLowerCase().includes(q.toLowerCase()))
  return (
    <div className="page">
      <div className="page-head"><div><h1>Customers</h1><p className="muted">{s.customers.length} customers</p></div></div>
      <div className="toolbar"><input placeholder="Search name, phone, email, PAN…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <div className="card table-wrap">
        <table className="table">
          <thead><tr><th>Customer</th><th>Contact</th><th>Units</th><th className="num">Value</th><th className="num">Paid</th><th className="num">Overdue</th><th>Since</th></tr></thead>
          <tbody>{list.slice(0, 200).map((c) => {
            const bs = (by[c.id] || []).filter((r) => r.b.status !== 'Cancelled')
            return (
              <tr key={c.id}>
                <td><b>{c.name}</b>{c.pan && <><br /><small className="muted">PAN {c.pan}</small></>}</td>
                <td>{c.phone}<br /><small className="muted">{c.email}</small></td>
                <td>{bs.map((r) => <Link key={r.b.id} to={`/admin/bookings/${r.b.id}`} className="tag">{r.u?.no}</Link>)}</td>
                <td className="num">{inrShort(bs.reduce((a, r) => a + r.b.payable, 0))}</td>
                <td className="num">{inrShort(bs.reduce((a, r) => a + r.t.paid, 0))}</td>
                <td className="num red">{bs.reduce((a, r) => a + r.t.overdue, 0) ? inrShort(bs.reduce((a, r) => a + r.t.overdue, 0)) : '—'}</td>
                <td>{fmtDate(c.createdAt)}</td>
              </tr>
            )
          })}</tbody>
        </table>
      </div>
    </div>
  )
}
