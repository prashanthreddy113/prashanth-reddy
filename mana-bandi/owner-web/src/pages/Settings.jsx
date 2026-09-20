import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { useTown } from '../lib/town'
import { useToast } from '../lib/toast'
import { fmtDateTime } from '../lib/format'
import StatusPill from '../components/StatusPill'
import Modal from '../components/Modal'

const TABS = ['Company', 'Terms', 'Templates', 'Users', 'Audit log']

export default function Settings() {
  const { towns } = useTown()
  const toast = useToast()
  const [tab, setTab] = useState('Company')
  const [company, setCompany] = useState(null)
  const [commission, setCommission] = useState(null)
  const [terms, setTerms] = useState(null)
  const [newTerms, setNewTerms] = useState(null)
  const [templates, setTemplates] = useState([])
  const [tpl, setTpl] = useState(null)
  const [users, setUsers] = useState([])
  const [newUser, setNewUser] = useState(null)
  const [audit, setAudit] = useState([])
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const [c, cm, t, tp, u, a] = await Promise.all([api.settings.company(), api.commission.get(), api.settings.terms(), api.settings.templates(), api.settings.users(), api.settings.audit()])
    setCompany(c); setCommission(cm); setTerms(t); setTemplates(tp); setUsers(u); setAudit(a)
  }, [])
  useEffect(() => { load() }, [load])
  if (!company || !terms || !commission) return <div className="loading">Loading…</div>

  const run = async (fn, msg) => { setBusy(true); try { await fn(); await load(); toast.success(msg) } catch (e) { toast.error(e.message) } finally { setBusy(false) } }
  const setC = (k, v) => setCompany({ ...company, [k]: v })
  const townName = (id) => towns.find((t) => t.id === id)?.nameEn || '—'
  const bump = (v) => { const [a, b] = v.split('.').map(Number); return `${a}.${b + 1}` }

  return (
    <>
      <div className="tabs">{TABS.map((t) => <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>{t}</button>)}</div>

      {tab === 'Company' && (
        <div className="grid-2 wide-left">
          <div className="card">
            <div className="card-head"><h2>Company details</h2></div>
            <div className="card-body form-grid">
              <label className="field"><span>Legal name</span><input value={company.legalName} onChange={(e) => setC('legalName', e.target.value)} /></label>
              <label className="field"><span>Brand</span><input value={company.brand} onChange={(e) => setC('brand', e.target.value)} /></label>
              <label className="field"><span>GSTIN</span><input className="mono" value={company.gstin} onChange={(e) => setC('gstin', e.target.value)} /></label>
              <label className="field"><span>Support email</span><input value={company.supportEmail} onChange={(e) => setC('supportEmail', e.target.value)} /></label>
              <label className="field"><span>Support phone</span><input value={company.supportPhone} onChange={(e) => setC('supportPhone', e.target.value)} /></label>
              <label className="field"><span>WhatsApp number</span><input value={company.whatsappNumber} onChange={(e) => setC('whatsappNumber', e.target.value)} /></label>
              <label className="field span2"><span>Address</span><input value={company.address} onChange={(e) => setC('address', e.target.value)} /></label>
              <h3 className="span2">Dispatch and incentives</h3>
              <label className="field"><span>Offer window (s)</span><input type="number" value={company.offerWindowSec} onChange={(e) => setC('offerWindowSec', +e.target.value)} /></label>
              <label className="field"><span>Dispatch rounds</span><input type="number" value={company.dispatchRounds} onChange={(e) => setC('dispatchRounds', +e.target.value)} /></label>
              <label className="field"><span>Dispatch radius (km)</span><input type="number" value={company.dispatchRadiusKm} onChange={(e) => setC('dispatchRadiusKm', +e.target.value)} /></label>
              <label className="field"><span>Incentive: trips/day</span><input type="number" value={company.incentiveTripsPerDay} onChange={(e) => setC('incentiveTripsPerDay', +e.target.value)} /></label>
              <label className="field"><span>Incentive ₹</span><input type="number" value={company.incentiveAmount} onChange={(e) => setC('incentiveAmount', +e.target.value)} /></label>
            </div>
            <div className="card-foot"><span /><button className="btn primary" disabled={busy} onClick={() => run(() => api.settings.saveCompany(company), 'Company details saved')}>Save</button></div>
          </div>
          <div className="card commission-tile">
            <div className="card-head"><h2>💸 Commission</h2><Link className="btn sm" to="/commission">Configure →</Link></div>
            <div className="card-body">
              <div className="kpi-value">{commission.defaultRule.pct}%</div>
              <div className="muted">default · {commission.defaultRule.freeMonths} free month{commission.defaultRule.freeMonths === 1 ? '' : 's'} at {commission.defaultRule.freePct}% for new captains · from {commission.defaultRule.effectiveFrom}</div>
              <ul className="plain top8">
                {['bike', 'auto', 'parcel'].map((s) => <li key={s}>{s}: {commission.serviceOverrides[s] ?? 'default'}{commission.serviceOverrides[s] != null ? '%' : ''}</li>)}
                <li>{commission.townOverrides.length} town override{commission.townOverrides.length === 1 ? '' : 's'}</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {tab === 'Terms' && (
        <div className="card">
          <div className="card-head"><h2>Terms &amp; conditions · v{terms.currentVersion}</h2><div className="row gap"><span className="muted">published {terms.publishedAt}</span><button className="btn primary sm" onClick={() => setNewTerms({ version: bump(terms.currentVersion), te: terms.te, en: terms.en })}>Publish new version…</button></div></div>
          <div className="card-body grid-2">
            <div><h3>తెలుగు</h3><p className="te terms-text">{terms.te}</p></div>
            <div><h3>English</h3><p className="terms-text">{terms.en}</p></div>
          </div>
          <div className="table-wrap"><table><thead><tr><th>Version</th><th>Published</th><th>By</th></tr></thead><tbody>{[...terms.versions].reverse().map((v) => <tr key={v.version}><td>v{v.version}</td><td>{v.publishedAt}</td><td>{v.by}</td></tr>)}</tbody></table></div>
          <Modal open={!!newTerms} width={760} title="Publish new terms version" onClose={() => setNewTerms(null)} footer={<><button className="btn" onClick={() => setNewTerms(null)}>Cancel</button><button className="btn primary" disabled={busy} onClick={() => run(async () => { await api.settings.publishTerms(newTerms); setNewTerms(null) }, `Terms v${newTerms?.version} published — riders and captains must accept on next open`)}>Publish</button></>}>
            {newTerms && (
              <div className="form-grid">
                <label className="field"><span>Version</span><input value={newTerms.version} onChange={(e) => setNewTerms({ ...newTerms, version: e.target.value })} /></label>
                <label className="field span2"><span>తెలుగు</span><textarea className="te" rows={6} value={newTerms.te} onChange={(e) => setNewTerms({ ...newTerms, te: e.target.value })} /></label>
                <label className="field span2"><span>English</span><textarea rows={6} value={newTerms.en} onChange={(e) => setNewTerms({ ...newTerms, en: e.target.value })} /></label>
              </div>
            )}
          </Modal>
        </div>
      )}

      {tab === 'Templates' && (
        <div className="card">
          <div className="card-head"><h2>SMS / WhatsApp templates</h2><button className="btn sm primary" onClick={() => setTpl({ channel: 'sms', key: '', langs: ['te'], status: 'pending_review', te: '', en: '' })}>＋ New template</button></div>
          <div className="table-wrap">
            <table className="clickable"><thead><tr><th>Key</th><th>Channel</th><th>Languages</th><th>Telugu</th><th>Status</th></tr></thead><tbody>
              {templates.map((t) => <tr key={t.id} onClick={() => setTpl({ ...t })}><td className="mono">{t.key}</td><td>{t.channel === 'whatsapp' ? '💬 WhatsApp' : '✉️ SMS'}</td><td>{t.langs.join(', ')}</td><td className="te ellipsis">{t.te}</td><td><StatusPill status={t.status} /></td></tr>)}
            </tbody></table>
          </div>
          <div className="card-body muted small">Placeholders in braces are filled by the backend notify service. WhatsApp templates must be approved by Meta before use; SMS templates need DLT registration.</div>
          <Modal open={!!tpl} width={680} title={tpl?.id ? `Template · ${tpl.key}` : 'New template'} onClose={() => setTpl(null)} footer={<><button className="btn" onClick={() => setTpl(null)}>Cancel</button><button className="btn primary" disabled={busy || !tpl?.key} onClick={() => run(async () => { await api.settings.saveTemplate(tpl); setTpl(null) }, 'Template saved')}>Save</button></>}>
            {tpl && (
              <div className="form-grid">
                <label className="field"><span>Key</span><input className="mono" value={tpl.key} onChange={(e) => setTpl({ ...tpl, key: e.target.value })} /></label>
                <label className="field"><span>Channel</span><select value={tpl.channel} onChange={(e) => setTpl({ ...tpl, channel: e.target.value })}><option value="sms">SMS</option><option value="whatsapp">WhatsApp</option></select></label>
                <label className="field span2"><span>తెలుగు</span><textarea className="te" rows={3} value={tpl.te} onChange={(e) => setTpl({ ...tpl, te: e.target.value })} /></label>
                <label className="field span2"><span>English</span><textarea rows={3} value={tpl.en} onChange={(e) => setTpl({ ...tpl, en: e.target.value })} /></label>
                <label className="field"><span>Status</span><select value={tpl.status} onChange={(e) => setTpl({ ...tpl, status: e.target.value })}><option value="pending_review">Pending review</option><option value="approved">Approved</option></select></label>
              </div>
            )}
          </Modal>
        </div>
      )}

      {tab === 'Users' && (
        <div className="card">
          <div className="card-head"><h2>Users &amp; roles</h2><button className="btn sm primary" onClick={() => setNewUser({ name: '', email: '', role: 'town_manager', townId: towns[0]?.id })}>＋ Add town manager</button></div>
          <div className="table-wrap">
            <table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Town</th><th>Last login</th><th /></tr></thead><tbody>
              {users.map((u) => <tr key={u.id}><td>{u.name}</td><td>{u.email}</td><td><span className={`role-pill role-${u.role}`}>{u.role === 'owner' ? 'Owner' : 'Town manager'}</span></td><td>{u.townId ? townName(u.townId) : 'All'}</td><td>{fmtDateTime(u.lastLogin)}</td><td>{u.role !== 'owner' && <button className="btn sm ghost danger-text" onClick={() => run(() => api.settings.removeUser(u.id), 'User removed')}>Remove</button>}</td></tr>)}
            </tbody></table>
          </div>
          <div className="card-body muted small">Owner: everything. Town manager: own town only — dashboard, live map, areas, captains, rides, parcels, analytics, settlements; commission read-only; no Settings.</div>
          <Modal open={!!newUser} title="Add town manager" onClose={() => setNewUser(null)} footer={<><button className="btn" onClick={() => setNewUser(null)}>Cancel</button><button className="btn primary" disabled={busy || !newUser?.name || !newUser?.email} onClick={() => run(async () => { await api.settings.addUser(newUser); setNewUser(null) }, 'Invitation sent')}>Add</button></>}>
            {newUser && (
              <div className="form-grid">
                <label className="field"><span>Name</span><input value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} /></label>
                <label className="field"><span>Email</span><input type="email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} /></label>
                <label className="field"><span>Role</span><select value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value, townId: e.target.value === 'owner' ? null : newUser.townId || towns[0]?.id })}><option value="town_manager">Town manager</option><option value="owner">Owner</option></select></label>
                {newUser.role === 'town_manager' && <label className="field"><span>Town</span><select value={newUser.townId || ''} onChange={(e) => setNewUser({ ...newUser, townId: e.target.value })}>{towns.map((t) => <option key={t.id} value={t.id}>{t.nameEn}</option>)}</select></label>}
              </div>
            )}
          </Modal>
        </div>
      )}

      {tab === 'Audit log' && (
        <div className="card">
          <div className="card-head"><h2>Audit log</h2><span className="count">{audit.length}</span></div>
          <div className="table-wrap tall">
            <table><thead><tr><th>When</th><th>Who</th><th>Action</th><th>Target</th><th>Detail</th></tr></thead><tbody>
              {audit.map((a) => <tr key={a.id}><td className="nowrap">{fmtDateTime(a.at)}</td><td>{a.by}</td><td className="mono small">{a.action}</td><td className="mono small">{a.target}</td><td>{a.detail}</td></tr>)}
            </tbody></table>
          </div>
        </div>
      )}
    </>
  )
}
