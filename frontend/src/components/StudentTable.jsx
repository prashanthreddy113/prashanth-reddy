import { Link } from 'react-router-dom'
import StatusBadge from './StatusBadge'
import { money, fmtDate, dueText } from '../lib/format'
import { IconEdit, IconMoney, IconRefresh, IconTransfer } from './Icons'

export default function StudentTable({ students, onEdit, onPay, onRenew, onTransfer, compact, showBranch }) {
  if (!students.length) {
    return (
      <div className="empty">
        <strong>No students to show</strong>
        Register a student using the “Add student” button.
      </div>
    )
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Seat</th>
            <th>Student</th>
            <th>Mobile</th>
            {!compact && <th>Study</th>}
            {!compact && <th>Joined</th>}
            <th>Plan</th>
            <th>Due date</th>
            <th>Status</th>
            <th className="num">Paid</th>
            <th className="num">Balance</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {students.map((s) => (
            <tr key={s.id} className={`row-${s.status}`}>
              <td>
                {s.seatNumber ? <span className="seat-chip" title={[s.seatSection, s.seatLabel].filter(Boolean).join(' · ')}>{s.seatNumber}</span> : <span className="seat-chip none">—</span>}
                {s.seatNumber && <div className="secondary" style={{ fontSize: 10, marginTop: 2 }}>{[s.seatSection, s.seatIsAc ? 'AC' : null].filter(Boolean).join(' · ')}</div>}
              </td>
              <td>
                <Link to={`/students/${s.id}`} className="primary">{s.name}</Link>
                {s.gender && <span className={`gender-tag ${s.gender}`} title={s.gender}>{s.gender[0]}</span>}
                {showBranch && s.branchName && <div className="secondary">{s.branchName}</div>}
                {s.address && <div className="secondary" style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.address}</div>}
              </td>
              <td><a href={`tel:${s.mobile}`}>{s.mobile}</a></td>
              {!compact && <td>{s.study || <span className="muted">—</span>}</td>}
              {!compact && <td>{fmtDate(s.joiningDate)}</td>}
              <td>
                <div>{s.months} mo × {money(s.amountPerMonth)}</div>
                <div className="secondary">Total {money(s.totalFee)}</div>
              </td>
              <td>
                <div className="primary">{fmtDate(s.dueDate)}</div>
                <div className="secondary">{dueText(s)}</div>
              </td>
              <td><StatusBadge status={s.status} /></td>
              <td className="num">{money(s.totalPaid)}</td>
              <td className="num">{s.balance > 0 ? <span className="neg">{money(s.balance)}</span> : <span className="pos">Paid</span>}</td>
              <td>
                <div className="row-actions">
                  {onPay && <button className="btn sm" title="Record payment" onClick={() => onPay(s)}><IconMoney /></button>}
                  {onRenew && <button className="btn sm" title="Renew / extend" onClick={() => onRenew(s)}><IconRefresh /></button>}
                  {onTransfer && s.isActive && <button className="btn sm" title="Transfer seat" onClick={() => onTransfer(s)}><IconTransfer /></button>}
                  {onEdit && <button className="btn sm" title="Edit" onClick={() => onEdit(s)}><IconEdit /></button>}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
