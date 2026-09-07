import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useToast } from '../lib/toast'
import { money } from '../lib/format'
import Modal from '../components/Modal'

export default function Admin() {
  const { isAdmin } = useAuth()
  const toast = useToast()
  const [operators, setOperators] = useState([])
  const [users, setUsers] = useState([])
  const [communities, setCommunities] = useState([])
  const [opModal, setOpModal] = useState(null)
  const [userModal, setUserModal] = useState(null)

  const load = () => Promise.all([api.operators(), api.users(), isAdmin ? api.communities(true) : Promise.resolve([])]).then(([o, u, c]) => { setOperators(o); setUsers(u); setCommunities(c) }).catch((e) => toast.error(e.message))
  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const saveOp = async (e) => {
    e.preventDefault()
    const body = { ...opModal, ratePerKl: Number(opModal.ratePerKl) }
    try { if (opModal.id) await api.updateOperator(opModal.id, body); else await api.createOperator(body); toast.success('Saved.'); setOpModal(null); load() } catch (err) { toast.error(err.message) }
  }
  const saveUser = async (e) => {
    e.preventDefault()
    const body = { ...userModal, operatorId: userModal.operatorId ? Number(userModal.operatorId) : null, communityId: userModal.communityId ? Number(userModal.communityId) : null, password: userModal.password || null }
    try { if (userModal.id) await api.updateUser(userModal.id, body); else await api.createUser(body); toast.success('Saved.'); setUserModal(null); load() } catch (err) { toast.error(err.message) }
  }

  return (
    <>
      <div className="card">
        <div className="card-head"><h2>Operators</h2>{isAdmin && <button className="btn primary sm" onClick={() => setOpModal({ name: '', phone: '', gstin: '', address: '', ratePerKl: 550, isActive: true })}>+ Add operator</button>}</div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Operator</th><th>Phone</th><th>GSTIN</th><th className="num">Rate</th><th className="num">Tankers</th><th className="num">Devices</th><th></th></tr></thead>
            <tbody>
              {operators.map((o) => (
                <tr key={o.id}><td className="primary">{o.name}{!o.isActive && <span className="chip" style={{ marginLeft: 6 }}>inactive</span>}</td><td>{o.phone || '—'}</td><td className="mono">{o.gstin || '—'}</td><td className="num">{money(o.ratePerKl)}/kL</td><td className="num">{o.tankers}</td><td className="num">{o.devices}</td><td className="right"><button className="btn sm" onClick={() => setOpModal({ ...o })}>Edit</button></td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="card">
        <div className="card-head"><h2>Logins</h2><button className="btn primary sm" onClick={() => setUserModal({ email: '', password: '', displayName: '', phone: '', role: isAdmin ? 'Rwa' : 'Operator', operatorId: operators[0]?.id || '', communityId: communities[0]?.id || '', isActive: true })}>+ Add login</button></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Scope</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}><td className="primary">{u.displayName}<div className="secondary">{u.phone}</div></td><td>{u.email}</td><td>{u.role === 'Rwa' ? 'RWA' : u.role}</td><td>{u.operatorName || u.communityName || '—'}</td><td>{u.isActive ? <span className="badge green">Active</span> : <span className="badge grey">Disabled</span>}</td><td className="right"><button className="btn sm" onClick={() => setUserModal({ ...u, password: '', operatorId: u.operatorId || '', communityId: u.communityId || '' })}>Edit</button></td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {opModal && (
        <Modal title={opModal.id ? opModal.name : 'Add operator'} onClose={() => setOpModal(null)}>
          <form onSubmit={saveOp}>
            <div className="form-grid">
              <div className="field full"><label>Company name</label><input value={opModal.name} onChange={(e) => setOpModal({ ...opModal, name: e.target.value })} required /></div>
              <div className="field"><label>Phone</label><input value={opModal.phone || ''} onChange={(e) => setOpModal({ ...opModal, phone: e.target.value })} /></div>
              <div className="field"><label>GSTIN</label><input value={opModal.gstin || ''} onChange={(e) => setOpModal({ ...opModal, gstin: e.target.value })} /></div>
              <div className="field full"><label>Address</label><input value={opModal.address || ''} onChange={(e) => setOpModal({ ...opModal, address: e.target.value })} /></div>
              <div className="field"><label>Default rate per kL (₹)</label><input type="number" step="1" value={opModal.ratePerKl} onChange={(e) => setOpModal({ ...opModal, ratePerKl: e.target.value })} required /></div>
              {isAdmin && <div className="field"><label><input type="checkbox" checked={opModal.isActive} onChange={(e) => setOpModal({ ...opModal, isActive: e.target.checked })} /> Active</label></div>}
            </div>
            <div className="form-actions"><button type="button" className="btn" onClick={() => setOpModal(null)}>Cancel</button><button className="btn primary" type="submit">Save</button></div>
          </form>
        </Modal>
      )}
      {userModal && (
        <Modal title={userModal.id ? userModal.email : 'Add login'} onClose={() => setUserModal(null)}>
          <form onSubmit={saveUser}>
            <div className="form-grid">
              <div className="field"><label>Name</label><input value={userModal.displayName} onChange={(e) => setUserModal({ ...userModal, displayName: e.target.value })} required /></div>
              <div className="field"><label>Phone</label><input value={userModal.phone || ''} onChange={(e) => setUserModal({ ...userModal, phone: e.target.value })} /></div>
              <div className="field"><label>Email</label><input type="email" value={userModal.email} onChange={(e) => setUserModal({ ...userModal, email: e.target.value })} required disabled={!!userModal.id} /></div>
              <div className="field"><label>{userModal.id ? 'New password (blank = keep)' : 'Password'}</label><input type="password" value={userModal.password} onChange={(e) => setUserModal({ ...userModal, password: e.target.value })} required={!userModal.id} minLength="6" /></div>
              {isAdmin && <>
                <div className="field"><label>Role</label><select value={userModal.role} onChange={(e) => setUserModal({ ...userModal, role: e.target.value })}><option value="Rwa">RWA</option><option value="Operator">Operator</option><option value="Admin">Admin</option></select></div>
                {userModal.role === 'Operator' && <div className="field"><label>Operator</label><select value={userModal.operatorId} onChange={(e) => setUserModal({ ...userModal, operatorId: e.target.value })} required>{operators.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></div>}
                {userModal.role === 'Rwa' && <div className="field"><label>Community</label><select value={userModal.communityId} onChange={(e) => setUserModal({ ...userModal, communityId: e.target.value })} required>{communities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>}
              </>}
              <div className="field full"><label><input type="checkbox" checked={userModal.isActive} onChange={(e) => setUserModal({ ...userModal, isActive: e.target.checked })} /> Active</label></div>
            </div>
            <div className="form-actions"><button type="button" className="btn" onClick={() => setUserModal(null)}>Cancel</button><button className="btn primary" type="submit">Save</button></div>
          </form>
        </Modal>
      )}
    </>
  )
}
