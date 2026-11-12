import { useState } from 'react'
import { useStore } from '../lib/store'
import { addDays, todayISO } from '../lib/format'
import { Field, Modal } from './ui'

const validPhone = (p) => /^[6-9]\d{9}$/.test(String(p).replace(/\D/g, '').slice(-10)) && String(p).replace(/\D/g, '').length >= 10

export function EnquiryForm({ projectId = '', config = '', subject = 'Enquiry', compact, onDone, purposeOptions, cta = 'Request call back' }) {
  const { projects, submitEnquiry, toast } = useStore()
  const [f, setF] = useState({ name: '', phone: '', email: '', projectId, config, message: '', purpose: '', consent: true })
  const [sent, setSent] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })
  const submit = (e) => {
    e.preventDefault()
    if (!f.name.trim()) return toast('Please enter your name', 'err')
    if (!validPhone(f.phone)) return toast('Please enter a valid 10-digit mobile number', 'err')
    submitEnquiry({ ...f, subject: f.purpose ? `${subject} – ${f.purpose}` : subject })
    setSent(true)
    toast('Thank you! Our team will call you shortly.')
    onDone?.()
  }
  if (sent && !onDone)
    return (
      <div className="sent">
        <div className="sent-icon">✓</div>
        <h3>Thanks, {f.name.split(' ')[0]}!</h3>
        <p>A relationship manager will call you on {f.phone} within 30 minutes (9:30 AM – 7:30 PM).</p>
        <button className="btn btn-ghost" onClick={() => { setSent(false); setF({ ...f, message: '' }) }}>Send another enquiry</button>
      </div>
    )
  return (
    <form className={`form-grid ${compact ? 'compact' : ''}`} onSubmit={submit}>
      <Field label="Full name"><input value={f.name} onChange={set('name')} placeholder="Your name" required /></Field>
      <Field label="Mobile number"><input value={f.phone} onChange={set('phone')} placeholder="10-digit mobile" inputMode="tel" required /></Field>
      {!compact && <Field label="Email (optional)"><input type="email" value={f.email} onChange={set('email')} placeholder="you@example.com" /></Field>}
      <Field label="Interested in">
        <select value={f.projectId} onChange={set('projectId')}>
          <option value="">Any project</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name} — {p.type}</option>)}
        </select>
      </Field>
      {purposeOptions && (
        <Field label="Purpose">
          <select value={f.purpose} onChange={set('purpose')}>
            <option value="">Select</option>
            {purposeOptions.map((o) => <option key={o}>{o}</option>)}
          </select>
        </Field>
      )}
      {!compact && <Field label="Message (optional)" span={2}><textarea rows={3} value={f.message} onChange={set('message')} placeholder="Configuration, budget, preferred floor…" /></Field>}
      <label className="check span-2"><input type="checkbox" checked={f.consent} onChange={set('consent')} /> I agree to be contacted by SRM Developers on call / WhatsApp.</label>
      <button className="btn btn-primary span-2" disabled={!f.consent}>{cta}</button>
    </form>
  )
}

export function VisitModal({ projectId = '', onClose }) {
  const { projects, scheduleVisit, toast } = useStore()
  const [f, setF] = useState({ name: '', phone: '', projectId: projectId || projects[0]?.id, date: addDays(todayISO(), 1), time: '11:00', pickup: false })
  const [done, setDone] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })
  const submit = (e) => {
    e.preventDefault()
    if (!f.name.trim() || !validPhone(f.phone)) return toast('Enter your name and a valid mobile number', 'err')
    if (f.date < todayISO()) return toast('Pick a date from today onwards', 'err')
    scheduleVisit(f)
    setDone(true)
  }
  const p = projects.find((x) => x.id === f.projectId)
  return (
    <Modal title="Book a site visit" onClose={onClose}>
      {done ? (
        <div className="sent">
          <div className="sent-icon">📅</div>
          <h3>Visit booked!</h3>
          <p>{p?.name} on <b>{f.date}</b> at <b>{f.time}</b>. {f.pickup ? 'We will call you to arrange the free pick-up.' : ''} You will get a WhatsApp confirmation shortly.</p>
          <button className="btn btn-primary" onClick={onClose}>Done</button>
        </div>
      ) : (
        <form className="form-grid" onSubmit={submit}>
          <Field label="Full name"><input value={f.name} onChange={set('name')} required /></Field>
          <Field label="Mobile number"><input value={f.phone} onChange={set('phone')} inputMode="tel" required /></Field>
          <Field label="Project" span={2}>
            <select value={f.projectId} onChange={set('projectId')}>
              {projects.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
          </Field>
          <Field label="Date"><input type="date" min={todayISO()} value={f.date} onChange={set('date')} /></Field>
          <Field label="Time slot">
            <select value={f.time} onChange={set('time')}>
              {['10:00', '11:00', '12:00', '13:00', '15:00', '16:00', '17:00', '18:00'].map((t) => <option key={t}>{t}</option>)}
            </select>
          </Field>
          <label className="check span-2"><input type="checkbox" checked={f.pickup} onChange={set('pickup')} /> Arrange free pick-up & drop (within 15 km)</label>
          <button className="btn btn-primary span-2">Confirm site visit</button>
        </form>
      )}
    </Modal>
  )
}
