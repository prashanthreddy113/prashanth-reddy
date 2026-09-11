import { Link } from 'react-router-dom'
import AuthImg from './AuthImg'
import StarRating from './StarRating'
import { StatusBadge, FollowUpBadge, ProjectChip } from './StatusBadge'
import { IconPhone, IconWhatsapp, IconMap } from './Icons'
import { api } from '../lib/api'
import { followUpText, telLink, whatsappLink, mapLink, timeAgo, money, fmtMobile } from '../lib/format'

/** Compact lead row used on the Leads list, follow-ups and dashboard. */
export default function LeadCard({ lead, showOwner = false, compact = false }) {
  return (
    <div className={`lead-card ${compact ? 'compact' : ''}`}>
      <Link to={`/leads/${lead.id}`} className="lead-thumb" aria-label={`Open ${lead.shopName}`}>
        {lead.coverPhotoId
          ? <AuthImg path={api.photoPath(lead.id, lead.coverPhotoId, true)} alt="" />
          : <div className="img-fallback">🏪</div>}
        {lead.photoCount > 1 && <span className="count">{lead.photoCount}</span>}
      </Link>
      <div className="lead-main">
        <Link to={`/leads/${lead.id}`} className="lead-title">
          <strong>{lead.shopName}</strong>
          {lead.contactName && <span className="muted"> · {lead.contactName}</span>}
        </Link>
        <div className="lead-meta">
          <StatusBadge status={lead.status} />
          <FollowUpBadge state={lead.followUpState} text={followUpText(lead.followUpState, lead.nextFollowUpAt)} />
          <ProjectChip name={lead.projectName} color={lead.projectColor} />
        </div>
        <div className="lead-sub">
          <StarRating value={lead.interest} size="sm" />
          {lead.expectedValue ? <span className="muted">{money(lead.expectedValue, { compact: true })}</span> : null}
          {(lead.area || lead.city) && <span className="muted">{[lead.area, lead.city].filter(Boolean).join(', ')}</span>}
          {showOwner && <span className="muted">👤 {lead.assignedToName}</span>}
          <span className="muted">{timeAgo(lead.lastActivityAt)}</span>
        </div>
      </div>
      <div className="lead-actions">
        <a className="icon-btn" href={telLink(lead.mobile)} title={`Call ${fmtMobile(lead.mobile)}`} aria-label="Call"><IconPhone /></a>
        <a className="icon-btn wa" href={whatsappLink(lead.mobile)} target="_blank" rel="noreferrer" title="WhatsApp" aria-label="WhatsApp"><IconWhatsapp /></a>
        {lead.latitude != null && <a className="icon-btn" href={mapLink(lead.latitude, lead.longitude)} target="_blank" rel="noreferrer" title="Open in Maps" aria-label="Map"><IconMap /></a>}
      </div>
    </div>
  )
}
