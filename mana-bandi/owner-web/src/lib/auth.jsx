import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { api, session } from './api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => (session.getToken() ? session.getUser() : null))

  const login = useCallback(async (email, password, otp) => {
    const res = await api.login(email, password, otp)
    session.save(res.token, res.user)
    setUser(res.user)
    return res.user
  }, [])

  const logout = useCallback(() => { session.clear(); setUser(null) }, [])

  const value = useMemo(() => ({
    user,
    login,
    logout,
    isAuthenticated: !!user,
    isOwner: user?.role === 'owner',
  }), [user, login, logout])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
