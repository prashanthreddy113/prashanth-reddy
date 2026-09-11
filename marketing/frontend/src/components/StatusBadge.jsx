import { STATUS, INTEREST } from '../lib/format'

export function StatusBadge({ status }) {
  const s = STATUS[status] || { label: status, tone: 'grey' }
  return <span className={`badge ${s.tone}`} title={s.hint}>{s.label}</span>
}

export function InterestBadge({ interest }) {
  const i = INTEREST[interest] || { short: '—', tone: 'grey' }
  return <span className={`badge ${i.tone}`}>{interest >= 5 ? '🔥 ' : ''}{i.short}</span>
}

export function FollowUpBadge({ state, text }) {
  if (!state || state === 'Closed' || state === 'None' || state === 'Later') return null
  const tone = state === 'Overdue' ? 'red' : state === 'Today' ? 'amber' : 'blue'
  return <span className={`badge ${tone}`}>{text}</span>
}

export function ProjectChip({ name, color }) {
  return <span className="project-chip"><span className="dot" style={{ background: color }} />{name}</span>
}
