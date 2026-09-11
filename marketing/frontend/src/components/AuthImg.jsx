import { useEffect, useState } from 'react'
import { authBlobUrl } from '../lib/api'

/** <img> for API photos that need the Authorization header (fetched as a blob, cached in memory). */
export default function AuthImg({ path, alt = '', className, onClick, ...rest }) {
  const [src, setSrc] = useState(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    setSrc(null); setFailed(false)
    authBlobUrl(path).then((url) => { if (alive) setSrc(url) }).catch(() => { if (alive) setFailed(true) })
    return () => { alive = false }
  }, [path])

  if (failed) return <div className={`img-fallback ${className || ''}`}>📷</div>
  if (!src) return <div className={`img-skeleton ${className || ''}`} />
  return <img src={src} alt={alt} className={className} onClick={onClick} loading="lazy" {...rest} />
}
