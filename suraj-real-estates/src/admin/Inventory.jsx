import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../lib/store'
import { costSheet } from '../lib/pricing'
import { Badge, Field, Modal } from '../components/ui'
import { inr, inrShort, num } from '../lib/format'

const STATUSES = ['available', 'hold', 'booked', 'sold', 'leased', 'blocked']

export default function Inventory() {
  const s = useStore()
  const [pid, setPid] = useState(s.projects[0]?.id)
  const p = s.projects.find((x) => x.id === pid)
  const pu = s.units.filter((u) => u.projectId === pid)
  const towers = [...new Set(pu.map((u) => u.tower))]
  const [tower, setTower] = useState('')
  const t = towers.includes(tower) ? tower : towers[0]
  const [sel, setSel] = useState(null)
  const list = pu.filter((u) => u.tower === t)
  const floors = [...new Set(list.map((u) => u.floor))].sort((a, b) => b - a)
  const cfgs = [...new Set(pu.map((u) => u.config))]
  const cnt = (st, arr = pu) => arr.filter((u) => u.status === st).length
  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Inventory</h1><p className="muted">{num(s.units.length)} units across {s.projects.length} projects · {num(cnt('available', s.units))} available</p></div>
        <div className="row gap wrap-row">
          <select value={pid} onChange={(e) => { setPid(e.target.value); setTower('') }}>{s.projects.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
          <select value={t} onChange={(e) => setTower(e.target.value)}>{towers.map((x) => <option key={x}>{x}</option>)}</select>
        </div>
      </div>
      {p && (
        <div className="table-wrap card">
          <table className="table">
            <thead><tr><th>Configuration</th>{STATUSES.map((x) => <th key={x} className="num">{x}</th>)}<th className="num">Total</th><th className="num">Unsold value</th></tr></thead>
            <tbody>{cfgs.map((c) => {
              const cu = pu.filter((u) => u.config === c)
              return <tr key={c}><td><b>{c}</b></td>{STATUSES.map((x) => <td key={x} className="num">{cnt(x, cu) || '—'}</td>)}<td className="num">{cu.length}</td><td className="num">{inrShort(cu.filter((u) => u.status === 'available').reduce((a, u) => a + costSheet(u, p, s.settings.taxes).agreementValue, 0))}</td></tr>
            })}</tbody>
          </table>
        </div>
      )}
      <div className="card pad mt">
        <div className="unit-legend">{STATUSES.map((k) => <span key={k}><i className={`u-${k}`} />{k} ({cnt(k, list)})</span>)}</div>
        {pu.length === 0 ? <p className="muted">No units yet. Add units from Projects → Edit → Add units.</p> : (
          <div className="unit-stack admin-units">
            {floors.map((f) => (
              <div key={f} className="unit-row">
                <span className="floor">{f === 0 ? (list.length > 12 ? '' : 'G') : f}</span>
                <div className="unit-wrap">
                  {list.filter((u) => u.floor === f).map((u) => (
                    <button key={u.id} className={`unit u-${u.status}`} onClick={() => setSel(u)} title={`${u.no} · ${u.config} · ${u.area} · ${u.facing}`}>
                      <b>{u.no}</b><small>{u.config} · {num(u.area)}</small>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {sel && <UnitEdit unit={s.units.find((x) => x.id === sel.id)} project={p} onClose={() => setSel(null)} />}
    </div>
  )
}

function UnitEdit({ unit: u, project: p, onClose }) {
  const s = useStore()
  const [f, setF] = useState(u)
  const cs = costSheet(f, p, s.settings.taxes)
  const booking = s.bookings.find((b) => b.unitId === u.id && b.status !== 'Cancelled')
  const lease = s.leases.find((l) => l.unitId === u.id && l.status === 'Active')
  const set = (k, n) => (e) => setF({ ...f, [k]: n ? Number(e.target.value) : e.target.type === 'checkbox' ? e.target.checked : e.target.value })
  return (
    <Modal title={`${p.name} · ${u.no}`} onClose={onClose}>
      <form className="form-grid" onSubmit={(e) => { e.preventDefault(); s.update('units', u.id, f); s.toast('Unit updated'); onClose() }}>
        <Field label="Status"><select value={f.status} onChange={set('status')}>{STATUSES.map((x) => <option key={x}>{x}</option>)}</select></Field>
        <Field label="Configuration"><input value={f.config} onChange={set('config')} /></Field>
        <Field label={`Area (${p.areaUnit})`}><input type="number" value={f.area} onChange={set('area', 1)} /></Field>
        <Field label="Facing"><input value={f.facing} onChange={set('facing')} /></Field>
        <label className="check span-2"><input type="checkbox" checked={!!f.forLease} onChange={set('forLease')} /> Available for lease</label>
        <div className="span-2 box">
          Agreement value <b>{inr(cs.agreementValue)}</b> · payable incl. GST <b>{inr(cs.payable)}</b>{p.leaseRate && f.forLease ? <> · rent <b>{inr(f.area * p.leaseRate)}/mo</b></> : null}
        </div>
        {booking && <p className="span-2">Booked: <Link to={`/admin/bookings/${booking.id}`}>{booking.code}</Link> <Badge>{booking.status}</Badge></p>}
        {lease && <p className="span-2">Leased to <b>{lease.tenant}</b> · <Link to="/admin/leasing">Leasing →</Link></p>}
        <div className="span-2 row gap wrap-row">
          <button className="btn btn-primary">Save</button>
          {['available', 'hold'].includes(u.status) && <Link className="btn btn-ghost" to={`/admin/bookings?new=1&unit=${u.id}`}>📝 Book this unit</Link>}
          {u.status === 'available' && u.forLease && <Link className="btn btn-ghost" to={`/admin/leasing?new=${u.id}`}>🔑 Lease this unit</Link>}
        </div>
      </form>
    </Modal>
  )
}
