import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api } from '../lib/api'
import { useTown } from '../lib/town'
import { CHART, SERVICE, fmtTime, inr, num, pct } from '../lib/format'
import KpiTile from '../components/KpiTile'
import StatusPill from '../components/StatusPill'
import Empty from '../components/Empty'

export default function Dashboard() {
  const { townId, towns } = useTown()
  const [data, setData] = useState(null)
  const [live, setLive] = useState([])
  const [captains, setCaptains] = useState({})
  const [tick, setTick] = useState(0)

  useEffect(() => { api.dashboard(townId).then(setData) }, [townId, tick])
  useEffect(() => {
    let alive = true
    const load = () => api.live.requests(townId).then((rows) => { if (alive) setLive(rows) })
    load()
    const id = setInterval(() => { load(); setTick((t) => t + 1) }, 5000)
    return () => { alive = false; clearInterval(id) }
  }, [townId])
  useEffect(() => { api.captains.list().then((rows) => setCaptains(Object.fromEntries(rows.map((c) => [c.id, c])))) }, [])

  if (!data) return <div className="loading">Loading…</div>
  const k = data.kpis
  const townName = (id) => towns.find((t) => t.id === id)?.nameEn || id
  const a = data.attention
  const attentionCount = a.pendingCaptains.length + a.sos.length + a.unfulfilled.length + a.lowRated.length + a.searchingLong.length

  return (
    <>
      <div className="kpi-grid">
        <KpiTile icon="🏍️" label="Rides today" value={num(k.ridesToday)} tone="yellow" />
        <KpiTile icon="📦" label="Parcels today" value={num(k.parcelsToday)} tone="orange" />
        <KpiTile icon="₹" label="Revenue today" value={inr(k.revenueToday)} sub={`commission earned · gross fares ${inr(k.grossToday)}`} tone="green" />
        <KpiTile icon="🛺" label="Captains online" value={`${k.captainsOnline} / ${k.captainsTotal}`} sub="online / verified" tone="green" />
        <KpiTile icon="✅" label="Fulfilment" value={pct(k.fulfilment)} sub="target > 85%" tone={k.fulfilment >= 85 ? 'green' : 'red'} />
        <KpiTile icon="⏱️" label="Median pickup" value={`${k.medianPickup.toFixed(1)} min`} sub="target < 6 min" tone={k.medianPickup < 6 ? 'green' : 'red'} />
        <KpiTile icon="❌" label="Cancellations" value={pct(k.cancellations, 1)} tone={k.cancellations > 12 ? 'red' : 'ink'} />
        <KpiTile icon="⭐" label="Average rating" value={k.avgRating ? k.avgRating.toFixed(2) : '—'} sub="target > 4.6" tone={k.avgRating >= 4.6 ? 'green' : 'ink'} />
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-head"><h2>Rides vs parcels · last 14 days</h2></div>
          <div className="card-body chart">
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={data.series14d} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                <CartesianGrid stroke={CHART.grid} vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} tickLine={false} axisLine={{ stroke: CHART.grid }} />
                <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="rides" name="Rides" stroke={CHART.rides} strokeWidth={2} dot={false} activeDot={{ r: 5 }} />
                <Line type="monotone" dataKey="parcels" name="Parcels" stroke={CHART.parcels} strokeWidth={2} dot={false} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card">
          <div className="card-head"><h2>Requests by hour · today</h2></div>
          <div className="card-body chart">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data.byHourToday} margin={{ top: 8, right: 12, left: -16, bottom: 0 }} barCategoryGap={2}>
                <CartesianGrid stroke={CHART.grid} vertical={false} />
                <XAxis dataKey="hour" tick={{ fontSize: 11 }} tickLine={false} axisLine={{ stroke: CHART.grid }} interval={2} />
                <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip labelFormatter={(h) => `${h}:00–${h}:59`} />
                <Legend />
                <Bar dataKey="rides" name="Rides" stackId="a" fill={CHART.rides} stroke="#FFFDF7" strokeWidth={1} />
                <Bar dataKey="parcels" name="Parcels" stackId="a" fill={CHART.parcels} stroke="#FFFDF7" strokeWidth={1} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid-2 wide-left">
        <div className="card">
          <div className="card-head">
            <h2>Live requests <span className="muted">· searching / assigned / on trip</span></h2>
            <span className="live-dot">refreshes every 5 s</span>
          </div>
          <div className="table-wrap tall">
            {live.length === 0 ? <Empty icon="🌙" text="No open requests right now" /> : (
              <table>
                <thead><tr><th>Time</th><th>Service</th><th>Town</th><th>Pickup → Drop</th><th>Fare</th><th>Captain</th><th>Status</th></tr></thead>
                <tbody>
                  {live.map((x) => (
                    <tr key={x.id}>
                      <td>{fmtTime(x.requestedAt)}</td>
                      <td><span className={`svc-dot svc-${x.service}`} />{SERVICE[x.service].emoji} {SERVICE[x.service].label}</td>
                      <td>{townName(x.townId)}</td>
                      <td className="ellipsis">{x.pickup.name} → {x.drop.name}</td>
                      <td>{inr(x.fareQuoted)}</td>
                      <td>{x.captainId ? <Link to={`/captains/${x.captainId}`}>{captains[x.captainId]?.name || x.captainId}</Link> : <span className="muted">—</span>}</td>
                      <td><StatusPill status={x.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-head"><h2>Needs attention</h2><span className={`count ${attentionCount ? 'hot' : ''}`}>{attentionCount}</span></div>
          <div className="card-body attention">
            {attentionCount === 0 && <Empty icon="😌" text="All clear" />}
            {a.sos.map((s) => (
              <div key={s.id} className="attn attn-red">
                <span>🆘</span>
                <div><b>SOS pressed by {s.by}</b><div className="muted">{s.rideId} · {townName(s.townId)} · {fmtTime(s.at)}</div></div>
                <Link className="btn sm danger" to="/rides">Open</Link>
              </div>
            ))}
            {a.searchingLong.map((x) => (
              <div key={x.id} className="attn attn-red">
                <span>⏳</span>
                <div><b>Searching for over 90 s</b><div className="muted">{x.id} · {x.pickup.name} · {SERVICE[x.service].label}</div></div>
                <Link className="btn sm" to="/live">Map</Link>
              </div>
            ))}
            {a.unfulfilled.length > 0 && (
              <div className="attn attn-orange">
                <span>🚫</span>
                <div><b>{a.unfulfilled.length} unfulfilled request{a.unfulfilled.length > 1 ? 's' : ''} today</b><div className="muted">No captain accepted in 3 rounds · call the rider back</div></div>
                <Link className="btn sm" to="/rides?status=unfulfilled">View</Link>
              </div>
            )}
            {a.pendingCaptains.map((c) => (
              <div key={c.id} className="attn attn-yellow">
                <span>🪪</span>
                <div><b>{c.name}</b> awaiting verification<div className="muted">{SERVICE[c.vehicleType].label} · {townName(c.townId)} · score {c.verificationScore}</div></div>
                <Link className="btn sm" to={`/captains/${c.id}`}>Verify</Link>
              </div>
            ))}
            {a.lowRated.map((c) => (
              <div key={c.id} className="attn attn-orange">
                <span>⭐</span>
                <div><b>{c.name}</b> rated {c.rating}<div className="muted">{c.trips} trips · below 4.2</div></div>
                <Link className="btn sm" to={`/captains/${c.id}`}>Review</Link>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
