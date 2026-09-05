import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api } from './api'

const BranchContext = createContext(null)

/**
 * The app runs a single reading room. This context only resolves the internal branch id the API
 * stores seats and students under; nothing branch-related is shown to the admin.
 */
export function BranchProvider({ children }) {
  const [branches, setBranches] = useState([])
  const [loaded, setLoaded] = useState(false)

  const reload = useCallback(async () => {
    try { setBranches(await api.branches(true)) } catch { setBranches([]) }
    finally { setLoaded(true) }
  }, [])

  useEffect(() => { reload() }, [reload])

  const value = useMemo(() => {
    const first = branches[0] || null
    return {
      branches, loaded, reload,
      branchId: first ? first.id : null,
      current: null,
      selected: first ? String(first.id) : 'all',
      setSelected: () => {},
      activeBranches: branches.filter((b) => b.isActive),
      multi: false,
    }
  }, [branches, loaded, reload])

  return <BranchContext.Provider value={value}>{children}</BranchContext.Provider>
}

export function useBranch() {
  const ctx = useContext(BranchContext)
  if (!ctx) throw new Error('useBranch must be used inside BranchProvider')
  return ctx
}
