import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api } from '../lib/api'
import { useTown } from '../lib/town'
import { CHART, SERVICE, inr, num } from '../lib/format'
import { downloadCsv } from '../lib/csv'
import KpiTile from '../components/KpiTile'

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const axis = { tick: { fontSize: 12 }, tickLine: false }

export default function Analytics() {
  const { townId, towns } = useTown()
  const [a, setA] = useState(null)
  useEffect(() => { api.analytics(townId, 30).then(setA) }, [townId])
  if (!a) return <div className="loading">Loading…</div>

  const totalTrips = a.perDay.reduce((s, d) => s + d.rides + d.parcels, 0)
  const totalRev = a.perDay.reduce((s, d) => s + d.revenue, 0)
  const heatMax = Math.max(1, ...a.heatmap.flat())
  const townName = (id) => towns.find((t) => t.id === id)?.nameEn || id
  const exportAll = () => downloadCsv(`analytics-${townId}-30d.csv`, a.perDay, [
    { key: 'day', label: 'Day' }, { key: 'rides', label: 'Rides' }, { key: 'parcels', label: 'Parcels' }, { key: 'revenue', label: 'Gross fares ₹' }, { key: 'fulfilment', label: 'Fulfilment %' }, { key: 'medianPickup', label: 'Median pickup min' },
  ])

  return (
    <>
      <div className="row between wrap">
        <div className="kpi-grid four grow">
          <KpiTile icon="🧮" label="Trips · 30 days" value={num(totalTrips)} tone="green" />
          <KpiTile icon="₹" label="Gross fares · 30 days" value={inr(totalRev)} tone="green" />
          <KpiTile icon="📦" label="COD collected" value={inr(a.codSummary.collected)} sub={`${inr(a.codSummary.pending)} pending · ${a.codSummary.parcels} COD parcels`} tone={a.codSummary.pending > 2000 ? 'red' : 'orange'} />
          <div className="kpi kpi-ink export-tile"><div className="kpi-label">Export</div><button className="btn primary" onClick={exportAll}>⬇ Per-day CSV</button><small className="muted">rides, parcels, fares, fulfilment, pickup</small></div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card"><div className="card-head"><h2>Rides and parcels per day</h2></div><div className="card-body chart">
          <ResponsiveContainer width="100%" height={240}><LineChart data={a.perDay} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
            <CartesianGrid stroke={CHART.grid} vertical={false} /><XAxis dataKey="label" {...axis} interval={4} axisLine={{ stroke: CHART.grid }} /><YAxis {...axis} axisLine={false} allowDecimals={false} /><Tooltip /><Legend />
            <Line type="monotone" dataKey="rides" name="Rides" stroke={CHART.rides} strokeWidth={2} dot={false} /><Line type="monotone" dataKey="parcels" name="Parcels" stroke={CHART.parcels} strokeWidth={2} dot={false} />
          </LineChart></ResponsiveContainer></div></div>
        <div className="card"><div className="card-head"><h2>Gross fares per day (₹)</h2></div><div className="card-body chart">
          <ResponsiveContainer width="100%" height={240}><BarChart data={a.perDay} margin={{ top: 8, right: 12, left: -8, bottom: 0 }} barCategoryGap={2}>
            <CartesianGrid stroke={CHART.grid} vertical={false} /><XAxis dataKey="label" {...axis} interval={4} axisLine={{ stroke: CHART.grid }} /><YAxis {...axis} axisLine={false} /><Tooltip formatter={(v) => inr(v)} />
            <Bar dataKey="revenue" name="Gross fares" fill={CHART.revenue} radius={[4, 4, 0, 0]} />
          </BarChart></ResponsiveContainer></div></div>
      </div>

      <div className="grid-3">
        <div className="card"><div className="card-head"><h2>By service</h2></div><div className="card-body chart">
          <ResponsiveContainer width="100%" height={220}><PieChart>
            <Pie data={a.byService} dataKey="count" nameKey="service" innerRadius={50} outerRadius={85} paddingAngle={2} stroke="#FFFDF7" strokeWidth={2} label={(p) => { const e = p.payload?.service ? p.payload : p; return `${SERVICE[e.service]?.label ?? ''} ${e.count ?? ''}` }}>
              {a.byService.map((s) => <Cell key={s.service} fill={CHART[s.service]} />)}
            </Pie><Tooltip />
          </PieChart></ResponsiveContainer>
          <table className="mini"><tbody>{a.byService.map((s) => <tr key={s.service}><td><span className={`svc-dot svc-${s.service}`} />{SERVICE[s.service].label}</td><td>{s.count}</td><td>{inr(s.revenue)}</td></tr>)}</tbody></table>
        </div></div>
        <div className="card"><div className="card-head"><h2>By town</h2></div><div className="card-body chart">
          <ResponsiveContainer width="100%" height={220}><BarChart data={a.byTown} margin={{ top: 8, right: 12, left: -16, bottom: 0 }} barCategoryGap={12}>
            <CartesianGrid stroke={CHART.grid} vertical={false} /><XAxis dataKey="town" {...axis} axisLine={{ stroke: CHART.grid }} /><YAxis {...axis} axisLine={false} allowDecimals={false} /><Tooltip /><Legend />
            <Bar dataKey="rides" name="Rides" fill={CHART.rides} radius={[4, 4, 0, 0]} /><Bar dataKey="parcels" name="Parcels" fill={CHART.parcels} radius={[4, 4, 0, 0]} />
          </BarChart></ResponsiveContainer>
        </div></div>
        <div className="card"><div className="card-head"><h2>Fulfilment % and median pickup (min)</h2></div><div className="card-body chart two-small">
          <ResponsiveContainer width="100%" height={105}><LineChart data={a.perDay} margin={{ top: 4, right: 12, left: -16, bottom: 0 }}>
            <XAxis dataKey="label" hide /><YAxis {...axis} domain={[50, 100]} axisLine={false} /><Tooltip /><Line type="monotone" dataKey="fulfilment" name="Fulfilment %" stroke={CHART.rides} strokeWidth={2} dot={false} connectNulls />
          </LineChart></ResponsiveContainer>
          <ResponsiveContainer width="100%" height={105}><LineChart data={a.perDay} margin={{ top: 4, right: 12, left: -16, bottom: 0 }}>
            <XAxis dataKey="label" {...axis} interval={9} axisLine={{ stroke: CHART.grid }} /><YAxis {...axis} axisLine={false} /><Tooltip /><Line type="monotone" dataKey="medianPickup" name="Median pickup (min)" stroke={CHART.bike} strokeWidth={2} dot={false} />
          </LineChart></ResponsiveContainer>
        </div></div>
      </div>

      <div className="card"><div className="card-head"><h2>Requests by hour and weekday</h2><small className="muted">darker = more requests</small></div>
        <div className="card-body heat-wrap"><div className="heat">
          <div className="heat-row head"><span /> {Array.from({ length: 24 }, (_, h) => <span key={h} className="heat-h">{h % 3 === 0 ? h : ''}</span>)}</div>
          {a.heatmap.map((row, dow) => (
            <div key={dow} className="heat-row"><span className="heat-d">{DOW[dow]}</span>{row.map((v, h) => <span key={h} className="heat-cell" title={`${DOW[dow]} ${h}:00 · ${v}`} style={{ background: `rgba(18,138,70,${0.08 + (v / heatMax) * 0.85})` }} />)}</div>
          ))}
        </div></div>
      </div>

      <div className="grid-2">
        <div className="card"><div className="card-head"><h2>Captain leaderboard</h2><small className="muted">finished trips · 30 days</small></div><div className="table-wrap">
          <table><thead><tr><th>#</th><th>Captain</th><th>Town</th><th>Trips</th><th>Fares</th><th>Rating</th></tr></thead><tbody>
            {a.leaderboard.map((c, i) => <tr key={c.captainId}><td>{i + 1}</td><td><Link to={`/captains/${c.captainId}`}>{SERVICE[c.vehicleType]?.emoji} {c.name}</Link></td><td>{townName(c.townId)}</td><td>{c.trips}</td><td>{inr(c.revenue)}</td><td>{c.rating ? `⭐ ${c.rating}` : '—'}</td></tr>)}
          </tbody></table></div></div>
        <div className="card"><div className="card-head"><h2>Top landmarks</h2><small className="muted">pickups + drops</small></div><div className="table-wrap">
          <table><thead><tr><th>Landmark</th><th>Telugu</th><th>Pickups</th><th>Drops</th></tr></thead><tbody>
            {a.topLandmarks.map((l) => <tr key={l.name}><td>{l.name}</td><td className="te">{l.nameTe}</td><td>{l.pickups}</td><td>{l.drops}</td></tr>)}
          </tbody></table></div></div>
      </div>

      <div className="grid-2">
        <div className="card"><div className="card-head"><h2>Retention · new vs repeat riders per week</h2></div><div className="card-body chart">
          <ResponsiveContainer width="100%" height={220}><BarChart data={a.retention} margin={{ top: 8, right: 12, left: -16, bottom: 0 }} barCategoryGap={10}>
            <CartesianGrid stroke={CHART.grid} vertical={false} /><XAxis dataKey="label" {...axis} axisLine={{ stroke: CHART.grid }} /><YAxis {...axis} axisLine={false} allowDecimals={false} /><Tooltip /><Legend />
            <Bar dataKey="newRiders" name="New riders" stackId="r" fill={CHART.bike} stroke="#FFFDF7" /><Bar dataKey="repeatRiders" name="Repeat riders" stackId="r" fill={CHART.rides} stroke="#FFFDF7" radius={[4, 4, 0, 0]} />
          </BarChart></ResponsiveContainer></div></div>
        <div className="card"><div className="card-head"><h2>Parcel COD · collected vs pending</h2></div><div className="card-body chart">
          <ResponsiveContainer width="100%" height={220}><BarChart data={[{ name: 'COD', collected: a.codSummary.collected, pending: a.codSummary.pending }]} layout="vertical" margin={{ top: 8, right: 24, left: 8, bottom: 0 }}>
            <XAxis type="number" {...axis} axisLine={false} tickFormatter={(v) => inr(v)} /><YAxis type="category" dataKey="name" hide /><Tooltip formatter={(v) => inr(v)} /><Legend />
            <Bar dataKey="collected" name="Collected" stackId="c" fill={CHART.rides} stroke="#FFFDF7" barSize={48} /><Bar dataKey="pending" name="Pending" stackId="c" fill={CHART.parcels} stroke="#FFFDF7" barSize={48} radius={[0, 4, 4, 0]} />
          </BarChart></ResponsiveContainer>
          <p className="muted small">Pending COD is cash the receiver has not yet paid or the captain has not marked collected; it is deducted in the captain's settlement once collected.</p>
        </div></div>
      </div>
    </>
  )
}
