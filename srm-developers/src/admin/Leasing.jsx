import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useStore } from '../lib/store'
import { Badge, Field, Modal, Stat } from '../components/ui'
import { addMonths, fmtDate, inr, inrShort, monthLabel, num, todayISO, waLink } from '../lib/format'

/** Monthly rent for a given month with yearly escalation. */
export function rentFor(l, monthKeyStr) {
  const s = new Date(l.start + 'T00:00:00')
  const m = new Date(monthKeyStr + '-01T00:00:00')
  const elapsed = (m.getFullYear() - s.getFullYear()) * 12 + (m.getMonth() - s.getMonth())
  return Math.round(l.rent * Math.pow(1 + (l.escalation || 0) / 100, Math.floor(Math.max(0, elapsed) / 12)))
}
function dues(l, rentPayments) {
  const paid = new Set(rentPayments.filter((r) => r.leaseId === l.id).map((r) => r.month))
  const out = []
  const end = todayISO().slice(0, 7)
  const last = addMonths(l.start, l.months - 1).slice(0, 7)
  let k = l.start.slice(0, 7)
  while (k <= end && k <= last) {
    if (!paid.has(k)) out.push({ month: k, amount: rentFor(l, k) })
    k = addMonths(k + '-01', 1).slice(0, 7)
  }
  return out
}

