const TOKEN_KEY = 'aquaproof.token'
const USER_KEY = 'aquaproof.user'
const API_URL_KEY = 'aquaproof.apiUrl'

/** Build-time API URL (Netlify env var VITE_API_URL). Empty in local dev (Vite proxy handles /api). */
export const BUILD_API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '')

/** Runtime override so a deployed frontend can be pointed at any API without a rebuild. */
export const apiUrl = {
  get: () => { try { return (localStorage.getItem(API_URL_KEY) || '').replace(/\/+$/, '') } catch { return '' } },
  set: (url) => { try { url ? localStorage.setItem(API_URL_KEY, url.trim().replace(/\/+$/, '')) : localStorage.removeItem(API_URL_KEY) } catch { /* ignore */ } },
  effective: () => apiUrl.get() || BUILD_API_URL,
  isConfigured: () => !!(apiUrl.get() || BUILD_API_URL) || import.meta.env.DEV,
}

export const auth = {
  getToken: () => localStorage.getItem(TOKEN_KEY),
  getUser: () => { try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null') } catch { return null } },
  save: (token, user) => { localStorage.setItem(TOKEN_KEY, token); localStorage.setItem(USER_KEY, JSON.stringify(user)) },
  clear: () => { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY) },
}

export class ApiError extends Error {
  constructor(message, status, details) { super(message); this.status = status; this.details = details }
}

let onUnauthorized = () => {}
export function setUnauthorizedHandler(fn) { onUnauthorized = fn }

async function request(method, path, body, { query, form } = {}) {
  const url = new URL(apiUrl.effective() + path, window.location.origin)
  if (query) Object.entries(query).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v) })

  const headers = { Accept: 'application/json' }
  const token = auth.getToken()
  if (token) headers.Authorization = `Bearer ${token}`
  if (body !== undefined && !form) headers['Content-Type'] = 'application/json'

  let res
  try {
    res = await fetch(url, { method, headers, body: form ? body : body === undefined ? undefined : JSON.stringify(body) })
  } catch {
    throw new ApiError('Cannot reach the server. Check your connection or the API URL.', 0)
  }

  if (res.status === 401 && !path.startsWith('/api/auth/login')) {
    auth.clear(); onUnauthorized()
    throw new ApiError('Session expired. Please sign in again.', 401)
  }
  if (res.status === 204) return null

  const text = await res.text()
  const contentType = res.headers.get('content-type') || ''
  if (!contentType.includes('json')) {
    const where = apiUrl.effective() || window.location.origin
    throw new ApiError(`No API found at ${where}. Check the API server URL (set VITE_API_URL, or use "Change API server" on the login page).`, res.status)
  }
  let data = null
  try { data = text ? JSON.parse(text) : null } catch { data = null }
  if (!res.ok) {
    let message = data?.message || data?.title || `Request failed (${res.status})`
    if (data?.errors) { const first = Object.values(data.errors).flat()[0]; if (first) message = first }
    throw new ApiError(message, res.status, data)
  }
  return data
}

export const api = {
  health: () => request('GET', '/api/health'),
  login: (email, password) => request('POST', '/api/auth/login', { email, password }),
  me: () => request('GET', '/api/auth/me'),
  changePassword: (currentPassword, newPassword) => request('POST', '/api/auth/change-password', { currentPassword, newPassword }),

  dashboard: () => request('GET', '/api/dashboard', undefined, { query: { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone } }),

  deliveries: (query) => request('GET', '/api/deliveries', undefined, { query }),
  delivery: (id) => request('GET', `/api/deliveries/${id}`),
  assignCommunity: (id, communityId) => request('PUT', `/api/deliveries/${id}/community`, { communityId }),
  deliveryNotes: (id, notes) => request('PUT', `/api/deliveries/${id}/notes`, { notes }),
  closeDelivery: (id) => request('POST', `/api/deliveries/${id}/close`, {}),
  verifyDelivery: (id) => request('POST', `/api/deliveries/${id}/verify`, {}),
  disputeDelivery: (id, reason) => request('POST', `/api/deliveries/${id}/dispute`, { reason }),
  uploadSealPhoto: (id, file) => { const fd = new FormData(); fd.append('photo', file); return request('POST', `/api/deliveries/${id}/seal-photo`, fd, { form: true }) },
  sealPhotoUrl: (id) => `${apiUrl.effective()}/api/deliveries/${id}/seal-photo`,

  disputes: (query) => request('GET', '/api/disputes', undefined, { query }),
  resolveDispute: (id, data) => request('POST', `/api/disputes/${id}/resolve`, data),

  tankers: (query) => request('GET', '/api/fleet/tankers', undefined, { query }),
  createTanker: (data, operatorId) => request('POST', '/api/fleet/tankers', data, { query: { operatorId } }),
  updateTanker: (id, data) => request('PUT', `/api/fleet/tankers/${id}`, data),
  devices: (query) => request('GET', '/api/fleet/devices', undefined, { query }),
  registerDevice: (data, operatorId) => request('POST', '/api/fleet/devices', data, { query: { operatorId } }),
  updateDevice: (id, data) => request('PUT', `/api/fleet/devices/${id}`, data),
  rotateDeviceKey: (id) => request('POST', `/api/fleet/devices/${id}/rotate-key`, {}),

  bookings: (query) => request('GET', '/api/bookings', undefined, { query }),
  createBooking: (data, communityId) => request('POST', '/api/bookings', data, { query: { communityId } }),
  acceptBooking: (id, data) => request('POST', `/api/bookings/${id}/accept`, data),
  dispatchBooking: (id) => request('POST', `/api/bookings/${id}/dispatch`, {}),
  cancelBooking: (id) => request('POST', `/api/bookings/${id}/cancel`, {}),

  invoices: (query) => request('GET', '/api/invoices', undefined, { query }),
  invoice: (id) => request('GET', `/api/invoices/${id}`),
  generateInvoice: (data) => request('POST', '/api/invoices/generate', data),
  payInvoice: (id, data) => request('POST', `/api/invoices/${id}/pay`, data),
  markInvoicePaid: (id, data) => request('POST', `/api/invoices/${id}/mark-paid`, data),
  cancelInvoice: (id) => request('POST', `/api/invoices/${id}/cancel`, {}),

  operators: () => request('GET', '/api/operators'),
  createOperator: (data) => request('POST', '/api/operators', data),
  updateOperator: (id, data) => request('PUT', `/api/operators/${id}`, data),
  communities: (includeInactive) => request('GET', '/api/communities', undefined, { query: { includeInactive } }),
  createCommunity: (data) => request('POST', '/api/communities', data),
  updateCommunity: (id, data) => request('PUT', `/api/communities/${id}`, data),
  users: () => request('GET', '/api/users'),
  createUser: (data) => request('POST', '/api/users', data),
  updateUser: (id, data) => request('PUT', `/api/users/${id}`, data),
}
