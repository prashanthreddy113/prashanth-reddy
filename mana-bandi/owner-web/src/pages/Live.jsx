import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Circle, MapContainer, Marker, Polyline, Popup, useMap } from 'react-leaflet'
import MapTiles, { OFFLINE_MAP } from '../components/MapTiles'
import { api } from '../lib/api'
import { useTown } from '../lib/town'
import { SERVICE, fmtTime, inr } from '../lib/format'
import { captainIcon, pointIcon } from '../components/mapIcons'
import StatusPill from '../components/StatusPill'

const NKD = [18.033, 77.755]

function Recenter({ center, zoom }) {
  const map = useMap()
  useEffect(() => { map.setView(center, zoom) }, [map, center, zoom])
  return null
}

export default function Live() {
  const { towns, townId, town } = useTown()
  const [captains, setCaptains] = useState([])
  const [requests, setRequests] = useState([])
  const [showLines, setShowLines] = useState(true)

  useEffect(() => {
    let alive = true
    const load = () => Promise.all([api.live.captains(townId), api.live.requests(townId)]).then(([c, r]) => { if (alive) { setCaptains(c); setRequests(r) } })
    load()
    const id = setInterval(load, 3000)
    return () => { alive = false; clearInterval(id) }
  }, [townId])

  const center = useMemo(() => (town ? [town.center.lat, town.center.lng] : NKD), [town])
  const zoom = town ? 13 : 10
  const capById = useMemo(() => Object.fromEntries(captains.map((c) => [c.id, c])), [captains])
  const active = requests.filter((r) => r.status !== 'searching')

  return (
    <div className="live-layout">
      <div className="card map-card">
        <div className="card-head">
          <h2>{town ? `${town.nameEn} · ${town.nameTe}` : 'All towns'} <span className="muted">· {captains.length} online</span></h2>
          <div className="row gap">
            <span className="legend"><i className="cap-dot cap-bike" /> Bike</span>
            <span className="legend"><i className="cap-dot cap-auto" /> Auto</span>
            <label className="check-inline"><input type="checkbox" checked={showLines} onChange={(e) => setShowLines(e.target.checked)} /> trip lines</label>
          </div>
        </div>
        <MapContainer center={NKD} zoom={13} className={`map map-live ${OFFLINE_MAP ? 'offline' : ''}`} scrollWheelZoom>
          <Recenter center={center} zoom={zoom} />
          <MapTiles />
          {towns.filter((t) => t.enabled && (townId === 'all' || t.id === townId)).map((t) => (
            <Circle key={t.id} center={[t.center.lat, t.center.lng]} radius={t.radiusKm * 1000} pathOptions={{ color: '#128A46', weight: 1, fillOpacity: 0.04, dashArray: '4 6' }} />
          ))}
          {captains.map((c) => (
            <Marker key={c.id} position={[c.pos.lat, c.pos.lng]} icon={captainIcon(c.vehicleType)}>
              <Popup>
                <div className="popup">
                  <b>{c.name}</b> <span className="te muted">{c.nameTe}</span><br />
                  {SERVICE[c.vehicleType].emoji} {c.vehicleModel}<br />
                  <span className="mono big">{c.vehicleNo}</span><br />
                  {c.tripsToday} trips today · ⭐ {c.rating ?? '—'}<br />
                  📞 <a href={`tel:${c.phone}`}>{c.phone}</a><br />
                  <Link to={`/captains/${c.id}`}>Open profile →</Link>
                </div>
              </Popup>
            </Marker>
          ))}
          {showLines && active.map((r) => (
            <Polyline key={r.id} positions={[[r.pickup.lat, r.pickup.lng], [r.drop.lat, r.drop.lng]]} pathOptions={{ color: SERVICE[r.service].color, weight: 3, opacity: 0.85, dashArray: r.status === 'assigned' ? '6 6' : null }} />
          ))}
          {requests.map((r) => (
            <Marker key={r.id + '_p'} position={[r.pickup.lat, r.pickup.lng]} icon={pointIcon(r.status === 'searching' ? 'searching' : 'pickup')}>
              <Popup><div className="popup"><b>{SERVICE[r.service].emoji} {r.id}</b><br />{r.pickup.name} → {r.drop.name}<br />{inr(r.fareQuoted)} · <StatusPill status={r.status} /></div></Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
      <div className="card live-side">
        <div className="card-head"><h2>Open requests</h2><span className="count">{requests.length}</span></div>
        <div className="live-list">
          {requests.length === 0 && <div className="muted pad">Nothing open</div>}
          {requests.map((r) => (
            <div key={r.id} className="live-item">
              <div className="row between">
                <b>{SERVICE[r.service].emoji} {r.id}</b>
                <StatusPill status={r.status} />
              </div>
              <div className="muted">{fmtTime(r.requestedAt)} · {r.pickup.name} → {r.drop.name}</div>
              <div>{inr(r.fareQuoted)} · {r.captainId ? (capById[r.captainId]?.name || r.captainId) : 'no captain yet'}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
