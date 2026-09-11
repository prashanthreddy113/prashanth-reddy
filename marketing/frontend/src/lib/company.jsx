import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api, publicLogoUrl } from './api'
import { setCurrency, setCountryCode } from './format'

const CompanyContext = createContext(null)

const DEFAULT = { companyName: 'Field Marketing', tagline: '', hasLogo: false, logoVersion: null, currency: 'INR', defaultCountryCode: '91' }

/** Company name, logo and currency – public info, loaded once and refreshed after Settings changes. */
export function CompanyProvider({ children }) {
  const [company, setCompany] = useState(DEFAULT)

  const refresh = useCallback(async () => {
    try {
      const c = await api.company()
      setCompany(c)
      setCurrency(c.currency)
      setCountryCode(c.defaultCountryCode)
      document.title = c.companyName
      return c
    } catch { return null }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const value = useMemo(() => ({
    ...company,
    logoUrl: company.hasLogo ? publicLogoUrl(company.logoVersion) : null,
    initials: (company.companyName || 'FM').split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase(),
    refresh,
  }), [company, refresh])

  return <CompanyContext.Provider value={value}>{children}</CompanyContext.Provider>
}

export function useCompany() {
  const ctx = useContext(CompanyContext)
  if (!ctx) throw new Error('useCompany must be used inside CompanyProvider')
  return ctx
}
