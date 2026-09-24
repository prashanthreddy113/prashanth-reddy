/**
 * Real backend client (ManaBandi.Api, see mana-bandi/docs/07-API.md).
 * Used when the portal is built with VITE_API_URL; otherwise api.js serves mock data.
 * Every function mirrors the mock's signature and returns the same JSON shape.
 */
export function createRemoteApi({ baseUrl, session, buildChecks, resolveCommission, ApiError }) {
  let commissionCache = null

  async function http(method, path, { query, body, form } = {}) {
    const url = new URL(baseUrl + path, window.location.origin)
    for (const [k, v] of Object.entries(query || {})) {
      if (v !== undefined && v !== null && v !== '' && v !== 'all') url.searchParams.set(k, v)
    }
    const headers = { Accept: 'application/json' }
    const token = session.getToken()
    if (token) headers.Authorization = `Bearer ${token}`
    let payload
    if (form) payload = form
    else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body) }
    let res
    try {
      res = await fetch(url, { method, headers, body: payload })
    } catch {
      throw new ApiError('Cannot reach the server. Check the internet connection.', 0)
    }
    if (res.status === 401 && path !== '/api/auth/login') {
      session.clear()
      window.location.assign(window.location.pathname.includes('#') ? '#/login' : `${import.meta.env.BASE_URL}login`)
      throw new ApiError('Session expired — please sign in again', 401)
    }
    if (res.status === 204) return null
    const text = await res.text()
    const data = text ? safeJson(text) : null
    if (!res.ok) throw new ApiError(data?.title || data?.detail || `Request failed (${res.status})`, res.status)
    return data
  }
  const safeJson = (t) => { try { return JSON.parse(t) } catch { return null } }
  const get = (p, query) => http('GET', p, { query })
  const post = (p, body) => http('POST', p, { body: body ?? {} })
  const put = (p, body) => http('PUT', p, { body })
  const del = (p) => http('DELETE', p)

  return {
    async login(email, password, otp) { return post('/api/auth/login', { email, password, otp: otp || undefined }) },

    towns: {
      list: () => get('/api/towns'),
      get: (id) => get(`/api/towns/${id}`),
      save: (town) => put(`/api/towns/${town.id}`, town),
      create: (t) => post('/api/towns', t),
    },

    captains: {
      list: ({ townId, vehicleType, status, q } = {}) => get('/api/captains', { town: townId, vehicle: vehicleType, status, q }),
      get: (id) => get(`/api/captains/${id}`),
      create: (data) => post('/api/captains', data),
      runVerification: (docs) => post('/api/captains/verify', docs),
      checks: (c) => {
        const d = c.docs
        const today = new Date().toISOString().slice(0, 10)
        return buildChecks({
          aadhaarOk: !!d.aadhaar?.verifiedVia, verifiedVia: d.aadhaar?.verifiedVia,
          dlValid: (d.dl?.validTill || '') >= today, dlValidTill: d.dl?.validTill, nameScore: d.dl?.nameMatchScore ?? 0,
          rcValid: (d.rc?.validTill || '') >= today, insuranceValid: (d.rc?.insuranceTill || '') >= today, rcValidTill: d.rc?.validTill, insuranceTill: d.rc?.insuranceTill,
          ownerIsCaptain: d.rc?.ownerIsCaptain, consentLetter: d.rc?.consentLetter,
          faceScore: d.selfie?.faceMatchScore ?? 0, liveness: d.selfie?.liveness, police: d.police?.status,
        })
      },
      approve: (id) => post(`/api/captains/${id}/approve`),
      reject: (id, reason) => post(`/api/captains/${id}/reject`, { reason }),
      block: (id, reason) => post(`/api/captains/${id}/block`, { reason }),
      unblock: (id) => post(`/api/captains/${id}/unblock`),
      requestReupload: (id, documents, note) => post(`/api/captains/${id}/request-reupload`, { documents, note }),
      uploadConsentLetter: (id, file) => {
        if (!file) return post(`/api/captains/${id}/documents/consent-letter`)
        const form = new FormData(); form.append('photo', file)
        return http('POST', `/api/captains/${id}/documents/consent-letter`, { form })
      },
      setPolice: (id, status) => http('PATCH', `/api/captains/${id}/police-verification`, { body: { status } }),
    },

    live: {
      captains: (townId) => get('/api/live/captains', { town: townId }),
      requests: (townId) => get('/api/live/requests', { town: townId }),
    },

    dashboard: (townId) => get('/api/admin/dashboard', { town: townId }),

    trips: {
      list: (kind, { townId, from, to, status, service, q } = {}) => get(kind === 'parcel' ? '/api/parcels' : '/api/rides', { town: townId, from, to, status, service, q }),
      get: (id) => get(`/api/${String(id).startsWith('p') ? 'parcels' : 'rides'}/${id}`),
    },

    analytics: (townId, days = 30) => get('/api/admin/analytics', { town: townId, days }),

    settlements: {
      list: (townId) => get('/api/settlements', { town: townId }),
      markPaid: (id, utr) => post(`/api/settlements/${id}/pay`, { utr }),
    },

    commission: {
      async get() { commissionCache = await get('/api/config/commission'); return commissionCache },
      async save(cfg) { commissionCache = await put('/api/config/commission', cfg); return commissionCache },
      async addTownOverride(o) { const r = await post('/api/config/commission/towns', o); commissionCache = null; return r },
      async updateTownOverride(o) { const r = await put(`/api/config/commission/towns/${o.id}`, o); commissionCache = null; return r },
      async deleteTownOverride(id) { const r = await del(`/api/config/commission/towns/${id}`); commissionCache = null; return r ?? { ok: true } },
      // Same resolver the backend runs, applied to the rules last loaded from the server.
      resolve: (args) => resolveCommission(args, commissionCache || undefined),
    },

    settings: {
      company: () => get('/api/admin/settings/company'),
      saveCompany: (data) => put('/api/admin/settings/company', data),
      terms: () => get('/api/admin/terms'),
      publishTerms: (t) => post('/api/admin/terms', t),
      templates: () => get('/api/admin/templates'),
      saveTemplate: (t) => (t.id ? put(`/api/admin/templates/${t.id}`, t) : post('/api/admin/templates', t)),
      users: () => get('/api/admin/users'),
      addUser: (u) => post('/api/admin/users', u),
      removeUser: (id) => del(`/api/admin/users/${id}`),
      audit: () => get('/api/admin/audit', { limit: 200 }),
    },
  }
}
