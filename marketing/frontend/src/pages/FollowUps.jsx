import { useCallback, useEffect, useState } from 'react'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useToast } from '../lib/toast'
import LeadCard from '../components/LeadCard'

const SECTIONS = [
  ['overdue', 'Overdue', 'These slipped – call or visit today.', 'red'],
  ['today', 'Today', 'Planned for today.', 'amber'],
  ['upcoming', 'Next 7 days', 'Coming up this week.', 'blue'],
  ['none', 'No follow-up planned', 'Open leads without a next step – pick a date from the lead page.', 'grey'],
]

export default function FollowUps() {
  const { isAdmin } = useAuth()
  const toast = useToast()
  const [data, setData] = useState({})
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const results = await Promise.all(SECTIONS.map(([key]) => api.leads({ followUp: key, sort: key === 'none' ? 'interest' : 'followup', pageSize: 100 })))
      setData(Object.fromEntries(SECTIONS.map(([key], i) => [key, results[i]])))
    } catch (e) { toast.error(e.message) }
    finally { setLoading(false) }
  }, [toast])

  useEffect(() => { load() }, [load])

  if (loading && !data.today) return <div className="empty">Loading…</div>

  return (
    <>
      {SECTIONS.map(([key, title, hint, tone]) => {
        const r = data[key]
        if (!r) return null
        if (key === 'none' && r.total === 0) return null
        return (
          <section key={key} className="card">
            <div className="card-head">
              <div><h2><span className={`badge ${tone}`}>{r.total}</span> {title}</h2><small className="muted">{hint}</small></div>
            </div>
            <div className="card-body list">
              {r.items.length === 0 && <div className="empty small">{key === 'overdue' ? 'Nothing overdue. 👏' : 'Nothing here.'}</div>}
              {r.items.map((l) => <LeadCard key={l.id} lead={l} showOwner={isAdmin} />)}
              {r.total > r.items.length && <div className="muted small">Showing {r.items.length} of {r.total}. Use the Leads page filters to see all.</div>}
            </div>
          </section>
        )
      })}
    </>
  )
}