export default function Leasing() {
  const s = useStore()
  const [sp, setSp] = useSearchParams()
  const [pay, setPay] = useState(null)
  const rows = useMemo(() => s.leases.map((l) => ({
    l, u: s.units.find((u) => u.id === l.unitId), p: s.projects.find((p) => p.id === l.projectId),
    due: l.status === 'Active' ? dues(l, s.rentPayments) : [], current: rentFor(l, todayISO().slice(0, 7)),
  })), [s.leases, s.units, s.projects, s.rentPayments])
  const active = rows.filter((r) => r.l.status === 'Active')
  const vacant = s.units.filter((u) => u.forLease && u.status === 'available')
  const outstanding = active.reduce((a, r) => a + r.due.reduce((x, d) => x + d.amount, 0), 0)
  const newUnit = sp.get('new')
  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Leasing & rent</h1><p className="muted">Commercial leases at Trade Tower & Galleria — tenants, escalations and rent collection.</p></div>
        <button className="btn btn-primary" onClick={() => setSp({ new: vacant[0]?.id || '' })} disabled={!vacant.length}>+ New lease</button>
      </div>
      <div className="grid-4">
        <Stat tone="blue" icon="🔑" label="Active leases" value={active.length} sub={`${num(active.reduce((a, r) => a + (r.u?.area || 0), 0))} sq ft leased`} />
        <Stat tone="green" icon="💵" label="Monthly rent roll" value={inrShort(active.reduce((a, r) => a + r.current, 0))} sub={`${inrShort(active.reduce((a, r) => a + r.current, 0) * 12)} / year`} />
        <Stat tone="red" icon="⚠️" label="Rent outstanding" value={inrShort(outstanding)} sub={`${active.filter((r) => r.due.length).length} tenants`} />
        <Stat tone="amber" icon="🏬" label="Vacant leasable units" value={vacant.length} sub={`${num(vacant.reduce((a, u) => a + u.area, 0))} sq ft`} />
      </div>
      <div className="card table-wrap mt">
        <table className="table">
          <thead><tr><th>Tenant</th><th>Unit</th><th>Start · term</th><th className="num">Current rent</th><th className="num">Deposit</th><th>Dues</th><th>Status</th><th /></tr></thead>
          <tbody>{rows.map(({ l, u, p, due, current }) => (
            <tr key={l.id}>
              <td><b>{l.tenant}</b><br /><small className="muted">{l.contact} · {l.phone}</small></td>
              <td>{p?.name.replace('SRM ', '')} · {u?.no}<br /><small className="muted">{num(u?.area)} sq ft</small></td>
              <td>{fmtDate(l.start)}<br /><small className="muted">{l.months} months · lock-in {l.lockIn} · +{l.escalation}%/yr</small></td>
              <td className="num">{inr(current)}</td><td className="num">{inrShort(l.deposit)}</td>
              <td>{due.length ? <span className="red">{due.length} month{due.length > 1 ? 's' : ''} · {inrShort(due.reduce((a, d) => a + d.amount, 0))}</span> : <span className="green">Up to date</span>}</td>
              <td><Badge>{l.status}</Badge></td>
              <td className="nowrap">
                {due.length > 0 && <>
                  <a className="btn btn-sm btn-ghost" target="_blank" rel="noreferrer" href={waLink(l.phone, `Dear ${l.contact}, rent of ${inr(due.reduce((a, d) => a + d.amount, 0))} for ${due.map((d) => monthLabel(d.month)).join(', ')} at ${p?.name} ${u?.no} is pending. Kindly arrange payment. – SRM Developers`)}>Remind</a>
                  <button className="btn btn-sm btn-primary" onClick={() => setPay({ l, due })}>Collect</button>
                </>}
                {l.status === 'Active' && <button className="btn btn-sm btn-ghost" onClick={() => { if (confirm(`Terminate lease for ${l.tenant}? Unit will become available.`)) { s.update('leases', l.id, { status: 'Terminated' }); s.update('units', l.unitId, { status: 'available' }) } }}>End</button>}
              </td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      {newUnit !== null && <NewLease unitId={newUnit} vacant={vacant} onClose={() => setSp({})} />}
      {pay && (
        <Modal title={`Collect rent · ${pay.l.tenant}`} onClose={() => setPay(null)}>
          <ul className="list">{pay.due.map((d) => (
            <li key={d.month}><b>{monthLabel(d.month)}</b><span>{inr(d.amount)}</span>
              <button className="btn btn-sm btn-primary" onClick={() => { s.add('rentPayments', { leaseId: pay.l.id, month: d.month, amount: d.amount, date: todayISO(), mode: 'NEFT' }); setPay({ ...pay, due: pay.due.filter((x) => x.month !== d.month) }); s.toast(`Rent for ${monthLabel(d.month)} recorded`) }}>Mark paid</button></li>
          ))}</ul>
          {pay.due.length === 0 && <p className="green">All dues cleared ✓</p>}
        </Modal>
      )}
    </div>
  )
}

function NewLease({ unitId, vacant, onClose }) {
  const s = useStore()
  const [f, setF] = useState({ unitId: unitId || vacant[0]?.id || '', tenant: '', contact: '', phone: '', start: todayISO().slice(0, 8) + '01', months: 36, lockIn: 36, escalation: 5, rent: '', deposit: '' })
  const u = s.units.find((x) => x.id === f.unitId)
  const p = u && s.projects.find((x) => x.id === u.projectId)
  const suggested = u && p?.leaseRate ? u.area * p.leaseRate : 0
  const save = (e) => {
    e.preventDefault()
    if (!u || !f.tenant) return s.toast('Select unit and enter tenant', 'err')
    const rent = Number(f.rent) || suggested
    s.add('leases', { ...f, projectId: u.projectId, rent, deposit: Number(f.deposit) || rent * 6, months: Number(f.months), lockIn: Number(f.lockIn), escalation: Number(f.escalation), status: 'Active' })
    s.update('units', u.id, { status: 'leased' })
    s.toast('Lease created'); onClose()
  }
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  return (
    <Modal title="New lease" onClose={onClose}>
      <form className="form-grid" onSubmit={save}>
        <Field label="Unit" span={2}><select value={f.unitId} onChange={set('unitId')}>{vacant.map((x) => <option key={x.id} value={x.id}>{s.projects.find((p) => p.id === x.projectId)?.name} · {x.no} · {num(x.area)} sq ft</option>)}</select></Field>
        <Field label="Tenant / company"><input value={f.tenant} onChange={set('tenant')} /></Field>
        <Field label="Contact person"><input value={f.contact} onChange={set('contact')} /></Field>
        <Field label="Phone"><input value={f.phone} onChange={set('phone')} /></Field>
        <Field label="Start date"><input type="date" value={f.start} onChange={set('start')} /></Field>
        <Field label="Monthly rent (₹)" hint={suggested ? `Suggested ${inr(suggested)}` : ''}><input type="number" value={f.rent} onChange={set('rent')} placeholder={String(suggested)} /></Field>
        <Field label="Security deposit (₹)"><input type="number" value={f.deposit} onChange={set('deposit')} placeholder="6 months rent" /></Field>
        <Field label="Term (months)"><input type="number" value={f.months} onChange={set('months')} /></Field>
        <Field label="Lock-in (months)"><input type="number" value={f.lockIn} onChange={set('lockIn')} /></Field>
        <Field label="Escalation % / year"><input type="number" value={f.escalation} onChange={set('escalation')} /></Field>
        <button className="btn btn-primary span-2">Create lease</button>
      </form>
    </Modal>
  )
}
