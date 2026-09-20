/** One KYC document: image placeholder + extracted fields. */
export default function DocCard({ title, icon, uploaded, fields = [], children }) {
  return (
    <div className="doc">
      <div className={`doc-img ${uploaded ? '' : 'missing'}`} aria-label={`${title} image`}>
        <span className="doc-ico" aria-hidden>{icon}</span>
        <span className="doc-cap">{uploaded ? 'uploaded' : 'not uploaded'}</span>
      </div>
      <div className="doc-body">
        <h3>{title}</h3>
        <dl className="kv">
          {fields.map(([k, v]) => (<div key={k}><dt>{k}</dt><dd>{v || <span className="muted">—</span>}</dd></div>))}
        </dl>
        {children}
      </div>
    </div>
  )
}
