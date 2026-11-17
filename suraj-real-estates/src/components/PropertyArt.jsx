// Illustrated, colourful artwork for each kind of property (no photos needed).
// Replace with real renders by giving a project an `image` URL.
export default function PropertyArt({ kind = 'tower', palette = ['#7c3aed', '#ec4899'], seed = 1, className = '', image }) {
  if (image) return <img className={`prop-art ${className}`} src={image} alt="" loading="lazy" />
  const [a, b] = palette
  const id = `pa${kind}${seed}${a.slice(1)}`
  const win = (x, y, w, h, cols, rows, gap = 3, c = '#fff8') => {
    const out = []
    const cw = (w - gap * (cols + 1)) / cols
    const rh = (h - gap * (rows + 1)) / rows
    for (let r = 0; r < rows; r++)
      for (let k = 0; k < cols; k++)
        out.push(<rect key={`${x}-${r}-${k}`} x={x + gap + k * (cw + gap)} y={y + gap + r * (rh + gap)} width={cw} height={rh} rx="1" fill={(r * 7 + k * 3 + seed) % 5 === 0 ? '#fde68a' : c} />)
    return out
  }
  return (
    <svg className={`prop-art ${className}`} viewBox="0 0 400 260" preserveAspectRatio="xMidYMid slice" role="img" aria-label={`${kind} illustration`}>
      <defs>
        <linearGradient id={`${id}s`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={a} />
          <stop offset="1" stopColor={b} />
        </linearGradient>
        <linearGradient id={`${id}b`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity=".95" />
          <stop offset="1" stopColor="#ffffff" stopOpacity=".7" />
        </linearGradient>
      </defs>
      <rect width="400" height="260" fill={`url(#${id}s)`} />
      <circle cx={300 - (seed % 4) * 30} cy="62" r="34" fill="#fde68a" opacity=".85" />
      <circle cx={80 + (seed % 3) * 40} cy="44" r="10" fill="#fff" opacity=".25" />
      <path d="M0 200 Q100 170 200 195 T400 185 V260 H0Z" fill="#000" opacity=".12" />
      {kind === 'tower' && (
        <g>
          <rect x="40" y="70" width="70" height="160" fill={`url(#${id}b)`} />{win(40, 70, 70, 160, 3, 12, 4, a + '55')}
          <rect x="125" y="40" width="80" height="190" fill={`url(#${id}b)`} />{win(125, 40, 80, 190, 3, 14, 4, b + '55')}
          <rect x="220" y="85" width="70" height="145" fill={`url(#${id}b)`} />{win(220, 85, 70, 145, 3, 11, 4, a + '55')}
          <rect x="305" y="60" width="60" height="170" fill={`url(#${id}b)`} />{win(305, 60, 60, 170, 2, 13, 4, b + '55')}
        </g>
      )}
      {kind === 'villa' && (
        <g>
          {[0, 1, 2].map((i) => (
            <g key={i} transform={`translate(${30 + i * 120} ${100 - (i % 2) * 14})`}>
              <rect x="0" y="40" width="100" height="90" fill={`url(#${id}b)`} />
              <path d="M-8 44 50 4 108 44Z" fill={i % 2 ? a : b} />
              <rect x="14" y="62" width="22" height="22" fill={a + '66'} />
              <rect x="64" y="62" width="22" height="22" fill="#fde68a" />
              <rect x="40" y="96" width="20" height="34" fill={b + '88'} />
            </g>
          ))}
          {[20, 150, 270, 370].map((x) => (
            <g key={x}><rect x={x} y="200" width="5" height="26" fill="#14532d" /><circle cx={x + 2} cy="194" r="16" fill="#22c55e" opacity=".9" /></g>
          ))}
        </g>
      )}
      {kind === 'office' && (
        <g>
          <path d="M120 230 V40 L200 20 L280 40 V230Z" fill={`url(#${id}b)`} />
          {win(128, 48, 144, 180, 6, 14, 3, a + '66')}
          <rect x="40" y="110" width="70" height="120" fill="#ffffffaa" />{win(40, 110, 70, 120, 3, 8, 3, b + '55')}
          <rect x="290" y="95" width="75" height="135" fill="#ffffffaa" />{win(290, 95, 75, 135, 3, 9, 3, a + '55')}
        </g>
      )}
      {kind === 'retail' && (
        <g>
          <rect x="30" y="80" width="340" height="150" fill={`url(#${id}b)`} />
          <rect x="30" y="80" width="340" height="22" fill={a} />
          {[0, 1, 2, 3, 4].map((i) => (
            <g key={i}>
              <path d={`M${40 + i * 66} 120 h56 l-6 14 h-44z`} fill={i % 2 ? a : b} />
              <rect x={46 + i * 66} y="140" width="44" height="60" fill={i % 2 ? a + '44' : '#fde68a'} />
            </g>
          ))}
          <rect x="30" y="206" width="340" height="24" fill={b + '66'} />
          <text x="200" y="96" textAnchor="middle" fontSize="14" fontWeight="700" fill="#fff" letterSpacing="4">GALLERIA</text>
        </g>
      )}
      {kind === 'plot' && (
        <g>
          <path d="M0 150 L400 120 V260 H0Z" fill="#ffffff55" />
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <g key={i}>
              <path d={`M${20 + i * 64} ${158 - i * 4} l56 -4 l6 40 l-58 4z`} fill={i % 2 ? '#ffffffcc' : '#ffffff99'} stroke={a} strokeWidth="1.5" />
              <path d={`M${26 + i * 64} ${206 - i * 4} l56 -4 l6 40 l-58 4z`} fill={i % 3 ? '#ffffff99' : '#fde68a'} stroke={b} strokeWidth="1.5" />
            </g>
          ))}
          <path d="M0 200 L400 168" stroke="#334155" strokeWidth="6" opacity=".55" />
          {[60, 180, 300].map((x) => (
            <g key={x}><rect x={x} y="80" width="4" height="40" fill="#14532d" /><circle cx={x + 2} cy="76" r="14" fill="#16a34a" /></g>
          ))}
        </g>
      )}
    </svg>
  )
}
