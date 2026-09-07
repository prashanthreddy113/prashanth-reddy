import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, auth as store } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useToast } from '../lib/toast'
import { money, money2, litres, fmtDateTime, fmtTime, statusLabel } from '../lib/format'
import { StatusBadge, GradeChip } from '../components/StatusBadge'
import { ReadingsChart } from '../components/Charts'
import Modal from '../components/Modal'
import ConfirmDialog from '../components/ConfirmDialog'
import { IconCamera, IconCheck, IconAlert } from '../components/Icons'

export default function DeliveryDetail() {
  const { id } = useParams()
  const { isRwa, isOperator, isAdmin } = useAuth()
  const toast = useToast()
  const [data, setData] = useState(null)
  const [communities, setCommunities] = useState([])
  const [dispute, setDispute] = useState(false)
  const [reason, setReason] = useState('')
  const [confirm, setConfirm] = useState(null)
  const [notes, setNotes] = useState('')
  const [photoUrl, setPhotoUrl] = useState(null)
  const fileRef = useRef()

  const load = () => api.delivery(id).then((d) => { setData(d); setNotes(d.delivery.notes || '') }).catch((e) => toast.error(e.message))
  useEffect(() => { load() }, [id]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!isRwa) api.communities().then(setCommunities).catch(() => {}) }, [isRwa])
  useEffect(() => {
    if (!data?.delivery.hasSealPhoto) { setPhotoUrl(null); return }
    let url
    fetch(api.sealPhotoUrl(id), { headers: { Authorization: `Bearer ${store.getToken()}` } })
      .then((r) => (r.ok ? r.blob() : null)).then((b) => { if (b) { url = URL.createObjectURL(b); setPhotoUrl(url) } }).catch(() => {})
    return () => { if (url) URL.revokeObjectURL(url) }
  }, [data?.delivery.hasSealPhoto, data?.delivery.sealPhotoAt, id])

  if (!data) return <div className="loading">Loading…</div>
  const d = data.delivery
  const capacity = null
  const act = async (fn, ok) => { try { await fn(); toast.success(ok); await load() } catch (e) { toast.error(e.message) } }

  const upload = async (file) => {
    if (!file) return
    await act(() => api.uploadSealPhoto(d.id, file), 'Seal photo attached.')
  }

  const steps = [
    { label: 'Pump started', sub: fmtDateTime(d.startedAt), cls: 'done' },
    { label: d.geofenceMatched ? `Inside ${d.communityName} geofence (${d.distanceToCommunityM} m from centre)` : d.communityName ? `Assigned to ${d.communityName} manually` : 'Location not matched to a community', sub: d.latitude ? `${d.latitude.toFixed(5)}, ${d.longitude.toFixed(5)}` : 'No GPS fix', cls: d.geofenceMatched ? 'done' : d.communityName ? 'warn' : 'bad' },
    { label: `${litres(d.litresDelivered)} metered over ${d.durationMinutes} min`, sub: `peak ${Math.round(d.peakFlowLpm || 0)} L/min · ${d.readingCount} samples`, cls: 'done' },
    { label: `Quality ${d.qualityGrade}`, sub: `${d.avgTdsPpm != null ? `avg ${Math.round(d.avgTdsPpm)} ppm TDS (max ${Math.round(d.maxTdsPpm)})` : 'no TDS'} · ${d.avgTurbidityNtu != null ? `${d.avgTurbidityNtu} NTU` : 'no turbidity'}`, cls: d.qualityGrade === 'Good' ? 'done' : d.qualityGrade === 'Acceptable' ? 'warn' : d.qualityGrade === 'Poor' ? 'bad' : '' },
    { label: d.hasSealPhoto ? 'Seal photo attached' : 'No seal photo yet', sub: d.hasSealPhoto ? fmtDateTime(d.sealPhotoAt) : 'driver uploads from the operator app', cls: d.hasSealPhoto ? 'done' : 'warn' },
    { label: d.tamperFlag ? 'TAMPER switch triggered during delivery' : 'Enclosure sealed throughout', sub: d.tamperFlag ? 'inspect the unit' : '', cls: d.tamperFlag ? 'bad' : 'done' },
    { label: statusLabel[d.status], sub: d.verifiedAt ? `verified ${fmtDateTime(d.verifiedAt)}` : d.endedAt ? `ended ${fmtTime(d.endedAt)}` : 'still pumping', cls: d.status === 'Verified' ? 'done' : d.status === 'Disputed' ? 'bad' : d.status === 'Completed' ? 'warn' : '' },
  ]

  return (
    <>
      <div className="page-head">
        <div>
          <Link to="/deliveries" className="small">← All deliveries</Link>
          <h2 style={{ marginTop: 4 }}>Delivery #{d.id} · {d.tankerRegistration || d.deviceCode} → {d.communityName || 'unmatched'}</h2>
          <div className="row" style={{ marginTop: 6 }}><StatusBadge status={d.status} pulse /><GradeChip grade={d.qualityGrade} tds={d.avgTdsPpm} ntu={d.avgTurbidityNtu} />{d.invoiceNumber && <span className="chip">Invoice {d.invoiceNumber}</span>}{d.bookingId && <span className="chip">Booking #{d.bookingId}</span>}</div>
        </div>
        <div className="row">
          {(isRwa || isAdmin) && d.status === 'Completed' && <button className="btn success" onClick={() => setConfirm({ title: 'Verify delivery', message: `Confirm ${litres(d.litresDelivered)} of ${d.qualityGrade.toLowerCase()} quality water was received for ${money(d.amount)}.`, fn: () => act(() => api.verifyDelivery(d.id), 'Delivery verified.') })}><IconCheck /> Verify</button>}
          {(isRwa || isAdmin) && (d.status === 'Completed' || d.status === 'Verified') && d.openDisputes === 0 && <button className="btn danger" onClick={() => setDispute(true)}><IconAlert /> Raise dispute</button>}
          {(isOperator || isAdmin) && d.status === 'InProgress' && <button className="btn" onClick={() => setConfirm({ title: 'Close delivery', message: 'Finalise this delivery with the readings received so far?', fn: () => act(() => api.closeDelivery(d.id), 'Delivery closed.') })}>Force close</button>}
          {(isOperator || isAdmin) && <><input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => upload(e.target.files?.[0])} /><button className="btn primary" onClick={() => fileRef.current?.click()}><IconCamera /> {d.hasSealPhoto ? 'Replace seal photo' : 'Add seal photo'}</button></>}
        </div>
      </div>

      <div className="stats">
        <div className="card stat"><span className="label">Litres delivered</span><span className="value">{litres(d.litresDelivered)}</span><span className="sub">{d.durationMinutes} min · peak {Math.round(d.peakFlowLpm || 0)} L/min</span></div>
        <div className={`card stat ${d.qualityGrade === 'Poor' ? 'red' : d.qualityGrade === 'Acceptable' ? 'amber' : 'green'}`}><span className="label">TDS</span><span className="value">{d.avgTdsPpm != null ? `${Math.round(d.avgTdsPpm)} ppm` : '—'}</span><span className="sub">turbidity {d.avgTurbidityNtu ?? '—'} NTU</span></div>
        <div className="card stat"><span className="label">Amount</span><span className="value">{money2(d.amount)}</span><span className="sub">@ {money(d.ratePerKl)} per kL</span></div>
        <div className={`card stat ${d.geofenceMatched ? 'green' : 'amber'}`}><span className="label">Location</span><span className="value" style={{ fontSize: 18 }}>{d.geofenceMatched ? 'In geofence' : d.communityName ? 'Manual' : 'Unmatched'}</span><span className="sub">{d.latitude ? `${d.latitude.toFixed(4)}, ${d.longitude.toFixed(4)}` : 'no fix'}</span></div>
      </div>

      <div className="grid-2">
        <div className="stack" style={{ gap: 20 }}>
          <div className="card">
            <div className="card-head"><h2>Flow and TDS during the delivery</h2><span className="muted small">{data.readings.length} points</span></div>
            <div className="card-body"><ReadingsChart points={data.readings} /></div>
          </div>
          <div className="card">
            <div className="card-head"><h2>Seal photo</h2>{d.hasSealPhoto && <span className="muted small">{fmtDateTime(d.sealPhotoAt)}</span>}</div>
            <div className="card-body">
              {photoUrl ? <img className="photo" src={photoUrl} alt="Outlet seal at delivery" /> : <div className="empty"><b>No seal photo</b>The driver photographs the numbered seal on the outlet after pumping; it proves the meter was not bypassed.</div>}
            </div>
          </div>
          {data.disputes.length > 0 && (
            <div className="card">
              <div className="card-head"><h2>Disputes</h2></div>
              <div className="card-body stack">
                {data.disputes.map((x) => (
                  <div key={x.id} className={`alert ${x.status === 'Open' ? 'error' : x.status === 'Resolved' ? 'success' : 'info'}`}>
                    <b>{statusLabel[x.status]}</b> · raised by {x.raisedBy} on {fmtDateTime(x.createdAt)}<br />{x.reason}
                    {x.resolution && <><br /><i>Resolution: {x.resolution}</i></>}
                  </div>
                ))}
                {(isOperator || isAdmin) && data.disputes.some((x) => x.status === 'Open') && <Link to="/disputes" className="btn sm">Resolve in Disputes</Link>}
              </div>
            </div>
          )}
        </div>
        <div className="stack" style={{ gap: 20 }}>
          <div className="card">
            <div className="card-head"><h2>Proof trail</h2></div>
            <div className="card-body"><ul className="timeline">{steps.map((s, i) => <li key={i}><i className={s.cls} /><div>{s.label}<small>{s.sub}</small></div></li>)}</ul></div>
          </div>
          <div className="card">
            <div className="card-head"><h2>Where</h2></div>
            <div className="card-body">
              <MiniMap d={d} />
              {d.latitude && <a className="btn sm" style={{ marginTop: 10 }} href={`https://www.google.com/maps?q=${d.latitude},${d.longitude}`} target="_blank" rel="noreferrer">Open in Google Maps</a>}
            </div>
          </div>
          <div className="card">
            <div className="card-head"><h2>Details</h2></div>
            <div className="card-body">
              <dl className="kv">
                <dt>Operator</dt><dd>{d.operatorName}</dd>
                <dt>Tanker</dt><dd>{d.tankerRegistration || '—'} {d.driverName ? `· ${d.driverName}` : ''}</dd>
                <dt>Device</dt><dd className="mono">{d.deviceCode}</dd>
                <dt>Started</dt><dd>{fmtDateTime(d.startedAt)}</dd>
                <dt>Ended</dt><dd>{fmtDateTime(d.endedAt)}</dd>
                <dt>Samples</dt><dd>{d.readingCount}</dd>
                <dt>Max TDS</dt><dd>{d.maxTdsPpm != null ? `${Math.round(d.maxTdsPpm)} ppm` : '—'}</dd>
                <dt>Max turbidity</dt><dd>{d.maxTurbidityNtu ?? '—'} NTU</dd>
              </dl>
              {(isOperator || isAdmin) && (
                <div className="stack" style={{ marginTop: 14 }}>
                  {d.invoiceId == null && (
                    <div className="field"><label>Community</label>
                      <select value={d.communityId || ''} onChange={(e) => act(() => api.assignCommunity(d.id, e.target.value ? Number(e.target.value) : null), 'Community updated.')}>
                        <option value="">— unmatched —</option>
                        {communities.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.area})</option>)}
                      </select>
                    </div>
                  )}
                  <div className="field"><label>Notes</label><textarea rows="3" value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
                  <button className="btn sm" onClick={() => act(() => api.deliveryNotes(d.id, notes), 'Notes saved.')}>Save notes</button>
                </div>
              )}
              {isRwa && d.notes && <p className="small muted" style={{ marginTop: 10 }}>Operator note: {d.notes}</p>}
            </div>
          </div>
        </div>
      </div>

      {dispute && (
        <Modal title="Raise a dispute" onClose={() => setDispute(false)}>
          <p className="muted small">Tell the operator what is wrong. The delivery is frozen until they respond; you can verify it afterwards.</p>
          <div className="field" style={{ marginTop: 12 }}><label>Reason</label><textarea rows="4" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Only one of the two agreed loads arrived, or the water was visibly muddy." /></div>
          <div className="form-actions"><button className="btn" onClick={() => setDispute(false)}>Cancel</button><button className="btn danger" disabled={!reason.trim()} onClick={() => act(() => api.disputeDelivery(d.id, reason), 'Dispute raised.').then(() => { setDispute(false); setReason('') })}>Submit dispute</button></div>
        </Modal>
      )}
      {confirm && <ConfirmDialog title={confirm.title} message={confirm.message} onConfirm={async () => { await confirm.fn(); setConfirm(null) }} onClose={() => setConfirm(null)} />}
    </>
  )
}

function MiniMap({ d }) {
  if (!d.latitude) return <div className="map-mini"><span className="muted small">No GPS fix for this delivery</span></div>
  // Schematic: community centre in the middle, the geofence ring, and the tanker's fix offset by its distance.
  const radiusPx = 60
  const dist = d.distanceToCommunityM ?? 0
  const fenceM = 150
  const scale = radiusPx / fenceM
  const angle = ((d.id * 137) % 360) * Math.PI / 180
  const off = Math.min(85, dist * scale)
  const x = 50 + Math.cos(angle) * off / 2, y = 50 + Math.sin(angle) * off / 2
  return (
    <div className="map-mini">
      <div className="ring" style={{ width: radiusPx * 2, height: radiusPx * 2 }} />
      <div className="center" style={{ left: 'calc(50% - 5px)', top: 'calc(50% - 5px)' }} />
      <div className="pin" style={{ left: `calc(${x}% - 7px)`, top: `calc(${y}% - 7px)` }} title="Tanker position" />
      <div className="cap"><span>● {d.communityName || 'community'}</span><span>📍 tanker {dist ? `${dist} m away` : ''}</span></div>
    </div>
  )
}
