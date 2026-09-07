// Which shop is this? In dev VITE_STORE_SLUG decides. In production the storefront is one static site served for
// every {slug}.<root domain> and for custom domains, and API calls are proxied (so the API cannot see the original
// host); the page therefore tells the API explicitly.
const env = (import.meta as any).env ?? {}
const ROOT = (env.VITE_ROOT_DOMAIN as string | undefined) || 'yukktha.in'
const host = location.hostname
const slug = (env.VITE_STORE_SLUG as string | undefined)
  || (host.endsWith('.' + ROOT) ? host.slice(0, -(ROOT.length + 1)).replace(/^www\./, '') : undefined)
const customDomain = !slug && !/^(localhost|127\.|.*\.netlify\.app$)/.test(host) ? host.replace(/^www\./, '') : undefined
export async function api<T = any>(path: string, body?: any): Promise<T> {
  const headers: Record<string, string> = {}
  if (slug) headers['X-Store-Slug'] = slug
  else if (customDomain) headers['X-Store-Domain'] = customDomain
  if (body) headers['Content-Type'] = 'application/json'
  const res = await fetch(path, { method: body ? 'POST' : 'GET', headers, body: body ? JSON.stringify(body) : undefined })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw Object.assign(new Error(data.error || 'Request failed'), { status: res.status, data })
  return data
}
export const inr = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN')

// Cart lives in memory + sessionStorage; no accounts for customers.
export type CartLine = { variantId: string; productName: string; variantLabel?: string; price: number; qty: number; image?: string }
const KEY = 'yk_cart'
export const cart = {
  get(): CartLine[] { try { return JSON.parse(sessionStorage.getItem(KEY) || '[]') } catch { return [] } },
  set(lines: CartLine[]) { sessionStorage.setItem(KEY, JSON.stringify(lines)); window.dispatchEvent(new Event('cart')) },
  add(line: CartLine) { const c = cart.get(); const ex = c.find(l => l.variantId === line.variantId); if (ex) ex.qty += line.qty; else c.push(line); cart.set(c) },
  clear() { cart.set([]) },
}
