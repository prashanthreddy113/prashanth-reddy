import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, forgetBlob } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useToast } from '../lib/toast'
import { compressImage } from '../lib/image'
import { getPosition } from '../lib/geo'
import { STATUS, STATUS_ORDER, INTEREST, ACTIVITY, money, fmtDate, fmtDateTime, followUpText, telLink, whatsappLink, mapLink, directionsLink, fmtMobile, addDaysIso, todayIso, timeAgo } from '../lib/format'
import AuthImg from '../components/AuthImg'
import StarRating from '../components/StarRating'
import Modal from '../components/Modal'
import ConfirmDialog from '../components/ConfirmDialog'
import { StatusBadge, FollowUpBadge, ProjectChip } from '../components/StatusBadge'
import { IconPhone, IconWhatsapp, IconMap, IconEdit, IconTrash, IconCamera, IconPlus, IconX } from '../components/Icons'

const QUICK = [['Visit', '📍 Log visit'], ['Call', '📞 Log call'], ['WhatsApp', '💬 WhatsApp'], ['Meeting', '🤝 Meeting'], ['Note', '📝 Note']]

export default function LeadDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { user, isAdmin } = useAuth()
  const [lead, setLead] = useState(null)
  const [error, setError] = useState('')
  const [activity, setActivity] = useState(null) // { type }
  const [lightbox, setLightbox] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [assign, setAssign] = useState(false)
  const [users, setUsers] = useState([])
  const [settings, setSettings] = useState({ defaultFollowUpDays: 3 })
  const [uploading, setUploading] = useState(false)

  const load = useCallback(async () => {
    try { setLead(await api.lead(id)); setError('') } catch (e) { setError(e.message) }
  }, [id])
  useEffect(() => { load() }, [load])
  useEffect(() => { api.settings().then(setSettings).catch(() => {}) }, [])
  useEffect(() => { if (isAdmin) api.users().then((u) => setUsers(u.filter((x) => x.isActive))).catch(() => {}) }, [isAdmin])

  const addPhotos = async (e) => {
    const files = Array.from(e.target.files || [])
    e.target.value = ''
    if (!files.length) return
    setUploading(true)
    try {
      const photos = []
      for (const f of files) { const p = await compressImage(f); photos.push({ contentType: p.contentType, dataBase64: p.dataBase64, thumbBase64: p.thumbBase64 }) }
      setLead(await api.addPhotos(id, photos))
      toast.success(`${photos.length} photo${photos.length > 1 ? 's' : ''} added`)
    } catch (err) { toast.error(err.message) }
    finally { setUploading(false) }
  }

  const removePhoto = (photoId) => setConfirm({
    title: 'Remove photo', message: 'Delete this photo from the lead?', danger: true, confirmLabel: 'Delete',
    onConfirm: async () => { await api.deletePhoto(id, photoId); forgetBlob(api.photoPath(id, photoId, true)); forgetBlob(api.photoPath(id, photoId, false)); setLightbox(null); await load() },
  })

  const quickStatus = async (status) => {
    if (status === lead.status) return
    if (status === 'Lost') { setActivity({ type: 'Note', status: 'Lost' }); return }
    try { setLead(await api.addActivity(id, { type: 'Note', status, note: `Status changed to ${STATUS[status].label}` })); toast.success(`Marked ${STATUS[status].label}`) }
    catch (e) { toast.error(e.message) }
  }

  if (error) return <div className="alert error">{error} <Link to="/leads" className="btn sm">Back to leads</Link></div>
  if (!lead) return <div className="empty">Loading…</div>
  const isOpen = lead.status !== 'Converted' && lead.status !== 'Lost'
  const canEdit = isAdmin || lead.assignedToUserId === user.id

  return (
    <>
      <section className="card detail-head">
        <div className="card-body">
          <div className="row-between wrap">
            <div>
              <h2 className="detail-title">{lead.shopName}</h2>
              <div className="muted">{[lead.contactName, lead.shopType].filter(Boolean).join(' · ')}</div>
            </div>
            <div className="row gap">
              {canEdit && <Link to={`/leads/${id}/edit`} className="btn sm"><IconEdit /> Edit</Link>}
              {isAdmin && <button className="btn sm danger" onClick={() => setConfirm({ title: 'Delete lead', message: `Delete "${lead.shopName}" and all its photos and history? This cannot be undone.`, danger: true, confirmLabel: 'Delete', onConfirm: async () => { await api.deleteLead(id); toast.success('Lead deleted'); navigate('/leads', { replace: true }) } })}><IconTrash /></button>}
            </div>
          </div>
          <div className="lead-meta" style={{ marginTop: 10 }}>
            <StatusBadge status={lead.status} />
            <FollowUpBadge state={lead.followUpState} text={followUpText(lead.followUpState, lead.nextFollowUpAt)} />
            <ProjectChip name={lead.projectName} color={lead.projectColor} />
            <span className="muted small">👤 {lead.assignedToName}{isAdmin && <button className="link" style={{ marginLeft: 4 }} onClick={() => setAssign(true)}>change</button>}</span>
          </div>
          <div className="row gap wrap" style={{ marginTop: 12 }}>
            <StarRating value={lead.interest} showLabel />
            {lead.expectedValue ? <span className="pill">💰 {money(lead.expectedValue)}</span> : null}
          </div>
          <div className="quick-actions">
            <a className="btn" href={telLink(lead.mobile)}><IconPhone /> Call</a>
            <a className="btn wa" href={whatsappLink(lead.mobile, `Hello ${lead.contactName || ''}`.trim())} target="_blank" rel="noreferrer"><IconWhatsapp /> WhatsApp</a>
            {lead.latitude != null && <a className="btn" href={directionsLink(lead.latitude, lead.longitude)} target="_blank" rel="noreferrer"><IconMap /> Navigate</a>}
            {isOpen && <button className="btn accent" onClick={() => setActivity({ type: 'Visit' })}><IconPlus /> Log visit</button>}
          </div>
        </div>
      </section>

      {isOpen && (
        <div className="chips scroll status-steps">
          {STATUS_ORDER.map((s) => (
            <button key={s} className={`chip ${lead.status === s ? 'active' : ''} tone-${STATUS[s].tone}`} onClick={() => quickStatus(s)} title={STATUS[s].hint}>{STATUS[s].label}</button>
          ))}
        </div>
      )}

      <div className="grid-2">
        <div className="stack">
          <section className="card">
            <div className="card-head"><h2><IconCamera /> Photos <span className="muted">({lead.photos.length})</span></h2>
              <label className="btn sm">{uploading ? 'Uploading…' : '+ Add'}<input type="file" accept="image/*" capture="environment" multiple hidden onChange={addPhotos} disabled={uploading} /></label>
            </div>
            <div className="card-body">
              {lead.photos.length === 0 ? <div className="empty small">No photos yet. Take one from the shop front so the team can recognise it.</div> : (
                <div className="photo-grid">
                  {lead.photos.map((p) => (
                    <button type="button" key={p.id} className="photo-tile" onClick={() => setLightbox(p)}>
                      <AuthImg path={api.photoPath(id, p.id, true)} alt={p.caption || ''} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>

          <section className="card">
            <div className="card-head"><h2>Follow-ups & history</h2>
              {isOpen && <div className="chips">{QUICK.map(([t, lbl]) => <button key={t} className="chip" onClick={() => setActivity({ type: t })}>{lbl}</button>)}</div>}
            </div>
            <div className="card-body timeline">
              {lead.activities.map((a) => (
                <div key={a.id} className="timeline-item">
                  <span className="tl-icon">{ACTIVITY[a.type]?.icon || '•'}</span>
                  <div className="grow">
                    <div className="row-between">
                      <strong>{ACTIVITY[a.type]?.label || a.type}{a.toStatus && a.type !== 'StatusChange' ? ` · ${STATUS[a.toStatus]?.label}` : ''}{a.type === 'StatusChange' ? `: ${STATUS[a.fromStatus]?.label || '—'} → ${STATUS[a.toStatus]?.label}` : ''}</strong>
                      <small className="muted" title={fmtDateTime(a.createdAt)}>{timeAgo(a.createdAt)}</small>
                    </div>
                    {a.note && <div>{a.note}</div>}
                    <small className="muted">
                      {a.userName}
                      {a.interest ? ` · interest ${a.interest}★` : ''}
                      {a.nextFollowUpAt ? ` · next: ${fmtDate(a.nextFollowUpAt)}` : ''}
                      {a.latitude != null && <> · <a href={mapLink(a.latitude, a.longitude)} target="_blank" rel="noreferrer">📍 location</a></>}
                      {(isAdmin || a.userId === user.id) && a.type !== 'StatusChange' && a.type !== 'Assignment' && <> · <button className="link" onClick={() => setConfirm({ title: 'Delete entry', message: 'Remove this history entry?', danger: true, confirmLabel: 'Delete', onConfirm: async () => { await api.deleteActivity(id, a.id); await load() } })}>delete</button></>}
                    </small>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="stack">
          <section className="card">
            <div className="card-head"><h2>Details</h2></div>
            <div className="card-body kv">
              <div><dt>Mobile</dt><dd><a href={telLink(lead.mobile)}>{fmtMobile(lead.mobile)}</a>{lead.altMobile && <> · <a href={telLink(lead.altMobile)}>{fmtMobile(lead.altMobile)}</a></>}</dd></div>
              {lead.email && <div><dt>Email</dt><dd><a href={`mailto:${lead.email}`}>{lead.email}</a></dd></div>}
              <div><dt>Address</dt><dd>{[lead.address, lead.area, lead.city, lead.pincode].filter(Boolean).join(', ') || '—'}</dd></div>
              <div><dt>Location</dt><dd>{lead.latitude != null ? <a href={mapLink(lead.latitude, lead.longitude)} target="_blank" rel="noreferrer">{lead.latitude}, {lead.longitude}</a> : <span className="muted">not captured</span>}</dd></div>
              <div><dt>Next follow-up</dt><dd>{lead.nextFollowUpAt ? fmtDate(lead.nextFollowUpAt) : <span className="muted">{isOpen ? 'not set' : '—'}</span>}</dd></div>
              {lead.notes && <div><dt>Notes</dt><dd className="pre">{lead.notes}</dd></div>}
              {lead.lostReason && <div><dt>Lost reason</dt><dd>{lead.lostReason}</dd></div>}
              <div><dt>Captured</dt><dd>{fmtDateTime(lead.createdAt)} by {lead.createdByName}</dd></div>
              {lead.convertedAt && <div><dt>Converted</dt><dd>{fmtDateTime(lead.convertedAt)}</dd></div>}
              <div><dt>Last activity</dt><dd>{fmtDateTime(lead.lastActivityAt)}</dd></div>
            </div>
          </section>
          {lead.latitude != null && (
            <section className="card">
              <div className="card-body" style={{ padding: 0 }}>
                <iframe title="map" className="map-embed" loading="lazy" src={`https://www.google.com/maps?q=${lead.latitude},${lead.longitude}&z=16&output=embed`} />
              </div>
            </section>
          )}
        </div>
      </div>

      {activity && <ActivityModal lead={lead} initial={activity} defaultDays={settings.defaultFollowUpDays} onClose={() => setActivity(null)} onSaved={(l) => { setLead(l); setActivity(null) }} />}
      {lightbox && (
        <div className="lightbox" onClick={() => setLightbox(null)}>
          <AuthImg path={api.photoPath(id, lightbox.id, false)} alt="" onClick={(e) => e.stopPropagation()} />
          <div className="lightbox-bar" onClick={(e) => e.stopPropagation()}>
            <span className="muted">{fmtDateTime(lightbox.createdAt)} · {Math.round(lightbox.size / 1024)} KB</span>
            <button className="btn sm danger" onClick={() => removePhoto(lightbox.id)}><IconTrash /> Delete</button>
            <button className="btn sm" onClick={() => setLightbox(null)}><IconX /> Close</button>
          </div>
        </div>
      )}
      {confirm && <ConfirmDialog {...confirm} onClose={() => setConfirm(null)} />}
      {assign && (
        <Modal title="Reassign lead" onClose={() => setAssign(false)} size="narrow">
          <p className="muted small">Only executives assigned to <strong>{lead.projectName}</strong> can take this lead.</p>
          <div className="list">
            {users.filter((u) => u.id !== lead.assignedToUserId && (u.role === 'Admin' || u.projects.some((p) => p.id === lead.projectId))).map((u) => (
              <button key={u.id} className="btn block" onClick={async () => { try { setLead(await api.assignLead(id, u.id)); toast.success(`Assigned to ${u.displayName}`); setAssign(false) } catch (e) { toast.error(e.message) } }}>{u.displayName}{u.role === 'Admin' ? ' (admin)' : ''}</button>
            ))}
          </div>
        </Modal>
      )}
    </>
  )
}

function ActivityModal({ lead, initial, defaultDays, onClose, onSaved }) {
  const toast = useToast()
  const [form, setForm] = useState({ type: initial.type, note: '', interest: lead.interest, status: initial.status || lead.status, nextFollowUpAt: '', expectedValue: lead.expectedValue ?? '', lostReason: '' })
  const [pos, setPos] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  useEffect(() => { if (form.type === 'Visit') getPosition().then(setPos).catch(() => {}) }, [form.type])

  const isOpen = form.status !== 'Converted' && form.status !== 'Lost'
  const submit = async (e) => {
    e.preventDefault()
    setBusy(true); setError('')
    try {
      const saved = await api.addActivity(lead.id, {
        type: form.type, note: form.note, interest: form.interest, status: form.status,
        expectedValue: form.expectedValue === '' ? null : Number(form.expectedValue),
        nextFollowUpAt: isOpen && form.nextFollowUpAt ? form.nextFollowUpAt : null,
        lostReason: form.status === 'Lost' ? form.lostReason : null,
        latitude: pos?.latitude, longitude: pos?.longitude,
      })
      toast.success(`${ACTIVITY[form.type].label} logged`)
      onSaved(saved)
    } catch (err) { setError(err.message); setBusy(false) }
  }

  return (
    <Modal title="Log activity" onClose={onClose}>
      <form onSubmit={submit} className="stack">
        {error && <div className="alert error">{error}</div>}
        <div className="chips">{QUICK.map(([t, lbl]) => <button type="button" key={t} className={`chip ${form.type === t ? 'active' : ''}`} onClick={() => set('type', t)}>{lbl}</button>)}</div>
        <div className="field"><label>What happened?</label><textarea rows={3} value={form.note} onChange={(e) => set('note', e.target.value)} autoFocus placeholder="e.g. Showed samples, owner wants a price for 50 units" /></div>
        <div className="field"><label>Interest now</label><StarRating value={form.interest} onChange={(v) => set('interest', v)} size="lg" showLabel /></div>
        <div className="form-grid">
          <div className="field"><label>Status</label><select value={form.status} onChange={(e) => set('status', e.target.value)}>{STATUS_ORDER.map((s) => <option key={s} value={s}>{STATUS[s].label}</option>)}</select></div>
          <div className="field"><label>Expected value</label><input type="number" inputMode="decimal" min="0" value={form.expectedValue} onChange={(e) => set('expectedValue', e.target.value)} /></div>
        </div>
        {form.status === 'Lost' && <div className="field"><label>Why lost?</label><input value={form.lostReason} onChange={(e) => set('lostReason', e.target.value)} placeholder="e.g. price too high" /></div>}
        {isOpen && (
          <div className="field"><label>Next follow-up</label>
            <div className="row gap wrap">
              {[['Tomorrow', 1], [`${defaultDays} days`, defaultDays], ['1 week', 7], ['2 weeks', 14]].map(([lbl, d]) => (
                <button type="button" key={d} className={`chip ${form.nextFollowUpAt === addDaysIso(todayIso(), d) ? 'active' : ''}`} onClick={() => set('nextFollowUpAt', addDaysIso(todayIso(), d))}>{lbl}</button>
              ))}
              <input type="date" value={form.nextFollowUpAt} min={todayIso()} onChange={(e) => set('nextFollowUpAt', e.target.value)} style={{ maxWidth: 170 }} />
            </div>
            <span className="help">{lead.nextFollowUpAt && !form.nextFollowUpAt ? `Current: ${fmtDate(lead.nextFollowUpAt)}. Leave blank to keep it (a visit/call on the due day clears it).` : 'Pick when to visit or call next.'}</span>
          </div>
        )}
        {form.type === 'Visit' && <span className="help">{pos ? `📍 Visit location captured (±${pos.accuracy} m)` : 'Capturing your location for this visit…'}</span>}
        <div className="form-actions">
          <button type="button" className="btn" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" className="btn primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </Modal>
  )
}
