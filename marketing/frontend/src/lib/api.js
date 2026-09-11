const TOKEN_KEY = 'marketing.token'
const USER_KEY = 'marketing.user'
const API_URL_KEY = 'marketing.apiUrl'

/** Build-time API URL (Netlify env var VITE_API_URL). Empty in local dev (Vite proxy handles /api). */
export const BUILD_API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '')

/** Runtime override: lets an admin point a deployed frontend at their API without rebuilding. */
export const apiUrl = {
  get: () => { try { return (localStorage.getItem(API_URL_KEY) || '').replace(/\/+$/, '') } catch { return '' } },
  set: (url) => { try { url ? localStorage.setItem(API_URL_KEY, url.trim().replace(/\/+$/, '')) : localStorage.removeItem(API_URL_KEY) } catch { /* ignore */ } },
  effective: () => apiUrl.get() || BUILD_API_URL,
  isConfigured: () => !!(apiUrl.get() || BUILD_API_URL) || import.meta.env.DEV,
}

export const auth = {
  getToken: () => { try { return localStorage.getItem(TOKEN_KEY) } catch { return null } },
  getUser: () => {
    try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null') } catch { return null }
  },
  save: (token, user) => {
    try { localStorage.setItem(TOKEN_KEY, token); localStorage.setItem(USER_KEY, JSON.stringify(user)) } catch { /* ignore */ }
  },
  updateUser: (user) => { try { localStorage.setItem(USER_KEY, JSON.stringify(user)) } catch { /* ignore */ } },
  clear: () => {
    try { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY) } catch { /* ignore */ }
  },
}

export class ApiError extends Error {
  constructor(message, status, details) {
    super(message)
    this.status = status
    this.details = details
  }
}

let onUnauthorized = () => {}
export function setUnauthorizedHandler(fn) { onUnauthorized = fn }

function buildUrl(path, query) {
  const url = new URL(apiUrl.effective() + path, window.location.origin)
  if (query) Object.entries(query).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v)
  })
  return url
}

