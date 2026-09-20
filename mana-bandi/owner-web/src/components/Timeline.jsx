import { fmtTime } from '../lib/format'

const STEPS = ['requested', 'accepted', 'arrived', 'started', 'finished']
const LABEL = { requested: 'Requested', accepted: 'Accepted', arrived: 'Arrived', started: 'Started (OTP)', finished: 'Finished', cancelled: 'Cancelled', no_captain: 'No captain' }

/** requested → accepted → arrived → started → finished, with cancel / no-captain as a terminal branch. */
export default function Timeline({ events = [] }) {
  const byType = Object.fromEntries(events.map((e) => [e.type, e]))
  const terminal = events.find((e) => e.type === 'cancelled' || e.type === 'no_captain')
  return (
    <ol className="timeline">
      {STEPS.map((s) => {
        const e = byType[s]
        if (!e && terminal) return null
        return (
          <li key={s} className={e ? 'done' : ''}>
            <span className="dot" />
            <span className="tl-label">{LABEL[s]}</span>
            <span className="tl-time">{e ? fmtTime(e.at) : '—'}</span>
          </li>
        )
      })}
      {terminal && (
        <li className="done bad">
          <span className="dot" />
          <span className="tl-label">{LABEL[terminal.type]}{terminal.by ? ` by ${terminal.by}` : ''}</span>
          <span className="tl-time">{fmtTime(terminal.at)}</span>
          {terminal.reason && <div className="tl-reason">{terminal.reason}</div>}
        </li>
      )}
    </ol>
  )
}
