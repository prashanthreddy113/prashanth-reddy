import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import { useTown } from '../lib/town'
import { useToast } from '../lib/toast'
import { SERVICE, fmtDate, num } from '../lib/format'
import StatusPill from '../components/StatusPill'
import CheckChip from '../components/CheckChip'
import DocCard from '../components/DocCard'
import KycNote from '../components/KycNote'
import Modal from '../components/Modal'

export default function CaptainDetail() {
  const { id } = useParams()
  const { towns } = useTown()
  const toast = useToast()
  const [c, setC] = useState(null)
  const [modal, setModal] = useState(null) // 'reject' | 'reupload' | 'block'
  const [reason, setReason] = useState('')
  const [docsToReupload, setDocsToReupload] = useState([])
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => api.captains.get(id).then(setC), [id])
  useEffect(() => { load() }, [load])

  if (!c) return <div className="loading">Loading…</div>
  const checks = api.captains.checks(c)
  const fails = checks.filter((x) => x.state === 'fail').length
  const reviews = checks.filter((x) => x.state === 'review' || x.state === 'pending').length
  const town = towns.find((t) => t.id === c.townId)
  const d = c.docs

  const run = async (fn, msg) => {
    setBusy(true)
    try { await fn(); await load(); toast.success(msg); setModal(null); setReason('') } catch (e) { toast.error(e.message) } finally { setBusy(false) }
  }

  return (
    <>
      <div className="row between wrap">
        <Link to="/captains" className="back">← All captains</Link>
        <div className="row gap wrap">
          {c.status !== 'verified' && c.status !== 'blocked' && <button className="btn success" disabled={busy || fails > 0} title={fails ? 'Fix failed checks first' : ''} onClick={() => run(() => api.captains.approve(c.id), `${c.name} approved`)}>✓ Approve</button>}
          {c.status !== 'rejected' && c.status !== 'blocked' && <button className="btn danger" disabled={busy} onClick={() => setModal('reject')}>Reject…</button>}
          <button className="btn" disabled={busy} onClick={() => setModal('reupload')}>Request re-upload…</button>
          {c.status === 'blocked'
            ? <button className="btn" disabled={busy} onClick={() => run(() => api.captains.unblock(c.id), `${c.name} unblocked`)}>Unblock</button>
            : <button className="btn danger" disabled={busy} onClick={() => setModal('block')}>Block…</button>}
        </div>
      </div>

      <div className="profile-head card">
        <div className={`avatar xl av-${c.vehicleType}`}>{c.name.slice(0, 1)}</div>
        <div className="grow">
          <h1>{c.name} <span className="te muted">{c.nameTe}</span></h1>
          <div className="muted">{SERVICE[c.vehicleType].emoji} {c.vehicleModel} · <span className="mono big">{c.vehicleNo}</span> · {town?.nameEn} · joined {fmtDate(c.joinedAt)} · speaks {c.lang}</div>
          <div className="row gap wrap top8">
            <StatusPill status={c.status} />{c.online && <StatusPill status="online" />}
            <span>⭐ {c.rating ?? '—'}</span><span>{num(c.trips)} trips</span><span>📞 <a href={`tel:${c.phone}`}>{c.phone}</a></span>
          </div>
          {c.rejectReason && <div className="form-error top8">Rejected: {c.rejectReason}</div>}
          {c.blockReason && <div className="form-error top8">Blocked: {c.blockReason}</div>}
        </div>
        <div className="score-big">
          <div className="kpi-label">Verification score</div>
          <div className={`kpi-value ${c.verificationScore >= 85 ? 'ok' : c.verificationScore >= 65 ? 'mid' : 'bad'}`}>{c.verificationScore}</div>
          <small className="muted">{fails} fail · {reviews} to review</small>
        </div>
      </div>

      <div className="card">
        <div className="card-head"><h2>Automated checks</h2><small className="muted">re-run on every re-upload</small></div>
        <div className="card-body checks-grid">
          {checks.map((x) => <CheckChip key={x.id} check={x} />)}
        </div>
        {checks.find((x) => x.id === 'rc_owner')?.state === 'review' && (
          <div className="card-body consent">
            <b>🚗 Vehicle belongs to someone else — needs owner consent letter.</b> Not a hard block: many captains drive a brother's or a rented auto. Upload the signed letter (RC owner name, vehicle number, captain name, signature) and the check turns green.
            <div className="upload-slot" onClick={() => run(() => api.captains.uploadConsentLetter(c.id), 'Consent letter attached')}>📎 Upload consent letter (photo / PDF)</div>
          </div>
        )}
        {checks.find((x) => x.id === 'police')?.state !== 'pass' && (
          <div className="card-body row gap wrap">
            <span>Police verification:</span>
            <select value={d.police.status} onChange={(e) => run(() => api.captains.setPolice(c.id, e.target.value), 'Police verification updated')}>
              <option value="not_started">Not started</option><option value="requested">Applied at PS</option><option value="done">Certificate received</option>
            </select>
          </div>
        )}
      </div>

      <div className="docs-grid">
        <DocCard title="Aadhaar" icon="🪪" uploaded={d.aadhaar.uploaded} fields={[['Name', d.aadhaar.name], ['DOB', d.aadhaar.dob], ['Number', d.aadhaar.number], ['Verified via', d.aadhaar.verifiedVia || 'pending']]} />
        <DocCard title="Driving licence" icon="🚦" uploaded={d.dl.uploaded} fields={[['DL number', d.dl.number], ['Valid till', d.dl.validTill], ['Class', d.dl.vehicleClass], ['Name match', `${d.dl.nameMatchScore}/100`]]} />
        <DocCard title="RC (registration)" icon="📄" uploaded={d.rc.uploaded} fields={[['RC number', d.rc.number], ['Owner name', d.rc.ownerName], ['Vehicle class', d.rc.vehicleClass], ['Valid till', d.rc.validTill], ['Insurance till', d.rc.insuranceTill], ['Consent letter', d.rc.ownerIsCaptain ? 'not needed' : d.rc.consentLetter ? 'on file' : 'missing']]} />
        <DocCard title="Selfie" icon="🤳" uploaded={d.selfie.uploaded} fields={[['Face match', `${d.selfie.faceMatchScore}/100`], ['Liveness', d.selfie.liveness ? 'passed' : 'failed']]} />
        <DocCard title="Bank / UPI" icon="🏦" uploaded={d.bank.uploaded} fields={[['UPI', d.bank.upi], ['IFSC', d.bank.ifsc], ['Account', `•••• ${d.bank.accountLast4}`]]} />
      </div>

      <KycNote />

      <Modal open={modal === 'reject'} title="Reject captain" onClose={() => setModal(null)} footer={<><button className="btn" onClick={() => setModal(null)}>Cancel</button><button className="btn danger" disabled={!reason || busy} onClick={() => run(() => api.captains.reject(c.id, reason), 'Rejected')}>Reject</button></>}>
        <label className="field"><span>Reason (sent to the captain by SMS in Telugu)</span><textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Selfie does not match DL photo" /></label>
      </Modal>
      <Modal open={modal === 'block'} title="Block captain" onClose={() => setModal(null)} footer={<><button className="btn" onClick={() => setModal(null)}>Cancel</button><button className="btn danger" disabled={!reason || busy} onClick={() => run(() => api.captains.block(c.id, reason), 'Blocked')}>Block</button></>}>
        <p className="muted">Blocking takes the captain offline immediately and stops new offers. Settlement continues for finished trips.</p>
        <label className="field"><span>Reason</span><textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} /></label>
      </Modal>
      <Modal open={modal === 'reupload'} title="Request re-upload" onClose={() => setModal(null)} footer={<><button className="btn" onClick={() => setModal(null)}>Cancel</button><button className="btn primary" disabled={!docsToReupload.length || busy} onClick={() => run(() => api.captains.requestReupload(c.id, docsToReupload, reason), 'Re-upload requested — SMS sent')}>Send request</button></>}>
        <div className="form-grid">
          {['Aadhaar', 'Driving licence', 'RC', 'Selfie', 'Bank/UPI'].map((doc) => (
            <label key={doc} className="check-row"><input type="checkbox" checked={docsToReupload.includes(doc)} onChange={(e) => setDocsToReupload(e.target.checked ? [...docsToReupload, doc] : docsToReupload.filter((x) => x !== doc))} /> {doc}</label>
          ))}
          <label className="field span2"><span>Note to captain</span><input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="RC photo is blurred, please retake in daylight" /></label>
        </div>
      </Modal>
    </>
  )
}
