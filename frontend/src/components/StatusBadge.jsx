import { STATUS } from '../lib/format'

export default function StatusBadge({ status }) {
  const s = STATUS[status] || { label: status, tone: 'grey' }
  return <span className={`badge ${s.tone}`} title={s.hint}>{s.label}</span>
}
