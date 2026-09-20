import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, fuzzy } from '../lib/api'
import { useTown } from '../lib/town'
import { useToast } from '../lib/toast'
import CheckChip from '../components/CheckChip'
import DocCard from '../components/DocCard'
import KycNote from '../components/KycNote'

const empty = {
  name: '', nameTe: '', phone: '', vehicleType: 'bike', vehicleModel: '', vehicleNo: '', townId: 'nkd',
  aadhaar: { name: '', dob: '', number: '', verifiedVia: '' },
  dl: { name: '', number: '', validTill: '', vehicleClass: 'MCWG' },
  rc: { number: '', ownerName: '', vehicleClass: '', validTill: '', insuranceTill: '', consentLetter: false },
  selfie: {},
  bank: { upi: '', ifsc: '', accountLast4: '' },
  police: { status: 'not_started' },
}

export default function CaptainNew() {
  const { towns } = useTown()
  const toast = useToast()
  const navigate = useNavigate()
  const [f, setF] = useState(empty)
  const [uploads, setUploads] = useState({ aadhaar: false, dl: false, rc: false, selfie: false, bank: false })
  const [checks, setChecks] = useState(null)
  const [verified, setVerified] = useState(null)
  const [running, setRunning] = useState(false)
  const [saving, setSaving] = useState(false)

  const set = (k, v) => setF((x) => ({ ...x, [k]: v }))
  const setDoc = (doc, k, v) => setF((x) => ({ ...x, [doc]: { ...x[doc], [k]: v } }))
  const upload = (k) => setUploads((u) => ({ ...u, [k]: true }))

  const runChecks = async () => {
    setRunning(true)
    setChecks(null)
    try {
      const res = await api.captains.runVerification({
        aadhaar: { ...f.aadhaar, name: f.aadhaar.name || f.name, number: uploads.aadhaar ? f.aadhaar.number || 'XXXX XXXX 1234' : '', verifiedVia: uploads.aadhaar ? 'Aadhaar OTP' : null },
        dl: { ...f.dl, name: f.dl.name || f.name, nameMatchScore: fuzzy(f.aadhaar.name || f.name, f.dl.name || f.name) },
        rc: { ...f.rc, ownerName: f.rc.ownerName || f.name },
        selfie: uploads.selfie ? {} : { faceMatchScore: 0, liveness: false },
        police: f.police,
      })
      setChecks(res.checks)
      setVerified(res.docs)
      toast.info('Automatic verification finished')
    } catch (e) { toast.error(e.message) } finally { setRunning(false) }
  }

  const save = async () => {
    if (!f.name || !f.phone || !f.vehicleNo) { toast.error('Name, phone and vehicle number are required'); return }
    setSaving(true)
    try {
      const score = checks ? Math.round((checks.filter((c) => c.state === 'pass').length / checks.length) * 100) : 0
      const docs = verified || { aadhaar: { ...f.aadhaar, verifiedVia: null }, dl: { ...f.dl, nameMatchScore: 0 }, rc: { ...f.rc, ownerIsCaptain: true }, selfie: { faceMatchScore: 0, liveness: false }, bank: f.bank, police: f.police }
      const c = await api.captains.create({
        name: f.name, nameTe: f.nameTe, phone: f.phone, vehicleType: f.vehicleType, vehicleModel: f.vehicleModel, vehicleNo: f.vehicleNo, townId: f.townId,
        verificationScore: score,
        docs: { aadhaar: { uploaded: uploads.aadhaar, ...docs.aadhaar }, dl: { uploaded: uploads.dl, ...docs.dl }, rc: { uploaded: uploads.rc, ...docs.rc }, selfie: { uploaded: uploads.selfie, ...docs.selfie }, bank: { uploaded: uploads.bank, ...f.bank }, police: f.police },
      })
      toast.success(`${c.name} registered as pending`)
      navigate(`/captains/${c.id}`)
    } catch (e) { toast.error(e.message) } finally { setSaving(false) }
  }

  const Upload = ({ k }) => <button type="button" className={`upload-slot ${uploads[k] ? 'done' : ''}`} onClick={() => upload(k)}>{uploads[k] ? '✓ Image attached (mock)' : '📷 Take photo / upload'}</button>

  return (
    <>
      <Link to="/captains" className="back">← All captains</Link>
      <div className="card">
        <div className="card-head"><h2>Captain details</h2></div>
        <div className="card-body form-grid three">
          <label className="field"><span>Full name (as on Aadhaar)</span><input value={f.name} onChange={(e) => set('name', e.target.value)} /></label>
          <label className="field"><span>Name in Telugu</span><input className="te" value={f.nameTe} onChange={(e) => set('nameTe', e.target.value)} /></label>
          <label className="field"><span>Phone</span><input inputMode="tel" value={f.phone} onChange={(e) => set('phone', e.target.value)} /></label>
          <label className="field"><span>Town</span><select value={f.townId} onChange={(e) => set('townId', e.target.value)}>{towns.map((t) => <option key={t.id} value={t.id}>{t.nameEn}</option>)}</select></label>
          <label className="field"><span>Vehicle type</span><select value={f.vehicleType} onChange={(e) => set('vehicleType', e.target.value)}><option value="bike">🏍️ Bike</option><option value="auto">🛺 Auto</option></select></label>
          <label className="field"><span>Vehicle model</span><input value={f.vehicleModel} onChange={(e) => set('vehicleModel', e.target.value)} placeholder="Hero Splendor+" /></label>
          <label className="field"><span>Vehicle number</span><input className="mono" value={f.vehicleNo} onChange={(e) => set('vehicleNo', e.target.value.toUpperCase())} placeholder="TS15 AB 1234" /></label>
        </div>
      </div>

      <div className="docs-grid">
        <DocCard title="Aadhaar" icon="🪪" uploaded={uploads.aadhaar} fields={[]}>
          <Upload k="aadhaar" />
          <label className="field"><span>Name on Aadhaar</span><input value={f.aadhaar.name} onChange={(e) => setDoc('aadhaar', 'name', e.target.value)} placeholder={f.name} /></label>
          <label className="field"><span>DOB</span><input type="date" value={f.aadhaar.dob} onChange={(e) => setDoc('aadhaar', 'dob', e.target.value)} /></label>
          <label className="field"><span>Last 4 digits</span><input maxLength={4} value={f.aadhaar.number} onChange={(e) => setDoc('aadhaar', 'number', e.target.value)} /></label>
        </DocCard>
        <DocCard title="Driving licence" icon="🚦" uploaded={uploads.dl}>
          <Upload k="dl" />
          <label className="field"><span>Name on DL</span><input value={f.dl.name} onChange={(e) => setDoc('dl', 'name', e.target.value)} placeholder={f.name} /></label>
          <label className="field"><span>DL number</span><input value={f.dl.number} onChange={(e) => setDoc('dl', 'number', e.target.value)} /></label>
          <label className="field"><span>Valid till</span><input type="date" value={f.dl.validTill} onChange={(e) => setDoc('dl', 'validTill', e.target.value)} /></label>
          <label className="field"><span>Class</span><select value={f.dl.vehicleClass} onChange={(e) => setDoc('dl', 'vehicleClass', e.target.value)}><option>MCWG</option><option>MCWOG</option><option>LMV</option><option>3W (Auto)</option></select></label>
        </DocCard>
        <DocCard title="RC" icon="📄" uploaded={uploads.rc}>
          <Upload k="rc" />
          <label className="field"><span>RC number</span><input value={f.rc.number} onChange={(e) => setDoc('rc', 'number', e.target.value)} placeholder={f.vehicleNo} /></label>
          <label className="field"><span>Owner name on RC</span><input value={f.rc.ownerName} onChange={(e) => setDoc('rc', 'ownerName', e.target.value)} placeholder={f.name} /></label>
          <label className="field"><span>RC valid till</span><input type="date" value={f.rc.validTill} onChange={(e) => setDoc('rc', 'validTill', e.target.value)} /></label>
          <label className="field"><span>Insurance valid till</span><input type="date" value={f.rc.insuranceTill} onChange={(e) => setDoc('rc', 'insuranceTill', e.target.value)} /></label>
          <label className="check-row"><input type="checkbox" checked={f.rc.consentLetter} onChange={(e) => setDoc('rc', 'consentLetter', e.target.checked)} /> Owner consent letter attached (if vehicle is not the captain's)</label>
        </DocCard>
        <DocCard title="Selfie" icon="🤳" uploaded={uploads.selfie}>
          <Upload k="selfie" />
          <p className="muted small">Taken at the hub on the ops phone; liveness = blink and turn head.</p>
        </DocCard>
        <DocCard title="Bank / UPI" icon="🏦" uploaded={uploads.bank}>
          <Upload k="bank" />
          <label className="field"><span>UPI id</span><input value={f.bank.upi} onChange={(e) => setDoc('bank', 'upi', e.target.value)} placeholder="98xxxxxxx@ybl" /></label>
          <label className="field"><span>IFSC</span><input value={f.bank.ifsc} onChange={(e) => setDoc('bank', 'ifsc', e.target.value)} /></label>
          <label className="field"><span>Account last 4</span><input maxLength={4} value={f.bank.accountLast4} onChange={(e) => setDoc('bank', 'accountLast4', e.target.value)} /></label>
        </DocCard>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Automatic verification</h2>
          <button className="btn gold" disabled={running} onClick={runChecks}>{running ? <><span className="spinner" /> Calling KYC provider…</> : '⚡ Run automatic verification'}</button>
        </div>
        <div className="card-body checks-grid">
          {!checks && !running && <p className="muted">Fill the documents above, then run the checks. Takes about two seconds.</p>}
          {running && Array.from({ length: 9 }).map((_, i) => <div key={i} className="check check-pending skeleton"><span className="check-ico">…</span><div><div className="check-label">Checking…</div></div></div>)}
          {checks && checks.map((x) => <CheckChip key={x.id} check={x} />)}
        </div>
        <div className="card-foot">
          <span className="muted">{checks ? `${checks.filter((c) => c.state === 'pass').length}/${checks.length} passed` : ''}</span>
          <div className="row gap"><Link className="btn" to="/captains">Cancel</Link><button className="btn primary" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save as pending'}</button></div>
        </div>
      </div>
      <KycNote />
    </>
  )
}
