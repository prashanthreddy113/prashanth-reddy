import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useToast } from '../lib/toast'
import { money, litres, kl, n, fmtDateTime, ago } from '../lib/format'
import { StatusBadge, GradeChip } from '../components/StatusBadge'
import { BarChart, QualityDonut } from '../components/Charts'

export default function Dashboard() {
  const { user, isRwa, isOperator } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [data, setData] = useState(null)

  const load = () => api.dashboard().then(setData).catch((e) => toast.error(e.message))
  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (!data) return <div className="loading">Loading…</div>
  const perDay = (data.perDay || []).map((d) => ({ day: new Date(d.day).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }), litres: Number(d.litres), count: d.count }))
  const poor = data.quality?.find((q) => q.grade === 'Poor')?.count || 0

  return (
    <>
      <div className="card hero">
        <div>
          <h2>{isRwa ? `${user.communityName}` : isOperator ? `${user.operatorName}` : 'Platform overview'}</h2>
          <p>{isRwa ? 'Every load that reached your gate, metered at the tanker outlet. Verify, dispute or pay from here.' : 'Live meters on your tankers turn each load into proof: litres, quality, location, seal.'}</p>
        </div>
        <div className="row">
          <span className="pill"><b>{n(data.today.count)}</b> loads today</span>
          <span className="pill"><b>{kl(data.today.litres)}</b> delivered today</span>
          {data.inProgress > 0 && <span className="pill"><b>{data.inProgress}</b> pumping now</span>}
        </div>
      </div>

      <div className="stats">
        <div className="card stat"><span className="label">This month</span><span className="value">{kl(data.month.litres)}</span><span className="sub">{n(data.month.count)} loads · {money(data.month.amount)}</span></div>
        <div className={`card stat ${data.awaitingVerification ? 'amber' : 'green'}`}><span className="label">{isRwa ? 'To verify' : 'Awaiting RWA verification'}</span><span className="value">{n(data.awaitingVerification)}</span><span className="sub"><Link to="/deliveries?status=Completed">Open list</Link></span></div>
        <div className={`card stat ${data.disputed ? 'red' : 'green'}`}><span className="label">Disputed</span><span className="value">{n(data.disputed)}</span><span className="sub"><Link to="/disputes">Disputes</Link></span></div>
        <div className={`card stat ${data.shortLoads30d ? 'amber' : 'green'}`}><span className="label">Short loads (30 d)</span><span className="value">{n(data.shortLoads30d)}</span><span className="sub">under 85% of tank capacity</span></div>
        <div className={`card stat ${poor ? 'red' : 'green'}`}><span className="label">Poor quality (30 d)</span><span className="value">{n(poor)}</span><span className="sub">above IS 10500 permissible limits</span></div>
        <div className={`card stat ${Number(data.money?.outstanding) > 0 ? 'amber' : 'grey'}`}><span className="label">{isRwa ? 'Invoices due' : 'Outstanding'}</span><span className="value">{money(data.money?.outstanding)}</span><span className="sub">{money(data.money?.uninvoiced)} not yet invoiced</span></div>
        {data.fleet && <div className={`card stat ${data.fleet.online < data.fleet.devices ? 'amber' : 'green'}`}><span className="label">Devices online</span><span className="value">{data.fleet.online}/{data.fleet.devices}</span><span className="sub">{data.fleet.tankers} active tankers{data.fleet.tampered ? ` · ${data.fleet.tampered} tamper alert` : ''}</span></div>}
        {data.bookings && <div className={`card stat ${data.bookings.pending ? 'blue' : 'grey'}`}><span className="label">Bookings</span><span className="value">{n(data.bookings.pending)}</span><span className="sub">{isRwa ? 'awaiting operator' : 'to accept'} · {data.bookings.upcoming} upcoming</span></div>}
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-head"><h2>Litres per day, last 30 days</h2><span className="muted small">{kl(perDay.reduce((s, d) => s + d.litres, 0))} total</span></div>
          <div className="card-body">{perDay.length ? <BarChart data={perDay} format={(v) => kl(v)} /> : <div className="empty">No deliveries yet.</div>}</div>
        </div>
        <div className="card">
          <div className="card-head"><h2>Water quality, last 30 days</h2></div>
          <div className="card-body"><QualityDonut quality={data.quality} /><p className="muted small" style={{ marginTop: 12 }}>Graded on average TDS and turbidity per load against IS 10500: Good ≤ 500 ppm / 1 NTU, Acceptable ≤ 2000 ppm / 5 NTU.</p></div>
        </div>
      </div>

      {data.fleet?.items?.length > 0 && (
        <div className="card">
          <div className="card-head"><h2>Fleet status</h2><Link to="/fleet" className="btn sm">Manage</Link></div>
          <div className="card-body tight device-grid">
            {data.fleet.items.map((d) => (
              <div key={d.id} className="card device-card">
                <div className="row between"><span className="code">{d.deviceCode}</span><span className={`chip ${d.status === 'Tampered' ? 'bad' : d.isOnline ? 'ok' : ''}`}>{d.status === 'Tampered' ? 'TAMPER' : d.isOnline ? 'Online' : 'Offline'}</span></div>
                <div className="small">{d.tankerRegistration ? <b>{d.tankerRegistration}</b> : <span className="muted">Not fitted</span>} · seen {ago(d.lastSeenAt)}</div>
                <div className="small muted">{d.lastBatteryVolts ? `${d.lastBatteryVolts.toFixed(2)} V` : ''}{d.lastSignalCsq != null ? ` · signal ${d.lastSignalCsq}/31` : ''}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-head"><h2>Recent deliveries</h2><Link to="/deliveries" className="btn sm">All deliveries</Link></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>When</th><th>{isRwa ? 'Tanker' : 'Community'}</th><th className="num">Litres</th><th>Quality</th><th>Status</th><th className="num">Amount</th></tr></thead>
            <tbody>
              {data.recent.map((d) => (
                <tr key={d.id} className="clickable" onClick={() => navigate(`/deliveries/${d.id}`)}>
                  <td><div className="primary">{fmtDateTime(d.startedAt)}</div><div className="secondary">{d.tankerRegistration || d.deviceCode}</div></td>
                  <td>{isRwa ? (d.tankerRegistration || '—') : (d.communityName || <span className="muted">Unmatched</span>)}</td>
                  <td className="num">{litres(d.litresDelivered)}</td>
                  <td><GradeChip grade={d.qualityGrade} tds={d.avgTdsPpm} ntu={d.avgTurbidityNtu} /></td>
                  <td><StatusBadge status={d.status} pulse /></td>
                  <td className="num">{money(d.amount)}</td>
                </tr>
              ))}
              {data.recent.length === 0 && <tr><td colSpan="6" className="empty">No deliveries yet. Fit a device to a tanker or run <code>tools/simulate-device.mjs</code>.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
