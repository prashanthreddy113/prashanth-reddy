// Small dependency-free SVG charts.
import { inrShort } from '../lib/format'

export const SERIES = ['#7c3aed', '#ec4899', '#f59e0b', '#06b6d4', '#10b981', '#3b82f6', '#ef4444', '#84cc16', '#a855f7', '#f97316']

export function BarChart({ data, height = 200, money = true, colors = ['#7c3aed', '#ec4899'], labels }) {
  // data: [{label, values:[a,b]}]
  const max = Math.max(1, ...data.flatMap((d) => d.values))
  const w = 100 / data.length
  const fmt = money ? inrShort : (v) => v.toLocaleString('en-IN')
  return (
    <div className="chart">
      <svg viewBox={`0 0 100 ${height / 4}`} preserveAspectRatio="none" style={{ height }} className="bars">
        {data.map((d, i) =>
          d.values.map((v, k) => {
            const bw = (w * 0.7) / d.values.length
            const h = (v / max) * (height / 4 - 2)
            return (
              <rect key={`${i}-${k}`} x={i * w + w * 0.15 + k * bw} y={height / 4 - h} width={bw * 0.9} height={h} rx="0.6" fill={colors[k % colors.length]}>
                <title>{`${d.label}${labels ? ' · ' + labels[k] : ''}: ${fmt(v)}`}</title>
              </rect>
            )
          }),
        )}
      </svg>
      <div className="bar-labels">{data.map((d) => <span key={d.label}>{d.label}</span>)}</div>
      {labels && (
        <div className="legend">
          {labels.map((l, k) => <span key={l}><i style={{ background: colors[k] }} />{l}</span>)}
        </div>
      )}
    </div>
  )
}

export function Donut({ data, size = 160, center, sub }) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1
  const r = 15.9155
  let acc = 0
  return (
    <div className="donut-wrap">
      <svg viewBox="0 0 42 42" width={size} height={size} className="donut">
        <circle cx="21" cy="21" r={r} fill="none" stroke="#eef0f6" strokeWidth="6" />
        {data.map((d, i) => {
          const pct = (d.value / total) * 100
          const el = (
            <circle key={d.label} cx="21" cy="21" r={r} fill="none" stroke={d.color || SERIES[i % SERIES.length]} strokeWidth="6"
              strokeDasharray={`${pct} ${100 - pct}`} strokeDashoffset={25 - acc}>
              <title>{`${d.label}: ${d.value}`}</title>
            </circle>
          )
          acc += pct
          return el
        })}
        <text x="21" y="21" textAnchor="middle" fontSize="6" fontWeight="800" fill="currentColor">{center}</text>
        {sub && <text x="21" y="27" textAnchor="middle" fontSize="2.8" fill="#64748b">{sub}</text>}
      </svg>
      <ul className="legend-list">
        {data.map((d, i) => (
          <li key={d.label}><i style={{ background: d.color || SERIES[i % SERIES.length] }} />{d.label}<b>{d.value}</b></li>
        ))}
      </ul>
    </div>
  )
}

export function Funnel({ data }) {
  const max = Math.max(1, ...data.map((d) => d.value))
  return (
    <div className="funnel">
      {data.map((d, i) => (
        <div key={d.label} className="funnel-row">
          <span className="funnel-label">{d.label}</span>
          <div className="funnel-bar">
            <div style={{ width: `${Math.max(4, (d.value / max) * 100)}%`, background: `linear-gradient(90deg, ${SERIES[i % SERIES.length]}, ${SERIES[(i + 1) % SERIES.length]})` }}>{d.value}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

export function HBar({ data, money }) {
  const max = Math.max(1, ...data.map((d) => d.value))
  return (
    <div className="hbars">
      {data.map((d, i) => (
        <div key={d.label} className="hbar">
          <div className="hbar-top"><span>{d.label}</span><b>{money ? inrShort(d.value) : d.value}</b></div>
          <div className="hbar-track"><div style={{ width: `${(d.value / max) * 100}%`, background: d.color || SERIES[i % SERIES.length] }} /></div>
        </div>
      ))}
    </div>
  )
}
