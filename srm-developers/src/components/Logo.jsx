// SRM Developers brand mark: a house-shaped emblem holding a rising
// three-tower skyline (S·R·M) under a Narsingi sun, in the brand gradient.
export function LogoMark({ size = 44 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className="logo-mark">
      <defs>
        <linearGradient id="srm-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7c3aed" />
          <stop offset=".55" stopColor="#ec4899" />
          <stop offset="1" stopColor="#f59e0b" />
        </linearGradient>
        <linearGradient id="srm-w" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#a855f7" />
          <stop offset="1" stopColor="#ec4899" />
        </linearGradient>
      </defs>
      <path d="M32 3 61 25v31a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5V25Z" fill="url(#srm-g)" />
      <circle cx="45" cy="22" r="6" fill="#fde68a" className="logo-sun" />
      <rect x="13" y="33" width="10" height="24" rx="1.5" fill="#fff" />
      <rect x="27" y="22" width="10" height="35" rx="1.5" fill="#fff" />
      <rect x="41" y="30" width="10" height="27" rx="1.5" fill="#fff" opacity=".92" />
      <g fill="url(#srm-w)">
        <rect x="16" y="37" width="4" height="3" /><rect x="16" y="44" width="4" height="3" />
        <rect x="30" y="26" width="4" height="3" /><rect x="30" y="33" width="4" height="3" /><rect x="30" y="40" width="4" height="3" />
        <rect x="44" y="34" width="4" height="3" /><rect x="44" y="41" width="4" height="3" />
      </g>
      <path d="M6 57h52" stroke="#fff" strokeOpacity=".5" strokeWidth="1.5" />
    </svg>
  )
}

export default function Logo({ size = 44, light = false, sub = true }) {
  return (
    <span className={`logo ${light ? 'logo-light' : ''}`}>
      <LogoMark size={size} />
      <span className="logo-text">
        <span className="logo-name">SRM</span>
        <span className="logo-dev">DEVELOPERS</span>
        {sub && <span className="logo-sub">Narsingi · Hyderabad</span>}
      </span>
    </span>
  )
}
