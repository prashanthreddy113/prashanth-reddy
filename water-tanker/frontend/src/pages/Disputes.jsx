import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useToast } from '../lib/toast'
import { litres, fmtDateTime } from '../lib/format'
import { StatusBadge } from '../components/StatusBadge'
import Modal from '../components/Modal'

export default function Disputes() {
  const { isOperator, isAdmin } = useAuth()
  const toast = useToast()
  const [items, setItems] = useState(null)
  const [resolve, setResolve] = useState(null)

  const load = () => api.disputes().then(setItems).catch((e) => toast.error(e.message))
  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async (accept) => {
    try {
      await api.resolveDispute(resolve.id, { accept, resolution: resolve.resolution, adjustedLitres: accept && resolve.adjustedLitres !== '' ? Number(resolve.adjustedLitres) : null })
      toast.success(accept ? 'Dispute accepted.' : 'Dispute rejected.'); setResolve(null); load()
    } catch (e) { toast.error(e.message) }
  }

  return (
    <>
      <div className="card">
        <div className="card-head"><h2>Disputes</h2><span className="muted small">{items ? `${items.filter((x) => x.status === 'Open').length} open` : ''}</span></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Raised</th><th>Delivery</th><th>Reason</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {!items && <tr><td colSpan="5" className="loading">Loading…</td></tr>}
              {items?.map((x) => (
                <tr key={x.id}>
                  <td><div className="primary">{fmtDateTime(x.createdAt)}</div><div className="secondary">by {x.raisedBy}</div></td>
                  <td><Link to={`/deliveries/${x.deliveryId}`}>#{x.deliveryId}</Link><div className="secondary">{x.communityName} · {fmtDateTime(x.deliveryStartedAt)} · {litres(x.deliveryLitres)}</div></td>
                  <td style={{ whiteSpace: 'normal', maxWidth: 420 }}>{x.reason}{x.resolution && <div className="secondary">Resolution: {x.resolution}</div>}</td>
                  <td><StatusBadge status={x.status} /></td>
                  <td className="right">{(isOperator || isAdmin) && x.status === 'Open' && <button className="btn sm primary" onClick={() => setResolve({ ...x, resolution: '', adjustedLitres: '' })}>Resolve</button>}</td>
                </tr>
              ))}
              {items?.length === 0 && <tr><td colSpan="5" className="empty"><b>No disputes.</b>Metered deliveries rarely need them.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      {resolve && (
        <Modal title={`Resolve dispute on delivery #${resolve.deliveryId}`} onClose={() => setResolve(null)}>
          <div className="alert info">{resolve.reason}</div>
          <div className="form-grid" style={{ marginTop: 14 }}>
            <div className="field full"><label>Your response</label><textarea rows="3" value={resolve.resolution} onChange={(e) => setResolve({ ...resolve, resolution: e.target.value })} placeholder="What you found and what you are doing about it." /></div>
            <div className="field full"><label>Corrected litres (only if accepting and the bill should change)</label><input type="number" min="0" step="10" value={resolve.adjustedLitres} onChange={(e) => setResolve({ ...resolve, adjustedLitres: e.target.value })} placeholder={`metered: ${resolve.deliveryLitres}`} /></div>
          </div>
          <div className="form-actions"><button className="btn" onClick={() => setResolve(null)}>Cancel</button><button className="btn danger" onClick={() => submit(false)}>Reject</button><button className="btn success" onClick={() => submit(true)}>Accept</button></div>
        </Modal>
      )}
    </>
  )
}
