const TOKEN_KEY = 'studyroom.token'
const USER_KEY = 'studyroom.user'
const API_URL_KEY = 'studyroom.apiUrl'

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
  getToken: () => localStorage.getItem(TOKEN_KEY),
  getUser: () => {
    try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null') } catch { return null }
  },
  save: (token, user) => {
    localStorage.setItem(TOKEN_KEY, token)
    localStorage.setItem(USER_KEY, JSON.stringify(user))
  },
  clear: () => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
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

async function request(method, path, body, { query } = {}) {
  const url = new URL(apiUrl.effective() + path, window.location.origin)
  if (query) Object.entries(query).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v)
  })

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
    // The API always answers with JSON; anything else means we hit a wrong host (e.g. the SPA's own index.html).
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

export const api = {
  health: () => request('GET', '/api/health'),
  get: (path, query) => request('GET', path, undefined, { query }),
  post: (path, body) => request('POST', path, body ?? {}),
  put: (path, body) => request('PUT', path, body),
  delete: (path) => request('DELETE', path),

  login: (username, password) => request('POST', '/api/auth/login', { username, password }),
  changePassword: (currentPassword, newPassword) => request('POST', '/api/auth/change-password', { currentPassword, newPassword }),

  dashboard: (branchId) => request('GET', '/api/dashboard', undefined, { query: { branchId } }),

  branches: (includeInactive = true) => request('GET', '/api/branches', undefined, { query: { includeInactive } }),
  branchSummary: () => request('GET', '/api/branches/summary'),
  createBranch: (data) => request('POST', '/api/branches', data),
  updateBranch: (id, data) => request('PUT', `/api/branches/${id}`, data),
  deleteBranch: (id) => request('DELETE', `/api/branches/${id}`),

  students: (query) => request('GET', '/api/students', undefined, { query }),
  student: (id) => request('GET', `/api/students/${id}`),
  createStudent: (data) => request('POST', '/api/students', data),
  updateStudent: (id, data) => request('PUT', `/api/students/${id}`, data),
  deleteStudent: (id) => request('DELETE', `/api/students/${id}`),
  deactivateStudent: (id) => request('POST', `/api/students/${id}/deactivate`, {}),
  activateStudent: (id, seatNumber) => request('POST', `/api/students/${id}/activate`, {}, { query: { seatNumber } }),
  vacateSeat: (id) => request('POST', `/api/students/${id}/vacate-seat`, {}),
  transferSeat: (id, data) => request('POST', `/api/students/${id}/transfer`, data),
  addPayment: (id, data) => request('POST', `/api/students/${id}/payments`, data),
  deletePayment: (id, paymentId) => request('DELETE', `/api/students/${id}/payments/${paymentId}`),
  renewStudent: (id, data) => request('POST', `/api/students/${id}/renew`, data),

  seats: (branchId) => request('GET', '/api/seats', undefined, { query: { branchId } }),
  seatSummary: (branchId) => request('GET', '/api/seats/summary', undefined, { query: { branchId } }),
  seatSections: (branchId) => request('GET', '/api/seats/sections', undefined, { query: { branchId } }),
  setSeatCapacity: (data) => request('PUT', '/api/seats/capacity', data),
  addSeatSection: (data) => request('POST', '/api/seats/sections', data),
  updateSeatSection: (data) => request('PUT', '/api/seats/sections', data),
  applySeatReservation: (branchId) => request('POST', `/api/seats/apply-reservation?branchId=${branchId}`, {}),
  deleteSeatSection: (branchId, name) => request('DELETE', `/api/seats/sections?branchId=${branchId}&name=${encodeURIComponent(name)}`),
  updateSeat: (id, data) => request('PUT', `/api/seats/${id}`, data),
  deleteSeat: (id) => request('DELETE', `/api/seats/${id}`),

  reminderStatus: () => request('GET', '/api/reminders/status'),
  reminderPreview: () => request('GET', '/api/reminders/preview'),
  reminderRun: () => request('POST', '/api/reminders/run', {}),
  reminderSend: (studentId) => request('POST', `/api/reminders/send/${studentId}`, {}),
  reminderLogs: (query) => request('GET', '/api/reminders/logs', undefined, { query }),

  expenses: (query) => request('GET', '/api/expenses', undefined, { query }),
  expenseSummary: (query) => request('GET', '/api/expenses/summary', undefined, { query }),
  createExpense: (data) => request('POST', '/api/expenses', data),
  updateExpense: (id, data) => request('PUT', `/api/expenses/${id}`, data),
  deleteExpense: (id) => request('DELETE', `/api/expenses/${id}`),

  settings: () => request('GET', '/api/settings'),
  updateSettings: (data) => request('PUT', '/api/settings', data),
}
