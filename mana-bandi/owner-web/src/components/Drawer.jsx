import { useEffect } from 'react'

/** Right-hand side drawer used for ride / parcel detail. */
export default function Drawer({ open, title, onClose, children, width = 460 }) {
  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  return (
    <>
      <div className={`backdrop ${open ? 'open' : ''}`} onClick={onClose} />
      <aside className={`drawer ${open ? 'open' : ''}`} style={{ width }} aria-hidden={!open}>
        <div className="drawer-head">
          <h2>{title}</h2>
          <button className="btn ghost sm" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="drawer-body">{open && children}</div>
      </aside>
    </>
  )
}
