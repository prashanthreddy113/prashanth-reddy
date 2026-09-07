import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useToast } from '../lib/toast'
import { money, litres, fmtDateTime, statusLabel } from '../lib/format'
import { StatusBadge, GradeChip } from '../components/StatusBadge'

const STATUSES = ['InProgress', 'Completed', 'Verified', 'Disputed', 'Discarded']

export default function Deliveries() {
  const { isRwa } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [data, setData] = useState(null)
  const [communities, setCommunities] = useState([])
  const page = Number(params.get('page') || 1)
  const filters = { status: params.get('status') || '', communityId: params.get('communityId') || '', grade: params.get('grade') || '', from: params.get('from') || '', to: params.get('to') || '' }

  useEffect(() => { if (!isRwa) api.communities().then(setCommunities).catch(() => {}) }, [isRwa])
  useEffect(() => {
    api.deliveries({ ...filters, page, pageSize: 25 }).then(setData).catch((e) => toast.error(e.message))
  }, [params]) // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k, v) => { const p = new URLSearchParams(params); v ? p.set(k, v) : p.delete(k); p.delete('page'); setParams(p) }
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1

  return (
    <div className="card">
      <div className="card-head">
        <div className="toolbar">
          <select value={filters.status} onChange={(e) => set('status', e.target.value)}>
            <option value="">All statuses</option>
            {STATUSES.filter((s) => !isRwa || s !== 'Discarded').map((s) => <option key={s} value={s}>{statusLabel[s]}</option>)}
          </select>
          {!isRwa && (
            <select value={filters.communityId} onChange={(e) => set('communityId', e.target.value)}>
              <option value="">All communities</option>
              {communities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          <select value={filters.grade} onChange={(e) => set('grade', e.target.value)}>
            <option value="">Any quality</option><option value="Good">Good</option><option value="Acceptable">Acceptable</option><option value="Poor">Poor</option>
          </select>
          <input type="date" value={filters.from} onChange={(e) => set('from', e.target.value)} />
          <input type="date" value={filters.to} onChange={(e) => set('to', e.target.value)} />
        </div>
        <span className="muted small">{data ? `${data.total} deliveries` : ''}</span>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Started</th><th>Tanker</th>{!isRwa && <th>Community</th>}<th className="num">Litres</th><th>Quality</th><th>Proof</th><th>Status</th><th className="num">Amount</th></tr></thead>
          <tbody>
            {!data && <tr><td colSpan="8" className="loading">Loading…</td></tr>}
            {data?.items.map((d) => (
              <tr key={d.id} className="clickable" onClick={() => navigate(`/deliveries/${d.id}`)}>
                <td><div className="primary">{fmtDateTime(d.startedAt)}</div><div className="secondary">{d.durationMinutes} min · #{d.id}</div></td>
                <td><div className="primary">{d.tankerRegistration || d.deviceCode}</div><div className="secondary">{d.driverName || d.operatorName}</div></td>
                {!isRwa && <td>{d.communityName ? <><div className="primary">{d.communityName}</div><div className="secondary">{d.geofenceMatched ? `geofence ✓ ${d.distanceToCommunityM ?? ''} m` : 'assigned manually'}</div></> : <span className="chip warn">Unmatched</span>}</td>}
                <td className="num"><b>{litres(d.litresDelivered)}</b></td>
                <td><GradeChip grade={d.qualityGrade} tds={d.avgTdsPpm} ntu={d.avgTurbidityNtu} /></td>
                <td className="small">{d.hasSealPhoto ? '📷 seal' : <span className="muted">no photo</span>}{d.tamperFlag && <span className="chip bad" style={{ marginLeft: 6 }}>TAMPER</span>}</td>
                <td><StatusBadge status={d.status} pulse />{d.openDisputes > 0 && <span className="chip bad" style={{ marginLeft: 6 }}>dispute</span>}</td>
                <td className="num">{money(d.amount)}</td>
              </tr>
            ))}
            {data?.items.length === 0 && <tr><td colSpan="8" className="empty"><b>No deliveries match.</b>Try widening the filters.</td></tr>}
          </tbody>
        </table>
      </div>
      {data && pages > 1 && (
        <div className="pager">
          <span>Page {data.page} of {pages}</span>
          <div className="row">
            <button className="btn sm" disabled={page <= 1} onClick={() => { const p = new URLSearchParams(params); p.set('page', page - 1); setParams(p) }}>Previous</button>
            <button className="btn sm" disabled={page >= pages} onClick={() => { const p = new URLSearchParams(params); p.set('page', page + 1); setParams(p) }}>Next</button>
          </div>
        </div>
      )}
    </div>
  )
}
