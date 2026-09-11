import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api, auth as store, setUnauthorizedHandler } from './api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => (store.getToken() ? store.getUser() : null))

  const logout = useCallback(() => {
    store.clear()
    setUser(null)
  }, [])

  useEffect(() => { setUnauthorizedHandler(logout) }, [logout])

  // Refresh the profile (project assignments may have changed since the last login).
  useEffect(() => {
    if (!store.getToken()) return
    api.me().then((u) => { store.updateUser(u); setUser(u) }).catch(() => {})
  }, [])

  const login = useCallback(async (username, password) => {
    const res = await api.login(username, password)
    store.save(res.token, res.user)
    setUser(res.user)
    return res.user
  }, [])

  const refresh = useCallback(async () => {
    const u = await api.me()
    store.updateUser(u)
    setUser(u)
    return u
  }, [])

  const value = useMemo(() => ({
    user, login, logout, refresh,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'Admin',
  }), [user, login, logout, refresh])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
