import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api, auth as store, setUnauthorizedHandler } from './api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => (store.getToken() ? store.getUser() : null))

  const logout = useCallback(() => { store.clear(); setUser(null) }, [])
  useEffect(() => { setUnauthorizedHandler(logout) }, [logout])

  const login = useCallback(async (email, password) => {
    const res = await api.login(email, password)
    const u = {
      email: res.email, displayName: res.displayName, role: res.role, expiresAt: res.expiresAt,
      operatorId: res.operatorId, operatorName: res.operatorName, communityId: res.communityId, communityName: res.communityName,
    }
    store.save(res.token, u)
    setUser(u)
    return u
  }, [])

  const value = useMemo(() => ({
    user, login, logout, isAuthenticated: !!user,
    role: user?.role, isOperator: user?.role === 'Operator', isRwa: user?.role === 'Rwa', isAdmin: user?.role === 'Admin',
  }), [user, login, logout])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
