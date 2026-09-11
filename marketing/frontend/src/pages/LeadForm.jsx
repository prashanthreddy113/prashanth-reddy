import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useToast } from '../lib/toast'
import { compressImage } from '../lib/image'
import { getPosition } from '../lib/geo'
import { STATUS_ORDER, STATUS, INTEREST, addDaysIso, todayIso, mapLink } from '../lib/format'
import StarRating from '../components/StarRating'
import Modal from '../components/Modal'
import { IconCamera, IconMap, IconX, IconCheck } from '../components/Icons'

const EMPTY = {
  projectId: '', shopName: '', contactName: '', mobile: '', altMobile: '', email: '', shopType: '', address: '', area: '', city: '', pincode: '',
  latitude: null, longitude: null, interest: 3, status: 'New', expectedValue: '', notes: '', nextFollowUpAt: '', visitNote: '', assignedToUserId: '',
}

export default function LeadForm() {
  const { id } = useParams()
  const editing = !!id
  const navigate = useNavigate()
  const toast = useToast()
  const { user, isAdmin } = useAuth()
  const [form, setForm] = useState(EMPTY)
  const [photos, setPhotos] = useState([]) // { preview, dataBase64, thumbBase64, contentType, size }
  const [projects, setProjects] = useState([])
  const [users, setUsers] = useState([])
  const [suggest, setSuggest] = useState({ cities: [], areas: [], shopTypes: [] })
  const [settings, setSettings] = useState({ defaultFollowUpDays: 3 })
  const [geo, setGeo] = useState({ busy: false, error: '', accuracy: null })
  const [dup, setDup] = useState(null)
  const [conflict, setConflict] = useState(null)
  const [busy, setBusy] = useState(false)
  const [processing, setProcessing] = useState(0)
  const [error, setError] = useState('')
  const fileRef = useRef(null)

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  useEffect(() => {
    api.projects(false).then((p) => {
      setProjects(p)
      if (!editing && p.length === 1) set('projectId', String(p[0].id))
    }).catch(() => {})
    api.leadSuggestions().then(setSuggest).catch(() => {})
    api.settings().then(setSettings).catch(() => {})
    if (isAdmin) api.users().then((u) => setUsers(u.filter((x) => x.isActive))).catch(() => {})
  }, [editing, isAdmin])

  useEffect(() => {
    if (!editing) { if (!form.latitude) captureLocation(true); return }
    api.lead(id).then((l) => setForm({
      projectId: String(l.projectId), shopName: l.shopName, contactName: l.contactName || '', mobile: l.mobile, altMobile: l.altMobile || '', email: l.email || '',
      shopType: l.shopType || '', address: l.address || '', area: l.area || '', city: l.city || '', pincode: l.pincode || '',
      latitude: l.latitude, longitude: l.longitude, interest: l.interest, status: l.status, expectedValue: l.expectedValue ?? '', notes: l.notes || '',
      nextFollowUpAt: l.nextFollowUpAt || '', visitNote: '', assignedToUserId: String(l.assignedToUserId), lostReason: l.lostReason || '',
    })).catch((e) => setError(e.message))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, editing])

  const captureLocation = async (silent = false) => {
    setGeo({ busy: true, error: '', accuracy: null })
    try {
      const pos = await getPosition()
      setForm((f) => ({ ...f, latitude: pos.latitude, longitude: pos.longitude }))
      setGeo({ busy: false, error: '', accuracy: pos.accuracy })
    } catch (e) {
      setGeo({ busy: false, error: silent ? '' : e.message, accuracy: null })
    }
  }

  const onFiles = async (e) => {
    const files = Array.from(e.target.files || [])
    e.target.value = ''
    if (!files.length) return
    setProcessing(files.length)
    for (const file of files) {
      try { const img = await compressImage(file); setPhotos((p) => [...p, img]) }
      catch { toast.error(`Could not read ${file.name}`) }
      finally { setProcessing((n) => n - 1) }
    }
  }

  const checkDuplicate = async () => {
    const digits = form.mobile.replace(/\D/g, '')
    if (digits.length < 6) { setDup(null); return }
    try {
      const r = await api.checkMobile(form.mobile, editing ? id : undefined)
      setDup(r.exists ? r.matches : null)
    } catch { /* ignore */ }
  }

  const projectOptions = useMemo(() => projects.filter((p) => p.isActive || String(p.id) === form.projectId), [projects, form.projectId])
  const assignable = useMemo(() => users.filter((u) => u.role === 'Admin' || u.projects.some((p) => String(p.id) === form.projectId)), [users, form.projectId])

  const payload = () => ({
    ...form,
    projectId: Number(form.projectId),
    expectedValue: form.expectedValue === '' ? null : Number(form.expectedValue),
    nextFollowUpAt: form.nextFollowUpAt || null,
    assignedToUserId: isAdmin && form.assignedToUserId ? Number(form.assignedToUserId) : null,
    photos: editing ? undefined : photos.map(({ contentType, dataBase64, thumbBase64 }) => ({ contentType, dataBase64, thumbBase64 })),
  })

  const submit = async (e, force = false) => {
    e?.preventDefault()
    if (!form.projectId) { setError('Choose the project / product you are marketing.'); return }
    if (form.mobile.replace(/\D/g, '').length < 6) { setError('Enter the shop owner\'s mobile number.'); return }
    setBusy(true); setError(''); setConflict(null)
    try {
      const saved = editing ? await api.updateLead(id, payload()) : await api.createLead(payload(), force)
      toast.success(editing ? 'Lead updated' : 'Lead captured 🎉')
      navigate(`/leads/${saved.id}`, { replace: true })
    } catch (err) {
      if (err.status === 409 && err.details?.existingLeadId) setConflict(err.details)
      else setError(err.message)
      setBusy(false)
    }
  }

  const followDays = settings.defaultFollowUpDays || 3
  const isOpen = form.status !== 'Converted' && form.status !== 'Lost'

  return (
    <form className="lead-form" onSubmit={submit}>
      {error && <div className="alert error">{error}</div>}

      {!editing && (
        <section className="card">
          <div className="card-head"><h2><IconCamera /> Shop photos</h2><span className="muted">{photos.length ? `${photos.length} added` : 'optional'}</span></div>
          <div className="card-body">
            <div className="photo-grid">
              {photos.map((p, i) => (
                <div key={i} className="photo-tile">
                  <img src={p.preview} alt="" />
                  <button type="button" className="remove" onClick={() => setPhotos((ps) => ps.filter((_, j) => j !== i))} aria-label="Remove photo"><IconX width={14} height={14} /></button>
                </div>
              ))}
              {processing > 0 && <div className="photo-tile img-skeleton" />}
              <button type="button" className="photo-tile add" onClick={() => fileRef.current?.click()}>
                <IconCamera width={26} height={26} /><span>Take photo</span>
              </button>
            </div>
            <input ref={fileRef} type="file" accept="image/*" capture="environment" multiple hidden onChange={onFiles} />
            <span className="help">Photos are shrunk on your phone before upload, so they are quick even on mobile data.</span>
          </div>
        </section>
      )}

      <section className="card">
        <div className="card-head"><h2><IconMap /> Location</h2>
          <button type="button" className="btn sm" onClick={() => captureLocation(false)} disabled={geo.busy}>{geo.busy ? 'Locating…' : form.latitude ? 'Re-capture' : 'Capture GPS'}</button>
        </div>
        <div className="card-body">
          {form.latitude != null ? (
            <div className="row-between wrap">
              <span><IconCheck className="text-green" /> {form.latitude}, {form.longitude}{geo.accuracy ? <span className="muted"> (±{geo.accuracy} m)</span> : null}</span>
              <span className="row gap"><a href={mapLink(form.latitude, form.longitude)} target="_blank" rel="noreferrer" className="btn sm">Open map</a><button type="button" className="btn sm ghost" onClick={() => setForm((f) => ({ ...f, latitude: null, longitude: null }))}>Clear</button></span>
            </div>
          ) : <span className="muted">{geo.busy ? 'Getting your position…' : geo.error || 'Tap "Capture GPS" while you are at the shop so the team can find it again.'}</span>}
          {geo.error && form.latitude == null && <div className="alert warn" style={{ marginTop: 8 }}>{geo.error}</div>}
        </div>
      </section>

      <section className="card">
        <div className="card-head"><h2>Shop & contact</h2></div>
        <div className="card-body form-grid">
          <div className="field full">
            <label>Project / product<span className="req">*</span></label>
            {projectOptions.length === 0 ? (
              <div className="alert warn">No project is assigned to you yet. Ask your admin to assign one.</div>
            ) : (
              <div className="chips">
                {projectOptions.map((p) => (
                  <button type="button" key={p.id} className={`chip lg ${form.projectId === String(p.id) ? 'active' : ''}`} style={form.projectId === String(p.id) ? { background: p.color, borderColor: p.color } : {}} onClick={() => set('projectId', String(p.id))}>
                    <span className="dot" style={{ background: form.projectId === String(p.id) ? '#fff' : p.color }} />{p.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="field full"><label>Shop / business name<span className="req">*</span></label><input value={form.shopName} onChange={(e) => set('shopName', e.target.value)} required maxLength={160} placeholder="e.g. Sri Lakshmi General Stores" /></div>
          <div className="field"><label>Owner / contact person</label><input value={form.contactName} onChange={(e) => set('contactName', e.target.value)} maxLength={120} autoComplete="off" /></div>
          <div className="field"><label>Shop type</label><input list="shop-types" value={form.shopType} onChange={(e) => set('shopType', e.target.value)} maxLength={60} placeholder="Retail, Wholesale…" /><datalist id="shop-types">{suggest.shopTypes.map((s) => <option key={s} value={s} />)}</datalist></div>
          <div className="field"><label>Mobile number<span className="req">*</span></label><input type="tel" inputMode="tel" value={form.mobile} onChange={(e) => set('mobile', e.target.value)} onBlur={checkDuplicate} required placeholder="10-digit mobile" autoComplete="off" /></div>
          <div className="field"><label>Alternate mobile</label><input type="tel" inputMode="tel" value={form.altMobile} onChange={(e) => set('altMobile', e.target.value)} /></div>
          {dup && (
            <div className="alert warn full">
              <strong>This number already exists:</strong>
              {dup.map((m) => <div key={m.id}><Link to={`/leads/${m.id}`}>{m.shopName}</Link> · {m.projectName} · {STATUS[m.status]?.label} · handled by {m.assignedToName}</div>)}
              <small>Saving in the same project is blocked; a different project is allowed.</small>
            </div>
          )}
          <div className="field full"><label>Address</label><input value={form.address} onChange={(e) => set('address', e.target.value)} placeholder="Door no, street, landmark" /></div>
          <div className="field"><label>Area / locality</label><input list="areas" value={form.area} onChange={(e) => set('area', e.target.value)} maxLength={120} /><datalist id="areas">{suggest.areas.map((s) => <option key={s} value={s} />)}</datalist></div>
          <div className="field"><label>City</label><input list="cities" value={form.city} onChange={(e) => set('city', e.target.value)} maxLength={80} /><datalist id="cities">{suggest.cities.map((s) => <option key={s} value={s} />)}</datalist></div>
          <div className="field"><label>Pincode</label><input inputMode="numeric" value={form.pincode} onChange={(e) => set('pincode', e.target.value)} maxLength={12} /></div>
          <div className="field"><label>Email <span className="opt">optional</span></label><input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} /></div>
        </div>
      </section>

      <section className="card">
        <div className="card-head"><h2>Interest & next step</h2></div>
        <div className="card-body form-grid">
          <div className="field full">
            <label>How interested are they in buying?<span className="req">*</span></label>
            <StarRating value={form.interest} onChange={(v) => set('interest', v)} size="lg" showLabel />
            <div className="interest-scale">{[1, 2, 3, 4, 5].map((n) => <span key={n} className={form.interest === n ? 'on' : ''}>{INTEREST[n].short}</span>)}</div>
          </div>
          <div className="field"><label>Status</label>
            <select value={form.status} onChange={(e) => set('status', e.target.value)}>{STATUS_ORDER.map((s) => <option key={s} value={s}>{STATUS[s].label}</option>)}</select></div>
          <div className="field"><label>Expected order value <span className="opt">optional</span></label><input type="number" inputMode="decimal" min="0" step="1" value={form.expectedValue} onChange={(e) => set('expectedValue', e.target.value)} placeholder="e.g. 25000" /></div>
          {form.status === 'Lost' && <div className="field full"><label>Why lost?</label><input value={form.lostReason || ''} onChange={(e) => set('lostReason', e.target.value)} placeholder="e.g. already using a competitor" /></div>}
          {isOpen && (
            <div className="field full">
              <label>Next follow-up</label>
              <div className="row gap wrap">
                {[['Tomorrow', 1], [`${followDays} days`, followDays], ['1 week', 7], ['2 weeks', 14]].map(([lbl, d]) => (
                  <button type="button" key={d} className={`chip ${form.nextFollowUpAt === addDaysIso(todayIso(), d) ? 'active' : ''}`} onClick={() => set('nextFollowUpAt', addDaysIso(todayIso(), d))}>{lbl}</button>
                ))}
                <input type="date" value={form.nextFollowUpAt} min={todayIso()} onChange={(e) => set('nextFollowUpAt', e.target.value)} style={{ maxWidth: 170 }} />
                {form.nextFollowUpAt && <button type="button" className="btn sm ghost" onClick={() => set('nextFollowUpAt', '')}>Clear</button>}
              </div>
            </div>
          )}
          <div className="field full"><label>{editing ? 'Notes' : 'Notes from this visit'}</label><textarea rows={3} value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="What did they say? Products they asked about, objections, best time to visit…" /></div>
          {isAdmin && (
            <div className="field full"><label>Assigned executive</label>
              <select value={form.assignedToUserId} onChange={(e) => set('assignedToUserId', e.target.value)}>
                <option value="">{editing ? '(unchanged)' : `Me (${user.displayName})`}</option>
                {assignable.map((u) => <option key={u.id} value={u.id}>{u.displayName}{u.role === 'Admin' ? ' (admin)' : ''}</option>)}
              </select>
              {form.projectId && assignable.length === 0 && <span className="help">No executive is assigned to this project yet.</span>}
            </div>
          )}
        </div>
      </section>

      <div className="save-bar">
        <button type="button" className="btn" onClick={() => navigate(-1)} disabled={busy}>Cancel</button>
        <button type="submit" className="btn accent lg" disabled={busy || processing > 0}>{busy ? 'Saving…' : processing > 0 ? 'Processing photos…' : editing ? 'Save changes' : 'Save lead'}</button>
      </div>

      {conflict && (
        <Modal title="Already captured" onClose={() => setConflict(null)} size="narrow">
          <p>{conflict.message}</p>
          <p className="muted small">Open the existing lead to add this visit there, or save anyway if it is genuinely a different shop.</p>
          <div className="form-actions">
            <button className="btn" type="button" onClick={() => setConflict(null)}>Back</button>
            <Link className="btn primary" to={`/leads/${conflict.existingLeadId}`}>Open existing</Link>
            <button className="btn danger" type="button" onClick={(e) => submit(e, true)}>Save anyway</button>
          </div>
        </Modal>
      )}
    </form>
  )
}
