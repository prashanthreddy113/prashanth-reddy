import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import { useToast } from '../lib/toast'
import { money, fmtDate, dueText } from '../lib/format'
import StatusBadge from '../components/StatusBadge'
import StudentFormModal from '../components/StudentFormModal'
import PaymentModal from '../components/PaymentModal'
import RenewModal from '../components/RenewModal'
import ConfirmDialog from '../components/ConfirmDialog'
import { IconBack, IconEdit, IconMoney, IconRefresh, IconTrash, IconWhatsapp } from '../components/Icons'

export default function StudentDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const [student, setStudent] = useState(null)
  const [error, setError] = useState('')
  const [modal, setModal] = useState(null)

  const load = useCallback(async () => {
    try { setStudent(await api.student(id)); setError('') }
    catch (e) { setError(e.message) }
  }, [id])

  useEffect(() => { load() }, [load])

  if (error) return <div className="alert error">{error} · <Link to="/students">Back to students</Link></div>
  if (!student) return <div className="loading"><div className="spinner" />Loading…</div>

  const s = student
  const reminder = encodeURIComponent(
    `Hello ${s.name}, this is a reminder from the reading room. Your subscription ${s.daysUntilDue < 0 ? 'expired' : 'is due'} on ${fmtDate(s.dueDate)}.` +
    (s.balance > 0 ? ` Pending balance: ${money(s.balance)}.` : '') + ' Please renew at the earliest. Thank you!'
  )
  const waNumber = s.mobile.replace(/[^0-9]/g, '')
  const waLink = `https://wa.me/${waNumber.length === 10 ? '91' + waNumber : waNumber}?text=${reminder}`

  const pct = s.totalFee > 0 ? Math.min(100, Math.round((s.totalPaid / s.totalFee) * 100)) : 100

  return (
    <>
      <div className="page-head">
        <div className="row">
          <button className="btn ghost" onClick={() => navigate(-1)}><IconBack /> Back</button>
          <div>
            <h2 className="row" style={{ gap: 10 }}>{s.name} <StatusBadge status={s.status} /></h2>
            <p>{s.seatNumber ? `Seat ${s.seatNumber}${s.seatLabel ? ` · ${s.seatLabel}` : ''}` : 'No seat assigned'} · {dueText(s)}</p>
          </div>
        </div>
        <div className="row">
          <a className="btn" href={waLink} target="_blank" rel="noreferrer" title="Send WhatsApp reminder"><IconWhatsapp width={16} height={16} /> Remind</a>
          <button className="btn" onClick={() => setModal('pay')}><IconMoney /> Record payment</button>
          <button className="btn" onClick={() => setModal('renew')}><IconRefresh /> Renew</button>
          <button className="btn primary" onClick={() => setModal('edit')}><IconEdit /> Edit</button>
        </div>
      </div>

      <div className="grid-2">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="card">
            <div className="card-head"><h3>Details</h3></div>
            <div className="card-body">
              <div className="kv">
                <span className="k">Mobile</span><span className="v"><a href={`tel:${s.mobile}`}>{s.mobile}</a></span>
                <span className="k">Address</span><span className="v">{s.address || '—'}</span>
                <span className="k">Aadhaar</span><span className="v">{s.aadhaar ? s.aadhaar.replace(/(\d{4})(?=\d)/g, '$1 ') : '—'}</span>
                <span className="k">Studying for</span><span className="v">{s.study || '—'}</span>
                <span className="k">Joining date</span><span className="v">{fmtDate(s.joiningDate)}</span>
                <span className="k">Plan</span><span className="v">{s.months} month{s.months === 1 ? '' : 's'} × {money(s.amountPerMonth)}</span>
                <span className="k">Due date</span><span className="v" style={{ color: s.daysUntilDue <= 0 && s.isActive ? 'var(--red)' : undefined }}>{fmtDate(s.dueDate)} ({dueText(s)})</span>
                <span className="k">Notes</span><span className="v">{s.notes || '—'}</span>
                <span className="k">Registered</span><span className="v">{new Date(s.createdAt).toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-head"><h3>Payment history</h3><span className="muted">{s.payments?.length || 0} entries</span></div>
            {s.payments?.length ? (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Date</th><th>Note</th><th className="num">Amount</th><th></th></tr></thead>
                  <tbody>
                    {s.payments.map((p) => (
                      <tr key={p.id}>
                        <td>{fmtDate(p.paidOn)}</td>
                        <td>{p.note || <span className="muted">—</span>}</td>
                        <td className="num pos">{money(p.amount)}</td>
                        <td><div className="row-actions"><button className="btn sm danger" title="Delete payment" onClick={() => setModal({ deletePayment: p })}><IconTrash /></button></div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <div className="empty">No payments recorded yet.</div>}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="card">
            <div className="card-head"><h3>Fees</h3></div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="summary-box" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <div><div className="k">Total fee</div><div className="v">{money(s.totalFee)}</div></div>
                <div><div className="k">Paid</div><div className="v" style={{ color: 'var(--green)' }}>{money(s.totalPaid)}</div></div>
                <div><div className="k">Balance</div><div className="v" style={{ color: s.balance > 0 ? 'var(--red)' : 'var(--green)' }}>{money(Math.max(0, s.balance))}</div></div>
                <div><div className="k">Advance</div><div className="v">{s.balance < 0 ? money(-s.balance) : money(0)}</div></div>
              </div>
              <div className="progress"><span style={{ width: `${pct}%`, background: pct >= 100 ? 'var(--green)' : 'var(--navy)' }} /></div>
              <div className="muted" style={{ fontSize: 12 }}>{pct}% of total fee collected</div>
            </div>
          </div>

          <div className="card">
            <div className="card-head"><h3>Membership</h3></div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {s.isActive ? (
                <>
                  <p className="muted">Marking as left releases seat {s.seatNumber || '—'} and hides the student from due reminders. Their record and payments are kept.</p>
                  <button className="btn danger" onClick={() => setModal('deactivate')}>Mark as left</button>
                </>
              ) : (
                <>
                  <p className="muted">This student has left. Reactivate to resume the membership (assign a seat by editing).</p>
                  <button className="btn success" onClick={() => setModal('activate')}>Reactivate</button>
                </>
              )}
              <hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '4px 0' }} />
              <p className="muted">Permanently delete this student and all payment history.</p>
              <button className="btn ghost" style={{ color: 'var(--red)' }} onClick={() => setModal('delete')}><IconTrash /> Delete student</button>
            </div>
          </div>
        </div>
      </div>

      {modal === 'edit' && <StudentFormModal student={s} onClose={() => setModal(null)} onSaved={() => { setModal(null); toast.success('Student updated'); load() }} />}
      {modal === 'pay' && <PaymentModal student={s} onClose={() => setModal(null)} onSaved={(u) => { setModal(null); setStudent(u); toast.success('Payment recorded') }} />}
      {modal === 'renew' && <RenewModal student={s} onClose={() => setModal(null)} onSaved={(u) => { setModal(null); setStudent(u); toast.success(`Renewed until ${fmtDate(u.dueDate)}`) }} />}
      {modal === 'deactivate' && (
        <ConfirmDialog title="Mark as left?" message={`${s.name} will be marked inactive and their seat released.`} confirmLabel="Mark as left" danger
          onClose={() => setModal(null)} onConfirm={async () => { await api.deactivateStudent(s.id); toast.info(`${s.name} marked as left`); load() }} />
      )}
      {modal === 'activate' && (
        <ConfirmDialog title="Reactivate student?" message={`${s.name} will be active again. You can assign a seat by editing the student.`} confirmLabel="Reactivate"
          onClose={() => setModal(null)} onConfirm={async () => { await api.activateStudent(s.id); toast.success(`${s.name} reactivated`); load() }} />
      )}
      {modal === 'delete' && (
        <ConfirmDialog title="Delete student?" message={`This permanently removes ${s.name} and all their payment records. This cannot be undone.`} confirmLabel="Delete permanently" danger
          onClose={() => setModal(null)} onConfirm={async () => { await api.deleteStudent(s.id); toast.info('Student deleted'); navigate('/students', { replace: true }) }} />
      )}
      {modal?.deletePayment && (
        <ConfirmDialog title="Delete payment?" message={`Remove the ${money(modal.deletePayment.amount)} payment from ${fmtDate(modal.deletePayment.paidOn)}? The total paid amount will be reduced.`} confirmLabel="Delete" danger
          onClose={() => setModal(null)} onConfirm={async () => { const u = await api.deletePayment(s.id, modal.deletePayment.id); setStudent(u); toast.info('Payment removed') }} />
      )}
    </>
  )
}
