import { useEffect } from 'react'

export function Modal({ title, onClose, children, wide, footer }) {
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', k)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', k); document.body.style.overflow = '' }
  }, [onClose])
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  )
}

const TONES = {
  available: 'green', Available: 'green', Approved: 'green', Paid: 'green', Completed: 'green', Resolved: 'green', Active: 'green', Booked: 'violet', Registered: 'blue', 'Ready to Move': 'green',
  booked: 'violet', sold: 'slate', Sold: 'slate', leased: 'blue', Leased: 'blue', hold: 'amber', Hold: 'amber', blocked: 'slate',
  New: 'blue', Contacted: 'cyan', 'Site visit': 'violet', Negotiation: 'amber', Lost: 'slate',
  Scheduled: 'blue', 'No show': 'red', Cancelled: 'slate', Pending: 'amber', Rejected: 'red',
  Overdue: 'red', 'Due soon': 'amber', 'Part paid': 'cyan', Upcoming: 'slate',
  Open: 'red', 'In progress': 'amber', Hot: 'red', Warm: 'amber', Cold: 'blue',
  'Under Construction': 'amber', 'New Launch': 'pink', 'Under Development': 'amber',
  Sell: 'violet', Rent: 'cyan', Lease: 'blue', Residential: 'violet', Commercial: 'blue', Plots: 'pink',
}
export function Badge({ children, tone }) {
  return <span className={`badge badge-${tone || TONES[children] || 'slate'}`}>{children}</span>
}

export function Field({ label, children, hint, span }) {
  return (
    <label className={`field ${span ? 'span-' + span : ''}`}>
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  )
}

export function Stat({ label, value, sub, tone = 'violet', icon }) {
  return (
    <div className={`stat stat-${tone}`}>
      {icon && <div className="stat-icon">{icon}</div>}
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  )
}

export function Empty({ children = 'Nothing here yet.' }) {
  return <div className="empty">{children}</div>
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => {
        const [k, label] = Array.isArray(t) ? t : [t, t]
        return (
          <button key={k} role="tab" aria-selected={value === k} className={value === k ? 'tab on' : 'tab'} onClick={() => onChange(k)}>
            {label}
          </button>
        )
      })}
    </div>
  )
}

export function Progress({ value, palette }) {
  const bg = palette ? `linear-gradient(90deg, ${palette[0]}, ${palette[1]})` : undefined
  return (
    <div className="progress"><div style={{ width: `${Math.min(100, value)}%`, background: bg }} /></div>
  )
}
