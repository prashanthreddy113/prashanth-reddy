import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useToast } from '../lib/toast'
import { ago, fmtDate } from '../lib/format'
import Modal from '../components/Modal'

export default function Fleet() {
  const { isAdmin, user } = useAuth()
  const toast = useToast()
  const [tankers, setTankers] = useState([])
  const [devices, setDevices] = useState([])
  const [operators, setOperators] = useState([])
  const [operatorId, setOperatorId] = useState(user.operatorId || '')
  const [tankerModal, setTankerModal] = useState(null)
  const [deviceModal, setDeviceModal] = useState(null)
  const [issued, setIssued] = useState(null)

  const load = () => Promise.all([api.tankers({ operatorId }), api.devices({ operatorId })]).then(([t, d]) => { setTankers(t); setDevices(d) }).catch((e) => toast.error(e.message))
  useEffect(() => { load() }, [operatorId]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (isAdmin) api.operators().then((o) => { setOperators(o); if (!operatorId && o[0]) setOperatorId(o[0].id) }) }, [isAdmin]) // eslint-disable-line react-hooks/exhaustive-deps

  const saveTanker = async (form) => {
    try {
      if (form.id) await api.updateTanker(form.id, form); else await api.createTanker(form, operatorId)
      toast.success('Tanker saved.'); setTankerModal(null); load()
    } catch (e) { toast.error(e.message) }
  }
  const saveDevice = async (form) => {
    try {
      if (form.id) { await api.updateDevice(form.id, form); toast.success('Device updated.') }
      else { const r = await api.registerDevice(form, operatorId); setIssued(r) }
      setDeviceModal(null); load()
    } catch (e) { toast.error(e.message) }
  }
  const rotate = async (d) => { try { setIssued(await api.rotateDeviceKey(d.id)); load() } catch (e) { toast.error(e.message) } }

  return (
    <>
      {isAdmin && <div className="toolbar"><label className="small muted">Operator</label><select value={operatorId} onChange={(e) => setOperatorId(e.target.value)}>{operators.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></div>}
      <div className="card">
        <div className="card-head"><h2>Tankers</h2><button className="btn primary sm" onClick={() => setTankerModal({ registrationNumber: '', capacityLitres: 10000, driverName: '', driverPhone: '', isActive: true })}>+ Add tanker</button></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Registration</th><th className="num">Capacity</th><th>Driver</th><th>Device</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {tankers.map((t) => (
                <tr key={t.id}>
                  <td className="primary">{t.registrationNumber}</td>
                  <td className="num">{t.capacityLitres.toLocaleString('en-IN')} L</td>
                  <td>{t.driverName || '—'}<div className="secondary">{t.driverPhone}</div></td>
                  <td>{t.device ? <span className="mono">{t.device.deviceCode}</span> : <span className="chip warn">No meter</span>}</td>
                  <td>{t.isActive ? <span className="badge green">Active</span> : <span className="badge grey">Inactive</span>}</td>
                  <td className="right"><button className="btn sm" onClick={() => setTankerModal({ ...t })}>Edit</button></td>
                </tr>
              ))}
              {tankers.length === 0 && <tr><td colSpan="6" className="empty">No tankers yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div><h2>Devices</h2><p className="muted small">Sealed ESP32 + 4G meters. Register one, flash the key, clamp it on the outlet.</p></div>
          <button className="btn primary sm" onClick={() => setDeviceModal({ deviceCode: '', tankerId: '', pulsesPerLitre: 4.8 })}>+ Register device</button>
        </div>
        <div className="card-body device-grid">
          {devices.map((d) => (
            <div key={d.id} className="card device-card">
              <div className="row between"><span className="code">{d.deviceCode}</span><span className={`chip ${d.status === 'Tampered' ? 'bad' : d.status === 'Retired' ? '' : d.isOnline ? 'ok' : 'warn'}`}>{d.status === 'Tampered' ? 'TAMPER' : d.status === 'Retired' ? 'Retired' : d.isOnline ? 'Online' : 'Offline'}</span></div>
              <div className="small">{d.tankerRegistration ? <>Fitted on <b>{d.tankerRegistration}</b>{d.installedAt ? ` since ${fmtDate(d.installedAt)}` : ''}</> : <span className="muted">Not fitted to a tanker</span>}</div>
              <div className="small muted">Last seen {ago(d.lastSeenAt)} · fw {d.firmwareVersion || '?'} · K = {d.pulsesPerLitre} pulses/L</div>
              <div className="small muted">{d.lastBatteryVolts ? `${d.lastBatteryVolts.toFixed(2)} V` : 'battery ?'} · {d.lastSignalCsq != null ? `signal ${d.lastSignalCsq}/31` : 'signal ?'}{d.lastLatitude ? <> · <a href={`https://www.google.com/maps?q=${d.lastLatitude},${d.lastLongitude}`} target="_blank" rel="noreferrer">map</a></> : null}</div>
              <div className="row"><button className="btn sm" onClick={() => setDeviceModal({ id: d.id, deviceCode: d.deviceCode, tankerId: d.tankerId || '', pulsesPerLitre: d.pulsesPerLitre, status: d.status })}>Edit</button><button className="btn sm ghost" onClick={() => rotate(d)}>Rotate key</button></div>
            </div>
          ))}
          {devices.length === 0 && <div className="empty">No devices registered.</div>}
        </div>
      </div>

      {tankerModal && <TankerForm form={tankerModal} onChange={setTankerModal} onSave={saveTanker} onClose={() => setTankerModal(null)} />}
      {deviceModal && <DeviceForm form={deviceModal} tankers={tankers} onChange={setDeviceModal} onSave={saveDevice} onClose={() => setDeviceModal(null)} />}
      {issued && (
        <Modal title={`Device key for ${issued.device.deviceCode}`} onClose={() => setIssued(null)}>
          <div className="alert warn">{issued.note}</div>
          <div className="keybox" style={{ marginTop: 12 }}>{issued.apiKey}</div>
          <p className="small muted" style={{ marginTop: 10 }}>Put it in <code>firmware/esp32-tanker-node/include/config.h</code> as <code>DEVICE_KEY</code>, with <code>DEVICE_CODE</code> = <code>{issued.device.deviceCode}</code>.</p>
          <div className="form-actions"><button className="btn primary" onClick={() => setIssued(null)}>I have saved it</button></div>
        </Modal>
      )}
    </>
  )
}

function TankerForm({ form, onChange, onSave, onClose }) {
  const set = (k, v) => onChange({ ...form, [k]: v })
  return (
    <Modal title={form.id ? 'Edit tanker' : 'Add tanker'} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); onSave({ ...form, capacityLitres: Number(form.capacityLitres) }) }}>
        <div className="form-grid">
          <div className="field"><label>Registration number</label><input value={form.registrationNumber} onChange={(e) => set('registrationNumber', e.target.value)} placeholder="TS09UB1234" required /></div>
          <div className="field"><label>Capacity (litres)</label><input type="number" min="1000" step="500" value={form.capacityLitres} onChange={(e) => set('capacityLitres', e.target.value)} required /></div>
          <div className="field"><label>Driver name</label><input value={form.driverName || ''} onChange={(e) => set('driverName', e.target.value)} /></div>
          <div className="field"><label>Driver phone</label><input value={form.driverPhone || ''} onChange={(e) => set('driverPhone', e.target.value)} inputMode="tel" /></div>
          <div className="field full"><label><input type="checkbox" checked={form.isActive} onChange={(e) => set('isActive', e.target.checked)} /> Active</label></div>
        </div>
        <div className="form-actions"><button type="button" className="btn" onClick={onClose}>Cancel</button><button className="btn primary" type="submit">Save</button></div>
      </form>
    </Modal>
  )
}

