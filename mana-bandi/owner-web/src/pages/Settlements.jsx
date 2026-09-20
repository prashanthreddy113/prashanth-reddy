import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { useTown } from '../lib/town'
import { useToast } from '../lib/toast'
import { SERVICE, fmtDateTime, inr } from '../lib/format'
import { downloadCsv } from '../lib/csv'
import StatusPill from '../components/StatusPill'
import KpiTile from '../components/KpiTile'
import Modal from '../components/Modal'

export default function Settlements() {
  const { townId, towns } = useTown()
  const toast = useToast()
  const [rows, setRows] = useState(null)
  const [status, setStatus] = useState('')
  const [pay, setPay] = useState(null)
  const [utr, setUtr] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => api.settlements.list(townId).then(setRows), [townId])
  useEffect(() => { load() }, [load])
  if (!rows) return <div className="loading">Loading…</div>

  const shown = status ? rows.filter((r) => r.status === status) : rows
  const due = rows.filter((r) => r.status === 'due')
  const sum = (arr, k) => arr.reduce((a, r) => a + r[k], 0)
  const townName = (id) => towns.find((t) => t.id === id)?.nameEn || id

  const markPaid = async () => {
    setBusy(true)
    try { await api.settlements.markPaid(pay.id, utr); await load(); toast.success(`${pay.captain.name} paid ${inr(pay.payout)}`); setPay(null); setUtr('') } catch (e) { toast.error(e.message) } finally { setBusy(false) }
  }
  const exportCsv = () => downloadCsv('settlements.csv', shown, [
    { label: 'Captain', get: (r) => r.captain.name }, { label: 'Phone', get: (r) => r.captain.phone }, { label: 'Town', get: (r) => townName(r.captain.townId) }, { key: 'period', label: 'Period' },
    { key: 'cashCollected', label: 'Cash collected' }, { key: 'upiEarned', label: 'UPI earned' }, { key: 'codHeld', label: 'COD held' }, { key: 'commissionPct', label: 'Commission %' }, { key: 'commission', label: 'Commission' }, { key: 'incentive', label: 'Incentive' }, { key: 'payout', label: 'Payout due' }, { key: 'status', label: 'Status' }, { key: 'utr', label: 'UTR' },
  ])

  return (
    <>
      <div className="kpi-grid four">
        <KpiTile icon="🧾" label="Payouts due" value={inr(sum(due, 'payout'))} sub={`${due.length} captains`} tone="yellow" />
        <KpiTile icon="💵" label="Cash collected" value={inr(sum(rows, 'cashCollected'))} sub="stays with captains" tone="ink" />
        <KpiTile icon="📱" label="UPI earned" value={inr(sum(rows, 'upiEarned'))} sub="received by Mana Bandi, paid out T+1" tone="green" />
        <KpiTile icon="💸" label="Commission this week" value={inr(sum(rows, 'commission'))} sub={<Link to="/commission">from commission rules →</Link>} tone="green" />
      </div>
      <div className="card">
        <div className="card-head">
          <div className="filters">
            <span className="muted">Period {rows[0]?.period}</span>
            <select value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All</option><option value="due">Due</option><option value="paid">Paid</option><option value="on_hold">On hold</option></select>
          </div>
          <button className="btn sm" onClick={exportCsv}>⬇ CSV</button>
        </div>
        <div className="table-wrap tall">
          <table>
            <thead><tr><th>Captain</th><th>Town</th><th>Cash collected</th><th>UPI earned</th><th>COD held</th><th>Commission</th><th>Incentive</th><th>Payout due</th><th>Status</th><th /></tr></thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.id}>
                  <td><Link to={`/captains/${r.captainId}`}>{SERVICE[r.captain.vehicleType].emoji} {r.captain.name}</Link><div className="mono small muted">{r.captain.vehicleNo}</div></td>
                  <td>{townName(r.captain.townId)}</td>
                  <td>{inr(r.cashCollected)}</td>
                  <td>{inr(r.upiEarned)}</td>
                  <td>{r.codHeld ? inr(r.codHeld) : <span className="muted">—</span>}</td>
                  <td title={r.lines.map((l) => `${l.service}: ${l.pct}% of ${inr(l.amount)} (${l.rule})`).join('\n')}>{inr(r.commission)} <span className="muted small">{r.commissionPct}%</span>{r.lines.some((l) => l.pct === 0) && <span className="pill pill-green sm">free period</span>}</td>
                  <td>{r.incentive ? inr(r.incentive) : <span className="muted">—</span>}</td>
                  <td className={r.payout < 0 ? 'neg' : ''}><b>{inr(r.payout)}</b>{r.payout < 0 && <div className="small muted">captain owes us</div>}</td>
                  <td><StatusPill status={r.status} />{r.utr && <div className="mono small muted">{r.utr} · {fmtDateTime(r.paidAt)}</div>}</td>
                  <td>{r.status === 'due' && <button className="btn sm primary" onClick={() => setPay(r)}>Mark paid</button>}{r.status === 'on_hold' && <span className="muted small">KYC / dispute</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <Modal open={!!pay} title="Mark settlement paid" onClose={() => setPay(null)} footer={<><button className="btn" onClick={() => setPay(null)}>Cancel</button><button className="btn primary" disabled={busy} onClick={markPaid}>{busy ? 'Saving…' : 'Confirm paid'}</button></>}>
        {pay && (
          <>
            <p><b>{pay.captain.name}</b> · payout <b className="big">{inr(pay.payout)}</b> to UPI <span className="mono">{pay.captain.docs.bank.upi}</span></p>
            <dl className="kv top8">{pay.lines.map((l) => <div key={l.service}><dt>{SERVICE[l.service].label} commission</dt><dd>{l.pct}% of {inr(l.amount)} = {inr(l.commission)} <span className="muted small">({l.rule})</span></dd></div>)}</dl>
            <label className="field top8"><span>UTR / reference (optional)</span><input value={utr} onChange={(e) => setUtr(e.target.value)} placeholder="UTR123456789" /></label>
          </>
        )}
      </Modal>
    </>
  )
}
