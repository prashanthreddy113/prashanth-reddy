import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Circle, MapContainer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet'
import MapTiles, { OFFLINE_MAP } from '../components/MapTiles'
import { api } from '../lib/api'
import { useTown } from '../lib/town'
import { useToast } from '../lib/toast'
import { useAuth } from '../lib/auth'
import { SERVICE } from '../lib/format'
import { LANDMARK_KINDS } from '../mock/towns'
import { centreIcon, landmarkIcon } from '../components/mapIcons'
import Modal from '../components/Modal'

const kindIcon = (k) => LANDMARK_KINDS.find((x) => x.kind === k)?.icon || '📍'

function FlyTo({ center, zoomFor }) {
  const map = useMap()
  const key = `${center.lat},${center.lng}`
  useEffect(() => { map.flyTo([center.lat, center.lng], zoomFor) }, [map, key, zoomFor]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

function ClickCapture({ enabled, onClick }) {
  useMapEvents({ click: (e) => { if (enabled) onClick(e.latlng) } })
  return null
}

const zoomForRadius = (km) => (km <= 5 ? 13 : km <= 12 ? 12 : km <= 25 ? 11 : 10)

export default function Areas() {
  const { towns, reloadTowns, townId: globalTown, locked } = useTown()
  const { user } = useAuth()
  const toast = useToast()
  const [selectedId, setSelectedId] = useState(null)
  const [draft, setDraft] = useState(null)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [addMode, setAddMode] = useState(false)
  const [newLm, setNewLm] = useState(null)
  const [addTown, setAddTown] = useState(false)
  const [newTown, setNewTown] = useState({ nameEn: '', nameTe: '', lat: '', lng: '' })
  const centreRef = useRef(null)

  useEffect(() => {
    if (!towns.length) return
    const want = locked ? user.townId : selectedId || (globalTown !== 'all' ? globalTown : towns[0].id)
    const t = towns.find((x) => x.id === want) || towns[0]
    if (!selectedId || selectedId !== t.id) { setSelectedId(t.id); setDraft(JSON.parse(JSON.stringify(t))); setDirty(false) }
  }, [towns, selectedId, globalTown, locked, user])

  const select = (id) => {
    if (dirty && !window.confirm('Discard unsaved changes?')) return
    setSelectedId(id)
    setDraft(JSON.parse(JSON.stringify(towns.find((t) => t.id === id))))
    setDirty(false)
    setAddMode(false)
  }
  const patch = useCallback((p) => { setDraft((d) => ({ ...d, ...p })); setDirty(true) }, [])
  const patchFare = (svc, key, val) => patch({ fares: { ...draft.fares, [svc]: { ...draft.fares[svc], [key]: Number(val) } } })

  const save = async () => {
    setSaving(true)
    try {
      await api.towns.save(draft)
      await reloadTowns()
      setDirty(false)
      toast.success(`${draft.nameEn} saved · radius ${draft.radiusKm} km, ${draft.landmarks.length} landmarks`)
    } catch (e) { toast.error(e.message) } finally { setSaving(false) }
  }

  const onMapClick = (latlng) => {
    setNewLm({ kind: 'other', nameTe: '', nameEn: '', lat: +latlng.lat.toFixed(5), lng: +latlng.lng.toFixed(5) })
  }
  const commitLandmark = () => {
    if (!newLm.nameEn && !newLm.nameTe) { toast.error('Give the landmark a name'); return }
    patch({ landmarks: [...draft.landmarks, { ...newLm, id: `${draft.id}_l${Date.now()}` }] })
    setNewLm(null)
    setAddMode(false)
  }
  const removeLandmark = (id) => patch({ landmarks: draft.landmarks.filter((l) => l.id !== id) })
  const updateLandmark = (id, p) => patch({ landmarks: draft.landmarks.map((l) => (l.id === id ? { ...l, ...p } : l)) })

  const createTown = async () => {
    if (!newTown.nameEn || !newTown.lat || !newTown.lng) { toast.error('Name and centre coordinates are required'); return }
    const t = await api.towns.create({ nameEn: newTown.nameEn, nameTe: newTown.nameTe, center: { lat: +newTown.lat, lng: +newTown.lng } })
    await reloadTowns()
    setAddTown(false)
    setNewTown({ nameEn: '', nameTe: '', lat: '', lng: '' })
    setSelectedId(t.id); setDraft(t); setDirty(false)
    toast.success(`${t.nameEn} added (disabled until you turn it on)`)
  }

  const zoom = useMemo(() => zoomForRadius(draft?.radiusKm || 8), [draft?.radiusKm])
  if (!draft) return <div className="loading">Loading…</div>

  return (
    <div className="areas-layout">
      <div className="areas-left">
        <div className="card">
          <div className="card-head"><h2>Towns</h2>{!locked && <button className="btn sm primary" onClick={() => setAddTown(true)}>＋ Add town</button>}</div>
          <div className="town-list">
            {towns.filter((t) => !locked || t.id === user.townId).map((t) => (
              <button key={t.id} className={`town-item ${t.id === selectedId ? 'active' : ''}`} onClick={() => select(t.id)}>
                <span className={`dot ${t.enabled ? 'on' : 'off'}`} />
                <span><b>{t.nameEn}</b> <span className="te muted">{t.nameTe}</span><br /><small className="muted">{t.radiusKm} km · {t.landmarks.length} landmarks · {t.enabled ? 'live' : 'off'}</small></span>
              </button>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h2>{draft.nameEn} <span className="te muted">{draft.nameTe}</span></h2>
            <label className="switch"><input type="checkbox" checked={draft.enabled} onChange={(e) => patch({ enabled: e.target.checked })} /><span>{draft.enabled ? 'Enabled' : 'Disabled'}</span></label>
          </div>
          <div className="card-body form-grid">
            <label className="field"><span>Name (English)</span><input value={draft.nameEn} onChange={(e) => patch({ nameEn: e.target.value })} /></label>
            <label className="field"><span>Name (Telugu)</span><input className="te" value={draft.nameTe} onChange={(e) => patch({ nameTe: e.target.value })} /></label>
            <label className="field"><span>Centre latitude</span><input type="number" step="0.0001" value={draft.center.lat} onChange={(e) => patch({ center: { ...draft.center, lat: +e.target.value } })} /></label>
            <label className="field"><span>Centre longitude</span><input type="number" step="0.0001" value={draft.center.lng} onChange={(e) => patch({ center: { ...draft.center, lng: +e.target.value } })} /></label>

            <div className="field span2">
              <span>Service radius — <b>{draft.radiusKm} km</b> <small className="muted">(pickup must be inside this circle)</small></span>
              <div className="row gap">
                <input type="range" min={2} max={40} step={0.5} value={draft.radiusKm} onChange={(e) => patch({ radiusKm: +e.target.value })} className="grow" />
                <input type="number" min={2} max={40} step={0.5} value={draft.radiusKm} onChange={(e) => patch({ radiusKm: Math.min(40, Math.max(2, +e.target.value)) })} className="w80" />
              </div>
            </div>
            <div className="field span2">
              <span>Extended radius for parcel drops — <b>{draft.extendedRadiusKm} km</b> <small className="muted">(optional, ≥ service radius)</small></span>
              <div className="row gap">
                <input type="range" min={draft.radiusKm} max={60} step={1} value={draft.extendedRadiusKm} onChange={(e) => patch({ extendedRadiusKm: +e.target.value })} className="grow" />
                <input type="number" min={draft.radiusKm} max={60} value={draft.extendedRadiusKm} onChange={(e) => patch({ extendedRadiusKm: Math.max(draft.radiusKm, +e.target.value) })} className="w80" />
              </div>
            </div>
            <label className="check-row span2">
              <input type="checkbox" checked={draft.enforceRadius} onChange={(e) => patch({ enforceRadius: e.target.checked })} />
              <span><b>Accept requests only inside radius</b><br /><small className="muted">When on, the backend rejects a booking whose pickup is outside the town circle with a spoken "ఈ ప్రాంతంలో సేవ లేదు" message and shows the support number. Drops may go up to the extended radius (parcels) or the service radius (rides). When off, out-of-area requests fall into the manual dispatch queue instead of being rejected.</small></span>
            </label>

            <label className="field"><span>Night starts</span><input type="time" value={draft.nightStart} onChange={(e) => patch({ nightStart: e.target.value })} /></label>
            <label className="field"><span>Night ends</span><input type="time" value={draft.nightEnd} onChange={(e) => patch({ nightEnd: e.target.value })} /></label>
            <label className="field"><span>Support phone</span><input value={draft.supportPhone} onChange={(e) => patch({ supportPhone: e.target.value })} /></label>
            <label className="field"><span>Missed-call booking number</span><input value={draft.missedCallNo} onChange={(e) => patch({ missedCallNo: e.target.value })} /></label>
          </div>

          <div className="card-head"><h2>Fare table</h2><small className="muted">₹ · shown to the rider before booking, no surge</small></div>
          <div className="table-wrap">
            <table className="fares">
              <thead><tr><th>Service</th><th>Base</th><th>Per km</th><th>Minimum</th><th>Night %</th></tr></thead>
              <tbody>
                {['bike', 'auto', 'parcel'].map((s) => (
                  <tr key={s}>
                    <td><span className={`svc-dot svc-${s}`} />{SERVICE[s].emoji} {SERVICE[s].label} <span className="te muted">{SERVICE[s].te}</span>{s === 'parcel' && <div className="muted small">base = small; medium ₹50, big ₹80 within 5 km</div>}</td>
                    {['base', 'perKm', 'min', 'nightPct'].map((k) => (
                      <td key={k}><input type="number" min={0} value={draft.fares[s][k]} onChange={(e) => patchFare(s, k, e.target.value)} className="w80" /></td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="card-foot">
            <span className={dirty ? 'unsaved' : 'muted'}>{dirty ? 'Unsaved changes' : 'Saved'}</span>
            <button className="btn primary" disabled={!dirty || saving} onClick={save}>{saving ? 'Saving…' : 'Save town'}</button>
          </div>
        </div>
      </div>

      <div className="areas-right">
        <div className="card map-card">
          <div className="card-head">
            <h2>Map <small className="muted">· drag the మ marker to move the centre</small></h2>
            <button className={`btn sm ${addMode ? 'gold' : ''}`} onClick={() => { setAddMode((m) => !m); setNewLm(null) }}>{addMode ? 'Click the map to place a landmark…' : '＋ Add landmark by clicking map'}</button>
          </div>
          <MapContainer center={[draft.center.lat, draft.center.lng]} zoom={zoom} className={`map map-areas ${addMode ? 'crosshair' : ''} ${OFFLINE_MAP ? 'offline' : ''}`} scrollWheelZoom>
            <FlyTo center={draft.center} zoomFor={zoom} />
            <ClickCapture enabled={addMode && !newLm} onClick={onMapClick} />
            <MapTiles />
            <Circle center={[draft.center.lat, draft.center.lng]} radius={draft.extendedRadiusKm * 1000} pathOptions={{ color: '#E8641B', weight: 1.5, dashArray: '6 6', fillOpacity: 0.03 }} />
            <Circle center={[draft.center.lat, draft.center.lng]} radius={draft.radiusKm * 1000} pathOptions={{ color: '#128A46', weight: 2, fillColor: '#128A46', fillOpacity: 0.08 }} />
            <Marker
              ref={centreRef}
              position={[draft.center.lat, draft.center.lng]}
              icon={centreIcon}
              draggable
              eventHandlers={{ dragend: () => { const p = centreRef.current?.getLatLng(); if (p) patch({ center: { lat: +p.lat.toFixed(5), lng: +p.lng.toFixed(5) } }) } }}
            >
              <Popup>Town centre · {draft.center.lat}, {draft.center.lng}</Popup>
            </Marker>
            {draft.landmarks.map((l) => (
              <Marker key={l.id} position={[l.lat, l.lng]} icon={landmarkIcon(kindIcon(l.kind))}>
                <Popup><b className="te">{l.nameTe}</b><br />{l.nameEn}<br /><small className="muted">{l.lat}, {l.lng}</small></Popup>
              </Marker>
            ))}
            {newLm && <Marker position={[newLm.lat, newLm.lng]} icon={landmarkIcon('✨')} />}
          </MapContainer>
          <div className="map-legend">
            <span><i className="sw sw-green" /> service radius {draft.radiusKm} km</span>
            <span><i className="sw sw-orange" /> extended (parcel drop) {draft.extendedRadiusKm} km</span>
          </div>
        </div>

        {newLm && (
          <div className="card new-lm">
            <div className="card-head"><h2>New landmark</h2><span className="muted">{newLm.lat}, {newLm.lng}</span></div>
            <div className="card-body form-grid">
              <label className="field"><span>Type</span>
                <select value={newLm.kind} onChange={(e) => setNewLm({ ...newLm, kind: e.target.value })}>{LANDMARK_KINDS.map((k) => <option key={k.kind} value={k.kind}>{k.icon} {k.label}</option>)}</select>
              </label>
              <label className="field"><span>Telugu name</span><input className="te" placeholder="బస్టాండ్" value={newLm.nameTe} onChange={(e) => setNewLm({ ...newLm, nameTe: e.target.value })} /></label>
              <label className="field"><span>English name</span><input placeholder="Bus stand" value={newLm.nameEn} onChange={(e) => setNewLm({ ...newLm, nameEn: e.target.value })} /></label>
              <div className="field row gap end"><button className="btn" onClick={() => setNewLm(null)}>Cancel</button><button className="btn primary" onClick={commitLandmark}>Add to list</button></div>
            </div>
          </div>
        )}

        <div className="card">
          <div className="card-head"><h2>Landmarks <span className="muted">· saved places riders tap or say</span></h2><span className="count">{draft.landmarks.length}</span></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Type</th><th>Telugu</th><th>English</th><th>Lat, Lng</th><th /></tr></thead>
              <tbody>
                {draft.landmarks.map((l) => (
                  <tr key={l.id}>
                    <td><select value={l.kind} onChange={(e) => updateLandmark(l.id, { kind: e.target.value })}>{LANDMARK_KINDS.map((k) => <option key={k.kind} value={k.kind}>{k.icon} {k.label}</option>)}</select></td>
                    <td><input className="te" value={l.nameTe} onChange={(e) => updateLandmark(l.id, { nameTe: e.target.value })} /></td>
                    <td><input value={l.nameEn} onChange={(e) => updateLandmark(l.id, { nameEn: e.target.value })} /></td>
                    <td className="mono small">{l.lat}, {l.lng}</td>
                    <td><button className="btn ghost sm danger-text" onClick={() => removeLandmark(l.id)}>Remove</button></td>
                  </tr>
                ))}
                {draft.landmarks.length === 0 && <tr><td colSpan={5} className="muted">No landmarks yet — click the map to add the bus stand, hospital and market first.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card note">
          <div className="card-body">
            <h3>How the backend enforces the radius</h3>
            <ul>
              <li><code>POST /api/rides</code> computes <code>ST_DWithin(pickup, town.centre, radius_km)</code> in PostGIS; outside → <code>422 OUT_OF_AREA</code> with the town's support number, and the app speaks it.</li>
              <li>Drop is checked against <code>extended_radius_km</code> for parcels and <code>radius_km</code> for rides; a drop beyond it is allowed only through the manual dispatch console.</li>
              <li>Dispatch offers the request to online captains within {3} km of pickup (Redis GEORADIUS), 15 s per offer, 3 rounds, then the manual queue.</li>
              <li>Landmarks are served from <code>town_places</code>; the rider app never calls a paid geocoder.</li>
            </ul>
          </div>
        </div>
      </div>

      <Modal open={addTown} title="Add town" onClose={() => setAddTown(false)} footer={<><button className="btn" onClick={() => setAddTown(false)}>Cancel</button><button className="btn primary" onClick={createTown}>Create</button></>}>
        <div className="form-grid">
          <label className="field"><span>Name (English)</span><input value={newTown.nameEn} onChange={(e) => setNewTown({ ...newTown, nameEn: e.target.value })} placeholder="Sangareddy" /></label>
          <label className="field"><span>Name (Telugu)</span><input className="te" value={newTown.nameTe} onChange={(e) => setNewTown({ ...newTown, nameTe: e.target.value })} placeholder="సంగారెడ్డి" /></label>
          <label className="field"><span>Centre latitude</span><input type="number" step="0.0001" value={newTown.lat} onChange={(e) => setNewTown({ ...newTown, lat: e.target.value })} placeholder="17.6248" /></label>
          <label className="field"><span>Centre longitude</span><input type="number" step="0.0001" value={newTown.lng} onChange={(e) => setNewTown({ ...newTown, lng: e.target.value })} placeholder="78.0866" /></label>
          <p className="muted span2">The town starts disabled with an 8 km radius and the Narayanakhed fare table. Adjust, add landmarks, then enable.</p>
        </div>
      </Modal>
    </div>
  )
}
