/**
 * Cinematic reading-room banner for the dashboard: a night-time study hall with a warm desk lamp,
 * slow breathing light, drifting dust motes, page-turn shimmer and a gentle camera drift.
 * Pure CSS/SVG, no libraries; honours prefers-reduced-motion.
 */
export default function ReadingRoomScene({ title, subtitle, stats }) {
  const motes = Array.from({ length: 18 }, (_, i) => ({
    left: (i * 53) % 100,
    top: 20 + ((i * 37) % 60),
    size: 2 + (i % 3),
    delay: (i * 0.7) % 8,
    dur: 9 + (i % 5) * 2,
  }))

  return (
    <div className="scene card" aria-hidden="false">
      <div className="scene-sky" />
      <div className="scene-light" />
      <div className="scene-window">
        <span /><span /><span /><span />
      </div>
      <svg className="scene-room" viewBox="0 0 1200 320" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
        <defs>
          <linearGradient id="rr-floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1b1a35" /><stop offset="1" stopColor="#0e0d22" /></linearGradient>
          <linearGradient id="rr-desk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#5b3a1e" /><stop offset="1" stopColor="#3b2412" /></linearGradient>
          <radialGradient id="rr-lamp" cx="0.5" cy="0.2" r="0.9"><stop offset="0" stopColor="#ffd98a" stopOpacity="0.95" /><stop offset="0.45" stopColor="#ffb347" stopOpacity="0.35" /><stop offset="1" stopColor="#ffb347" stopOpacity="0" /></radialGradient>
          <linearGradient id="rr-shelf" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#2a2247" /><stop offset="1" stopColor="#1c1838" /></linearGradient>
        </defs>
        {/* back wall shelves */}
        <g className="scene-shelves" opacity="0.9">
          {[0, 1, 2].map((row) => (
            <g key={row} transform={`translate(0 ${40 + row * 70})`}>
              <rect x="60" y="44" width="1080" height="6" fill="url(#rr-shelf)" />
              {Array.from({ length: 34 }, (_, i) => {
                const h = 26 + ((i * 7 + row * 5) % 16)
                const colors = ['#7c3aed', '#ec4899', '#f97316', '#12b5a5', '#f4c95d', '#3b82f6', '#a78bfa']
                return <rect key={i} x={70 + i * 31} y={44 - h} width={i % 4 === 0 ? 12 : 18} height={h} rx="1.5" fill={colors[(i + row) % colors.length]} opacity={0.35 + ((i * 13 + row * 7) % 40) / 100} />
              })}
            </g>
          ))}
        </g>
        {/* floor */}
        <rect x="0" y="250" width="1200" height="70" fill="url(#rr-floor)" />
        {/* long desks */}
        <g className="scene-desks">
          <rect x="120" y="222" width="960" height="14" rx="3" fill="url(#rr-desk)" />
          <rect x="140" y="236" width="10" height="40" fill="#2e1b0e" /><rect x="1050" y="236" width="10" height="40" fill="#2e1b0e" />
          <rect x="590" y="236" width="10" height="40" fill="#2e1b0e" />
          {/* chairs */}
          {[220, 380, 540, 700, 860].map((x) => (
            <g key={x} transform={`translate(${x} 240)`}>
              <rect x="0" y="0" width="52" height="8" rx="2" fill="#26213f" />
              <rect x="4" y="8" width="5" height="30" fill="#26213f" /><rect x="43" y="8" width="5" height="30" fill="#26213f" />
            </g>
          ))}
          {/* open books with page shimmer */}
          {[260, 420, 740, 900].map((x, i) => (
            <g key={x} transform={`translate(${x} 208)`} className="scene-book" style={{ animationDelay: `${i * 1.3}s` }}>
              <path d="M0 14 Q22 4 44 14 L44 18 Q22 8 0 18 Z" fill="#f6efe0" />
              <path d="M44 14 Q66 4 88 14 L88 18 Q66 8 44 18 Z" fill="#fbf5e8" />
              <path d="M44 6 L44 18" stroke="#c9b48a" strokeWidth="1" />
            </g>
          ))}
          {/* reading lamps */}
          {[330, 640, 950].map((x, i) => (
            <g key={x} transform={`translate(${x} 150)`}>
              <ellipse className="scene-glow" cx="0" cy="66" rx="120" ry="70" fill="url(#rr-lamp)" style={{ animationDelay: `${i * 0.9}s` }} />
              <rect x="-2" y="20" width="4" height="52" fill="#3d3a5c" />
              <path d="M-26 22 L26 22 L14 0 L-14 0 Z" fill="#2b2848" />
              <path d="M-14 0 L14 0 L12 -6 L-12 -6 Z" fill="#f4c95d" opacity="0.9" />
            </g>
          ))}
        </g>
      </svg>
      <div className="scene-motes">
        {motes.map((m, i) => (
          <span key={i} style={{ left: `${m.left}%`, top: `${m.top}%`, width: m.size, height: m.size, animationDelay: `${m.delay}s`, animationDuration: `${m.dur}s` }} />
        ))}
      </div>
      <div className="scene-copy">
        <div className="scene-kicker">Live overview</div>
        <h2 className="scene-title">{title}</h2>
        <p className="scene-sub">{subtitle}</p>
        {stats && (
          <div className="scene-stats">
            {stats.map((s) => (
              <div key={s.label} className="scene-stat">
                <span className="v"><CountUp value={s.value} prefix={s.prefix} /></span>
                <span className="k">{s.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'

/** Counts from 0 to value once when it first renders (or when value changes). */
export function CountUp({ value, prefix = '', duration = 1100 }) {
  const [shown, setShown] = useState(0)
  const raf = useRef(null)
  useEffect(() => {
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const target = Number(value) || 0
    if (reduce) { setShown(target); return }
    const start = performance.now()
    const tick = (t) => {
      const p = Math.min(1, (t - start) / duration)
      const eased = 1 - Math.pow(1 - p, 3)
      setShown(Math.round(target * eased))
      if (p < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [value, duration])
  return <>{prefix}{shown.toLocaleString('en-IN')}</>
}
