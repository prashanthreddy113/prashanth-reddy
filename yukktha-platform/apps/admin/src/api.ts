// Thin fetch wrapper. Token + store slug live in localStorage; the API takes the tenant from the JWT.
const TOKEN = 'yk_token', SLUG = 'yk_slug'
export const session = {
  get token() { return localStorage.getItem(TOKEN) },
  get slug() { return localStorage.getItem(SLUG) },
  set(token: string, slug: string) { localStorage.setItem(TOKEN, token); localStorage.setItem(SLUG, slug) },
  clear() { localStorage.removeItem(TOKEN); localStorage.removeItem(SLUG) },
}

export async function api<T = any>(path: string, opts: { method?: string; body?: any; form?: FormData } = {}): Promise<T> {
  const headers: Record<string, string> = {}
  if (session.token) headers.Authorization = `Bearer ${session.token}`
  if (session.slug) headers['X-Store-Slug'] = session.slug
  if (opts.body) headers['Content-Type'] = 'application/json'
  const res = await fetch(path, { method: opts.method ?? (opts.body || opts.form ? 'POST' : 'GET'), headers, body: opts.form ?? (opts.body ? JSON.stringify(opts.body) : undefined) })
  if (res.status === 401 && !path.startsWith('/api/auth')) { session.clear(); location.href = '/login'; throw new Error('unauthorized') }
  if (res.status === 204) return undefined as T
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`)
  return data
}

export const inr = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN')
