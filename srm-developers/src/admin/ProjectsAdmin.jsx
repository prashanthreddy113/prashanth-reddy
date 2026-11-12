import { useState } from 'react'
import { useStore } from '../lib/store'
import { projectSummary } from '../lib/derive'
import PropertyArt from '../components/PropertyArt'
import { Badge, Field, Modal, Progress, Tabs } from '../components/ui'
import { fmtDate, inrShort, todayISO, uid } from '../lib/format'
import { AMENITY_ICONS } from '../lib/seed'

const BLANK = {
  name: '', slug: '', category: 'Residential', type: 'Apartments', art: 'tower', palette: ['#7c3aed', '#ec4899'], tagline: '', description: '',
  status: 'New Launch', possession: '', rera: '', land: '', structure: '', configs: '', progress: 0, featured: false,
  baseRate: 7000, floorRise: 0, plc: 0, plcFacings: [], parking: 0, clubFee: 0, maintenance: 3, areaUnit: 'sq ft', leaseRate: 0,
  amenities: [], highlights: [], image: '',
}

export default function ProjectsAdmin() {
  const s = useStore()
  const [edit, setEdit] = useState(null)
  const [upd, setUpd] = useState(null)
  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Projects</h1><p className="muted">Manage project details, pricing, construction progress and website content.</p></div>
        <button className="btn btn-primary" onClick={() => setEdit({ ...BLANK })}>+ New project</button>
      </div>
      <div className="grid-3">
        {s.projects.map((p) => {
          const sm = projectSummary(p, s.units, s.settings.taxes)
          return (
            <div className="card admin-pcard" key={p.id}>
              <PropertyArt kind={p.art} palette={p.palette} seed={3} image={p.image} />
              <div className="pad">
                <div className="row-between"><h3>{p.name}</h3>{p.featured && <Badge tone="pink">★ Featured</Badge>}</div>
                <div className="row gap"><Badge>{p.status}</Badge><Badge>{p.category}</Badge></div>
                <p className="small muted">{sm.total} units · {sm.available} available · {sm.soldPct}% sold · from {inrShort(sm.fromPrice)}</p>
                <Progress value={p.progress} palette={p.palette} /><small>{p.progress}% construction</small>
                <div className="row gap mt"><button className="btn btn-sm btn-ghost" onClick={() => setEdit(p)}>✏️ Edit</button><button className="btn btn-sm btn-ghost" onClick={() => setUpd({ projectId: p.id, date: todayISO(), title: '', text: '', progress: p.progress })}>📸 Post update</button><a className="btn btn-sm btn-ghost" href={`/projects/${p.slug}`} target="_blank" rel="noreferrer">View ↗</a></div>
              </div>
            </div>
          )
        })}
      </div>
      <div className="card pad mt">
        <h3>Construction updates</h3>
        <div className="timeline">
          {[...s.updates].sort((a, b) => b.date.localeCompare(a.date)).map((u) => (
            <div key={u.id} className="tl-item"><span className="tl-dot" /><small>{fmtDate(u.date)} · {s.projects.find((p) => p.id === u.projectId)?.name} · {u.progress}%</small><h4>{u.title}</h4><p>{u.text}</p>
              <button className="link small" onClick={() => confirm('Delete update?') && s.remove('updates', u.id)}>Delete</button></div>
          ))}
        </div>
      </div>
      {edit && <ProjectEdit initial={edit} onClose={() => setEdit(null)} />}
      {upd && (
        <Modal title="Post construction update" onClose={() => setUpd(null)}>
          <form className="form-grid" onSubmit={(e) => {
            e.preventDefault()
            if (!upd.title) return s.toast('Add a title', 'err')
            s.add('updates', { ...upd, progress: Number(upd.progress) })
            s.update('projects', upd.projectId, { progress: Number(upd.progress) })
            s.toast('Update posted to website & customer portal'); setUpd(null)
          }}>
            <Field label="Date"><input type="date" value={upd.date} onChange={(e) => setUpd({ ...upd, date: e.target.value })} /></Field>
            <Field label="Overall progress %"><input type="number" min="0" max="100" value={upd.progress} onChange={(e) => setUpd({ ...upd, progress: e.target.value })} /></Field>
            <Field label="Title" span={2}><input value={upd.title} onChange={(e) => setUpd({ ...upd, title: e.target.value })} placeholder="e.g. Tower C 12th slab completed" /></Field>
            <Field label="Details" span={2}><textarea rows={3} value={upd.text} onChange={(e) => setUpd({ ...upd, text: e.target.value })} /></Field>
            <button className="btn btn-primary span-2">Publish update</button>
          </form>
        </Modal>
      )}
    </div>
  )
}

