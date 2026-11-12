import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../lib/store'
import { useBookingRows } from './hooks'
import { PaymentModal } from './Bookings'
import { Badge, Stat, Tabs } from '../components/ui'
import { BarChart } from '../components/charts'
import { addDays, addMonths, fmtDate, inr, inrShort, monthKey, monthLabel, todayISO, waLink } from '../lib/format'
import { printDemand, printReceipt } from './printables'

export default function Collections() {
  const s = useStore()
  const rows = useBookingRows()
  const [tab, setTab] = useState('overdue')
  const [pay, setPay] = useState(null)
  const today = todayISO()
  const in30 = addDays(today, 30)
  const items = useMemo(() => rows.filter((r) => r.b.status !== 'Cancelled').flatMap((r) => r.t.schedule.filter((m) => m.balance > 1).map((m) => ({ r, m }))), [rows])
  const overdue = items.filter((x) => x.m.status === 'Overdue').sort((a, b) => a.m.dueDate.localeCompare(b.m.dueDate))
  const upcoming = items.filter((x) => x.m.dueDate >= today && x.m.dueDate <= in30).sort((a, b) => a.m.dueDate.localeCompare(b.m.dueDate))
  const recent = [...s.payments].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 60)
  const months = Array.from({ length: 6 }, (_, i) => monthKey(addMonths(today.slice(0, 7) + '-01', i - 5)))
  const sum = (a) => a.reduce((x, y) => x + y.m.balance, 0)
  const list = tab === 'overdue' ? overdue : upcoming
  const B = Object.fromEntries(rows.map((r) => [r.b.id, r]))
  return (
    <div className="page">
      <div className="page-head"><div><h1>Collections</h1><p className="muted">Demands, overdue follow-ups and receipts across all bookings.</p></div></div>
      <div className="grid-4">
        <Stat tone="red" label="Overdue" value={inrShort(sum(overdue))} sub={`${overdue.length} instalments`} icon="⚠️" />
        <Stat tone="amber" label="Due in 30 days" value={inrShort(sum(upcoming))} sub={`${upcoming.length} instalments`} icon="📅" />
        <Stat tone="green" label="Collected this month" value={inrShort(s.payments.filter((p) => monthKey(p.date) === monthKey(today)).reduce((a, p) => a + p.amount, 0))} icon="💰" />
        <Stat tone="violet" label="Total receivable" value={inrShort(rows.filter((r) => r.b.status !== 'Cancelled').reduce((a, r) => a + r.t.balance, 0))} icon="📈" />
      </div>
      <div className="card pad mt">
        <h3>Monthly collections</h3>
        <BarChart data={months.map((m) => ({ label: monthLabel(m), values: [s.payments.filter((p) => monthKey(p.date) === m).reduce((a, p) => a + p.amount, 0)] }))} colors={['#10b981']} height={160} />
      </div>
      <Tabs value={tab} onChange={setTab} tabs={[['overdue', `Overdue (${overdue.length})`], ['upcoming', `Due in 30 days (${upcoming.length})`], ['receipts', 'Recent receipts']]} />
      <div className="card table-wrap">
        {tab !== 'receipts' ? (
          <table className="table">
            <thead><tr><th>Customer</th><th>Booking · Unit</th><th>Milestone</th><th>Due</th><th className="num">Balance</th><th>Status</th><th /></tr></thead>
            <tbody>{list.map(({ r, m }) => (
              <tr key={r.b.id + m.index}>
                <td><b>{r.c?.name}</b><br /><small className="muted">{r.c?.phone}</small></td>
                <td><Link to={`/admin/bookings/${r.b.id}`}>{r.b.code}</Link><br /><small className="muted">{r.p?.name.replace('SRM ', '')} · {r.u?.no}</small></td>
                <td>{m.name}</td><td>{fmtDate(m.dueDate)}</td><td className="num"><b>{inr(m.balance)}</b></td><td><Badge>{m.status}</Badge></td>
                <td className="nowrap">
                  <a className="btn btn-sm btn-ghost" target="_blank" rel="noreferrer" href={waLink(r.c?.phone, `Dear ${r.c?.name}, a gentle reminder from SRM Developers: ${inr(m.balance)} towards "${m.name}" for unit ${r.u?.no} (${r.b.code}) ${m.status === 'Overdue' ? 'was due' : 'is due'} on ${fmtDate(m.dueDate)}. Kindly ignore if already paid. Thank you!`)}>💬 Remind</a>
                  <button className="btn btn-sm btn-ghost" onClick={() => printDemand(r.b, m, s)}>Demand</button>
                  <button className="btn btn-sm btn-primary" onClick={() => setPay({ b: r.b, m })}>Pay</button>
                </td>
              </tr>
            ))}</tbody>
          </table>
        ) : (
          <table className="table">
            <thead><tr><th>Date</th><th>Customer</th><th>Booking</th><th className="num">Amount</th><th>Mode</th><th>Ref</th><th /></tr></thead>
            <tbody>{recent.map((p) => {
              const r = B[p.bookingId]
              return (
                <tr key={p.id}><td>{fmtDate(p.date)}</td><td>{r?.c?.name}</td><td><Link to={`/admin/bookings/${p.bookingId}`}>{r?.b.code}</Link></td><td className="num">{inr(p.amount)}</td><td>{p.mode}</td><td>{p.ref}</td>
                  <td><button className="btn btn-sm btn-ghost" onClick={() => printReceipt(p, s)}>Receipt</button></td></tr>
              )
            })}</tbody>
          </table>
        )}
      </div>
      {pay && <PaymentModal booking={pay.b} milestone={pay.m} onClose={() => setPay(null)} />}
    </div>
  )
}
