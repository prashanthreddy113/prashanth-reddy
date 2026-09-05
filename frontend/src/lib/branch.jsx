import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api } from './api'

const KEY = 'studyroom.branch'
const BranchContext = createContext(null)

/** Holds the list of branches and the admin's current selection ('all' or a branch id). */
export function BranchProvider({ children }) {
  const [branches, setBranches] = useState([])
  const [loaded, setLoaded] = useState(false)
  const [selected, setSelectedState] = useState(() => {
    try { return localStorage.getItem(KEY) || 'all' } catch { return 'all' }
  })

  const reload = useCallback(async () => {
    try { setBranches(await api.branches(true)) } catch { setBranches([]) }
    finally { setLoaded(true) }
  }, [])

  useEffect(() => { reload() }, [reload])

  // If the remembered branch disappeared, fall back to "all".
  useEffect(() => {
    if (loaded && selected !== 'all' && !branches.some((b) => String(b.id) === String(selected))) setSelectedState('all')
  }, [loaded, branches, selected])

  const setSelected = useCallback((v) => {
    setSelectedState(v)
    try { localStorage.setItem(KEY, String(v)) } catch { /* ignore */ }
  }, [])

  const value = useMemo(() => {
    const branchId = selected === 'all' ? null : Number(selected)
    const current = branchId ? branches.find((b) => b.id === branchId) || null : null
    return {
      branches, loaded, selected, setSelected, branchId, current, reload,
      activeBranches: branches.filter((b) => b.isActive),
      multi: branches.length > 1,
    }
  }, [branches, loaded, selected, setSelected, reload])

  return <BranchContext.Provider value={value}>{children}</BranchContext.Provider>
}

export function useBranch() {
  const ctx = useContext(BranchContext)
  if (!ctx) throw new Error('useBranch must be used inside BranchProvider')
  return ctx
}
