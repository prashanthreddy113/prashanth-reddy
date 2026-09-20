const ICON = { pass: '✓', fail: '✗', review: '!', pending: '…' }

/** Automated verification check: pass / fail / needs-review / pending. */
export default function CheckChip({ check }) {
  return (
    <div className={`check check-${check.state}`}>
      <span className="check-ico" aria-hidden>{ICON[check.state]}</span>
      <div>
        <div className="check-label">{check.label}</div>
        {check.note && <div className="check-note">{check.note}</div>}
      </div>
    </div>
  )
}
