import { statusLabel, statusTone, gradeLabel } from '../lib/format'

export function StatusBadge({ status, pulse }) {
  return <span className={`badge ${statusTone[status] || 'grey'} ${pulse && status === 'InProgress' ? 'pulse' : ''}`}>{statusLabel[status] || status}</span>
}

export function GradeChip({ grade, tds, ntu }) {
  const cls = grade === 'Good' ? 'ok' : grade === 'Acceptable' ? 'warn' : grade === 'Poor' ? 'bad' : ''
  const detail = [tds != null ? `${Math.round(tds)} ppm` : null, ntu != null ? `${Number(ntu).toFixed(1)} NTU` : null].filter(Boolean).join(' · ')
  return <span className={`chip ${cls}`} title={detail}>{gradeLabel[grade] || grade}{detail ? ` · ${detail}` : ''}</span>
}
