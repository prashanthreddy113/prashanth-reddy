import { useCallback, useEffect, useState } from 'react'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useTown } from '../lib/town'
import { useToast } from '../lib/toast'
import { SERVICE, fmtDateTime, inr } from '../lib/format'
import Modal from '../components/Modal'
import StatusPill from '../components/StatusPill'

const SERVICES = ['bike', 'auto', 'parcel']
const emptyOverride = (townId) => ({ townId, service: 'all', pct: 10, freeMonths: 0, freePct: 0, effectiveFrom: new Date().toISOString().slice(0, 10), status: 'active', note: '' })

export default function Commission() {
  const { isOwner, user } = useAuth()
  const { towns, townId } = useTown()
  const toast = useToast()
  const ro = !isOwner
  const [cfg, setCfg] = useState(null)
  const [draft, setDraft] = useState(null)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(null)
  const [audit, setAudit] = useState([])
  const [calc, setCalc] = useState({ townId: 'nkd', service: 'bike', fare: 45, joinedAt: '2026-08-01' })
  const [result, setResult] = useState(null)

  const load = useCallback(async () => {
    const c = await api.commission.get(); setCfg(c); setDraft(JSON.parse(JSON.stringify(c))); setDirty(false)
    if (isOwner) api.settings.audit().then((rows) => setAudit(rows.filter((r) => r.action.startsWith('commission'))))
  }, [isOwner])
  useEffect(() => { load() }, [load])
  useEffect(() => { if (cfg) setResult(api.commission.resolve({ ...calc, fare: +calc.fare })) }, [calc, cfg])

  if (!draft) return <div className="loading">Loading…</div>
  const d = draft.defaultRule
  const setDefault = (p) => { setDraft({ ...draft, defaultRule: { ...d, ...p } }); setDirty(true) }
  const setSvc = (s, v) => { setDraft({ ...draft, serviceOverrides: { ...draft.serviceOverrides, [s]: v === '' ? null : Math.min(30, Math.max(0, +v)) } }); setDirty(true) }
  const save = async () => {
    setSaving(true)
    try { await api.commission.save({ defaultRule: draft.defaultRule, serviceOverrides: draft.serviceOverrides }); await load(); toast.success('Commission rules saved — captains see the new line on their next ride') } catch (e) { toast.error(e.message) } finally { setSaving(false) }
  }
  const saveOverride = async () => {
    try {
      if (editing.id) await api.commission.updateTownOverride(editing); else await api.commission.addTownOverride(editing)
      setEditing(null); await load(); toast.success('Town override saved')
    } catch (e) { toast.error(e.message) }
  }
  const remove = async (o) => { if (!window.confirm(`Delete override ${o.townId}/${o.service}?`)) return; await api.commission.deleteTownOverride(o.id); await load(); toast.success('Override deleted') }
  const townName = (id) => towns.find((t) => t.id === id)?.nameEn || id
  const overrides = cfg.townOverrides.filter((o) => townId === 'all' || o.townId === townId)

  return (
    <>
      {ro && <div className="banner">Read-only: only the owner can change commission. You are signed in as {user.name} (town manager).</div>}
      <div className="grid-2">
        <div className="card">
          <div className="card-head"><h2>Default rule</h2><small className="muted">applies where no override matches</small></div>
          <div className="card-body form-grid">
            <div className="field span2">
              <span>Commission — <b>{d.pct}%</b> of every fare</span>
              <div className="row gap"><input type="range" min={0} max={30} step={0.5} value={d.pct} disabled={ro} onChange={(e) => setDefault({ pct: +e.target.value })} className="grow" /><input type="number" min={0} max={30} step={0.5} value={d.pct} disabled={ro} onChange={(e) => setDefault({ pct: Math.min(30, Math.max(0, +e.target.value)) })} className="w80" /></div>
            </div>
            <label className="field"><span>Free months for new captains (0–12)</span><input type="number" min={0} max={12} value={d.freeMonths} disabled={ro} onChange={(e) => setDefault({ freeMonths: Math.min(12, Math.max(0, +e.target.value)) })} /></label>
            <label className="field"><span>Commission % during free period</span><input type="number" min={0} max={30} step={0.5} value={d.freePct} disabled={ro} onChange={(e) => setDefault({ freePct: Math.min(30, Math.max(0, +e.target.value)) })} /></label>
            <label className="field"><span>Effective from</span><input type="date" value={d.effectiveFrom} disabled={ro} onChange={(e) => setDefault({ effectiveFrom: e.target.value })} /></label>
          </div>
          <div className="card-head"><h2>Per-service overrides</h2><small className="muted">blank = use default</small></div>
          <div className="card-body form-grid three">
            {SERVICES.map((s) => (
              <label key={s} className="field"><span><span className={`svc-dot svc-${s}`} />{SERVICE[s].emoji} {SERVICE[s].label} %</span><input type="number" min={0} max={30} step={0.5} placeholder={`default ${d.pct}`} value={draft.serviceOverrides[s] ?? ''} disabled={ro} onChange={(e) => setSvc(s, e.target.value)} /></label>
            ))}
          </div>
          {!ro && <div className="card-foot"><span className={dirty ? 'unsaved' : 'muted'}>{dirty ? 'Unsaved changes' : 'Saved'}</span><button className="btn primary" disabled={!dirty || saving} onClick={save}>{saving ? 'Saving…' : 'Save rules'}</button></div>}
        </div>

        <div className="card">
          <div className="card-head"><h2>Preview calculator</h2><small className="muted">same resolver the backend runs</small></div>
          <div className="card-body form-grid">
            <label className="field"><span>Town</span><select value={calc.townId} onChange={(e) => setCalc({ ...calc, townId: e.target.value })}>{towns.map((t) => <option key={t.id} value={t.id}>{t.nameEn}</option>)}</select></label>
            <label className="field"><span>Service</span><select value={calc.service} onChange={(e) => setCalc({ ...calc, service: e.target.value })}>{SERVICES.map((s) => <option key={s} value={s}>{SERVICE[s].emoji} {SERVICE[s].label}</option>)}</select></label>
            <label className="field"><span>Fare ₹</span><input type="number" min={0} value={calc.fare} onChange={(e) => setCalc({ ...calc, fare: e.target.value })} /></label>
            <label className="field"><span>Captain joined</span><input type="date" value={calc.joinedAt} onChange={(e) => setCalc({ ...calc, joinedAt: e.target.value })} /></label>
          </div>
          {result && (
            <div className="card-body calc-result">
              <div className="calc-row"><span>Fare</span><b>{inr(+calc.fare)}</b></div>
              <div className="calc-row"><span>Commission ({result.pct}%)</span><b className="neg">− {inr(result.commission)}</b></div>
              <div className="calc-row total"><span>Captain gets</span><b className="big">{inr(result.captainGets)}</b></div>
              <div className="calc-why"><b>{result.rule}</b><br /><span className="muted">{result.reason}</span></div>
            </div>
          )}
          <div className="card-body note-inline">
            <h3>What captains see</h3>
            <p>The captain app prints a commission line on every ride card ("కమీషన్ ₹{result?.commission ?? 0} · మీకు {inr(result?.captainGets ?? 0)}") and on the Earnings screen, using <code>GET /config/commission?town=&amp;service=&amp;captainId=</code>. The response is cached for 10 minutes on the phone, so a change here reaches captains within their next ride. Rides already finished keep the % that applied at the time (stored on <code>rides.commission_pct</code>).</p>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head"><h2>Per-town overrides <span className="muted">· {townId === 'all' ? 'all towns' : townName(townId)}</span></h2>{!ro && <button className="btn sm primary" onClick={() => setEditing(emptyOverride(townId === 'all' ? 'nkd' : townId))}>＋ Add override</button>}</div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Town</th><th>Service</th><th>%</th><th>Free months</th><th>Free %</th><th>Effective from</th><th>Status</th><th>Note</th>{!ro && <th />}</tr></thead>
            <tbody>
              {overrides.length === 0 && <tr><td colSpan={9} className="muted">No town overrides — the default rule applies.</td></tr>}
              {overrides.map((o) => (
                <tr key={o.id}>
                  <td>{townName(o.townId)}</td><td>{o.service === 'all' ? 'All services' : `${SERVICE[o.service].emoji} ${SERVICE[o.service].label}`}</td><td><b>{o.pct}%</b></td><td>{o.freeMonths}</td><td>{o.freePct}%</td><td>{o.effectiveFrom}</td>
                  <td><StatusPill status={o.status} tone={o.status === 'active' ? 'green' : o.status === 'scheduled' ? 'yellow' : 'grey'} label={o.status} /></td><td className="muted">{o.note}</td>
                  {!ro && <td className="row gap"><button className="btn sm" onClick={() => setEditing({ ...o })}>Edit</button><button className="btn sm ghost danger-text" onClick={() => remove(o)}>Delete</button></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card-body muted small">Resolution order: town + service → town "all" → per-service override → default. A scheduled override becomes active on its effective date; a disabled one is ignored.</div>
      </div>

      {isOwner && (
        <div className="card">
          <div className="card-head"><h2>Commission audit</h2><small className="muted">also on Settings → Audit log</small></div>
          <div className="table-wrap">
            <table><thead><tr><th>When</th><th>Change</th></tr></thead><tbody>
              {audit.length === 0 && <tr><td colSpan={2} className="muted">No changes yet</td></tr>}
              {audit.map((a) => <tr key={a.id}><td className="nowrap">{fmtDateTime(a.at)}</td><td>{a.detail}</td></tr>)}
            </tbody></table>
          </div>
        </div>
      )}

      <Modal open={!!editing} title={editing?.id ? 'Edit town override' : 'Add town override'} onClose={() => setEditing(null)} footer={<><button className="btn" onClick={() => setEditing(null)}>Cancel</button><button className="btn primary" onClick={saveOverride}>Save</button></>}>
        {editing && (
          <div className="form-grid">
            <label className="field"><span>Town</span><select value={editing.townId} onChange={(e) => setEditing({ ...editing, townId: e.target.value })}>{towns.map((t) => <option key={t.id} value={t.id}>{t.nameEn}</option>)}</select></label>
            <label className="field"><span>Service</span><select value={editing.service} onChange={(e) => setEditing({ ...editing, service: e.target.value })}><option value="all">All services</option>{SERVICES.map((s) => <option key={s} value={s}>{SERVICE[s].label}</option>)}</select></label>
            <label className="field"><span>Commission %</span><input type="number" min={0} max={30} step={0.5} value={editing.pct} onChange={(e) => setEditing({ ...editing, pct: +e.target.value })} /></label>
            <label className="field"><span>Free months</span><input type="number" min={0} max={12} value={editing.freeMonths} onChange={(e) => setEditing({ ...editing, freeMonths: +e.target.value })} /></label>
            <label className="field"><span>% during free period</span><input type="number" min={0} max={30} step={0.5} value={editing.freePct} onChange={(e) => setEditing({ ...editing, freePct: +e.target.value })} /></label>
            <label className="field"><span>Effective from</span><input type="date" value={editing.effectiveFrom} onChange={(e) => setEditing({ ...editing, effectiveFrom: e.target.value })} /></label>
            <label className="field"><span>Status</span><select value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value })}><option value="active">Active</option><option value="scheduled">Scheduled</option><option value="disabled">Disabled</option></select></label>
            <label className="field"><span>Note</span><input value={editing.note} onChange={(e) => setEditing({ ...editing, note: e.target.value })} placeholder="Launch offer" /></label>
          </div>
        )}
      </Modal>
    </>
  )
}
