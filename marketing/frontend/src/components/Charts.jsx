import { fmtDateShort } from '../lib/format'

/** Grouped daily bars (leads vs visits), pure SVG so it needs no library. */
export function DailyBars({ data = [], height = 160 }) {
  if (!data.length) return null
  const max = Math.max(1, ...data.map((d) => Math.max(d.leads, d.visits)))
  const w = 100 / data.length
  const labelEvery = data.length > 20 ? 7 : data.length > 10 ? 3 : 1
  return (
    <div className="chart">
      <svg viewBox={`0 0 100 ${height / 4}`} preserveAspectRatio="none" className="chart-svg" style={{ height }}>
        {[0.25, 0.5, 0.75].map((f) => <line key={f} x1="0" x2="100" y1={(height / 4) * (1 - f)} y2={(height / 4) * (1 - f)} className="grid" />)}
        {data.map((d, i) => {
          const H = height / 4
          const lh = (d.leads / max) * (H - 2), vh = (d.visits / max) * (H - 2)
          return (
            <g key={d.date}>
              <rect x={i * w + w * 0.15} y={H - vh} width={w * 0.32} height={vh} className="bar visits" rx="0.4"><title>{`${fmtDateShort(d.date)}: ${d.visits} visits`}</title></rect>
              <rect x={i * w + w * 0.53} y={H - lh} width={w * 0.32} height={lh} className="bar leads" rx="0.4"><title>{`${fmtDateShort(d.date)}: ${d.leads} new leads`}</title></rect>
            </g>
          )
        })}
      </svg>
      <div className="chart-x">
        {data.map((d, i) => <span key={d.date} style={{ width: `${w}%` }}>{i % labelEvery === 0 || i === data.length - 1 ? fmtDateShort(d.date).slice(0, 6) : ''}</span>)}
      </div>
      <div className="legend"><span><i className="sw visits" /> Visits</span><span><i className="sw leads" /> New leads</span></div>
    </div>
  )
}

/** Horizontal bars for status / interest / cities. */
export function BarList({ items = [], tones = {}, total, formatValue }) {
  const max = Math.max(1, ...items.map((i) => i.count))
  const sum = total ?? items.reduce((a, b) => a + b.count, 0)
  return (
    <div className="barlist">
      {items.map((i) => (
        <div key={i.key} className="barlist-row">
          <span className="lbl">{i.label}</span>
          <span className="track"><span className={`fill ${tones[i.key] || ''}`} style={{ width: `${(i.count / max) * 100}%`, background: i.color }} /></span>
          <span className="val">{formatValue ? formatValue(i.count) : i.count}{sum ? <small> {Math.round((i.count / sum) * 100) || 0}%</small> : null}</span>
        </div>
      ))}
    </div>
  )
}
