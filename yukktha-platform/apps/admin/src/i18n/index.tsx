import { createContext, useContext, useState, ReactNode } from 'react'
import en from './en.json'
import te from './te.json'

type Lang = 'en' | 'te'
const dict: Record<Lang, Record<string, string>> = { en, te }
const Ctx = createContext<{ lang: Lang; t: (k: string) => string; setLang: (l: Lang) => void }>({ lang: 'te', t: k => k, setLang: () => {} })

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>((localStorage.getItem('lang') as Lang) || 'te')
  const setLang = (l: Lang) => { localStorage.setItem('lang', l); setLangState(l); document.documentElement.lang = l }
  const t = (k: string) => dict[lang][k] ?? dict.en[k] ?? k
  return <Ctx.Provider value={{ lang, t, setLang }}>{children}</Ctx.Provider>
}
export const useT = () => useContext(Ctx)
