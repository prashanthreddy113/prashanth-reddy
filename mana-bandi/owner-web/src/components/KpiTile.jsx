/** Big KPI tile. `tone` colours the accent bar: green | yellow | orange | red | ink. */
export default function KpiTile({ icon, label, value, sub, tone = 'green' }) {
  return (
    <div className={`kpi kpi-${tone}`}>
      <div className="kpi-head"><span className="kpi-ico" aria-hidden>{icon}</span><span className="kpi-label">{label}</span></div>
      <div className="kpi-value">{value}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  )
}
