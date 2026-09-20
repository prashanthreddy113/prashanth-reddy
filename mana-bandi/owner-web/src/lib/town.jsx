import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api } from './api'
import { useAuth } from './auth'

const TownContext = createContext(null)
const KEY = 'manabandi.town'

/** Global town selector. Owners may pick "all"; town managers are pinned to their own town. */
export function TownProvider({ children }) {
  const { user } = useAuth()
  const [towns, setTowns] = useState([])
  const [townId, setTownIdState] = useState(() => {
    if (user?.role === 'town_manager') return user.townId
    try { return localStorage.getItem(KEY) || 'all' } catch { return 'all' }
  })

  const reload = useCallback(() => api.towns.list().then(setTowns), [])
  useEffect(() => { reload() }, [reload])

  const setTownId = useCallback((id) => {
    if (user?.role === 'town_manager') return
    setTownIdState(id)
    try { localStorage.setItem(KEY, id) } catch { /* ignore */ }
  }, [user])

  const value = useMemo(() => ({
    towns,
    townId,
    setTownId,
    reloadTowns: reload,
    town: towns.find((t) => t.id === townId) || null,
    /** filter helper: does this record belong to the selected town? */
    inTown: (record) => townId === 'all' || record.townId === townId,
    locked: user?.role === 'town_manager',
  }), [towns, townId, setTownId, reload, user])
  return <TownContext.Provider value={value}>{children}</TownContext.Provider>
}

export function useTown() {
  const ctx = useContext(TownContext)
  if (!ctx) throw new Error('useTown must be used inside TownProvider')
  return ctx
}
