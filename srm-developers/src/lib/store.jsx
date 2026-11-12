import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { buildSeed } from './seed'
import { costSheet, planFor } from './pricing'
import { todayISO, uid } from './format'

// All data lives in the browser (localStorage) so the site runs with no
// backend. Swap load/save for API calls to go multi-user.
const KEY = 'srm-developers-data-v1'
const StoreCtx = createContext(null)

function load() {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const d = JSON.parse(raw)
      if (d?.version === 1) return d
    }
  } catch { /* ignore corrupt storage */ }
  return buildSeed()
}

export function StoreProvider({ children }) {
  const [data, setRaw] = useState(load)
  const [toasts, setToasts] = useState([])
  const ref = useRef(data)

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(data)) } catch { /* quota */ }
  }, [data])

  const toast = useCallback((text, kind = 'ok') => {
    const id = uid('t')
    setToasts((t) => [...t, { id, text, kind }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200)
  }, [])

  const api = useMemo(() => {
    // Apply a change synchronously so actions can return what they created.
    const setData = (fn) => {
      const next = typeof fn === 'function' ? fn(ref.current) : fn
      ref.current = next
      setRaw(next)
    }
    const add = (col, item) => {
      const rec = { id: uid(col.slice(0, 3)), ...item }
      setData((d) => ({ ...d, [col]: [rec, ...d[col]] }))
      return rec
    }
    const update = (col, id, patch) =>
      setData((d) => ({ ...d, [col]: d[col].map((x) => (x.id === id ? { ...x, ...(typeof patch === 'function' ? patch(x) : patch) } : x)) }))
    const remove = (col, id) => setData((d) => ({ ...d, [col]: d[col].filter((x) => x.id !== id) }))

    function submitEnquiry(form) {
      return api_.submitEnquiry(form)
    }
    const api_ = {
      add, update, remove,
      setSettings: (patch) => setData((d) => ({ ...d, settings: { ...d.settings, ...patch } })),
      reset: () => setData(buildSeed()),
      replaceAll: (next) => setData(next),

      /** Public enquiry → CRM lead (dedupes by phone: adds a note instead). */
      submitEnquiry(form) {
        const at = new Date().toISOString()
        let lead
        setData((d) => {
          const existing = d.leads.find((l) => l.phone.replace(/\D/g, '').slice(-10) === String(form.phone).replace(/\D/g, '').slice(-10))
          const note = { at, by: 'Website', text: form.message ? `${form.subject || 'Enquiry'}: ${form.message}` : form.subject || 'Website enquiry' }
          if (existing) {
            lead = existing
            return { ...d, leads: d.leads.map((l) => (l.id === existing.id ? { ...l, notes: [note, ...l.notes], followUp: todayISO(), stage: l.stage === 'Lost' ? 'New' : l.stage } : l)) }
          }
          const p = d.projects.find((x) => x.id === form.projectId)
          lead = {
            id: uid('ld'), name: form.name, phone: form.phone, email: form.email || '', projectId: form.projectId || '',
            config: form.config || '', budget: form.budget || '', source: form.source || 'Website', stage: 'New',
            assignedTo: p?.category === 'Commercial' ? 't3' : 't2', purpose: form.purpose || '', followUp: todayISO(),
            createdAt: todayISO(), rating: 'Warm', notes: [note],
          }
          return { ...d, leads: [lead, ...d.leads] }
        })
        return lead
      },

      scheduleVisit(form) {
        const lead = submitEnquiry({ ...form, subject: `Site visit request for ${form.date} ${form.time}` })
        setData((d) => {
          const l = d.leads.find((x) => x.phone === form.phone) || lead
          return {
            ...d,
            leads: d.leads.map((x) => (x.id === l?.id && ['New', 'Contacted'].includes(x.stage) ? { ...x, stage: 'Site visit' } : x)),
            visits: [{ id: uid('sv'), leadId: l?.id, name: form.name, phone: form.phone, projectId: form.projectId, date: form.date, time: form.time, status: 'Scheduled', agent: l?.assignedTo || 't2', pickup: !!form.pickup, feedback: '' }, ...d.visits],
          }
        })
      },

      createBooking({ unitId, customer, date, discount = 0, partnerId = null, salesPerson, loan = null, leadId }) {
        let booking
        setData((d) => {
          const u = d.units.find((x) => x.id === unitId)
          const p = d.projects.find((x) => x.id === u.projectId)
          let cust = d.customers.find((c) => c.phone === customer.phone)
          const customers = cust ? d.customers : [{ id: uid('c'), createdAt: date, ...customer }, ...d.customers]
          cust = cust || customers[0]
          const cs = costSheet(u, p, d.settings.taxes, Number(discount) || 0)
          const next = Math.max(1000, ...d.bookings.map((b) => Number(b.code.split('-').pop()) || 0)) + 1
          booking = {
            id: uid('b'), code: `SRM-BK-${next}`, unitId, projectId: p.id, customerId: cust.id, date,
            plan: planFor(p), discount: Number(discount) || 0, lines: cs.lines, agreementValue: Math.round(cs.agreementValue),
            gst: Math.round(cs.gst), gstPct: cs.gstPct, payable: Math.round(cs.payable), partnerId: partnerId || null,
            commissionPaid: false, loan, status: 'Active', demands: {}, salesPerson,
          }
          return {
            ...d, customers,
            bookings: [booking, ...d.bookings],
            units: d.units.map((x) => (x.id === unitId ? { ...x, status: 'booked' } : x)),
            leads: leadId ? d.leads.map((l) => (l.id === leadId ? { ...l, stage: 'Booked', followUp: '', notes: [{ at: new Date().toISOString(), by: 'CRM', text: `Booked unit ${u.no} (${booking.code}).` }, ...l.notes] } : l)) : d.leads,
          }
        })
        return booking
      },

      cancelBooking(id) {
        setData((d) => {
          const b = d.bookings.find((x) => x.id === id)
          return {
            ...d,
            bookings: d.bookings.map((x) => (x.id === id ? { ...x, status: 'Cancelled' } : x)),
            units: d.units.map((u) => (u.id === b.unitId ? { ...u, status: 'available' } : u)),
          }
        })
      },
    }
    return api_
  }, [])

  const value = useMemo(() => ({ ...data, data, ...api, toast }), [data, api, toast])
  return (
    <StoreCtx.Provider value={value}>
      {children}
      <div className="toasts">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.kind}`}>{t.text}</div>
        ))}
      </div>
    </StoreCtx.Provider>
  )
}

export const useStore = () => useContext(StoreCtx)

/** Visitor-side shortlist / compare (separate from business data). */
const SL = 'srm-shortlist'
export function useShortlist() {
  const [ids, setIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem(SL)) || [] } catch { return [] }
  })
  useEffect(() => {
    const on = () => { try { setIds(JSON.parse(localStorage.getItem(SL)) || []) } catch { /* */ } }
    window.addEventListener('srm-shortlist', on)
    return () => window.removeEventListener('srm-shortlist', on)
  }, [])
  const toggle = (id) => {
    const next = ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id].slice(-4)
    try { localStorage.setItem(SL, JSON.stringify(next)) } catch { /* */ }
    setIds(next)
    window.dispatchEvent(new Event('srm-shortlist'))
  }
  return { ids, toggle, has: (id) => ids.includes(id) }
}

/** Demo-only admin session (client side). Use a real backend for production auth. */
export function useAdminAuth() {
  const [ok, setOk] = useState(() => sessionStorage.getItem('srm-admin') === '1')
  return {
    ok,
    login: (email, pass, settings) => {
      const good = email.trim().toLowerCase() === settings.admin.email.toLowerCase() && pass === settings.admin.password
      if (good) { sessionStorage.setItem('srm-admin', '1'); setOk(true) }
      return good
    },
    logout: () => { sessionStorage.removeItem('srm-admin'); setOk(false) },
  }
}
