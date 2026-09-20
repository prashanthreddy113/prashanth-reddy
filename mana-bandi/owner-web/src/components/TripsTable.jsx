import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../lib/api'
import { useTown } from '../lib/town'
import { SERVICE, daysAgo, fmtDateTime, fmtTime, inr, isoDay, maskPhone } from '../lib/format'
import { downloadCsv } from '../lib/csv'
import Drawer from './Drawer'
import StatusPill from './StatusPill'
import Timeline from './Timeline'
import Empty from './Empty'

const STATUSES = ['searching', 'assigned', 'on_trip', 'finished', 'cancelled', 'unfulfilled']
const SIZE = { s: 'Small 🍱', m: 'Medium 📦', l: 'Big 🧳' }

/** Shared list + side drawer for /rides (kind='ride') and /parcels (kind='parcel'). */
export default function TripsTable({ kind }) {
  const { townId, towns } = useTown()
  const [params, setParams] = useSearchParams()
  const [rows, setRows] = useState(null)
  const [captains, setCaptains] = useState({})
  const [selected, setSelected] = useState(null)
  const [f, setF] = useState({ from: isoDay(daysAgo(7)), to: isoDay(new Date()), status: params.get('status') || '', service: '', q: '' })

  useEffect(() => { api.trips.list(kind, { townId, ...f }).then(setRows) }, [kind, townId, f])
  useEffect(() => { api.captains.list().then((cs) => setCaptains(Object.fromEntries(cs.map((c) => [c.id, c])))) }, [])
  useEffect(() => { if (params.get('status')) { setParams({}, { replace: true }) } }, [params, setParams])

  const townName = (id) => towns.find((t) => t.id === id)?.nameEn || id
  const totals = useMemo(() => {
    if (!rows) return null
    const fin = rows.filter((x) => x.status === 'finished')
    return { count: rows.length, finished: fin.length, fare: fin.reduce((a, x) => a + x.fareFinal, 0), cod: kind === 'parcel' ? rows.filter((x) => x.codCollected).reduce((a, x) => a + x.codAmount, 0) : 0 }
  }, [rows, kind])

  const exportCsv = () => downloadCsv(`${kind}s-${f.from}-to-${f.to}.csv`, rows, [
    { key: 'id', label: 'ID' }, { key: 'requestedAt', label: 'Requested' }, { key: 'service', label: 'Service' }, { label: 'Town', get: (x) => townName(x.townId) },
    { label: 'Pickup', get: (x) => x.pickup.name }, { label: 'Drop', get: (x) => x.drop.name }, { key: 'distanceKm', label: 'Km' }, { key: 'fareQuoted', label: 'Fare quoted' }, { key: 'fareFinal', label: 'Fare final' },
    { key: 'payment', label: 'Payment' }, { key: 'status', label: 'Status' }, { label: 'Captain', get: (x) => captains[x.captainId]?.name || '' }, { key: 'rating', label: 'Rating' },
    ...(kind === 'parcel' ? [{ key: 'size', label: 'Size' }, { key: 'codAmount', label: 'COD ₹' }, { label: 'COD collected', get: (x) => (x.codCollected ? 'yes' : 'no') }] : []),
  ])

  const x = selected
  const cap = x ? captains[x.captainId] : null

  return (
    <>
      <div className="card">
        <div className="card-head">
          <div className="filters">
            <label className="inline"><span>From</span><input type="date" value={f.from} max={f.to} onChange={(e) => setF({ ...f, from: e.target.value })} /></label>
            <label className="inline"><span>To</span><input type="date" value={f.to} min={f.from} onChange={(e) => setF({ ...f, to: e.target.value })} /></label>
            <select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}><option value="">All statuses</option>{STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}</select>
            {kind === 'ride' && <select value={f.service} onChange={(e) => setF({ ...f, service: e.target.value })}><option value="">Bike + auto</option><option value="bike">🏍️ Bike</option><option value="auto">🛺 Auto</option></select>}
            <input placeholder="Search id, rider, place…" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} />
          </div>
          <div className="row gap">
            {totals && <span className="muted small">{totals.count} · {totals.finished} finished · {inr(totals.fare)}{kind === 'parcel' ? ` · COD ${inr(totals.cod)}` : ''}</span>}
            <button className="btn sm" onClick={exportCsv} disabled={!rows?.length}>⬇ CSV</button>
          </div>
        </div>
        <div className="table-wrap tall">
          {rows && rows.length === 0 && <Empty text="No trips in this range" />}
          {rows && rows.length > 0 && (
            <table className="clickable">
              <thead><tr><th>When</th><th>ID</th><th>Service</th><th>Town</th><th>Pickup → Drop</th><th>Km</th><th>Fare</th><th>Pay</th><th>Captain</th>{kind === 'parcel' && <th>COD</th>}<th>Status</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} onClick={() => setSelected(r)} className={selected?.id === r.id ? 'selected' : ''}>
                    <td>{fmtDateTime(r.requestedAt)}</td>
                    <td className="mono">{r.id}</td>
                    <td><span className={`svc-dot svc-${r.service}`} />{SERVICE[r.service].emoji} {SERVICE[r.service].label}{r.night && <span title="night charge"> 🌙</span>}</td>
                    <td>{townName(r.townId)}</td>
                    <td className="ellipsis">{r.pickup.name} → {r.drop.name}</td>
                    <td>{r.distanceKm}</td>
                    <td>{inr(r.fareFinal ?? r.fareQuoted)}</td>
                    <td><StatusPill status={r.payment} /></td>
                    <td>{captains[r.captainId]?.name || <span className="muted">—</span>}</td>
                    {kind === 'parcel' && <td>{r.codAmount ? <>{inr(r.codAmount)} {r.codCollected ? '✓' : <span className="muted">pending</span>}</> : <span className="muted">—</span>}</td>}
                    <td><StatusPill status={r.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <Drawer open={!!x} onClose={() => setSelected(null)} title={x ? `${SERVICE[x.service].emoji} ${x.id}` : ''}>
        {x && (
          <>
            <div className="row gap wrap"><StatusPill status={x.status} /><StatusPill status={x.payment} />{x.night && <span className="pill pill-ink">🌙 night</span>}<span className="pill pill-grey">via {x.bookedVia.replace('_', ' ')}</span></div>
            <h3 className="top16">Timeline</h3>
            <Timeline events={x.events} />
            <h3 className="top16">Trip</h3>
            <dl className="kv">
              <div><dt>Pickup</dt><dd>{x.pickup.name} <span className="te muted">{x.pickup.nameTe}</span></dd></div>
              <div><dt>Drop</dt><dd>{x.drop.name} <span className="te muted">{x.drop.nameTe}</span></dd></div>
              <div><dt>Distance</dt><dd>{x.distanceKm} km</dd></div>
              <div><dt>Fare</dt><dd><b className="big">{inr(x.fareFinal ?? x.fareQuoted)}</b> <span className="muted">quoted {inr(x.fareQuoted)}{x.tip ? ` · tip ${inr(x.tip)}` : ''}</span></dd></div>
              <div><dt>Payment</dt><dd>{x.payment.toUpperCase()} · {x.paid ? 'paid ✓' : 'not yet'}</dd></div>
              <div><dt>Ride OTP</dt><dd className="mono">{x.otp}</dd></div>
              <div><dt>Pickup time</dt><dd>{x.pickupMinutes ? `${x.pickupMinutes} min` : '—'}</dd></div>
              <div><dt>Rating</dt><dd>{x.rating ? '⭐'.repeat(x.rating) : <span className="muted">not rated</span>}</dd></div>
            </dl>
            <h3 className="top16">People</h3>
            <dl className="kv">
              <div><dt>{kind === 'parcel' ? 'Sender' : 'Rider'}</dt><dd>{kind === 'parcel' ? x.sender.name : x.riderName} · <span className="mono">{maskPhone(x.riderPhone)}</span></dd></div>
              {x.bookedFor && <div><dt>Booked for</dt><dd>{x.bookedFor.name} · <span className="mono">{maskPhone(x.bookedFor.phone)}</span></dd></div>}
              {kind === 'parcel' && <div><dt>Receiver</dt><dd>{x.receiver.name} · <span className="mono">{maskPhone(x.receiver.phone)}</span></dd></div>}
              <div><dt>Captain</dt><dd>{cap ? <Link to={`/captains/${cap.id}`}>{cap.name}</Link> : <span className="muted">none</span>}{cap && <> · <span className="mono">{cap.vehicleNo}</span> · ⭐ {cap.rating ?? '—'}</>}</dd></div>
              <div><dt>Town</dt><dd>{townName(x.townId)}</dd></div>
              <div><dt>Requested</dt><dd>{fmtDateTime(x.requestedAt)}</dd></div>
            </dl>
            {kind === 'parcel' && (
              <>
                <h3 className="top16">Parcel</h3>
                <dl className="kv">
                  <div><dt>Size</dt><dd>{SIZE[x.size]}</dd></div>
                  <div><dt>Who pays</dt><dd>{x.payer}</dd></div>
                  <div><dt>Photos</dt><dd><span className={`photo ${x.photos.pickup ? 'ok' : ''}`}>📷 pickup</span> <span className={`photo ${x.photos.delivery ? 'ok' : ''}`}>📷 delivery</span></dd></div>
                  <div><dt>Pickup OTP</dt><dd>{x.pickupOtpVerified ? <StatusPill status="pass" label="verified" /> : <StatusPill status="pending" />}</dd></div>
                  <div><dt>Delivery OTP</dt><dd>{x.deliveryOtpVerified ? <StatusPill status="pass" label="verified" /> : <StatusPill status="pending" />}</dd></div>
                  <div><dt>COD</dt><dd>{x.codAmount ? <>{inr(x.codAmount)} · {x.codCollected ? <StatusPill status="pass" label="collected" /> : <StatusPill status="review" label="pending" />}</> : <span className="muted">none</span>}</dd></div>
                </dl>
              </>
            )}
            {x.events.length > 0 && <p className="muted small top16">Last event {fmtTime(x.events[x.events.length - 1].at)}</p>}
          </>
        )}
      </Drawer>
    </>
  )
}
