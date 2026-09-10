import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, inr, session } from '../api'

// PL-3 + BL-4: BrightLoop console. English only; used by the platform team, not by shop owners.
const STATUS = ['Trial', 'Active', 'PastDue', 'Suspended', 'Closed']
const RTYPE: Record<number, string> = { 1: 'Retailer', 2: 'Wholesaler', 3: 'Agent' }
const CTYPE: Record<number, string> = { 1: 'Trial extension', 2: 'Free month', 3: 'Payout' }
const CSTATUS = ['Pending', 'Applied', 'Paid', 'Cancelled']
const fmt = (d?: string | null) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'

export default function Super() {
  const nav = useNavigate()
  const [tab, setTab] = useState<'overview' | 'stores' | 'referrals' | 'credits'>('referrals')
  const [metrics, setMetrics] = useState<any>(null)
  const [stores, setStores] = useState<any[]>([]); const [q, setQ] = useState('')
  const [report, setReport] = useState<any>(null); const [rtype, setRtype] = useState<number | ''>('')
  const [credits, setCredits] = useState<any[]>([]); const [cstatus, setCstatus] = useState<number | ''>(0)
  const [open, setOpen] = useState<any>(null); const [openStores, setOpenStores] = useState<any[]>([])
  const [form, setForm] = useState({ name: '', type: 2, phone: '', city: 'Hyderabad', notes: '' }); const [created, setCreated] = useState<any>(null)
  const [err, setErr] = useState('')

  const loadReport = () => api(`/api/superadmin/referrals/report${rtype ? `?type=${rtype}` : ''}`).then(setReport)
  const loadCredits = () => api(`/api/superadmin/referrals/credits${cstatus !== '' ? `?status=${cstatus}` : ''}`).then(setCredits)
  useEffect(() => { api('/api/superadmin/metrics').then(setMetrics).catch(e => setErr(e.message)) }, [])
  useEffect(() => { if (tab === 'stores') api(`/api/superadmin/stores?q=${encodeURIComponent(q)}`).then(setStores) }, [tab, q])
  useEffect(() => { if (tab === 'referrals') loadReport() }, [tab, rtype])
  useEffect(() => { if (tab === 'credits') loadCredits() }, [tab, cstatus])

  async function createReferrer() {
    setErr('')
    try { setCreated(await api('/api/superadmin/referrals/referrers', { body: form })); setForm({ ...form, name: '', phone: '', notes: '' }); loadReport() }
    catch (e: any) { setErr(e.message) }
  }
  async function openReferrer(r: any) { setOpen(r); setOpenStores(await api(`/api/superadmin/referrals/referrers/${r.id}/stores`)) }
  async function setStore(s: any, patch: any) { await api(`/api/superadmin/stores/${s.id}`, { method: 'PATCH', body: patch }); setStores(await api(`/api/superadmin/stores?q=${encodeURIComponent(q)}`)) }
  async function openAsOwner(s: any) { const r = await api(`/api/superadmin/stores/${s.id}/impersonate`, { body: {} }); session.set(r.token, r.storeSlug); nav('/') }
  async function settle(c: any, status: number) { await api(`/api/superadmin/referrals/credits/${c.id}`, { method: 'PATCH', body: { status } }); loadCredits() }
  const csvUrl = `/api/superadmin/referrals/report.csv${rtype ? `?type=${rtype}` : ''}`
  async function downloadCsv() {
    const res = await fetch(csvUrl, { headers: { Authorization: `Bearer ${session.token}` } }); const blob = await res.blob()
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'referrals.csv'; a.click()
  }

  return <div className="page wide">
    <div className="topbar"><h1 style={{ margin: 0 }}>BrightLoop console</h1>
      <button className="btn sm ghost" onClick={() => { session.clear(); nav('/login') }}>Log out</button></div>
    {metrics && <div className="kpis" style={{ marginBottom: 14 }}>
      {[['Stores', metrics.total], ['Trial', metrics.trial], ['Active', metrics.active], ['Past due', metrics.pastDue], ['New this month', metrics.newThisMonth], ['MRR', inr(metrics.mrrInr)], ['Orders this month', metrics.ordersThisMonth]]
        .map(([k, v]) => <div className="card" key={String(k)} style={{ margin: 0, padding: 12 }}><div className="muted">{k}</div><div style={{ fontSize: 22, fontWeight: 800 }}>{v}</div></div>)}
    </div>}
    <div className="tabs">
      {(['referrals', 'credits', 'stores'] as const).map(k => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{k === 'referrals' ? 'Referrals' : k === 'credits' ? 'Credits & payouts' : 'Stores'}</button>)}
    </div>
    {err && <p className="err">{err}</p>}

    {tab === 'referrals' && <>
      <div className="card">
        <div className="row between" style={{ flexWrap: 'wrap', gap: 8 }}>
          <div className="tabs" style={{ margin: 0 }}>
            {[['', 'All'], [2, 'Wholesalers'], [1, 'Retailers'], [3, 'Agents']].map(([v, l]) => <button key={String(v)} className={rtype === v ? 'on' : ''} onClick={() => setRtype(v as any)}>{l}</button>)}
          </div>
          <button className="btn sm secondary" onClick={downloadCsv}>Download CSV</button>
        </div>
        {report && <table className="table" style={{ marginTop: 10 }}>
          <thead><tr><th>Type</th><th className="n">Referrers</th><th className="n">Signups</th><th className="n">Trial</th><th className="n">Paying</th><th className="n">Past due</th><th className="n">Churned</th><th className="n">MRR</th><th className="n">Credit pending</th><th className="n">Credit settled</th></tr></thead>
          <tbody>{report.totals.map((t: any) => <tr key={t.type}><td><b>{RTYPE[t.type]}</b></td><td className="n">{t.referrers}</td><td className="n">{t.signups}</td><td className="n">{t.trial}</td><td className="n">{t.paying}</td><td className="n">{t.pastDue}</td><td className="n">{t.churned}</td><td className="n">{inr(t.mrrInr)}</td><td className="n">{inr(t.creditPendingInr)}</td><td className="n">{inr(t.creditSettledInr)}</td></tr>)}
            {report.totals.length > 1 && <tr style={{ fontWeight: 800 }}><td>Total</td>{['referrers', 'signups', 'trial', 'paying', 'pastDue', 'churned'].map(k => <td className="n" key={k}>{report.totals.reduce((a: number, t: any) => a + t[k], 0)}</td>)}
              <td className="n">{inr(report.totals.reduce((a: number, t: any) => a + t.mrrInr, 0))}</td><td className="n">{inr(report.totals.reduce((a: number, t: any) => a + t.creditPendingInr, 0))}</td><td className="n">{inr(report.totals.reduce((a: number, t: any) => a + t.creditSettledInr, 0))}</td></tr>}
          </tbody></table>}
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Add a wholesaler, agent or partner</h2>
        <div className="grid2">
          <div><label>Name</label><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Begum Bazar Silks" /></div>
          <div><label>Type</label><select value={form.type} onChange={e => setForm({ ...form, type: +e.target.value })}><option value={2}>Wholesaler</option><option value={3}>Agent</option><option value={1}>Retailer</option></select></div>
          <div><label>Phone</label><input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
          <div><label>City</label><input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} /></div>
        </div>
        <label>Notes</label><input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Counter standee placed, 40 retail customers" />
        <div style={{ height: 10 }} /><button className="btn sm" disabled={!form.name} onClick={createReferrer}>Create referrer</button>
        {created && <p className="muted" style={{ marginTop: 8 }}>Created <b>{created.name}</b> · code <b>{created.code}</b> · link <code>{created.joinLink}</code></p>}
      </div>

      {report && <div className="card" style={{ overflowX: 'auto' }}>
        <table className="table">
          <thead><tr><th>Referrer</th><th>Type</th><th>Code</th><th className="n">Signups</th><th className="n">Trial</th><th className="n">Paying</th><th className="n">Churned</th><th className="n">MRR</th><th className="n">Pending</th><th>Last signup</th><th></th></tr></thead>
          <tbody>{report.rows.map((r: any) => <tr key={r.id} style={{ opacity: r.active ? 1 : .5 }}>
            <td><b>{r.name}</b><div className="muted" style={{ fontSize: 12 }}>{r.city ?? ''} {r.phone ?? ''}</div></td><td>{RTYPE[r.type]}</td><td><code>{r.code}</code></td>
            <td className="n">{r.signups}</td><td className="n">{r.trial}</td><td className="n">{r.paying}</td><td className="n">{r.churned}</td><td className="n">{inr(r.mrrInr)}</td><td className="n">{inr(r.creditPendingInr)}</td><td>{fmt(r.lastSignupAt)}</td>
            <td><button className="btn sm ghost" onClick={() => openReferrer(r)}>Stores</button></td></tr>)}
            {report.rows.length === 0 && <tr><td colSpan={11} className="muted">No referrals yet.</td></tr>}</tbody>
        </table>
        {open && <div style={{ marginTop: 14, borderTop: '1px solid var(--line)', paddingTop: 12 }}>
          <div className="row between"><b>{open.name} · {open.code} · <code style={{ fontWeight: 400 }}>{open.joinLink}</code></b><button className="btn sm ghost" onClick={() => setOpen(null)}>Close</button></div>
          <table className="table" style={{ marginTop: 8 }}><thead><tr><th>Store</th><th>City</th><th>Status</th><th>Plan</th><th>Signed up</th><th>First paid</th></tr></thead>
            <tbody>{openStores.map(s => <tr key={s.id}><td><b>{s.name}</b> <span className="muted">{s.slug}</span></td><td>{s.city}</td><td><span className={'chip ' + (s.status === 1 ? 'ok' : s.status === 0 ? 'warn' : 'bad')}>{STATUS[s.status]}</span></td><td>{['', 'Starter', 'Growth', 'Multi-branch'][s.plan]}</td><td>{fmt(s.createdAt)}</td><td>{fmt(s.firstPaidAt)}</td></tr>)}
              {openStores.length === 0 && <tr><td colSpan={6} className="muted">No stores yet.</td></tr>}</tbody></table>
        </div>}
      </div>}
    </>}

    {tab === 'credits' && <div className="card" style={{ overflowX: 'auto' }}>
      <div className="tabs">{[[0, 'Pending'], [1, 'Applied'], [2, 'Paid'], [3, 'Cancelled'], ['', 'All']].map(([v, l]) => <button key={String(v)} className={cstatus === v ? 'on' : ''} onClick={() => setCstatus(v as any)}>{l}</button>)}</div>
      <p className="muted">Free months settle automatically as a refund on the referrer’s next charge. Payouts to wholesalers and agents are paid by you: mark them Paid here once transferred.</p>
      <table className="table" style={{ marginTop: 8 }}>
        <thead><tr><th>When</th><th>Referrer</th><th>For store</th><th>Type</th><th className="n">Amount</th><th>Status</th><th>Note</th><th></th></tr></thead>
        <tbody>{credits.map(c => <tr key={c.id}>
          <td>{fmt(c.createdAt)}</td><td><b>{c.referrer?.name}</b><div className="muted" style={{ fontSize: 12 }}>{RTYPE[c.referrer?.type]} · {c.referrer?.phone ?? ''}</div></td><td>{c.store?.name}</td><td>{CTYPE[c.type]}</td>
          <td className="n">{c.amountInr ? inr(c.amountInr) : '—'}</td><td><span className={'chip ' + (c.status === 0 ? 'warn' : c.status === 3 ? 'bad' : 'ok')}>{CSTATUS[c.status]}</span></td><td className="muted" style={{ fontSize: 12 }}>{c.note}{c.razorpayRefundId ? ` · refund ${c.razorpayRefundId}` : ''}</td>
          <td>{c.status === 0 && c.type === 3 && <div className="row"><button className="btn sm" onClick={() => settle(c, 2)}>Mark paid</button><button className="btn sm ghost" onClick={() => settle(c, 3)}>Cancel</button></div>}</td></tr>)}
          {credits.length === 0 && <tr><td colSpan={8} className="muted">Nothing here.</td></tr>}</tbody>
      </table>
    </div>}

    {tab === 'stores' && <div className="card" style={{ overflowX: 'auto' }}>
      <input placeholder="Search name, slug or phone" value={q} onChange={e => setQ(e.target.value)} />
      <table className="table" style={{ marginTop: 10 }}>
        <thead><tr><th>Store</th><th>Owner</th><th>Plan</th><th>Status</th><th className="n">Products</th><th className="n">Orders</th><th>Last login</th><th>Referred by</th><th></th></tr></thead>
        <tbody>{stores.map(s => <tr key={s.id}>
          <td><b>{s.name}</b><div className="muted" style={{ fontSize: 12 }}>{s.slug} · {s.city}</div></td><td>{s.ownerPhone}</td><td>{['', 'Starter', 'Growth', 'Multi-branch'][s.plan]}</td>
          <td><span className={'chip ' + (s.status === 1 ? 'ok' : s.status === 0 ? 'warn' : 'bad')}>{STATUS[s.status]}</span></td><td className="n">{s.products}</td><td className="n">{s.orders}</td><td>{fmt(s.lastLogin)}</td><td>{s.referredByStoreId ? 'store' : s.referrerId ? 'partner' : '—'}</td>
          <td><div className="row">{s.status === 3 ? <button className="btn sm secondary" onClick={() => setStore(s, { status: 1 })}>Reactivate</button> : <button className="btn sm ghost" onClick={() => setStore(s, { status: 3 })}>Suspend</button>}<button className="btn sm" onClick={() => openAsOwner(s)}>Open as owner</button></div></td></tr>)}</tbody>
      </table>
    </div>}
  </div>
}
