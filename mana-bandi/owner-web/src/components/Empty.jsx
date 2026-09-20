export default function Empty({ icon = '🫙', text = 'Nothing here yet' }) {
  return <div className="empty"><div className="empty-ico" aria-hidden>{icon}</div><div>{text}</div></div>
}
