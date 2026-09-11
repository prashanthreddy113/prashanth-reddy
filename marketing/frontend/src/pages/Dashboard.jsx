import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useToast } from '../lib/toast'
import { money, STATUS, INTEREST, ACTIVITY, timeAgo, fmtDate } from '../lib/format'
import { DailyBars, BarList } from '../components/Charts'
import LeadCard from '../components/LeadCard'
import { IconPlus, IconBell, IconFlame, IconRefresh } from '../components/Icons'

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

export default function Dashboard() {
  const { user, isAdmin } = useAuth()
  const toast = useToast()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [projects, setProjects] = useState([])
  const [users, setUsers] = useState([])
  const [filter, setFilter] = useState({ projectId: '', userId: '', days: 30 })
  const [demo, setDemo] = useState(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try { setData(await api.dashboard(filter)); setError('') }
    catch (e) { setError(e.message) }
  }, [filter])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    api.projects(false).then(setProjects).catch(() => {})
    if (isAdmin) {
      api.users().then((u) => setUsers(u.filter((x) => x.role === 'Executive'))).catch(() => {})
      api.demoStatus().then(setDemo).catch(() => {})
    }
  }, [isAdmin])

  const seedDemo = async () => {
    setBusy(true)
    try { const r = await api.demoSeed(); toast.success(r.message); setDemo(await api.demoStatus()); await load() }
    catch (e) { toast.error(e.message) } finally { setBusy(false) }
  }

  if (error) return <div className="alert error">{error} <button className="btn sm" onClick={load}>Retry</button></div>
  if (!data) return <div className="empty">Loading…</div>
  const t = data.totals
  const due = t.followUpsToday + t.overdueFollowUps
  const statusTones = { New: 'blue', FollowUp: 'amber', Negotiation: 'purple', Converted: 'green', Lost: 'grey' }
  const interestTones = { 1: 'grey', 2: 'grey', 3: 'amber', 4: 'orange', 5: 'red' }

  return (
    <>
      <section className="hero-row">
        <div>
          <h2 className="hero-title">{greeting()}, {user?.displayName?.split(' ')[0]} 👋</h2>
          <p className="muted">{fmtDate(data.today)} · {isAdmin ? `${t.activeExecutives} active executive${t.activeExecutives === 1 ? '' : 's'}` : `${t.openLeads} open lead${t.openLeads === 1 ? '' : 's'} with you`}</p>
        </div>
        <div className="hero-actions">
          <Link to="/leads/new" className="btn accent"><IconPlus /> New lead</Link>
          <Link to="/followups" className={`btn ${due ? 'warn' : ''}`}><IconBell /> {due ? `${due} due` : 'Follow-ups'}</Link>
          <button className="btn ghost" onClick={load} aria-label="Refresh"><IconRefresh /></button>
        </div>
      </section>

      {isAdmin && (
        <div className="filters-row">
          <select value={filter.projectId} onChange={(e) => setFilter({ ...filter, projectId: e.target.value })}>
            <option value="">All projects</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select value={filter.userId} onChange={(e) => setFilter({ ...filter, userId: e.target.value })}>
            <option value="">All executives</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.displayName}</option>)}
          </select>
          <select value={filter.days} onChange={(e) => setFilter({ ...filter, days: Number(e.target.value) })}>
            <option value={7}>Last 7 days</option><option value={14}>Last 14 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option>
          </select>
        </div>
      )}

      {isAdmin && t.leads === 0 && demo && !demo.loaded && (
        <div className="card callout">
          <div>
            <strong>No leads yet.</strong> Create projects and executives from the menu, or load sample data to explore the dashboard.
          </div>
          <button className="btn primary" onClick={seedDemo} disabled={busy}>{busy ? 'Loading…' : 'Load sample data'}</button>
        </div>
      )}

      <section className="stats">
        <Link to="/leads?sort=newest" className="stat clickable"><span className="label">Visits today</span><span className="value">{t.visitsToday}</span><span className="sub">{t.visitsThisWeek} this week · {t.visitsThisMonth} this month</span></Link>
        <Link to="/leads?sort=newest" className="stat clickable blue"><span className="label">New leads this month</span><span className="value">{t.newThisMonth}</span><span className="sub">{t.newToday} today · {t.leads} total</span></Link>
        <Link to="/leads?minInterest=4&status=open" className="stat clickable orange"><span className="label">Hot leads</span><span className="value"><IconFlame /> {t.hot}</span><span className="sub">interest 4–5, still open</span></Link>
        <Link to="/followups" className={`stat clickable ${t.overdueFollowUps ? 'red' : 'amber'}`}><span className="label">Follow-ups due</span><span className="value">{due}</span><span className="sub">{t.overdueFollowUps} overdue · {t.followUpsToday} today</span></Link>
        <Link to="/leads?status=Converted" className="stat clickable green"><span className="label">Converted</span><span className="value">{t.converted}</span><span className="sub">{t.conversionRate}% of leads · {t.convertedThisMonth} this month</span></Link>
        <div className="stat purple"><span className="label">Pipeline value</span><span className="value">{money(t.pipelineValue, { compact: true })}</span><span className="sub">won {money(t.wonValue, { compact: true })}</span></div>
      </section>

      <div className="grid-2">
        <div className="card">
          <div className="card-head"><h2>Activity – last {filter.days} days</h2><span className="muted">visits vs new leads per day</span></div>
          <div className="card-body"><DailyBars data={data.daily} /></div>
        </div>
        <div className="card">
          <div className="card-head"><h2>Pipeline</h2></div>
          <div className="card-body">
            <BarList items={data.byStatus.map((s) => ({ ...s, label: STATUS[s.key]?.label || s.label }))} tones={statusTones} />
            <h3 style={{ marginTop: 18 }}>Interest</h3>
            <BarList items={[...data.byInterest].reverse().map((i) => ({ ...i, label: INTEREST[i.key]?.label || i.label }))} tones={interestTones} />
          </div>
        </div>
      </div>

      <div className="grid-2 even">
        <div className="card">
          <div className="card-head"><h2>By project / product</h2><Link to="/projects" className="muted">{isAdmin ? 'Manage' : ''}</Link></div>
          <div className="card-body project-list">
            {data.byProject.length === 0 && <div className="empty small">No projects assigned yet.</div>}
            {data.byProject.map((p) => (
              <Link to={`/leads?projectId=${p.projectId}`} key={p.projectId} className="project-row">
                <span className="dot" style={{ background: p.color }} />
                <div className="grow">
                  <div className="row-between"><strong>{p.name}</strong><span>{p.leads} leads</span></div>
                  <div className="progress"><span style={{ width: `${p.targetLeads ? Math.min(100, (p.leads / p.targetLeads) * 100) : 0}%`, background: p.color }} /></div>
                  <small className="muted">{p.converted} converted · {p.hot} hot · pipeline {money(p.pipelineValue, { compact: true })}{p.targetLeads ? ` · target ${p.targetLeads}` : ''}</small>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {isAdmin ? (
          <div className="card">
            <div className="card-head"><h2>Executive leaderboard</h2><span className="muted">this month</span></div>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Executive</th><th>Visits</th><th>Leads</th><th>Hot</th><th>Won</th><th>Overdue</th><th>Last active</th></tr></thead>
                <tbody>
                  {data.byExecutive.map((e, i) => (
                    <tr key={e.userId} className={!e.isActive ? 'muted' : ''}>
                      <td><Link to={`/leads?userId=${e.userId}`}>{i === 0 && e.visitsThisMonth > 0 ? '🏆 ' : ''}{e.name}</Link></td>
                      <td>{e.visitsThisMonth}<small className="muted"> / {e.visits}</small></td>
                      <td>{e.leadsThisMonth}<small className="muted"> / {e.leads}</small></td>
                      <td>{e.hot}</td><td>{e.converted}</td>
                      <td className={e.overdue ? 'text-red' : ''}>{e.overdue}</td>
                      <td className="muted">{e.lastActivityAt ? timeAgo(e.lastActivityAt) : '—'}</td>
                    </tr>
                  ))}
                  {data.byExecutive.length === 0 && <tr><td colSpan={7} className="empty small">No executives yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="card">
            <div className="card-head"><h2>Where you've been</h2></div>
            <div className="card-body">
              <BarList items={data.topCities} />
              {data.topShopTypes.length > 0 && <><h3 style={{ marginTop: 18 }}>Shop types</h3><BarList items={data.topShopTypes} /></>}
            </div>
          </div>
        )}
      </div>

      <div className="grid-2 even">
        <div className="card">
          <div className="card-head"><h2>Due follow-ups</h2><Link to="/followups">See all</Link></div>
          <div className="card-body list">
            {data.dueFollowUps.length === 0 && <div className="empty small">Nothing due. 🎉</div>}
            {data.dueFollowUps.map((l) => <LeadCard key={l.id} lead={l} showOwner={isAdmin} compact />)}
          </div>
        </div>
        <div className="card">
          <div className="card-head"><h2>Recent activity</h2></div>
          <div className="card-body timeline">
            {data.recentActivities.length === 0 && <div className="empty small">No activity yet.</div>}
            {data.recentActivities.map((a) => (
              <Link to={`/leads/${a.leadId}`} key={a.id} className="timeline-item">
                <span className="tl-icon">{ACTIVITY[a.type]?.icon || '•'}</span>
                <div>
                  <div><strong>{a.shopName}</strong> <span className="muted">· {ACTIVITY[a.type]?.label}{a.toStatus ? ` → ${STATUS[a.toStatus]?.label}` : ''}{a.interest ? ` · ${a.interest}★` : ''}</span></div>
                  {a.note && <div className="muted small">{a.note}</div>}
                  <small className="muted">{a.userName} · {timeAgo(a.createdAt)}</small>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