async function request(method, path, body, { query } = {}) {
  const url = buildUrl(path, query)
  const headers = { Accept: 'application/json' }
  const token = auth.getToken()
  if (token) headers.Authorization = `Bearer ${token}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  let res
  try {
    res = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
  } catch {
    throw new ApiError('Cannot reach the server. Check your connection or the API URL.', 0)
  }

  if (res.status === 401 && !path.startsWith('/api/auth/login')) {
    auth.clear()
    onUnauthorized()
    throw new ApiError('Session expired. Please sign in again.', 401)
  }

  if (res.status === 204) return null

  const text = await res.text()
  const contentType = res.headers.get('content-type') || ''
  let data = null
  if (!contentType.includes('json')) {
    const where = apiUrl.effective() || window.location.origin
    throw new ApiError(`No API found at ${where}. Check the API server URL (set VITE_API_URL, or use "Change API server" on the login page).`, res.status)
  }
  try { data = text ? JSON.parse(text) : null } catch { data = null }

  if (!res.ok) {
    let message = data?.message || data?.title || `Request failed (${res.status})`
    if (data?.errors) {
      const first = Object.values(data.errors).flat()[0]
      if (first) message = first
    }
    throw new ApiError(message, res.status, data)
  }
  return data
}

/** Fetches a binary resource with the auth header and returns an object URL (for lead photos). */
const blobCache = new Map()
export async function authBlobUrl(path) {
  if (blobCache.has(path)) return blobCache.get(path)
  const p = (async () => {
    const headers = {}
    const token = auth.getToken()
    if (token) headers.Authorization = `Bearer ${token}`
    const res = await fetch(buildUrl(path), { headers })
    if (!res.ok) throw new ApiError('Image not available', res.status)
    return URL.createObjectURL(await res.blob())
  })()
  blobCache.set(path, p)
  p.catch(() => blobCache.delete(path))
  return p
}
export function forgetBlob(path) { blobCache.delete(path) }

export async function downloadFile(path, query, filename) {
  const headers = {}
  const token = auth.getToken()
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(buildUrl(path, query), { headers })
  if (!res.ok) throw new ApiError(`Download failed (${res.status})`, res.status)
  const url = URL.createObjectURL(await res.blob())
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

export const publicLogoUrl = (version) => `${apiUrl.effective()}/api/company/logo${version ? `?v=${version}` : ''}`

export const api = {
  health: () => request('GET', '/api/health'),
  get: (path, query) => request('GET', path, undefined, { query }),
  post: (path, body) => request('POST', path, body ?? {}),
  put: (path, body) => request('PUT', path, body),
  delete: (path) => request('DELETE', path),

  login: (username, password) => request('POST', '/api/auth/login', { username, password }),
  me: () => request('GET', '/api/auth/me'),
  changePassword: (currentPassword, newPassword) => request('POST', '/api/auth/change-password', { currentPassword, newPassword }),

  company: () => request('GET', '/api/company'),
  settings: () => request('GET', '/api/settings'),
  updateSettings: (data) => request('PUT', '/api/settings', data),
  uploadLogo: (data) => request('POST', '/api/settings/logo', data),
  removeLogo: () => request('DELETE', '/api/settings/logo'),

  dashboard: (query) => request('GET', '/api/dashboard', undefined, { query }),

  projects: (includeInactive = true) => request('GET', '/api/projects', undefined, { query: { includeInactive } }),
  createProject: (data) => request('POST', '/api/projects', data),
  updateProject: (id, data) => request('PUT', `/api/projects/${id}`, data),
  deleteProject: (id) => request('DELETE', `/api/projects/${id}`),

  users: () => request('GET', '/api/users'),
  createUser: (data) => request('POST', '/api/users', data),
  updateUser: (id, data) => request('PUT', `/api/users/${id}`, data),
  resetPassword: (id, newPassword) => request('POST', `/api/users/${id}/reset-password`, { newPassword }),
  deleteUser: (id) => request('DELETE', `/api/users/${id}`),

  leads: (query) => request('GET', '/api/leads', undefined, { query }),
  lead: (id) => request('GET', `/api/leads/${id}`),
  leadSuggestions: () => request('GET', '/api/leads/suggestions'),
  checkMobile: (mobile, excludeId) => request('GET', '/api/leads/check-mobile', undefined, { query: { mobile, excludeId } }),
  createLead: (data, force) => request('POST', `/api/leads${force ? '?force=true' : ''}`, data),
  updateLead: (id, data) => request('PUT', `/api/leads/${id}`, data),
  deleteLead: (id) => request('DELETE', `/api/leads/${id}`),
  addActivity: (id, data) => request('POST', `/api/leads/${id}/activities`, data),
  deleteActivity: (id, activityId) => request('DELETE', `/api/leads/${id}/activities/${activityId}`),
  assignLead: (id, userId, note) => request('POST', `/api/leads/${id}/assign`, { userId, note }),
  addPhotos: (id, photos) => request('POST', `/api/leads/${id}/photos`, { photos }),
  deletePhoto: (id, photoId) => request('DELETE', `/api/leads/${id}/photos/${photoId}`),
  photoPath: (id, photoId, thumb) => `/api/leads/${id}/photos/${photoId}${thumb ? '?thumb=true' : ''}`,
  exportLeads: (query) => downloadFile('/api/leads/export', query, `leads-${new Date().toISOString().slice(0, 10)}.csv`),

  aiStatus: () => request('GET', '/api/ai/status'),
  aiCaptureAssist: (data) => request('POST', '/api/ai/capture-assist', data),
  aiInsight: (id, query) => request('GET', `/api/ai/leads/${id}/insight`, undefined, { query }),
  aiMessage: (id, data) => request('POST', `/api/ai/leads/${id}/message`, data),
  aiBriefing: (refresh) => request('GET', '/api/ai/briefing', undefined, { query: { refresh: refresh ? 'true' : '' } }),

  demoStatus: () => request('GET', '/api/demo'),
  demoSeed: () => request('POST', '/api/demo/seed', {}),
  demoRemove: () => request('DELETE', '/api/demo'),
}
