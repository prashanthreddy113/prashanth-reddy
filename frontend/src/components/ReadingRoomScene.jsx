import { useEffect, useMemo, useRef, useState } from 'react'
import { money, fmtDate } from '../lib/format'

/**
 * Rich animated dashboard hero.
 * Layers (back → front): brand aurora · perspective light-grid floor · drifting particles · glass panels.
 * Right side: a "seat constellation" built from the real seat counts that lights up in a wave, orbited by the BrightLoop loop.
 * Mouse parallax nudges the layers; a payments ticker runs along the bottom. Honours prefers-reduced-motion.
 */
export default function ReadingRoomScene({ title, subtitle, data }) {
  const ref = useRef(null)
  const [tilt, setTilt] = useState({ x: 0, y: 0 })

  useEffect(() => {
    const el = ref.current
    if (!el || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)) return
    const onMove = (e) => {
      const r = el.getBoundingClientRect()
      setTilt({ x: ((e.clientX - r.left) / r.width - 0.5) * 2, y: ((e.clientY - r.top) / r.height - 0.5) * 2 })
    }
    const onLeave = () => setTilt({ x: 0, y: 0 })
    el.addEventListener('mousemove', onMove); el.addEventListener('mouseleave', onLeave)
    return () => { el.removeEventListener('mousemove', onMove); el.removeEventListener('mouseleave', onLeave) }
  }, [])

  const seats = data.seats
  const occupancy = seats.active ? Math.round((seats.occupied / seats.active) * 100) : 0
  const attention = data.overdueCount + data.dueTodayCount + data.dueSoonCount
  const attentionPct = data.activeStudents ? Math.round((attention / data.activeStudents) * 100) : 0
  const collectedPct = data.expectedMonthlyRevenue > 0 ? Math.min(100, Math.round((data.collectedThisMonth / data.expectedMonthlyRevenue) * 100)) : 0

  // Seat constellation: up to 72 cells, proportional to real counts.
  const cells = useMemo(() => {
    const total = Math.max(1, seats.active)
    const n = Math.min(72, Math.max(12, total))
    const scale = (v) => Math.round((v / total) * n)
    const women = scale(seats.womenSeated)
    const men = Math.max(0, scale(seats.occupied) - women)
    const reservedFree = scale(seats.reservedFree)
    const kinds = [...Array(women).fill('woman'), ...Array(men).fill('taken'), ...Array(reservedFree).fill('reserved')]
    while (kinds.length < n) kinds.push('free')
    // deterministic shuffle so the map looks organic but stable between renders
    let seed = 7
    for (let i = kinds.length - 1; i > 0; i--) { seed = (seed * 9301 + 49297) % 233280; const j = Math.floor((seed / 233280) * (i + 1)); [kinds[i], kinds[j]] = [kinds[j], kinds[i]] }
    return kinds.slice(0, n)
  }, [seats])

  const particles = useMemo(() => Array.from({ length: 26 }, (_, i) => ({
    left: (i * 37) % 100, top: (i * 53) % 100, size: 1.5 + (i % 3), delay: (i * 0.9) % 12, dur: 10 + (i % 6) * 2,
  })), [])

  const ticker = data.recentPayments?.length ? data.recentPayments : []
  const px = (k) => `translate3d(${tilt.x * k}px, ${tilt.y * k}px, 0)`

  return (
    <div className="hero card" ref={ref}>
      <div className="hero-aurora" style={{ transform: px(-6) }}><span /><span /><span /></div>
      <div className="hero-floor" style={{ transform: `perspective(600px) rotateX(62deg) translateY(40px) translateX(${tilt.x * -10}px)` }} />
      <div className="hero-particles">{particles.map((p, i) => <span key={i} style={{ left: `${p.left}%`, top: `${p.top}%`, width: p.size, height: p.size, animationDelay: `${p.delay}s`, animationDuration: `${p.dur}s` }} />)}</div>
      <div className="hero-sweep" />

      <div className="hero-body">
        <div className="hero-left" style={{ transform: px(4) }}>
          <div className="hero-kicker"><span className="hero-live" /> Live overview · {fmtDate(data.today)}</div>
          <h2 className="hero-title">{title}</h2>
          <p className="hero-sub">{subtitle}</p>

          <div className="hero-tiles">
            <Gauge value={occupancy} label="Occupancy" big={`${seats.occupied}/${seats.active}`} hint={`${seats.free} free`} tone="pink" delay={0.2} />
            <Gauge value={collectedPct} label="Collected vs expected" big={money(data.collectedThisMonth)} hint={`of ${money(data.expectedMonthlyRevenue)}`} tone="orange" delay={0.35} />
            <Gauge value={attentionPct} label="Need attention" big={attention} hint={`${data.overdueCount + data.dueTodayCount} overdue · ${data.dueSoonCount} due soon`} tone="violet" delay={0.5} />
          </div>

          <div className="hero-chips">
            <span className="hero-chip"><b><CountUp value={data.activeStudents} /></b> active students</span>
            <span className="hero-chip"><b><CountUp value={seats.generalFree} /></b> seats open to anyone</span>
            <span className="hero-chip pink"><b><CountUp value={seats.reservedFree} /></b> women-only free</span>
            <span className={`hero-chip ${data.netThisMonth >= 0 ? 'green' : 'red'}`}><b>{data.netThisMonth < 0 ? '−' : ''}<CountUp value={Math.abs(Math.round(data.netThisMonth))} prefix="₹" /></b> net this month</span>
          </div>
        </div>

        <div className="hero-right" style={{ transform: px(10) }}>
          <div className="hero-loop" aria-hidden="true">
            <svg viewBox="0 0 200 200" width="100%" height="100%">
              <defs>
                <linearGradient id="hl-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#7c3aed" /><stop offset="0.5" stopColor="#ec4899" /><stop offset="1" stopColor="#f97316" /></linearGradient>
                <filter id="hl-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
              </defs>
              <circle cx="100" cy="100" r="92" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" strokeDasharray="2 8" className="hero-ring-slow" />
              <path className="hero-ring" d="M22 100 C22 55 58 22 100 22 C142 22 178 55 178 100 C178 145 142 178 100 178" fill="none" stroke="url(#hl-g)" strokeWidth="9" strokeLinecap="round" filter="url(#hl-glow)" />
              <circle className="hero-spark" cx="178" cy="100" r="7" fill="#fff" filter="url(#hl-glow)" />
            </svg>
          </div>
          <div className="hero-constellation" style={{ gridTemplateColumns: `repeat(${cells.length > 48 ? 12 : cells.length > 24 ? 8 : 6}, 1fr)` }}>
            {cells.map((k, i) => <span key={i} className={`cell ${k}`} style={{ animationDelay: `${0.6 + (i % 12) * 0.05 + Math.floor(i / 12) * 0.08}s` }} />)}
          </div>
          <div className="hero-legend">
            <span><i className="free" />free</span><span><i className="reserved" />women only</span><span><i className="woman" />woman</span><span><i className="taken" />occupied</span>
          </div>
        </div>
      </div>

      {ticker.length > 0 && (
        <div className="hero-ticker" aria-hidden="true">
          <div className="hero-ticker-track">
            {[...ticker, ...ticker].map((p, i) => (
              <span key={i} className="hero-tick"><b>+{money(p.amount)}</b> {p.studentName} <em>{fmtDate(p.paidOn)}</em></span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function Gauge({ value, label, big, hint, tone, delay }) {
  const r = 26, c = 2 * Math.PI * r
  const [v, setV] = useState(0)
  useEffect(() => {
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) { setV(value); return }
    const t = setTimeout(() => setV(value), 150 + delay * 1000)
    return () => clearTimeout(t)
  }, [value, delay])
  return (
    <div className={`hero-tile ${tone}`} style={{ animationDelay: `${delay}s` }}>
      <svg width="64" height="64" viewBox="0 0 64 64" className="hero-gauge">
        <circle cx="32" cy="32" r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="6" />
        <circle cx="32" cy="32" r={r} fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c - (c * Math.min(100, v)) / 100} transform="rotate(-90 32 32)" />
        <text x="32" y="36" textAnchor="middle" fontSize="13" fontWeight="800" fill="#fff"><CountUp value={value} />%</text>
      </svg>
      <div className="hero-tile-text">
        <div className="big">{big}</div>
        <div className="lbl">{label}</div>
        <div className="hint">{hint}</div>
      </div>
    </div>
  )
}

/** Counts from 0 to value once when it first renders (or when value changes). */
export function CountUp({ value, prefix = '', duration = 1200 }) {
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
