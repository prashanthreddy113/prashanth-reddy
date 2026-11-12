import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useStore } from '../lib/store'
import { useBookingRows, teamName } from './hooks'
import { costSheet } from '../lib/pricing'
import { Badge, Field, Modal, Progress, Stat } from '../components/ui'
import { fmtDate, inr, inrShort, num, todayISO, waLink } from '../lib/format'
import { printAllotment, printDemand, printReceipt } from './printables'

export default function Bookings() {
  const s = useStore()
  const rows = useBookingRows()
  const [sp, setSp] = useSearchParams()
  const [q, setQ] = useState('')
  const [fp, setFp] = useState('')
  const [fs, setFs] = useState('')
  const list = rows.filter((r) =>
    (!q || `${r.b.code} ${r.c?.name} ${r.c?.phone} ${r.u?.no}`.toLowerCase().includes(q.toLowerCase())) &&
    (!fp || r.b.projectId === fp) && (!fs || (fs === 'Overdue' ? r.t.overdue > 0 : r.b.status === fs)))
    .sort((a, b) => b.b.date.localeCompare(a.b.date))
  const active = rows.filter((r) => r.b.status !== 'Cancelled')
  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Bookings</h1><p className="muted">{active.length} active bookings · {inrShort(active.reduce((a, r) => a + r.b.agreementValue, 0))} total sales</p></div>
        <button className="btn btn-primary" onClick={() => setSp({ new: '1' })}>+ New booking</button>
      </div>
      <div className="toolbar">
        <input placeholder="Search booking ID, customer, unit…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={fp} onChange={(e) => setFp(e.target.value)}><option value="">All projects</option>{s.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        <select value={fs} onChange={(e) => setFs(e.target.value)}><option value="">All statuses</option>{['Active', 'Registered', 'Handed over', 'Cancelled', 'Overdue'].map((x) => <option key={x}>{x}</option>)}</select>
      </div>
      <div className="card table-wrap">
        <table className="table">
          <thead><tr><th>Booking</th><th>Date</th><th>Customer</th><th>Project · Unit</th><th className="num">Value</th><th className="num">Received</th><th className="num">Overdue</th><th>Status</th></tr></thead>
          <tbody>{list.slice(0, 200).map((r) => (
            <tr key={r.b.id}>
              <td><Link to={`/admin/bookings/${r.b.id}`}><b>{r.b.code}</b></Link></td><td>{fmtDate(r.b.date)}</td>
              <td>{r.c?.name}<br /><small className="muted">{r.c?.phone}</small></td>
              <td>{r.p?.name.replace('SRM ', '')}<br /><small className="muted">{r.u?.no} · {r.u?.config}</small></td>
              <td className="num">{inrShort(r.b.payable)}</td>
              <td className="num">{Math.round((r.t.paid / r.b.payable) * 100)}%<Progress value={(r.t.paid / r.b.payable) * 100} /></td>
              <td className={`num ${r.t.overdue ? 'red' : ''}`}>{r.t.overdue ? inrShort(r.t.overdue) : '—'}</td>
              <td><Badge>{r.b.status}</Badge></td>
            </tr>
          ))}</tbody>
        </table>
        {list.length > 200 && <p className="small muted pad">Showing 200 of {list.length}. Refine your search.</p>}
      </div>
      {sp.get('new') && <NewBooking leadId={sp.get('lead')} unitId={sp.get('unit')} onClose={() => setSp({})} />}
    </div>
  )
}

