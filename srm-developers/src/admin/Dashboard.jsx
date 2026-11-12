import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../lib/store'
import { useBookingRows } from './hooks'
import { Badge, Stat } from '../components/ui'
import { BarChart, Donut, Funnel, HBar } from '../components/charts'
import { addMonths, fmtDate, inrShort, monthKey, monthLabel, num, todayISO } from '../lib/format'
import { STAGES } from '../lib/seed'

export default function Dashboard() {
  const s = useStore()
  const rows = useBookingRows()
  const today = todayISO()
  const thisMonth = monthKey(today)

  const d = useMemo(() => {
    const active = rows.filter((r) => r.b.status !== 'Cancelled')
    const months = Array.from({ length: 12 }, (_, i) => monthKey(addMonths(thisMonth + '-01', i - 11)))
    const sales = months.map((m) => active.filter((r) => monthKey(r.b.date) === m).reduce((a, r) => a + r.b.agreementValue, 0))
    const coll = months.map((m) => s.payments.filter((p) => monthKey(p.date) === m).reduce((a, p) => a + p.amount, 0))
    const status = ['available', 'hold', 'booked', 'sold', 'leased'].map((k) => s.units.filter((u) => u.status === k).length)
    const availValue = s.units.filter((u) => u.status === 'available').reduce((a, u) => {
      const p = s.projects.find((x) => x.id === u.projectId)
      return a + u.area * p.baseRate
    }, 0)
    const leadsMonth = s.leads.filter((l) => monthKey(l.createdAt) === thisMonth)
    const bySource = {}
    s.leads.forEach((l) => { bySource[l.source] = (bySource[l.source] || 0) + 1 })
    const rent = s.leases.filter((l) => l.status === 'Active').reduce((a, l) => a + l.rent, 0)
    return {
      months, sales, coll, status, availValue, leadsMonth, rent,
      bookedMonth: active.filter((r) => monthKey(r.b.date) === thisMonth),
      collMonth: coll[11],
      overdue: active.reduce((a, r) => a + r.t.overdue, 0),
      overdueRows: active.filter((r) => r.t.overdue > 0).sort((a, b) => b.t.overdue - a.t.overdue),
      receivable: active.reduce((a, r) => a + r.t.balance, 0),
      sources: Object.entries(bySource).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value),
      funnel: STAGES.filter((x) => x !== 'Lost').map((st, i, arr) => ({ label: st, value: s.leads.filter((l) => arr.indexOf(l.stage) >= i).length })),
    }
  }, [rows, s.payments, s.units, s.projects, s.leads, s.leases, thisMonth])

  const followUps = s.leads.filter((l) => l.followUp && l.followUp <= today && !['Booked', 'Lost'].includes(l.stage)).slice(0, 6)
  const visitsToday = s.visits.filter((v) => v.date === today && v.status === 'Scheduled')
  const sold = d.status[2] + d.status[3] + d.status[4]

  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'} 👋</h1><p className="muted">Here's how SRM Developers is doing today, {fmtDate(today)}.</p></div>
        <div className="row gap"><Link className="btn btn-ghost" to="/admin/leads?new=1">+ Lead</Link><Link className="btn btn-primary" to="/admin/bookings?new=1">+ New booking</Link></div>
      </div>

      <div className="grid-4">
        <Stat icon="📝" tone="violet" label="Bookings this month" value={d.bookedMonth.length} sub={`${inrShort(d.bookedMonth.reduce((a, r) => a + r.b.agreementValue, 0))} sales value`} />
        <Stat icon="💰" tone="green" label="Collected this month" value={inrShort(d.collMonth)} sub={`${inrShort(d.receivable)} total receivable`} />
        <Stat icon="⚠️" tone="red" label="Overdue instalments" value={inrShort(d.overdue)} sub={`${d.overdueRows.length} customers`} />
        <Stat icon="🎯" tone="amber" label="Leads this month" value={d.leadsMonth.length} sub={`${s.leads.filter((l) => l.stage === 'New').length} new / uncontacted`} />
        <Stat icon="🏢" tone="cyan" label="Inventory sold" value={`${Math.round((sold / s.units.length) * 100)}%`} sub={`${num(d.status[0])} units available`} />
        <Stat icon="💎" tone="pink" label="Unsold inventory value" value={inrShort(d.availValue)} sub="at base rate" />
        <Stat icon="🔑" tone="blue" label="Monthly rental income" value={inrShort(d.rent)} sub={`${s.leases.filter((l) => l.status === 'Active').length} active leases`} />
        <Stat icon="📅" tone="violet" label="Site visits today" value={visitsToday.length} sub={`${s.visits.filter((v) => v.status === 'Scheduled' && v.date > today).length} upcoming`} />
      </div>

      <div className="dash-grid">
        <div className="card pad span-2">
          <div className="row-between"><h3>Sales vs collections · last 12 months</h3></div>
          <BarChart data={d.months.map((m, i) => ({ label: monthLabel(m), values: [d.sales[i], d.coll[i]] }))} labels={['Sales booked', 'Collections']} colors={['#7c3aed', '#10b981']} />
        </div>
        <div className="card pad">
          <h3>Inventory status</h3>
          <Donut center={num(s.units.length)} sub="units" data={[
            { label: 'Available', value: d.status[0], color: '#10b981' }, { label: 'On hold', value: d.status[1], color: '#f59e0b' },
            { label: 'Booked', value: d.status[2], color: '#a855f7' }, { label: 'Sold', value: d.status[3], color: '#64748b' }, { label: 'Leased', value: d.status[4], color: '#3b82f6' },
          ]} />
        </div>
        <div className="card pad">
          <h3>Lead funnel</h3>
          <Funnel data={d.funnel} />
          <p className="small muted">Conversion: {s.leads.length ? Math.round((s.leads.filter((l) => l.stage === 'Booked').length / s.leads.length) * 100) : 0}% of leads booked</p>
        </div>
        <div className="card pad">
          <h3>Leads by source</h3>
          <HBar data={d.sources.slice(0, 7)} />
        </div>
        <div className="card pad">
          <h3>Project-wise sales</h3>
          <HBar data={s.projects.map((p) => {
            const us = s.units.filter((u) => u.projectId === p.id)
            return { label: p.name.replace('SRM ', ''), value: us.length ? Math.round((us.filter((u) => ['sold', 'booked', 'leased'].includes(u.status)).length / us.length) * 100) : 0, color: p.palette[0] }
          })} />
          <p className="small muted">% of units sold / leased</p>
        </div>
        <div className="card pad">
          <div className="row-between"><h3>Follow-ups due</h3><Link to="/admin/leads" className="small">All leads →</Link></div>
          <ul className="list">
            {followUps.length === 0 && <li className="muted">All caught up 🎉</li>}
            {followUps.map((l) => (
              <li key={l.id}><Link to={`/admin/leads?id=${l.id}`}><b>{l.name}</b></Link><small>{l.config} · {s.projects.find((p) => p.id === l.projectId)?.name.replace('SRM ', '')}</small><Badge>{l.stage}</Badge></li>
            ))}
          </ul>
        </div>
        <div className="card pad">
          <div className="row-between"><h3>Today's site visits</h3><Link to="/admin/visits" className="small">Calendar →</Link></div>
          <ul className="list">
            {visitsToday.length === 0 && <li className="muted">No visits scheduled today.</li>}
            {visitsToday.map((v) => <li key={v.id}><b>{v.time}</b><span>{v.name}</span><small>{s.projects.find((p) => p.id === v.projectId)?.name.replace('SRM ', '')}</small></li>)}
          </ul>
        </div>
        <div className="card pad">
          <div className="row-between"><h3>Top overdue</h3><Link to="/admin/collections" className="small">Collections →</Link></div>
          <ul className="list">
            {d.overdueRows.slice(0, 6).map((r) => (
              <li key={r.b.id}><Link to={`/admin/bookings/${r.b.id}`}><b>{r.c?.name}</b></Link><small>{r.u?.no} · {r.p?.name.replace('SRM ', '')}</small><b className="red">{inrShort(r.t.overdue)}</b></li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
