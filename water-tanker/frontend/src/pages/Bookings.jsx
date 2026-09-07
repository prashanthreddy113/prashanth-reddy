import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useToast } from '../lib/toast'
import { money, litres, fmtDateTime, toLocalInput } from '../lib/format'
import { StatusBadge } from '../components/StatusBadge'
import Modal from '../components/Modal'

export default function Bookings() {
  const { isRwa, isOperator, isAdmin } = useAuth()
  const toast = useToast()
  const [items, setItems] = useState(null)
  const [tankers, setTankers] = useState([])
  const [operators, setOperators] = useState([])
  const [communities, setCommunities] = useState([])
  const [create, setCreate] = useState(false)
  const [accept, setAccept] = useState(null)
  const [form, setForm] = useState({ operatorId: '', requestedLitres: 10000, loads: 1, scheduledFor: toLocalInput(new Date(Date.now() + 86400000)), notes: '', communityId: '' })
  const [tab, setTab] = useState('open')

  const load = () => api.bookings().then(setItems).catch((e) => toast.error(e.message))
  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!isRwa) api.tankers({ includeInactive: false }).then(setTankers).catch(() => {})
    api.operators().then(setOperators).catch(() => {})
    if (isAdmin) api.communities().then(setCommunities).catch(() => {})
  }, [isRwa, isAdmin])

  const act = async (fn, ok) => { try { await fn(); toast.success(ok); load() } catch (e) { toast.error(e.message) } }
  const submit = async (e) => {
    e.preventDefault()
    await act(() => api.createBooking({ operatorId: form.operatorId ? Number(form.operatorId) : null, requestedLitres: Number(form.requestedLitres), loads: Number(form.loads), scheduledFor: new Date(form.scheduledFor).toISOString(), notes: form.notes }, form.communityId || undefined), 'Booking requested.')
    setCreate(false)
  }
  const shown = (items || []).filter((b) => tab === 'open' ? !['Delivered', 'Cancelled'].includes(b.status) : ['Delivered', 'Cancelled'].includes(b.status))

  return (
    <>
      <div className="page-head">
        <div className="tabs"><button className={tab === 'open' ? 'active' : ''} onClick={() => setTab('open')}>Open</button><button className={tab === 'done' ? 'active' : ''} onClick={() => setTab('done')}>Delivered / cancelled</button></div>
        {(isRwa || isAdmin) && <button className="btn primary" onClick={() => setCreate(true)}>+ Book a tanker</button>}
      </div>
      <div className="card">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Scheduled</th><th>{isRwa ? 'Operator' : 'Community'}</th><th className="num">Load</th><th className="num">Rate</th><th>Tanker</th><th>Status</th><th>Delivered</th><th></th></tr></thead>
            <tbody>
              {!items && <tr><td colSpan="8" className="loading">Loading…</td></tr>}
              {shown.map((b) => (
                <tr key={b.id}>
                  <td><div className="primary">{fmtDateTime(b.scheduledFor)}</div><div className="secondary">#{b.id}{b.notes ? ` · ${b.notes}` : ''}</div></td>
                  <td>{isRwa ? b.operatorName : <><div className="primary">{b.communityName}</div><div className="secondary">{b.communityArea}</div></>}</td>
                  <td className="num">{b.loads} × {litres(b.requestedLitres)}</td>
                  <td className="num">{money(b.ratePerKl)}/kL</td>
                  <td>{b.tankerRegistration || <span className="muted">—</span>}</td>
                  <td><StatusBadge status={b.status} /></td>
                  <td>{b.deliveryCount ? `${b.deliveryCount} load · ${litres(b.deliveredLitres)}` : <span className="muted">—</span>}</td>
                  <td className="right nowrap">
                    {(isOperator || isAdmin) && b.status === 'Requested' && <button className="btn sm primary" onClick={() => setAccept({ ...b, tankerId: b.tankerId || '', ratePerKl: b.ratePerKl })}>Accept</button>}
                    {(isOperator || isAdmin) && b.status === 'Accepted' && <><button className="btn sm" onClick={() => setAccept({ ...b, tankerId: b.tankerId || '', ratePerKl: b.ratePerKl })}>Assign</button> <button className="btn sm primary" disabled={!b.tankerId} onClick={() => act(() => api.dispatchBooking(b.id), 'Marked as dispatched.')}>Dispatch</button></>}
                    {!['Delivered', 'Cancelled'].includes(b.status) && !(isRwa && b.status === 'Dispatched') && <> <button className="btn sm danger" onClick={() => act(() => api.cancelBooking(b.id), 'Booking cancelled.')}>Cancel</button></>}
                  </td>
                </tr>
              ))}
              {items && shown.length === 0 && <tr><td colSpan="8" className="empty"><b>Nothing here.</b>{tab === 'open' ? (isRwa ? 'Book a tanker when you need one; the delivery is matched to it automatically.' : 'New requests from communities appear here.') : ''}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {create && (
        <Modal title="Book a tanker" onClose={() => setCreate(false)}>
          <form onSubmit={submit}>
            <div className="form-grid">
              {isAdmin && <div className="field full"><label>Community</label><select value={form.communityId} onChange={(e) => setForm({ ...form, communityId: e.target.value })} required><option value="">Choose…</option>{communities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>}
              <div className="field full"><label>Operator</label><select value={form.operatorId} onChange={(e) => setForm({ ...form, operatorId: e.target.value })}><option value="">Preferred operator</option>{operators.map((o) => <option key={o.id} value={o.id}>{o.name} · {money(o.ratePerKl)}/kL</option>)}</select></div>
              <div className="field"><label>Litres per load</label><select value={form.requestedLitres} onChange={(e) => setForm({ ...form, requestedLitres: e.target.value })}>{[5000, 6000, 10000, 12000, 20000].map((v) => <option key={v} value={v}>{litres(v)}</option>)}</select></div>
              <div className="field"><label>Number of loads</label><input type="number" min="1" max="20" value={form.loads} onChange={(e) => setForm({ ...form, loads: e.target.value })} /></div>
              <div className="field full"><label>When</label><input type="datetime-local" value={form.scheduledFor} onChange={(e) => setForm({ ...form, scheduledFor: e.target.value })} required /></div>
              <div className="field full"><label>Notes for the driver</label><input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Gate 2, sump on the left" /></div>
            </div>
            <div className="form-actions"><button type="button" className="btn" onClick={() => setCreate(false)}>Cancel</button><button className="btn primary" type="submit">Request</button></div>
          </form>
        </Modal>
      )}
      {accept && (
        <Modal title={`Booking #${accept.id} · ${accept.communityName}`} onClose={() => setAccept(null)}>
          <form onSubmit={async (e) => { e.preventDefault(); await act(() => api.acceptBooking(accept.id, { tankerId: accept.tankerId ? Number(accept.tankerId) : null, ratePerKl: Number(accept.ratePerKl) }), 'Booking accepted.'); setAccept(null) }}>
            <div className="form-grid">
              <div className="field"><label>Assign tanker</label><select value={accept.tankerId} onChange={(e) => setAccept({ ...accept, tankerId: e.target.value })}><option value="">Decide later</option>{tankers.map((t) => <option key={t.id} value={t.id}>{t.registrationNumber} · {litres(t.capacityLitres)}{t.device ? '' : ' (no meter!)'}</option>)}</select></div>
              <div className="field"><label>Rate per kL (₹)</label><input type="number" step="1" min="0" value={accept.ratePerKl} onChange={(e) => setAccept({ ...accept, ratePerKl: e.target.value })} /></div>
            </div>
            <div className="form-actions"><button type="button" className="btn" onClick={() => setAccept(null)}>Cancel</button><button className="btn primary" type="submit">Accept</button></div>
          </form>
        </Modal>
      )}
    </>
  )
}