function ProjectEdit({ initial, onClose }) {
  const s = useStore()
  const isNew = !initial.id
  const [f, setF] = useState({ ...initial, plcFacingsText: (initial.plcFacings || []).join(', '), highlightsText: (initial.highlights || []).join('\n') })
  const [tab, setTab] = useState('info')
  const [gen, setGen] = useState({ tower: 'A', floors: 10, perFloor: 4, config: '2 BHK', area: 1200, facing: 'East', forLease: false })
  const set = (k, n) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : n ? Number(e.target.value) : e.target.value })
  const save = (e) => {
    e.preventDefault()
    if (!f.name) return s.toast('Project name is required', 'err')
    const { plcFacingsText, highlightsText, ...rest } = f
    const rec = {
      ...rest, slug: f.slug || f.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
      plcFacings: plcFacingsText.split(',').map((x) => x.trim()).filter(Boolean), highlights: highlightsText.split('\n').map((x) => x.trim()).filter(Boolean),
      leaseRate: Number(f.leaseRate) || undefined,
    }
    if (isNew) s.add('projects', { ...rec, id: uid('p') })
    else s.update('projects', f.id, rec)
    s.toast(isNew ? 'Project created — add units from Edit → Units' : 'Project saved')
    onClose()
  }
  const addUnits = () => {
    const existing = s.units.filter((u) => u.projectId === f.id)
    const units = []
    for (let fl = 1; fl <= gen.floors; fl++)
      for (let k = 1; k <= gen.perFloor; k++) {
        const no = gen.floors > 1 ? `${gen.tower}-${fl}${String(k).padStart(2, '0')}` : `${gen.tower}-${String(k).padStart(3, '0')}`
        if (existing.some((u) => u.no === no)) continue
        units.push({ id: uid('u'), projectId: f.id, tower: gen.tower, floor: gen.floors > 1 ? fl : 0, no, config: gen.config, area: Number(gen.area), facing: gen.facing, status: 'available', forLease: gen.forLease })
      }
    s.replaceAll({ ...s.data, units: [...s.data.units, ...units] })
    s.toast(`${units.length} units added`)
  }
  return (
    <Modal title={isNew ? 'New project' : `Edit · ${initial.name}`} onClose={onClose} wide>
      <Tabs value={tab} onChange={setTab} tabs={[['info', 'Details'], ['price', 'Pricing'], ['web', 'Website content'], ...(isNew ? [] : [['units', 'Add units']])]} />
      {tab !== 'units' ? (
        <form className="form-grid three" onSubmit={save}>
          {tab === 'info' && <>
            <Field label="Name"><input value={f.name} onChange={set('name')} /></Field>
            <Field label="Category"><select value={f.category} onChange={set('category')}>{['Residential', 'Commercial', 'Plots'].map((x) => <option key={x}>{x}</option>)}</select></Field>
            <Field label="Type"><input value={f.type} onChange={set('type')} /></Field>
            <Field label="Status"><select value={f.status} onChange={set('status')}>{['New Launch', 'Under Construction', 'Under Development', 'Ready to Move', 'Sold Out'].map((x) => <option key={x}>{x}</option>)}</select></Field>
            <Field label="Possession"><input value={f.possession} onChange={set('possession')} /></Field>
            <Field label="TS RERA no."><input value={f.rera} onChange={set('rera')} /></Field>
            <Field label="Land area"><input value={f.land} onChange={set('land')} /></Field>
            <Field label="Structure"><input value={f.structure} onChange={set('structure')} /></Field>
            <Field label="Configurations"><input value={f.configs} onChange={set('configs')} /></Field>
            <Field label="Construction %"><input type="number" value={f.progress} onChange={set('progress', 1)} /></Field>
            <Field label="Area unit"><select value={f.areaUnit} onChange={set('areaUnit')}><option>sq ft</option><option>sq yd</option></select></Field>
            <label className="check"><input type="checkbox" checked={!!f.featured} onChange={set('featured')} /> Featured on home page</label>
          </>}
          {tab === 'price' && <>
            <Field label={`Base rate (₹/${f.areaUnit})`}><input type="number" value={f.baseRate} onChange={set('baseRate', 1)} /></Field>
            <Field label="Floor rise (₹ per floor)"><input type="number" value={f.floorRise} onChange={set('floorRise', 1)} /></Field>
            <Field label={`PLC (₹/${f.areaUnit})`}><input type="number" value={f.plc} onChange={set('plc', 1)} /></Field>
            <Field label="PLC facings (comma separated)"><input value={f.plcFacingsText} onChange={set('plcFacingsText')} /></Field>
            <Field label="Car parking (₹)"><input type="number" value={f.parking} onChange={set('parking', 1)} /></Field>
            <Field label="Clubhouse / amenities (₹)"><input type="number" value={f.clubFee} onChange={set('clubFee', 1)} /></Field>
            <Field label={`Maintenance (₹/${f.areaUnit}/mo)`}><input type="number" value={f.maintenance} onChange={set('maintenance', 1)} /></Field>
            <Field label={`Lease rate (₹/${f.areaUnit}/mo)`} hint="Leave 0 if not for lease"><input type="number" value={f.leaseRate || 0} onChange={set('leaseRate', 1)} /></Field>
          </>}
          {tab === 'web' && <>
            <Field label="Tagline" span={3}><input value={f.tagline} onChange={set('tagline')} /></Field>
            <Field label="Description" span={3}><textarea rows={4} value={f.description} onChange={set('description')} /></Field>
            <Field label="Highlights (one per line)" span={3}><textarea rows={3} value={f.highlightsText} onChange={set('highlightsText')} /></Field>
            <Field label="Illustration"><select value={f.art} onChange={set('art')}>{['tower', 'villa', 'office', 'retail', 'plot'].map((x) => <option key={x}>{x}</option>)}</select></Field>
            <Field label="Colour 1"><input type="color" value={f.palette[0]} onChange={(e) => setF({ ...f, palette: [e.target.value, f.palette[1]] })} /></Field>
            <Field label="Colour 2"><input type="color" value={f.palette[1]} onChange={(e) => setF({ ...f, palette: [f.palette[0], e.target.value] })} /></Field>
            <Field label="Photo URL (optional, replaces illustration)" span={3}><input value={f.image || ''} onChange={set('image')} placeholder="https://…/render.jpg" /></Field>
            <div className="span-3">
              <span className="field-label">Amenities</span>
              <div className="chips">
                {Object.keys(AMENITY_ICONS).map((a) => (
                  <button type="button" key={a} className={`chip ${f.amenities.includes(a) ? 'on' : ''}`} onClick={() => setF({ ...f, amenities: f.amenities.includes(a) ? f.amenities.filter((x) => x !== a) : [...f.amenities, a] })}>{AMENITY_ICONS[a]} {a}</button>
                ))}
              </div>
            </div>
          </>}
          <div className="span-3 row gap"><button className="btn btn-primary">{isNew ? 'Create project' : 'Save changes'}</button>
            {!isNew && <button type="button" className="btn btn-danger" onClick={() => {
              if (s.bookings.some((b) => b.projectId === f.id)) return s.toast('Cannot delete a project with bookings', 'err')
              if (confirm('Delete this project and its units?')) { s.replaceAll({ ...s.data, projects: s.data.projects.filter((x) => x.id !== f.id), units: s.data.units.filter((u) => u.projectId !== f.id) }); onClose() }
            }}>Delete project</button>}
          </div>
        </form>
      ) : (
        <div className="form-grid three">
          <p className="span-3 muted">Generate units in bulk. For villas or plots, use 1 floor and set "units per floor" to the count.</p>
          <Field label="Tower / block"><input value={gen.tower} onChange={(e) => setGen({ ...gen, tower: e.target.value })} /></Field>
          <Field label="Floors"><input type="number" min="1" value={gen.floors} onChange={(e) => setGen({ ...gen, floors: Number(e.target.value) })} /></Field>
          <Field label="Units per floor"><input type="number" min="1" value={gen.perFloor} onChange={(e) => setGen({ ...gen, perFloor: Number(e.target.value) })} /></Field>
          <Field label="Configuration"><input value={gen.config} onChange={(e) => setGen({ ...gen, config: e.target.value })} /></Field>
          <Field label={`Area (${f.areaUnit})`}><input type="number" value={gen.area} onChange={(e) => setGen({ ...gen, area: e.target.value })} /></Field>
          <Field label="Facing"><input value={gen.facing} onChange={(e) => setGen({ ...gen, facing: e.target.value })} /></Field>
          <label className="check"><input type="checkbox" checked={gen.forLease} onChange={(e) => setGen({ ...gen, forLease: e.target.checked })} /> Available for lease</label>
          <div className="span-3"><button type="button" className="btn btn-primary" onClick={addUnits}>Add {gen.floors * gen.perFloor} units</button></div>
        </div>
      )}
    </Modal>
  )
}