function NewBooking({ leadId, unitId, onClose }) {
  const s = useStore()
  const nav = useNavigate()
  const lead = s.leads.find((l) => l.id === leadId)
  const presetUnit = s.units.find((u) => u.id === unitId)
  const [projectId, setProjectId] = useState(presetUnit?.projectId || lead?.projectId || s.projects[0].id)
  const [uid, setUid] = useState(presetUnit?.id || '')
  const [c, setC] = useState({ name: lead?.name || '', phone: lead?.phone || '', email: lead?.email || '', pan: '', address: '' })
  const [f, setF] = useState({ date: todayISO(), discount: 0, partnerId: '', salesPerson: lead?.assignedTo || 't2', loanBank: '', loanAmount: '' })
  const p = s.projects.find((x) => x.id === projectId)
  const avail = s.units.filter((u) => u.projectId === projectId && ['available', 'hold'].includes(u.status))
  const u = s.units.find((x) => x.id === uid)
  const cs = u ? costSheet(u, p, s.settings.taxes, Number(f.discount) || 0) : null
  const save = (e) => {
    e.preventDefault()
    if (!u) return s.toast('Select a unit', 'err')
    if (!c.name || !/\d{10}/.test(c.phone.replace(/\D/g, ''))) return s.toast('Customer name and phone are required', 'err')
    const b = s.createBooking({
      unitId: u.id, customer: c, date: f.date, discount: f.discount, partnerId: f.partnerId || null, salesPerson: f.salesPerson, leadId,
      loan: f.loanBank ? { bank: f.loanBank, amount: Number(f.loanAmount) || 0, status: 'Applied' } : null,
    })
    s.toast(`Booking ${b.code} created`)
    nav(`/admin/bookings/${b.id}`)
  }
  return (
    <Modal title="New booking" onClose={onClose} wide>
      <form className="booking-form" onSubmit={save}>
        <div className="form-grid">
          <h4 className="span-2">1. Unit</h4>
          <Field label="Project"><select value={projectId} onChange={(e) => { setProjectId(e.target.value); setUid('') }}>{s.projects.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
          <Field label={`Unit (${avail.length} available)`}><select value={uid} onChange={(e) => setUid(e.target.value)}><option value="">Select unit</option>{avail.map((x) => <option key={x.id} value={x.id}>{x.no} · {x.config} · {num(x.area)} {p.areaUnit} · {x.facing}{x.status === 'hold' ? ' (on hold)' : ''}</option>)}</select></Field>
          <h4 className="span-2">2. Customer {lead && <small className="muted">from lead</small>}</h4>
          <Field label="Name"><input value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} /></Field>
          <Field label="Phone"><input value={c.phone} onChange={(e) => setC({ ...c, phone: e.target.value })} /></Field>
          <Field label="Email"><input value={c.email} onChange={(e) => setC({ ...c, email: e.target.value })} /></Field>
          <Field label="PAN"><input value={c.pan} onChange={(e) => setC({ ...c, pan: e.target.value.toUpperCase() })} maxLength={10} /></Field>
          <Field label="Address" span={2}><input value={c.address} onChange={(e) => setC({ ...c, address: e.target.value })} /></Field>
          <h4 className="span-2">3. Deal</h4>
          <Field label="Booking date"><input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
          <Field label={`Discount (₹ per ${p.areaUnit})`}><input type="number" value={f.discount} onChange={(e) => setF({ ...f, discount: e.target.value })} /></Field>
          <Field label="Sales person"><select value={f.salesPerson} onChange={(e) => setF({ ...f, salesPerson: e.target.value })}>{s.settings.team.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Field>
          <Field label="Channel partner"><select value={f.partnerId} onChange={(e) => setF({ ...f, partnerId: e.target.value })}><option value="">Direct (none)</option>{s.partners.filter((x) => x.status === 'Approved').map((x) => <option key={x.id} value={x.id}>{x.firm} ({x.commissionPct}%)</option>)}</select></Field>
          <Field label="Home-loan bank"><input value={f.loanBank} onChange={(e) => setF({ ...f, loanBank: e.target.value })} placeholder="Optional" /></Field>
          <Field label="Loan amount (₹)"><input type="number" value={f.loanAmount} onChange={(e) => setF({ ...f, loanAmount: e.target.value })} /></Field>
        </div>
        <div className="cost-preview">
          <h4>Cost sheet</h4>
          {!cs ? <p className="muted">Select a unit to see the cost sheet.</p> : (
            <table className="table cost">
              <tbody>
                {cs.lines.map(([l, v]) => <tr key={l}><td>{l}</td><td className="num">{inr(v)}</td></tr>)}
                <tr className="sub"><td>Agreement value</td><td className="num">{inr(cs.agreementValue)}</td></tr>
                <tr><td>GST @ {cs.gstPct}%</td><td className="num">{inr(cs.gst)}</td></tr>
                <tr className="total"><td>Total payable</td><td className="num">{inr(cs.payable)}</td></tr>
                <tr className="muted"><td>Booking amount due today (10–20%)</td><td className="num">{inr(cs.payable * (p.category === 'Plots' ? 0.2 : 0.1))}</td></tr>
              </tbody>
            </table>
          )}
          <button className="btn btn-primary full mt">Create booking</button>
        </div>
      </form>
    </Modal>
  )
}

export function PaymentModal({ booking: b, milestone, onClose }) {
  const s = useStore()
  const [f, setF] = useState({ amount: milestone?.balance || '', date: todayISO(), mode: 'NEFT', ref: '', note: milestone?.name || '' })
  const save = (e) => {
    e.preventDefault()
    const amount = Number(f.amount)
    if (!amount || amount <= 0) return s.toast('Enter an amount', 'err')
    const pay = s.add('payments', { bookingId: b.id, ...f, amount })
    s.toast(`Payment of ${inr(amount)} recorded`)
    onClose(pay)
  }
  return (
    <Modal title={`Record payment · ${b.code}`} onClose={() => onClose()}>
      <form className="form-grid" onSubmit={save}>
        <Field label="Amount (₹)"><input type="number" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} autoFocus /></Field>
        <Field label="Date"><input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
        <Field label="Mode"><select value={f.mode} onChange={(e) => setF({ ...f, mode: e.target.value })}>{['NEFT', 'RTGS', 'UPI', 'Cheque', 'Home loan disbursement', 'Cash'].map((x) => <option key={x}>{x}</option>)}</select></Field>
        <Field label="Reference / UTR"><input value={f.ref} onChange={(e) => setF({ ...f, ref: e.target.value })} /></Field>
        <Field label="Towards" span={2}><input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
        <button className="btn btn-primary span-2">Save payment</button>
      </form>
    </Modal>
  )
}

