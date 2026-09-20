import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useTown } from '../lib/town'
import { SERVICE, num } from '../lib/format'
import StatusPill from '../components/StatusPill'
import Empty from '../components/Empty'

export default function Captains() {
  const { townId, towns } = useTown()
  const navigate = useNavigate()
  const [rows, setRows] = useState(null)
  const [f, setF] = useState({ vehicleType: '', status: '', q: '' })

  useEffect(() => { api.captains.list({ townId, ...f }).then(setRows) }, [townId, f])
  const townName = (id) => towns.find((t) => t.id === id)?.nameEn || id

  return (
    <div className="card">
      <div className="card-head">
        <div className="filters">
          <input placeholder="Search name, phone, vehicle…" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} />
          <select value={f.vehicleType} onChange={(e) => setF({ ...f, vehicleType: e.target.value })}>
            <option value="">All vehicles</option><option value="bike">🏍️ Bike</option><option value="auto">🛺 Auto</option>
          </select>
          <select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
            <option value="">All statuses</option>
            {['pending', 'verified', 'rejected', 'blocked', 'online'].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <Link className="btn primary" to="/captains/new">＋ Add captain</Link>
      </div>
      <div className="table-wrap tall">
        {rows && rows.length === 0 && <Empty text="No captains match" />}
        {rows && rows.length > 0 && (
          <table className="clickable">
            <thead><tr><th>Photo</th><th>Name</th><th>Phone</th><th>Vehicle</th><th>Town</th><th>Rating</th><th>Trips</th><th>Status</th><th>Verification</th></tr></thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} onClick={() => navigate(`/captains/${c.id}`)}>
                  <td><div className={`avatar av-${c.vehicleType}`}>{c.name.slice(0, 1)}</div></td>
                  <td><b>{c.name}</b> <span className="te muted">{c.nameTe}</span>{c.online && <span className="online-dot" title="online" />}</td>
                  <td className="mono">{c.phone}</td>
                  <td>{SERVICE[c.vehicleType].emoji} {c.vehicleModel}<div className="mono small">{c.vehicleNo}</div></td>
                  <td>{townName(c.townId)}</td>
                  <td>{c.rating ? `⭐ ${c.rating}` : <span className="muted">—</span>}</td>
                  <td>{num(c.trips)}</td>
                  <td><StatusPill status={c.status} />{c.online && <> <StatusPill status="online" /></>}</td>
                  <td><div className="score"><i style={{ width: `${c.verificationScore}%` }} className={c.verificationScore >= 85 ? 'ok' : c.verificationScore >= 65 ? 'mid' : 'bad'} /></div><small>{c.verificationScore}</small></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
