import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useToast } from '../lib/toast'
import LeadCard from '../components/LeadCard'
import { IconSearch, IconFilter, IconDownload, IconPlus } from '../components/Icons'
import { STATUS } from '../lib/format'

const PAGE = 30
const CHIPS = [['', 'All'], ['open', 'Open'], ['New', 'New'], ['FollowUp', 'Follow-up'], ['Negotiation', 'Negotiation'], ['Converted', 'Converted'], ['Lost', 'Lost']]

export default function Leads() {
  const { isAdmin } = useAuth()
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const [result, setResult] = useState({ items: [], total: 0 })
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [showFilters, setShowFilters] = useState(false)
  const [projects, setProjects] = useState([])
  const [users, setUsers] = useState([])
  const [search, setSearch] = useState(params.get('search') || '')

  const filter = useMemo(() => ({
    search: params.get('search') || '',
    status: params.get('status') || '',
    projectId: params.get('projectId') || '',
    userId: params.get('userId') || '',
    minInterest: params.get('minInterest') || '',
    followUp: params.get('followUp') || '',
    city: params.get('city') || '',
    sort: params.get('sort') || 'recent',
    from: params.get('from') || '',
    to: params.get('to') || '',
  }), [params])

  const update = (patch) => {
    const next = new URLSearchParams(params)
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)))
    setParams(next, { replace: true })
    setPage(1)
  }

  useEffect(() => {
    const t = setTimeout(() => { if (search !== filter.search) update({ search }) }, 350)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  useEffect(() => {
    api.projects(true).then(setProjects).catch(() => {})
    if (isAdmin) api.users().then(setUsers).catch(() => {})
  }, [isAdmin])

  const load = useCallback(async (p) => {
    setLoading(true)
    try {
      const r = await api.leads({ ...filter, page: p, pageSize: PAGE })
      setResult((prev) => (p === 1 ? r : { ...r, items: [...prev.items, ...r.items] }))
    } catch (e) { toast.error(e.message) }
    finally { setLoading(false) }
  }, [filter, toast])

  useEffect(() => { setPage(1); load(1) }, [load])

  const more = () => { const p = page + 1; setPage(p); load(p) }
  const activeFilters = ['projectId', 'userId', 'minInterest', 'followUp', 'city', 'from', 'to'].filter((k) => filter[k]).length

  const exportCsv = async () => {
    try { await api.exportLeads(filter); toast.success('CSV downloaded') } catch (e) { toast.error(e.message) }
  }

  return (
    <>
      <div className="toolbar">
        <div className="search">
          <IconSearch />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search shop, contact, mobile, area…" inputMode="search" />
          {search && <button className="clear" onClick={() => { setSearch(''); update({ search: '' }) }} aria-label="Clear">×</button>}
        </div>
        <button className={`btn ${activeFilters ? 'primary' : ''}`} onClick={() => setShowFilters((v) => !v)}><IconFilter /> Filters{activeFilters ? ` (${activeFilters})` : ''}</button>
        {isAdmin && <button className="btn" onClick={exportCsv} title="Download CSV"><IconDownload /> <span className="hide-sm">Export</span></button>}
      </div>

      <div className="chips scroll">
        {CHIPS.map(([v, label]) => (
          <button key={v} className={`chip ${filter.status === v ? 'active' : ''}`} onClick={() => update({ status: v })}>{label}</button>
        ))}
      </div>

      {showFilters && (
        <div className="card filters">
          <div className="form-grid">
            <div className="field"><label>Project / product</label>
              <select value={filter.projectId} onChange={(e) => update({ projectId: e.target.value })}><option value="">All</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}{p.isActive ? '' : ' (inactive)'}</option>)}</select></div>
            {isAdmin && <div className="field"><label>Executive</label>
              <select value={filter.userId} onChange={(e) => update({ userId: e.target.value })}><option value="">All</option>{users.map((u) => <option key={u.id} value={u.id}>{u.displayName}</option>)}</select></div>}
            <div className="field"><label>Minimum interest</label>
              <select value={filter.minInterest} onChange={(e) => update({ minInterest: e.target.value })}><option value="">Any</option><option value="3">3★ and above</option><option value="4">4★ and above (hot)</option><option value="5">5★ ready to buy</option></select></div>
            <div className="field"><label>Follow-up</label>
              <select value={filter.followUp} onChange={(e) => update({ followUp: e.target.value })}><option value="">Any</option><option value="overdue">Overdue</option><option value="today">Today</option><option value="upcoming">Next 7 days</option><option value="none">Not scheduled</option></select></div>
            <div className="field"><label>City</label><input value={filter.city} onChange={(e) => update({ city: e.target.value })} placeholder="e.g. Hyderabad" /></div>
            <div className="field"><label>Sort by</label>
              <select value={filter.sort} onChange={(e) => update({ sort: e.target.value })}><option value="recent">Recent activity</option><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="followup">Follow-up date</option><option value="interest">Interest</option><option value="value">Expected value</option><option value="name">Shop name</option></select></div>
            <div className="field"><label>Captured from</label><input type="date" value={filter.from} onChange={(e) => update({ from: e.target.value })} /></div>
            <div className="field"><label>Captured to</label><input type="date" value={filter.to} onChange={(e) => update({ to: e.target.value })} /></div>
          </div>
          <div className="form-actions"><button className="btn" onClick={() => { setParams({}, { replace: true }); setSearch('') }}>Clear all</button></div>
        </div>
      )}

      <div className="row-between muted small">
        <span>{result.total} lead{result.total === 1 ? '' : 's'}{filter.status && STATUS[filter.status] ? ` · ${STATUS[filter.status].label}` : ''}</span>
      </div>

      <div className="list">
        {result.items.map((l) => <LeadCard key={l.id} lead={l} showOwner={isAdmin} />)}
        {!loading && result.items.length === 0 && (
          <div className="empty card">
            <strong>No leads found</strong>
            {activeFilters || filter.search || filter.status ? 'Try clearing the filters.' : 'Capture your first shop visit.'}
            <div style={{ marginTop: 12 }}><Link to="/leads/new" className="btn accent"><IconPlus /> New lead</Link></div>
          </div>
        )}
        {loading && <div className="empty small">Loading…</div>}
        {!loading && result.items.length < result.total && <button className="btn block" onClick={more}>Load more ({result.total - result.items.length} left)</button>}
      </div>
    </>
  )
}
