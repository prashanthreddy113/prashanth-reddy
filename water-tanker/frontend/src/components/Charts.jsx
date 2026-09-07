/** Small dependency-free SVG charts. */

export function BarChart({ data, valueKey = 'litres', labelKey = 'day', height = 160, format = (v) => v }) {
  const w = 600, padL = 40, padB = 22, padT = 10
  const max = Math.max(1, ...data.map((d) => Number(d[valueKey] || 0)))
  const bw = data.length ? (w - padL - 8) / data.length : 0
  const y = (v) => padT + (height - padT - padB) * (1 - v / max)
  return (
    <svg className="chart" viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" role="img" aria-label="Bar chart">
      {[0, 0.5, 1].map((f) => (
        <g key={f}><line className="axis" x1={padL} x2={w - 4} y1={y(max * f)} y2={y(max * f)} /><text x={padL - 4} y={y(max * f) + 3} textAnchor="end">{format(max * f)}</text></g>
      ))}
      {data.map((d, i) => {
        const v = Number(d[valueKey] || 0)
        return (
          <g key={i}>
            <rect className="bar" x={padL + i * bw + 2} y={y(v)} width={Math.max(1, bw - 4)} height={height - padB - y(v)} rx="2"><title>{`${d[labelKey]}: ${format(v)}`}</title></rect>
            {(data.length <= 16 || i % Math.ceil(data.length / 12) === 0) && <text x={padL + i * bw + bw / 2} y={height - 6} textAnchor="middle">{d[labelKey]}</text>}
          </g>
        )
      })}
    </svg>
  )
}

export function ReadingsChart({ points, height = 200 }) {
  if (!points?.length) return <div className="empty">No readings recorded.</div>
  const w = 640, padL = 40, padR = 44, padB = 22, padT = 10
  const t0 = new Date(points[0].t).getTime(), t1 = Math.max(t0 + 1, new Date(points[points.length - 1].t).getTime())
  const x = (p) => padL + ((new Date(p.t).getTime() - t0) / (t1 - t0)) * (w - padL - padR)
  const maxFlow = Math.max(1, ...points.map((p) => p.flowLpm || 0))
  const maxTds = Math.max(1, ...points.map((p) => p.tds || 0))
  const yF = (v) => padT + (height - padT - padB) * (1 - v / maxFlow)
  const yT = (v) => padT + (height - padT - padB) * (1 - v / maxTds)
  const flowPath = points.map((p, i) => `${i ? 'L' : 'M'}${x(p).toFixed(1)},${yF(p.flowLpm || 0).toFixed(1)}`).join(' ')
  const area = `${flowPath} L${x(points[points.length - 1]).toFixed(1)},${yF(0)} L${x(points[0]).toFixed(1)},${yF(0)} Z`
  const tdsPts = points.filter((p) => p.tds != null)
  const tdsPath = tdsPts.map((p, i) => `${i ? 'L' : 'M'}${x(p).toFixed(1)},${yT(p.tds).toFixed(1)}`).join(' ')
  const mins = Math.round((t1 - t0) / 60000)
  return (
    <svg className="chart" viewBox={`0 0 ${w} ${height}`} role="img" aria-label="Flow and TDS over the delivery">
      {[0, 0.5, 1].map((f) => (
        <g key={f}>
          <line className="axis" x1={padL} x2={w - padR} y1={yF(maxFlow * f)} y2={yF(maxFlow * f)} />
          <text x={padL - 4} y={yF(maxFlow * f) + 3} textAnchor="end">{Math.round(maxFlow * f)}</text>
          <text x={w - padR + 4} y={yT(maxTds * f) + 3}>{Math.round(maxTds * f)}</text>
        </g>
      ))}
      <path className="area" d={area} />
      <path className="line flow" d={flowPath} />
      {tdsPts.length > 1 && <path className="line tds" d={tdsPath} strokeDasharray="4 3" />}
      <text x={padL} y={height - 6}>0 min</text>
      <text x={w - padR} y={height - 6} textAnchor="end">{mins} min</text>
      <text x={padL} y={9} fill="var(--teal-light)">Flow L/min</text>
      <text x={w - padR} y={9} textAnchor="end" fill="var(--amber)">TDS ppm</text>
    </svg>
  )
}

const GRADE_COLORS = { Good: 'var(--green)', Acceptable: 'var(--amber)', Poor: 'var(--red)', Unknown: 'var(--grey-border)' }

export function QualityDonut({ quality }) {
  const order = ['Good', 'Acceptable', 'Poor', 'Unknown']
  const counts = Object.fromEntries(order.map((g) => [g, quality?.find((q) => q.grade === g)?.count || 0]))
  const total = order.reduce((s, g) => s + counts[g], 0)
  const r = 36, c = 2 * Math.PI * r
  let offset = 0
  return (
    <div className="donut">
      <svg width="100" height="100" viewBox="0 0 100 100" role="img" aria-label="Quality mix">
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--grey-bg)" strokeWidth="14" />
        {total > 0 && order.map((g) => {
          const frac = counts[g] / total
          const el = <circle key={g} cx="50" cy="50" r={r} fill="none" stroke={GRADE_COLORS[g]} strokeWidth="14" strokeDasharray={`${frac * c} ${c}`} strokeDashoffset={-offset * c} transform="rotate(-90 50 50)" />
          offset += frac
          return el
        })}
        <text x="50" y="47" textAnchor="middle" style={{ fontSize: 18, fontWeight: 800, fill: 'var(--text)' }}>{total}</text>
        <text x="50" y="62" textAnchor="middle">loads</text>
      </svg>
      <ul>
        {order.filter((g) => counts[g] > 0 || g !== 'Unknown').map((g) => (
          <li key={g}><i style={{ background: GRADE_COLORS[g] }} />{g === 'Unknown' ? 'Not graded' : g}: <b>{counts[g]}</b>{total ? ` (${Math.round((counts[g] / total) * 100)}%)` : ''}</li>
        ))}
      </ul>
    </div>
  )
}