function DeviceForm({ form, tankers, onChange, onSave, onClose }) {
  const set = (k, v) => onChange({ ...form, [k]: v })
  return (
    <Modal title={form.id ? `Edit ${form.deviceCode}` : 'Register device'} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); onSave({ ...form, tankerId: form.tankerId ? Number(form.tankerId) : null, pulsesPerLitre: Number(form.pulsesPerLitre) }) }}>
        <div className="form-grid">
          {!form.id && <div className="field full"><label>Device code (printed on the enclosure)</label><input value={form.deviceCode} onChange={(e) => set('deviceCode', e.target.value.toUpperCase())} placeholder="AQ-0001" required /></div>}
          <div className="field"><label>Fitted on tanker</label>
            <select value={form.tankerId} onChange={(e) => set('tankerId', e.target.value)}>
              <option value="">— not fitted —</option>
              {tankers.filter((t) => t.isActive && (!t.device || t.device.id === form.id)).map((t) => <option key={t.id} value={t.id}>{t.registrationNumber}</option>)}
            </select>
          </div>
          <div className="field"><label>K-factor (pulses per litre)</label><input type="number" step="0.01" min="0.1" value={form.pulsesPerLitre} onChange={(e) => set('pulsesPerLitre', e.target.value)} /><span className="help">Calibrate by pumping a known volume.</span></div>
          {form.id && <div className="field"><label>Status</label><select value={form.status} onChange={(e) => set('status', e.target.value)}><option value={form.status} disabled hidden>{form.status}</option><option value="Provisioned">Reset to provisioned</option><option value="Retired">Retire</option></select></div>}
        </div>
        <div className="form-actions"><button type="button" className="btn" onClick={onClose}>Cancel</button><button className="btn primary" type="submit">{form.id ? 'Save' : 'Register & issue key'}</button></div>
      </form>
    </Modal>
  )
}
