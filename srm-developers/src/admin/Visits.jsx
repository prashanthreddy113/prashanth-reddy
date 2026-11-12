import { useState } from 'react'
import { useStore } from '../lib/store'
import { Badge, Field, Modal, Tabs } from '../components/ui'
import { addDays, fmtDate, todayISO, waLink } from '../lib/format'
import { teamName } from './hooks'

export default function Visits() {
  const s = useStore()
  const today = todayISO()
  const [tab, setTab] = useState('upcoming')
  const [fb, setFb] = useState(null)
  const [anchor, setAnchor] = useState(today)
  const sorted = [...s.visits].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
  const list = tab === 'upcoming' ? sorted.filter((v) => v.date >= today && v.status === 'Scheduled') : tab === 'past' ? sorted.filter((v) => v.date < today || v.status !== 'Scheduled').reverse() : sorted
  const week = Array.from({ length: 7 }, (_, i) => addDays(anchor, i))
  const proj = (id) => s.projects.find((p) => p.id === id)
  const done = s.visits.filter((v) => v.status === 'Completed').length
  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Site visits</h1><p className="muted">{s.visits.filter((v) => v.status === 'Scheduled' && v.date >= today).length} upcoming · {done} completed · {s.visits.length ? Math.round((done / s.visits.length) * 100) : 0}% show-up</p></div>
      </div>
      <div className="card pad">
        <div className="row-between"><h3>Week view</h3><div className="row gap"><button className="btn btn-sm btn-ghost" onClick={() => setAnchor(addDays(anchor, -7))}>←</button><button className="btn btn-sm btn-ghost" onClick={() => setAnchor(today)}>Today</button><button className="btn btn-sm btn-ghost" onClick={() => setAnchor(addDays(anchor, 7))}>→</button></div></div>
        <div className="week">
          {week.map((d) => (
            <div key={d} className={`day ${d === today ? 'today' : ''}`}>
              <b>{new Date(d + 'T00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</b>
              {s.visits.filter((v) => v.date === d).sort((a, b) => a.time.localeCompare(b.time)).map((v) => (
                <div key={v.id} className={`vchip v-${v.status.replace(' ', '')}`} style={{ '--c': proj(v.projectId)?.palette[0] }} onClick={() => setFb(v)}>
                  <small>{v.time}</small> {v.name.split(' ')[0]}<small>{proj(v.projectId)?.name.replace('SRM ', '')}</small>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
      <Tabs value={tab} onChange={setTab} tabs={[['upcoming', 'Upcoming'], ['past', 'Past'], ['all', 'All']]} />
      <div className="card table-wrap">
        <table className="table">
          <thead><tr><th>Date</th><th>Time</th><th>Visitor</th><th>Project</th><th>Executive</th><th>Pick-up</th><th>Status</th><th>Feedback</th><th /></tr></thead>
          <tbody>{list.map((v) => (
            <tr key={v.id}>
              <td>{fmtDate(v.date)}</td><td>{v.time}</td><td><b>{v.name}</b><br /><small>{v.phone}</small></td><td>{proj(v.projectId)?.name}</td>
              <td>{teamName(s.settings, v.agent)}</td><td>{v.pickup ? '🚗 Yes' : '—'}</td><td><Badge>{v.status}</Badge></td><td className="small">{v.feedback}</td>
              <td className="nowrap">
                <a className="btn btn-sm btn-ghost" target="_blank" rel="noreferrer" href={waLink(v.phone, `Hi ${v.name.split(' ')[0]}, this is a reminder of your site visit to ${proj(v.projectId)?.name} on ${fmtDate(v.date)} at ${v.time}. Location: SRM Experience Centre, Narsingi. See you there!`)}>Remind</a>
                <button className="btn btn-sm btn-ghost" onClick={() => setFb(v)}>Update</button>
              </td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      {fb && <VisitUpdate v={fb} onClose={() => setFb(null)} />}
    </div>
  )
}

function VisitUpdate({ v, onClose }) {
  const s = useStore()
  const [f, setF] = useState({ status: v.status, feedback: v.feedback, date: v.date, time: v.time, agent: v.agent })
  return (
    <Modal title={`Visit · ${v.name}`} onClose={onClose}>
      <form className="form-grid" onSubmit={(e) => {
        e.preventDefault()
        s.update('visits', v.id, f)
        if (v.leadId && f.status === 'Completed') s.update('leads', v.leadId, (l) => ({ stage: ['New', 'Contacted', 'Site visit'].includes(l.stage) ? 'Negotiation' : l.stage, notes: [{ at: new Date().toISOString(), by: 'Admin', text: `Site visit completed. ${f.feedback}` }, ...l.notes] }))
        s.toast('Visit updated'); onClose()
      }}>
        <Field label="Status"><select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>{['Scheduled', 'Completed', 'No show', 'Cancelled'].map((x) => <option key={x}>{x}</option>)}</select></Field>
        <Field label="Executive"><select value={f.agent} onChange={(e) => setF({ ...f, agent: e.target.value })}>{s.settings.team.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Field>
        <Field label="Date"><input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
        <Field label="Time"><input type="time" value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} /></Field>
        <Field label="Feedback" span={2}><textarea rows={3} value={f.feedback} onChange={(e) => setF({ ...f, feedback: e.target.value })} /></Field>
        <button className="btn btn-primary span-2">Save</button>
      </form>
    </Modal>
  )
}
