import { useRef, useState } from 'react'
import { useStore } from '../lib/store'
import { Field } from '../components/ui'
import { uid } from '../lib/format'

export default function Settings() {
  const s = useStore()
  const [c, setC] = useState(s.settings.company)
  const [tx, setTx] = useState(s.settings.taxes)
  const [admin, setAdmin] = useState({ ...s.settings.admin, password: '' })
  const [member, setMember] = useState({ name: '', role: '', phone: '' })
  const file = useRef()
  const exportData = () => {
    const blob = new Blob([JSON.stringify(s.data, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `srm-developers-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
  }
  const importData = (e) => {
    const f = e.target.files[0]
    if (!f) return
    f.text().then((t) => {
      try {
        const d = JSON.parse(t)
        if (d.version !== 1 || !Array.isArray(d.projects)) throw new Error('bad')
        s.replaceAll(d); s.toast('Backup restored')
      } catch { s.toast('That file is not a valid SRM backup', 'err') }
    })
  }
  return (
    <div className="page">
      <div className="page-head"><div><h1>Settings</h1><p className="muted">Company profile, taxes, team, login and data.</p></div></div>
      <div className="settings-grid">
        <form className="card pad form-grid" onSubmit={(e) => { e.preventDefault(); s.setSettings({ company: c }); s.toast('Company profile saved') }}>
          <h3 className="span-2">Company profile (shown on website)</h3>
          {[['name', 'Company name'], ['tagline', 'Tagline'], ['phone', 'Phone'], ['whatsapp', 'WhatsApp number (with 91)'], ['email', 'Email'], ['hours', 'Office hours']].map(([k, l]) => <Field key={k} label={l}><input value={c[k]} onChange={(e) => setC({ ...c, [k]: e.target.value })} /></Field>)}
          <Field label="Address" span={2}><textarea rows={2} value={c.address} onChange={(e) => setC({ ...c, address: e.target.value })} /></Field>
          <button className="btn btn-primary span-2">Save profile</button>
        </form>
        <form className="card pad form-grid" onSubmit={(e) => { e.preventDefault(); s.setSettings({ taxes: Object.fromEntries(Object.entries(tx).map(([k, v]) => [k, Number(v)])) }); s.toast('Tax rates saved') }}>
          <h3 className="span-2">Taxes & government charges (%)</h3>
          {[['gstResidential', 'GST – residential (under construction)'], ['gstCommercial', 'GST – commercial (under construction)'], ['stampDuty', 'Stamp duty'], ['transferDuty', 'Transfer duty'], ['registration', 'Registration fee']].map(([k, l]) => <Field key={k} label={l}><input type="number" step="0.05" value={tx[k]} onChange={(e) => setTx({ ...tx, [k]: e.target.value })} /></Field>)}
          <p className="span-2 small muted">Defaults are indicative Telangana rates — verify with your auditor before publishing. Changes apply to new cost sheets and bookings.</p>
          <button className="btn btn-primary span-2">Save rates</button>
        </form>
        <div className="card pad">
          <h3>Sales & CRM team</h3>
          <ul className="list">{s.settings.team.map((t) => (
            <li key={t.id}><b>{t.name}</b><small>{t.role} · {t.phone}</small>
              <button className="btn btn-sm btn-ghost" onClick={() => s.setSettings({ team: s.settings.team.filter((x) => x.id !== t.id) })} disabled={s.settings.team.length <= 1}>Remove</button></li>
          ))}</ul>
          <form className="form-grid mt" onSubmit={(e) => { e.preventDefault(); if (!member.name) return; s.setSettings({ team: [...s.settings.team, { ...member, id: uid('t') }] }); setMember({ name: '', role: '', phone: '' }) }}>
            <Field label="Name"><input value={member.name} onChange={(e) => setMember({ ...member, name: e.target.value })} /></Field>
            <Field label="Role"><input value={member.role} onChange={(e) => setMember({ ...member, role: e.target.value })} /></Field>
            <Field label="Phone"><input value={member.phone} onChange={(e) => setMember({ ...member, phone: e.target.value })} /></Field>
            <button className="btn btn-ghost">+ Add member</button>
          </form>
        </div>
        <form className="card pad form-grid" onSubmit={(e) => { e.preventDefault(); if (admin.password.length < 6) return s.toast('Password must be at least 6 characters', 'err'); s.setSettings({ admin }); setAdmin({ ...admin, password: '' }); s.toast('Login updated') }}>
          <h3 className="span-2">Admin login</h3>
          <Field label="Email"><input value={admin.email} onChange={(e) => setAdmin({ ...admin, email: e.target.value })} /></Field>
          <Field label="New password"><input type="password" value={admin.password} onChange={(e) => setAdmin({ ...admin, password: e.target.value })} /></Field>
          <p className="span-2 small muted">This demo stores data and the login in this browser only. Connect a backend before putting real customer data online.</p>
          <button className="btn btn-primary span-2">Update login</button>
        </form>
        <div className="card pad">
          <h3>Data</h3>
          <p className="small muted">Back up everything (projects, units, leads, bookings, payments, leases) to a JSON file, or restore one.</p>
          <div className="row gap wrap-row mt">
            <button className="btn btn-ghost" onClick={exportData}>⬇ Export backup</button>
            <button className="btn btn-ghost" onClick={() => file.current.click()}>⬆ Restore backup</button>
            <input type="file" accept="application/json" ref={file} hidden onChange={importData} />
            <button className="btn btn-danger" onClick={() => confirm('Reset ALL data to the demo data? This cannot be undone.') && (s.reset(), s.toast('Demo data restored'))}>Reset demo data</button>
          </div>
        </div>
      </div>
    </div>
  )
}
