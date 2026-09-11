import { IconStar } from './Icons'
import { INTEREST } from '../lib/format'

/** 1–5 interest picker. Read-only when onChange is omitted. */
export default function StarRating({ value = 0, onChange, size = 'md', showLabel = false }) {
  const editable = typeof onChange === 'function'
  return (
    <div className={`stars ${size} ${editable ? 'editable' : ''} tone-${INTEREST[value]?.tone || 'grey'}`} role={editable ? 'radiogroup' : undefined} aria-label="Interest level">
      {[1, 2, 3, 4, 5].map((n) => (
        editable ? (
          <button type="button" key={n} className={n <= value ? 'on' : ''} onClick={() => onChange(n)} aria-label={INTEREST[n].label} aria-pressed={n === value}>
            <IconStar filled={n <= value} />
          </button>
        ) : (
          <span key={n} className={n <= value ? 'on' : ''}><IconStar filled={n <= value} /></span>
        )
      ))}
      {showLabel && <span className="stars-label">{INTEREST[value]?.label || 'Not rated'}</span>}
    </div>
  )
}
