// Suraj Real Estates brand mark. "Suraj" means sun: a rising sun with rays
// over a three-tower skyline, inside a dawn-sky roundel.
export function LogoMark({ size = 44 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className="logo-mark">
      <defs>
        <linearGradient id="sre-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5b21b6" />
          <stop offset=".6" stopColor="#db2777" />
          <stop offset="1" stopColor="#f97316" />
        </linearGradient>
        <radialGradient id="sre-sun" cx=".5" cy=".4" r=".6">
          <stop offset="0" stopColor="#fef9c3" />
          <stop offset=".55" stopColor="#fde047" />
          <stop offset="1" stopColor="#f59e0b" />
        </radialGradient>
        <clipPath id="sre-clip"><circle cx="32" cy="32" r="30" /></clipPath>
      </defs>
      <circle cx="32" cy="32" r="30" fill="url(#sre-sky)" />
      <g clipPath="url(#sre-clip)">
        <g className="logo-rays" stroke="#fde68a" strokeWidth="2.6" strokeLinecap="round">
          <path d="M32 9v6" /><path d="M17.5 14.5l4 4.5" /><path d="M46.5 14.5l-4 4.5" />
          <path d="M9 27l6 1.5" /><path d="M55 27l-6 1.5" />
        </g>
        <circle className="logo-sun" cx="32" cy="34" r="12.5" fill="url(#sre-sun)" />
        <g fill="#fff">
          <rect x="12" y="38" width="9" height="26" rx="1.2" />
          <rect x="23" y="29" width="10" height="35" rx="1.2" />
          <rect x="35" y="34" width="9" height="30" rx="1.2" />
          <rect x="46" y="41" width="8" height="23" rx="1.2" />
        </g>
        <g fill="#7c3aed">
          <rect x="15" y="42" width="3" height="3" /><rect x="15" y="48" width="3" height="3" />
          <rect x="26.5" y="33" width="3" height="3" /><rect x="26.5" y="39" width="3" height="3" /><rect x="26.5" y="45" width="3" height="3" />
          <rect x="38" y="38" width="3" height="3" /><rect x="38" y="44" width="3" height="3" />
          <rect x="48.5" y="45" width="3" height="3" />
        </g>
        <rect x="0" y="54" width="64" height="10" fill="#4c1d95" opacity=".55" />
      </g>
      <circle cx="32" cy="32" r="30" fill="none" stroke="#fff" strokeOpacity=".55" strokeWidth="1.5" />
    </svg>
  )
}

export default function Logo({ size = 44, light = false, sub = true }) {
  return (
    <span className={`logo ${light ? 'logo-light' : ''}`}>
      <LogoMark size={size} />
      <span className="logo-text">
        <span className="logo-name">SURAJ</span>
        <span className="logo-dev">REAL ESTATES</span>
        {sub && <span className="logo-sub">Jubilee Hills · Hyderabad</span>}
      </span>
    </span>
  )
}
