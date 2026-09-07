import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useToast } from '../lib/toast'
import { money } from '../lib/format'
import Modal from '../components/Modal'

const EMPTY = { name: '', area: 'Manikonda', address: '', contactName: '', contactPhone: '', flats: '', latitude: 17.4029, longitude: 78.3812, geofenceRadiusM: 150, ratePerKl: '', preferredOperatorId: '', subscriptionPerMonth: 1500, isActive: true }

export default function Communities() {
  const { isAdmin, isRwa } = useAuth()
  const toast = useToast()
  const [items, setItems] = useState(null)
  const [operators, setOperators] = useState([])
  const [modal, setModal] = useState(null)

  const load = () => api.communities(true).then(setItems).catch((e) => toast.error(e.message))
  useEffect(() => { load(); api.operators().then(setOperators).catch(() => {}) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const save = async (e) => {
    e.preventDefault()
    const body = { ...modal, flats: modal.flats === '' ? null : Number(modal.flats), latitude: Number(modal.latitude), longitude: Number(modal.longitude), geofenceRadiusM: Number(modal.geofenceRadiusM), ratePerKl: modal.ratePerKl === '' ? null : Number(modal.ratePerKl), preferredOperatorId: modal.preferredOperatorId ? Number(modal.preferredOperatorId) : null, subscriptionPerMonth: Number(modal.subscriptionPerMonth) }
    try { if (modal.id) await api.updateCommunity(modal.id, body); else await api.createCommunity(body); toast.success('Saved.'); setModal(null); load() } catch (err) { toast.error(err.message) }
  }
  const locate = () => navigator.geolocation?.getCurrentPosition((p) => setModal({ ...modal, latitude: p.coords.latitude.toFixed(6), longitude: p.coords.longitude.toFixed(6) }), () => toast.error('Could not read your location.'))

  return (
    <>
      <div className="card">
        <div className="card-head"><div><h2>Communities</h2><p className="muted small">A delivery is attributed to the community whose geofence the tanker was inside when pumping.</p></div>{isAdmin && <button className="btn primary sm" onClick={() => setModal({ ...EMPTY })}>+ Add community</button>}</div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Community</th><th>Contact</th><th>Geofence</th><th className="num">Rate</th><th>Preferred operator</th><th className="num">Subscription</th><th></th></tr></thead>
            <tbody>
              {!items && <tr><td colSpan="7" className="loading">Loading…</td></tr>}
              {items?.map((c) => (
                <tr key={c.id}>
                  <td><div className="primary">{c.name}{!c.isActive && <span className="chip" style={{ marginLeft: 6 }}>inactive</span>}</div><div className="secondary">{c.area}{c.flats ? ` · ${c.flats} flats` : ''}</div></td>
                  <td>{c.contactName || '—'}<div className="secondary">{c.contactPhone}</div></td>
                  <td className="small"><a href={`https://www.google.com/maps?q=${c.latitude},${c.longitude}`} target="_blank" rel="noreferrer">{c.latitude.toFixed(4)}, {c.longitude.toFixed(4)}</a><div className="secondary">radius {c.geofenceRadiusM} m</div></td>
                  <td className="num">{c.ratePerKl ? `${money(c.ratePerKl)}/kL` : <span className="muted">operator rate</span>}</td>
                  <td>{c.preferredOperatorName || '—'}</td>
                  <td className="num">{money(c.subscriptionPerMonth)}/mo</td>
                  <td className="right">{(isAdmin || isRwa) && <button className="btn sm" onClick={() => setModal({ ...EMPTY, ...c, flats: c.flats ?? '', ratePerKl: c.ratePerKl ?? '', preferredOperatorId: c.preferredOperatorId ?? '' })}>Edit</button>}</td>
                </tr>
              ))}
              {items?.length === 0 && <tr><td colSpan="7" className="empty">No communities yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      {modal && (
        <Modal title={modal.id ? modal.name : 'Add community'} onClose={() => setModal(null)} wide>
          <form onSubmit={save}>
            <div className="form-grid">
              <div className="field"><label>Name</label><input value={modal.name} onChange={(e) => setModal({ ...modal, name: e.target.value })} required disabled={isRwa} /></div>
              <div className="field"><label>Area</label><input value={modal.area} onChange={(e) => setModal({ ...modal, area: e.target.value })} disabled={isRwa} /></div>
              <div className="field full"><label>Address</label><input value={modal.address || ''} onChange={(e) => setModal({ ...modal, address: e.target.value })} /></div>
              <div className="field"><label>Contact name</label><input value={modal.contactName || ''} onChange={(e) => setModal({ ...modal, contactName: e.target.value })} /></div>
              <div className="field"><label>Contact phone</label><input value={modal.contactPhone || ''} onChange={(e) => setModal({ ...modal, contactPhone: e.target.value })} /></div>
              <div className="field"><label>Flats</label><input type="number" value={modal.flats} onChange={(e) => setModal({ ...modal, flats: e.target.value })} /></div>
              <div className="field"><label>Preferred operator</label><select value={modal.preferredOperatorId} onChange={(e) => setModal({ ...modal, preferredOperatorId: e.target.value })}><option value="">—</option>{operators.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></div>
              {isAdmin && <>
                <div className="field"><label>Latitude</label><input type="number" step="0.000001" value={modal.latitude} onChange={(e) => setModal({ ...modal, latitude: e.target.value })} required /></div>
                <div className="field"><label>Longitude</label><input type="number" step="0.000001" value={modal.longitude} onChange={(e) => setModal({ ...modal, longitude: e.target.value })} required /><span className="help"><a href="#loc" onClick={(e) => { e.preventDefault(); locate() }}>Use my current location</a> (stand at the sump inlet)</span></div>
                <div className="field"><label>Geofence radius (m)</label><input type="number" min="30" max="2000" value={modal.geofenceRadiusM} onChange={(e) => setModal({ ...modal, geofenceRadiusM: e.target.value })} /></div>
                <div className="field"><label>Negotiated rate per kL (₹)</label><input type="number" step="1" value={modal.ratePerKl} onChange={(e) => setModal({ ...modal, ratePerKl: e.target.value })} placeholder="blank = operator rate" /></div>
                <div className="field"><label>Platform subscription per month (₹)</label><input type="number" step="50" value={modal.subscriptionPerMonth} onChange={(e) => setModal({ ...modal, subscriptionPerMonth: e.target.value })} /></div>
                <div className="field"><label><input type="checkbox" checked={modal.isActive} onChange={(e) => setModal({ ...modal, isActive: e.target.checked })} /> Active</label></div>
              </>}
            </div>
            <div className="form-actions"><button type="button" className="btn" onClick={() => setModal(null)}>Cancel</button><button className="btn primary" type="submit">Save</button></div>
          </form>
        </Modal>
      )}
    </>
  )
}
