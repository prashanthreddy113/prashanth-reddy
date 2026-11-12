import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useStore } from '../lib/store'
import { Badge, Field, Modal, Tabs } from '../components/ui'
import { SOURCES, STAGES } from '../lib/seed'
import { addDays, fmtDate, fmtDateTime, todayISO, waLink } from '../lib/format'
import { teamName } from './hooks'

const BLANK = { name: '', phone: '', email: '', projectId: '', config: '', budget: '', source: 'Walk-in', stage: 'New', assignedTo: 't2', purpose: 'Self use', followUp: '', rating: 'Warm' }

export default function Leads() {
  const s = useStore()
  const [sp, setSp] = useSearchParams()
  const [view, setView] = useState('board')
  const [q, setQ] = useState('')
  const [fp, setFp] = useState('')
  const [fs, setFs] = useState('')
  const [fo, setFo] = useState('')
  const [drag, setDrag] = useState(null)
  const openId = sp.get('id')
  const isNew = sp.get('new') === '1'
  const close = () => setSp({})
  const list = useMemo(() => s.leads.filter((l) =>
    (!q || `${l.name} ${l.phone} ${l.email}`.toLowerCase().includes(q.toLowerCase())) &&
    (!fp || l.projectId === fp) && (!fs || l.source === fs) && (!fo || l.assignedTo === fo)), [s.leads, q, fp, fs, fo])
  const proj = (id) => s.projects.find((p) => p.id === id)?.name.replace('SRM ', '') || 'Any'
  const today = todayISO()
  const move = (id, stage) => {
    s.update('leads', id, (l) => ({ stage, notes: [{ at: new Date().toISOString(), by: 'Admin', text: `Stage changed ${l.stage} → ${stage}` }, ...l.notes] }))
  }

  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Leads & CRM</h1><p className="muted">{s.leads.length} leads · {s.leads.filter((l) => l.followUp && l.followUp <= today && !['Booked', 'Lost'].includes(l.stage)).length} follow-ups due</p></div>
        <div className="row gap"><Tabs value={view} onChange={setView} tabs={[['board', 'Board'], ['table', 'Table']]} /><button className="btn btn-primary" onClick={() => setSp({ new: '1' })}>+ Add lead</button></div>
      </div>
      <div className="toolbar">
        <input placeholder="Search name, phone, email…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={fp} onChange={(e) => setFp(e.target.value)}><option value="">All projects</option>{s.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        <select value={fs} onChange={(e) => setFs(e.target.value)}><option value="">All sources</option>{SOURCES.map((x) => <option key={x}>{x}</option>)}</select>
        <select value={fo} onChange={(e) => setFo(e.target.value)}><option value="">All owners</option>{s.settings.team.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
      </div>

      {view === 'board' ? (
        <div className="kanban">
          {STAGES.map((st) => {
            const col = list.filter((l) => l.stage === st)
            return (
              <div key={st} className={`kcol kcol-${st.replace(' ', '')}`} onDragOver={(e) => e.preventDefault()} onDrop={() => { if (drag) move(drag, st); setDrag(null) }}>
                <div className="kcol-head"><b>{st}</b><span>{col.length}</span></div>
                {col.slice(0, 40).map((l) => (
                  <div key={l.id} className="kcard" draggable onDragStart={() => setDrag(l.id)} onClick={() => setSp({ id: l.id })}>
                    <div className="row-between"><b>{l.name}</b><Badge>{l.rating}</Badge></div>
                    <small>{l.config || 'Any'} · {proj(l.projectId)}</small>
                    <small className="muted">{l.source} · {teamName(s.settings, l.assignedTo).split(' ')[0]}</small>
                    {l.followUp && <small className={l.followUp < today ? 'red' : l.followUp === today ? 'amber' : 'muted'}>⏰ {fmtDate(l.followUp)}</small>}
                  </div>
                ))}
                {col.length > 40 && <small className="muted">+{col.length - 40} more (use table view)</small>}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="card table-wrap">
          <table className="table">
            <thead><tr><th>Name</th><th>Phone</th><th>Interest</th><th>Budget</th><th>Source</th><th>Stage</th><th>Owner</th><th>Follow-up</th><th>Created</th></tr></thead>
            <tbody>{list.map((l) => (
              <tr key={l.id} className="click" onClick={() => setSp({ id: l.id })}>
                <td><b>{l.name}</b></td><td>{l.phone}</td><td>{l.config} · {proj(l.projectId)}</td><td>{l.budget}</td><td>{l.source}</td>
                <td><Badge>{l.stage}</Badge></td><td>{teamName(s.settings, l.assignedTo)}</td>
                <td className={l.followUp && l.followUp < today ? 'red' : ''}>{fmtDate(l.followUp)}</td><td>{fmtDate(l.createdAt)}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
      {isNew && <LeadForm onClose={close} />}
      {openId && <LeadDrawer id={openId} onClose={close} />}
    </div>
  )
}

function LeadForm({ onClose }) {
  const s = useStore()
  const [f, setF] = useState({ ...BLANK, followUp: addDays(todayISO(), 1) })
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const save = (e) => {
    e.preventDefault()
    if (!f.name || !/\d{10}/.test(f.phone.replace(/\D/g, ''))) return s.toast('Name and a 10-digit phone are required', 'err')
    s.add('leads', { ...f, createdAt: todayISO(), notes: [{ at: new Date().toISOString(), by: 'Admin', text: `Lead created (${f.source}).` }] })
    s.toast('Lead added')
    onClose()
  }
  return (
    <Modal title="New lead" onClose={onClose}>
      <form className="form-grid" onSubmit={save}>
        <LeadFields f={f} set={set} />
        <button className="btn btn-primary span-2">Save lead</button>
      </form>
    </Modal>
  )
}

function LeadFields({ f, set }) {
  const s = useStore()
  return (
    <>
      <Field label="Name"><input value={f.name} onChange={set('name')} /></Field>
      <Field label="Phone"><input value={f.phone} onChange={set('phone')} /></Field>
      <Field label="Email"><input value={f.email} onChange={set('email')} /></Field>
      <Field label="Project"><select value={f.projectId} onChange={set('projectId')}><option value="">Any</option>{s.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
      <Field label="Configuration"><input value={f.config} onChange={set('config')} placeholder="3 BHK / Office / Plot" /></Field>
      <Field label="Budget"><input value={f.budget} onChange={set('budget')} placeholder="1.2Cr – 2Cr" /></Field>
      <Field label="Source"><select value={f.source} onChange={set('source')}>{SOURCES.map((x) => <option key={x}>{x}</option>)}</select></Field>
      <Field label="Purpose"><select value={f.purpose} onChange={set('purpose')}>{['Self use', 'Investment', 'Buy – investment', 'Buy – own use', 'Lease'].map((x) => <option key={x}>{x}</option>)}</select></Field>
      <Field label="Assigned to"><select value={f.assignedTo} onChange={set('assignedTo')}>{s.settings.team.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Field>
      <Field label="Rating"><select value={f.rating} onChange={set('rating')}>{['Hot', 'Warm', 'Cold'].map((x) => <option key={x}>{x}</option>)}</select></Field>
      <Field label="Stage"><select value={f.stage} onChange={set('stage')}>{STAGES.map((x) => <option key={x}>{x}</option>)}</select></Field>
      <Field label="Next follow-up"><input type="date" value={f.followUp} onChange={set('followUp')} /></Field>
    </>
  )
}

function LeadDrawer({ id, onClose }) {
  const s = useStore()
  const nav = useNavigate()
  const l = s.leads.find((x) => x.id === id)
  const [note, setNote] = useState('')
  const [edit, setEdit] = useState(false)
  const [f, setF] = useState(l)
  const [visit, setVisit] = useState(null)
  if (!l) return null
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const addNote = (text) => s.update('leads', id, (x) => ({ notes: [{ at: new Date().toISOString(), by: 'Admin', text }, ...x.notes] }))
  const p = s.projects.find((x) => x.id === l.projectId)
  const msg = `Hi ${l.name.split(' ')[0]}, this is ${teamName(s.settings, l.assignedTo)} from SRM Developers. Thank you for your interest in ${p?.name || 'our projects'} at Narsingi. When would be a good time to talk?`
  const lv = s.visits.filter((v) => v.leadId === id)
  return (
    <div className="drawer-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="drawer">
        <div className="drawer-head">
          <div><h2>{l.name}</h2><small className="muted">{l.phone} · {l.email}</small></div>
          <button className="icon-btn" onClick={onClose}>✕</button>
        </div>
        <div className="row gap wrap-row">
          <a className="btn btn-sm btn-ghost" href={`tel:${l.phone}`} onClick={() => addNote('Called the lead.')}>📞 Call</a>
          <a className="btn btn-sm btn-ghost" href={waLink(l.phone, msg)} target="_blank" rel="noreferrer" onClick={() => addNote('Sent WhatsApp message.')}>💬 WhatsApp</a>
          <button className="btn btn-sm btn-ghost" onClick={() => setVisit({ date: addDays(todayISO(), 1), time: '11:00', projectId: l.projectId || s.projects[0].id })}>📅 Schedule visit</button>
          <button className="btn btn-sm btn-primary" onClick={() => nav(`/admin/bookings?new=1&lead=${l.id}`)}>📝 Convert to booking</button>
        </div>
        <div className="stage-bar">
          {STAGES.map((st) => <button key={st} className={l.stage === st ? 'on' : ''} onClick={() => s.update('leads', id, (x) => ({ stage: st, notes: [{ at: new Date().toISOString(), by: 'Admin', text: `Stage changed ${x.stage} → ${st}` }, ...x.notes] }))}>{st}</button>)}
        </div>
        {edit ? (
          <form className="form-grid" onSubmit={(e) => { e.preventDefault(); s.update('leads', id, f); setEdit(false); s.toast('Lead updated') }}>
            <LeadFields f={f} set={set} />
            <button className="btn btn-primary span-2">Save</button>
          </form>
        ) : (
          <div className="kv">
            {[['Project', p?.name || 'Any'], ['Configuration', l.config], ['Budget', l.budget], ['Purpose', l.purpose], ['Source', l.source], ['Owner', teamName(s.settings, l.assignedTo)], ['Rating', l.rating], ['Created', fmtDate(l.createdAt)]].map(([k, v]) => <div key={k}><small>{k}</small><b>{v || '—'}</b></div>)}
            <div><small>Follow-up</small><input type="date" value={l.followUp || ''} onChange={(e) => s.update('leads', id, { followUp: e.target.value })} /></div>
            <div><button className="btn btn-sm btn-ghost" onClick={() => { setF(l); setEdit(true) }}>✏️ Edit details</button></div>
          </div>
        )}
        {lv.length > 0 && <><h4>Site visits</h4><ul className="list">{lv.map((v) => <li key={v.id}><b>{fmtDate(v.date)} {v.time}</b><Badge>{v.status}</Badge><small>{v.feedback}</small></li>)}</ul></>}
        <h4>Activity</h4>
        <form className="note-form" onSubmit={(e) => { e.preventDefault(); if (note.trim()) { addNote(note.trim()); setNote('') } }}>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note (call outcome, requirement…)" />
          <button className="btn btn-sm btn-primary">Add</button>
        </form>
        <ul className="activity">
          {l.notes.map((n, i) => <li key={i}><small>{fmtDateTime(n.at)} · {n.by}</small><p>{n.text}</p></li>)}
        </ul>
        <p><button className="btn btn-sm btn-danger" onClick={() => { if (confirm('Delete this lead?')) { s.remove('leads', id); onClose() } }}>Delete lead</button> <Link className="small" to="/admin/visits">Visits →</Link></p>
      </aside>
      {visit && (
        <Modal title={`Schedule visit · ${l.name}`} onClose={() => setVisit(null)}>
          <form className="form-grid" onSubmit={(e) => {
            e.preventDefault()
            s.add('visits', { leadId: l.id, name: l.name, phone: l.phone, ...visit, status: 'Scheduled', agent: l.assignedTo, pickup: false, feedback: '' })
            s.update('leads', id, (x) => ({ stage: ['New', 'Contacted'].includes(x.stage) ? 'Site visit' : x.stage, notes: [{ at: new Date().toISOString(), by: 'Admin', text: `Site visit scheduled ${visit.date} ${visit.time}` }, ...x.notes] }))
            s.toast('Visit scheduled'); setVisit(null)
          }}>
            <Field label="Project" span={2}><select value={visit.projectId} onChange={(e) => setVisit({ ...visit, projectId: e.target.value })}>{s.projects.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
            <Field label="Date"><input type="date" value={visit.date} onChange={(e) => setVisit({ ...visit, date: e.target.value })} /></Field>
            <Field label="Time"><input type="time" value={visit.time} onChange={(e) => setVisit({ ...visit, time: e.target.value })} /></Field>
            <button className="btn btn-primary span-2">Schedule</button>
          </form>
        </Modal>
      )}
    </div>
  )
}
