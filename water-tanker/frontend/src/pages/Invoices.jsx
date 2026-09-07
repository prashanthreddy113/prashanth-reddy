import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useToast } from '../lib/toast'
import { money, money2, litres, kl, fmtDate, fmtDateTime } from '../lib/format'
import { StatusBadge, GradeChip } from '../components/StatusBadge'
import Modal from '../components/Modal'

export default function Invoices() {
  const { isRwa, isOperator, isAdmin } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [items, setItems] = useState(null)
  const [communities, setCommunities] = useState([])
  const [gen, setGen] = useState(null)
  const [pay, setPay] = useState(null)
  const [detail, setDetail] = useState(null)
  const now = new Date()

  const load = () => api.invoices().then(setItems).catch((e) => toast.error(e.message))
  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!isRwa) api.communities().then(setCommunities).catch(() => {}) }, [isRwa])

  const act = async (fn, ok) => { try { await fn(); toast.success(ok); load() } catch (e) { toast.error(e.message) } }
  const open = (i) => api.invoice(i.id).then(setDetail).catch((e) => toast.error(e.message))
  const due = (items || []).filter((i) => i.status === 'Issued').reduce((s, i) => s + Number(i.amount), 0)

  return (
    <>
      <div className="page-head">
        <div className="row">{isRwa ? <span className="muted">Statements from your operator, built only from metered loads.</span> : <span className="muted">One statement per community per month.</span>}{due > 0 && <span className="badge amber">{money(due)} due</span>}</div>
        {(isOperator || isAdmin) && <button className="btn primary" onClick={() => setGen({ communityId: communities[0]?.id || '', year: now.getFullYear(), month: now.getMonth() + 1 })}>+ Generate statement</button>}
      </div>
      <div className="card">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Invoice</th><th>{isRwa ? 'Operator' : 'Community'}</th><th>Period</th><th className="num">Loads</th><th className="num">Litres</th><th className="num">Amount</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {!items && <tr><td colSpan="8" className="loading">Loading…</td></tr>}
              {items?.map((i) => (
                <tr key={i.id} className="clickable" onClick={() => open(i)}>
                  <td className="mono">{i.number}</td>
                  <td>{isRwa ? i.operatorName : i.communityName}</td>
                  <td>{fmtDate(i.periodStart)} – {fmtDate(i.periodEnd)}</td>
                  <td className="num">{i.deliveryCount}</td>
                  <td className="num">{kl(i.totalLitres)}</td>
                  <td className="num"><b>{money2(i.amount)}</b></td>
                  <td><StatusBadge status={i.status} />{i.paidAt && <div className="secondary">{i.paymentMethod} {i.paymentReference} · {fmtDate(i.paidAt)}</div>}</td>
                  <td className="right nowrap" onClick={(e) => e.stopPropagation()}>
                    {(isRwa || isAdmin) && i.status === 'Issued' && <button className="btn sm primary" onClick={() => setPay({ ...i, method: 'UPI', reference: '' })}>Pay</button>}
                    {(isOperator || isAdmin) && i.status === 'Issued' && <> <button className="btn sm" onClick={() => setPay({ ...i, method: 'Cash', reference: '', operatorSide: true })}>Mark paid</button> <button className="btn sm danger" onClick={() => act(() => api.cancelInvoice(i.id), 'Invoice cancelled; deliveries released.')}>Cancel</button></>}
                  </td>
                </tr>
              ))}
              {items?.length === 0 && <tr><td colSpan="8" className="empty"><b>No invoices yet.</b>{isRwa ? 'Your operator generates a statement at month end.' : 'Generate a statement once a month per community.'}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {gen && (
        <Modal title="Generate monthly statement" onClose={() => setGen(null)}>
          <form onSubmit={async (e) => { e.preventDefault(); await act(() => api.generateInvoice({ communityId: Number(gen.communityId), year: Number(gen.year), month: Number(gen.month) }), 'Statement issued.'); setGen(null) }}>
            <div className="form-grid">
              <div className="field full"><label>Community</label><select value={gen.communityId} onChange={(e) => setGen({ ...gen, communityId: e.target.value })} required>{communities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
              <div className="field"><label>Month</label><select value={gen.month} onChange={(e) => setGen({ ...gen, month: e.target.value })}>{Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{new Date(2000, i, 1).toLocaleString('en-IN', { month: 'long' })}</option>)}</select></div>
              <div className="field"><label>Year</label><input type="number" value={gen.year} onChange={(e) => setGen({ ...gen, year: e.target.value })} /></div>
            </div>
            <p className="small muted" style={{ marginTop: 10 }}>Includes every completed or verified delivery in that month that is not on another invoice. Disputed and discarded loads are left out.</p>
            <div className="form-actions"><button type="button" className="btn" onClick={() => setGen(null)}>Cancel</button><button className="btn primary" type="submit">Generate</button></div>
          </form>
        </Modal>
      )}
      {pay && (
        <Modal title={`${pay.operatorSide ? 'Record payment for' : 'Pay'} ${pay.number}`} onClose={() => setPay(null)}>
          <form onSubmit={async (e) => { e.preventDefault(); await act(() => (pay.operatorSide ? api.markInvoicePaid : api.payInvoice)(pay.id, { method: pay.method, reference: pay.reference }), 'Payment recorded.'); setPay(null) }}>
            <div className="stat" style={{ border: 'none', padding: 0, marginBottom: 14 }}><span className="label">Amount</span><span className="value">{money2(pay.amount)}</span><span className="sub">{pay.deliveryCount} loads · {kl(pay.totalLitres)}</span></div>
            <div className="form-grid">
              <div className="field"><label>Method</label><select value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value })}>{['UPI', 'NEFT', 'Cheque', 'Cash'].map((m) => <option key={m}>{m}</option>)}</select></div>
              <div className="field"><label>Reference / UTR</label><input value={pay.reference} onChange={(e) => setPay({ ...pay, reference: e.target.value })} placeholder="optional" /></div>
            </div>
            {!pay.operatorSide && <p className="small muted" style={{ marginTop: 10 }}>Pilot flow: pay the operator by UPI/NEFT and record the reference here. Online checkout (Razorpay) plugs into this same step later.</p>}
            <div className="form-actions"><button type="button" className="btn" onClick={() => setPay(null)}>Cancel</button><button className="btn success" type="submit">Confirm paid</button></div>
          </form>
        </Modal>
      )}
      {detail && (
        <Modal title={`Statement ${detail.invoice.number}`} onClose={() => setDetail(null)} wide>
          <div className="row between" style={{ marginBottom: 12 }}>
            <div><b>{detail.invoice.communityName}</b> · {detail.invoice.operatorName}<div className="small muted">{fmtDate(detail.invoice.periodStart)} – {fmtDate(detail.invoice.periodEnd)} · issued {fmtDate(detail.invoice.issuedAt)}</div></div>
            <div className="right"><div style={{ fontSize: 22, fontWeight: 800 }}>{money2(detail.invoice.amount)}</div><StatusBadge status={detail.invoice.status} /></div>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Delivery</th><th>Tanker</th><th className="num">Litres</th><th>Quality</th><th className="num">Rate</th><th className="num">Amount</th></tr></thead>
              <tbody>{detail.deliveries.map((d) => <tr key={d.id} className="clickable" onClick={() => navigate(`/deliveries/${d.id}`)}><td>{fmtDateTime(d.startedAt)}</td><td>{d.tankerRegistration}</td><td className="num">{litres(d.litresDelivered)}</td><td><GradeChip grade={d.qualityGrade} /></td><td className="num">{money(d.ratePerKl)}/kL</td><td className="num">{money2(d.amount)}</td></tr>)}</tbody>
            </table>
          </div>
          <div className="form-actions"><button className="btn" onClick={() => window.print()}>Print</button><button className="btn primary" onClick={() => setDetail(null)}>Close</button></div>
        </Modal>
      )}
    </>
  )
}