export function BookingDetail() {
  const { id } = useParams()
  const s = useStore()
  const rows = useBookingRows()
  const r = rows.find((x) => x.b.id === id)
  const [pay, setPay] = useState(null)
  const [loan, setLoan] = useState(null)
  const partner = useMemo(() => r && s.partners.find((x) => x.id === r.b.partnerId), [r, s.partners])
  if (!r) return <div className="page"><p>Booking not found. <Link to="/admin/bookings">Back</Link></p></div>
  const { b, u, p, c, t } = r
  const pays = s.payments.filter((x) => x.bookingId === b.id).sort((a, z) => z.date.localeCompare(a.date))
  const setStatus = (status) => {
    if (status === 'Cancelled') {
      if (!confirm(`Cancel ${b.code}? Unit ${u.no} will be released to inventory.`)) return
      s.cancelBooking(b.id)
    } else {
      s.update('bookings', b.id, { status })
      if (['Registered', 'Handed over'].includes(status)) s.update('units', u.id, { status: 'sold' })
    }
    s.toast(`Booking marked ${status}`)
  }
  return (
    <div className="page">
      <div className="page-head">
        <div><Link to="/admin/bookings" className="small">← Bookings</Link><h1>{b.code} <Badge>{b.status}</Badge></h1><p className="muted">{c.name} · {p.name} · Unit {u.no} · booked {fmtDate(b.date)} by {teamName(s.settings, b.salesPerson)}</p></div>
        <div className="row gap wrap-row">
          <button className="btn btn-ghost" onClick={() => printAllotment(b, s)}>📄 Allotment letter</button>
          <a className="btn btn-ghost" target="_blank" rel="noreferrer" href={waLink(c.phone, `Dear ${c.name}, greetings from SRM Developers! Your booking ${b.code} for unit ${u.no} at ${p.name} is confirmed. Track payments & construction at our customer portal.`)}>💬 WhatsApp</a>
          <select value="" onChange={(e) => e.target.value && setStatus(e.target.value)} aria-label="Change status">
            <option value="">Change status…</option>{['Active', 'Registered', 'Handed over', 'Cancelled'].filter((x) => x !== b.status).map((x) => <option key={x}>{x}</option>)}
          </select>
          <button className="btn btn-primary" onClick={() => setPay({})} disabled={b.status === 'Cancelled'}>+ Record payment</button>
        </div>
      </div>
      <div className="grid-4">
        <Stat tone="violet" label="Total payable" value={inrShort(b.payable)} sub={`Agreement ${inrShort(b.agreementValue)} + GST ${inrShort(b.gst)}`} />
        <Stat tone="green" label="Received" value={inrShort(t.paid)} sub={`${Math.round((t.paid / b.payable) * 100)}% collected`} />
        <Stat tone="amber" label="Balance" value={inrShort(t.balance)} />
        <Stat tone="red" label="Overdue" value={t.overdue ? inrShort(t.overdue) : '—'} sub={t.nextDue ? `Next: ${t.nextDue.name}` : 'Fully paid'} />
      </div>
      <div className="detail-grid">
        <div className="card pad">
          <h3>Payment schedule</h3>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Milestone</th><th className="num">Amount</th><th className="num">Paid</th><th>Due</th><th>Status</th><th /></tr></thead>
              <tbody>{t.schedule.map((m) => (
                <tr key={m.index}>
                  <td>{m.name} <small className="muted">({m.pct}%)</small></td><td className="num">{inr(m.amount)}</td><td className="num">{inr(m.paid)}</td>
                  <td><input type="date" className="mini" value={m.dueDate} onChange={(e) => s.update('bookings', b.id, (x) => ({ demands: { ...x.demands, [m.index]: e.target.value } }))} title="Adjust due date when the construction stage is reached" /></td>
                  <td><Badge>{m.status}</Badge></td>
                  <td className="nowrap">{m.balance > 1 && <><button className="btn btn-sm btn-ghost" onClick={() => printDemand(b, m, s)}>Demand</button><button className="btn btn-sm btn-ghost" onClick={() => setPay({ m })}>Pay</button></>}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <h3 className="mt">Payments received</h3>
          <table className="table">
            <thead><tr><th>Date</th><th className="num">Amount</th><th>Mode</th><th>Ref</th><th /></tr></thead>
            <tbody>
              {pays.length === 0 && <tr><td colSpan={5} className="muted">No payments yet.</td></tr>}
              {pays.map((x) => (
                <tr key={x.id}><td>{fmtDate(x.date)}</td><td className="num">{inr(x.amount)}</td><td>{x.mode}</td><td>{x.ref}</td>
                  <td className="nowrap"><button className="btn btn-sm btn-ghost" onClick={() => printReceipt(x, s)}>Receipt</button><button className="btn btn-sm btn-ghost" onClick={() => confirm('Delete this payment?') && s.remove('payments', x.id)}>✕</button></td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="stack">
          <div className="card pad">
            <h3>Customer</h3>
            <div className="kv one">
              {[['Name', c.name], ['Phone', c.phone], ['Email', c.email], ['PAN', c.pan || '—'], ['Address', c.address || '—']].map(([k, v]) => <div key={k}><small>{k}</small><b>{v}</b></div>)}
            </div>
          </div>
          <div className="card pad">
            <h3>Unit</h3>
            <div className="kv">
              {[['Unit', u.no], ['Type', u.config], ['Area', `${num(u.area)} ${p.areaUnit}`], ['Facing', u.facing], ['Tower', u.tower], ['Floor', u.floor || '—']].map(([k, v]) => <div key={k}><small>{k}</small><b>{v}</b></div>)}
            </div>
            <table className="table cost mt"><tbody>{b.lines.map(([l, v]) => <tr key={l}><td className="small">{l}</td><td className="num">{inr(v)}</td></tr>)}<tr className="total"><td>Payable incl. GST</td><td className="num">{inr(b.payable)}</td></tr></tbody></table>
          </div>
          <div className="card pad">
            <div className="row-between"><h3>Home loan</h3><button className="btn btn-sm btn-ghost" onClick={() => setLoan(b.loan || { bank: '', amount: 0, status: 'Applied' })}>Edit</button></div>
            {b.loan ? <p>{b.loan.bank} · {inrShort(b.loan.amount)} · <Badge tone="blue">{b.loan.status}</Badge></p> : <p className="muted">Self-funded</p>}
          </div>
          <div className="card pad">
            <h3>Channel partner</h3>
            {partner ? (
              <>
                <p>{partner.firm} · {partner.commissionPct}% = <b>{inr((b.agreementValue * partner.commissionPct) / 100)}</b></p>
                <label className="check"><input type="checkbox" checked={!!b.commissionPaid} onChange={(e) => s.update('bookings', b.id, { commissionPaid: e.target.checked })} /> Commission paid</label>
              </>
            ) : <p className="muted">Direct sale</p>}
          </div>
        </div>
      </div>
      {pay && <PaymentModal booking={b} milestone={pay.m} onClose={(x) => { setPay(null); if (x) printReceipt(x, { ...s, payments: [x, ...s.payments] }) }} />}
      {loan && (
        <Modal title="Home loan" onClose={() => setLoan(null)}>
          <form className="form-grid" onSubmit={(e) => { e.preventDefault(); s.update('bookings', b.id, { loan: loan.bank ? { ...loan, amount: Number(loan.amount) } : null }); setLoan(null) }}>
            <Field label="Bank"><input value={loan.bank} onChange={(e) => setLoan({ ...loan, bank: e.target.value })} /></Field>
            <Field label="Amount (₹)"><input type="number" value={loan.amount} onChange={(e) => setLoan({ ...loan, amount: e.target.value })} /></Field>
            <Field label="Status" span={2}><select value={loan.status} onChange={(e) => setLoan({ ...loan, status: e.target.value })}>{['Applied', 'Sanctioned', 'Tripartite signed', 'Disbursing', 'Fully disbursed'].map((x) => <option key={x}>{x}</option>)}</select></Field>
            <button className="btn btn-primary span-2">Save</button>
          </form>
        </Modal>
      )}
    </div>
  )
}
