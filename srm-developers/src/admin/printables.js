// Printable documents (receipt, allotment letter, demand letter) opened in a new window.
import { bookingTotals } from '../lib/pricing'
import { fmtDate, inr, num } from '../lib/format'

const LOGO = `<svg width="54" height="54" viewBox="0 0 64 64"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7c3aed"/><stop offset=".55" stop-color="#ec4899"/><stop offset="1" stop-color="#f59e0b"/></linearGradient></defs><path d="M32 3 61 25v31a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5V25Z" fill="url(#g)"/><circle cx="45" cy="22" r="6" fill="#fde68a"/><rect x="13" y="33" width="10" height="24" rx="1.5" fill="#fff"/><rect x="27" y="22" width="10" height="35" rx="1.5" fill="#fff"/><rect x="41" y="30" width="10" height="27" rx="1.5" fill="#fff"/></svg>`
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

function open(title, body, company) {
  const w = window.open('', '_blank', 'width=820,height=900')
  if (!w) return alert('Please allow pop-ups to print documents.')
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>
    body{font-family:system-ui,Segoe UI,Roboto,sans-serif;color:#1e1b4b;margin:32px;font-size:13px}
    .head{display:flex;gap:14px;align-items:center;border-bottom:4px solid;border-image:linear-gradient(90deg,#7c3aed,#ec4899,#f59e0b) 1;padding-bottom:12px}
    .head h1{margin:0;font-size:22px;letter-spacing:.5px}.head small{color:#64748b}
    h2{font-size:16px;margin:22px 0 8px;color:#7c3aed}table{width:100%;border-collapse:collapse;margin-top:6px}
    td,th{border-bottom:1px solid #e5e7eb;padding:7px 6px;text-align:left}td.n,th.n{text-align:right}
    .tot td{font-weight:800;background:#faf5ff}.muted{color:#64748b}.box{background:#f8fafc;border-radius:8px;padding:12px;margin-top:10px}
    .sign{margin-top:60px;display:flex;justify-content:space-between}.stamp{color:#16a34a;font-weight:800;border:2px solid #16a34a;padding:4px 10px;border-radius:6px;display:inline-block;transform:rotate(-4deg)}
    @media print{button{display:none}}
  </style></head><body>
  <div class="head">${LOGO}<div><h1>SRM DEVELOPERS</h1><small>${esc(company.address)}<br>${esc(company.phone)} · ${esc(company.email)}</small></div></div>
  ${body}
  <p class="muted" style="margin-top:40px">This is a computer-generated document.</p>
  <button onclick="print()" style="margin-top:12px;padding:8px 16px">Print / Save as PDF</button>
  </body></html>`)
  w.document.close()
}

const ctx = (b, s) => ({
  u: s.units.find((x) => x.id === b.unitId),
  p: s.projects.find((x) => x.id === b.projectId),
  c: s.customers.find((x) => x.id === b.customerId),
})

export function printReceipt(pay, s) {
  const b = s.bookings.find((x) => x.id === pay.bookingId)
  const { u, p, c } = ctx(b, s)
  const t = bookingTotals(b, s.payments)
  open(`Receipt ${pay.ref}`, `
    <h2>Payment receipt</h2>
    <p>Receipt no: <b>RCPT-${esc(pay.id.slice(-6).toUpperCase())}</b> &nbsp; Date: <b>${fmtDate(pay.date)}</b></p>
    <div class="box">Received with thanks from <b>${esc(c.name)}</b> the sum of <b>${inr(pay.amount)}</b> by ${esc(pay.mode)} (ref ${esc(pay.ref)})
    towards ${esc(pay.note || 'instalment')} for unit <b>${esc(u.no)}</b>, ${esc(p.name)} (booking ${esc(b.code)}).</div>
    <table><tr><td>Total payable</td><td class="n">${inr(b.payable)}</td></tr><tr><td>Total received to date</td><td class="n">${inr(t.paid)}</td></tr><tr class="tot"><td>Balance</td><td class="n">${inr(t.balance)}</td></tr></table>
    <div class="sign"><span class="stamp">PAID</span><span>For SRM Developers<br><br>Authorised signatory</span></div>`, s.settings.company)
}

export function printAllotment(b, s) {
  const { u, p, c } = ctx(b, s)
  const t = bookingTotals(b, s.payments)
  open(`Allotment ${b.code}`, `
    <h2>Allotment letter</h2>
    <p>Date: ${fmtDate(b.date)} &nbsp; Booking ID: <b>${esc(b.code)}</b></p>
    <p>Dear ${esc(c.name)},<br>We are delighted to allot you the following property in <b>${esc(p.name)}</b> (TS RERA ${esc(p.rera)}), Narsingi, Hyderabad:</p>
    <table><tr><td>Unit</td><td>${esc(u.no)} · ${esc(u.tower)}</td></tr><tr><td>Type</td><td>${esc(u.config)}</td></tr><tr><td>Area</td><td>${num(u.area)} ${esc(p.areaUnit)}</td></tr><tr><td>Facing</td><td>${esc(u.facing)}</td></tr></table>
    <h2>Cost sheet</h2><table>${b.lines.map(([l, v]) => `<tr><td>${esc(l)}</td><td class="n">${inr(v)}</td></tr>`).join('')}
    <tr class="tot"><td>Agreement value</td><td class="n">${inr(b.agreementValue)}</td></tr>
    <tr><td>GST @ ${b.gstPct}%</td><td class="n">${inr(b.gst)}</td></tr><tr class="tot"><td>Total payable</td><td class="n">${inr(b.payable)}</td></tr></table>
    <p class="muted">Stamp duty, registration charges and maintenance deposit are payable separately at registration.</p>
    <h2>Payment schedule</h2><table><tr><th>Milestone</th><th class="n">%</th><th class="n">Amount</th><th>Due</th><th>Status</th></tr>
    ${t.schedule.map((m) => `<tr><td>${esc(m.name)}</td><td class="n">${m.pct}%</td><td class="n">${inr(m.amount)}</td><td>${fmtDate(m.dueDate)}</td><td>${m.status}</td></tr>`).join('')}</table>
    <div class="sign"><span>Customer signature</span><span>For SRM Developers<br><br>Authorised signatory</span></div>`, s.settings.company)
}

export function printDemand(b, m, s) {
  const { u, p, c } = ctx(b, s)
  open(`Demand ${b.code}`, `
    <h2>Demand letter</h2><p>Date: ${fmtDate(new Date().toISOString())} &nbsp; Booking: <b>${esc(b.code)}</b></p>
    <p>Dear ${esc(c.name)},<br>Construction of <b>${esc(p.name)}</b> has reached the stage "<b>${esc(m.name)}</b>". As per your payment plan for unit <b>${esc(u.no)}</b>, please remit the instalment below on or before <b>${fmtDate(m.dueDate)}</b>.</p>
    <table><tr><td>${esc(m.name)} (${m.pct}%)</td><td class="n">${inr(m.amount)}</td></tr><tr><td>Already received</td><td class="n">${inr(m.paid)}</td></tr><tr class="tot"><td>Amount due</td><td class="n">${inr(m.balance)}</td></tr></table>
    <p class="muted">Payments delayed beyond the due date attract interest as per the agreement of sale. Kindly quote ${esc(b.code)} with your NEFT/RTGS.</p>
    <div class="sign"><span></span><span>For SRM Developers<br><br>CRM Team</span></div>`, s.settings.company)
}
