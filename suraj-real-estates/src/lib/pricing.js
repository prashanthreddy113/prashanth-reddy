import { addDays, daysBetween, todayISO } from './format'

// Payment plan templates. dueDays = days after booking date.
export const PLANS = {
  clp: {
    name: 'Construction-linked plan',
    steps: [
      ['Booking amount', 10, 0],
      ['On agreement of sale', 10, 30],
      ['On completion of foundation', 15, 120],
      ['On completion of 5th slab', 10, 240],
      ['On completion of 10th slab', 10, 360],
      ['On completion of 15th slab', 10, 480],
      ['On completion of top slab', 10, 600],
      ['On flooring & finishing', 15, 780],
      ['On possession / registration', 10, 960],
    ],
  },
  villa: {
    name: 'Ready-to-move plan',
    steps: [
      ['Booking amount', 10, 0],
      ['On agreement of sale', 40, 30],
      ['On registration & handover', 50, 60],
    ],
  },
  plot: {
    name: 'Plot payment plan',
    steps: [
      ['Booking amount', 20, 0],
      ['Balance on registration', 80, 45],
    ],
  },
}

export const planFor = (project) =>
  project.category === 'Plots' ? 'plot' : project.status === 'Ready to Move' ? 'villa' : 'clp'

/** Rate per unit area for a specific unit, including floor rise and preferred location charge. */
export function unitRate(unit, project) {
  const floorRise = project.floorRise && unit.floor > 1 ? (unit.floor - 1) * project.floorRise : 0
  const plc = project.plcFacings?.includes(unit.facing) ? project.plc || 0 : 0
  return { base: project.baseRate, floorRise, plc, total: project.baseRate + floorRise + plc }
}

/** Itemised cost sheet. discount is per unit of area. */
export function costSheet(unit, project, taxes, discount = 0) {
  const r = unitRate(unit, project)
  const basic = unit.area * (project.baseRate - discount)
  const fr = unit.area * r.floorRise
  const plc = unit.area * r.plc
  const parking = project.parking || 0
  const club = project.clubFee || 0
  const agreementValue = basic + fr + plc + parking + club
  const gstPct =
    project.category === 'Plots' || project.status === 'Ready to Move'
      ? 0
      : project.category === 'Commercial'
        ? taxes.gstCommercial
        : taxes.gstResidential
  const gst = (agreementValue * gstPct) / 100
  const maintenance = project.maintenance ? project.maintenance * unit.area * 24 : 0
  const stampPct = taxes.stampDuty + taxes.transferDuty
  const stamp = (agreementValue * stampPct) / 100
  const registration = (agreementValue * taxes.registration) / 100
  const lines = [
    [`Basic price (${num0(unit.area)} ${project.areaUnit} × ₹${num0(project.baseRate - discount)})`, basic],
    fr ? [`Floor rise (₹${r.floorRise}/${project.areaUnit})`, fr] : null,
    plc ? [`Preferred location charge (${unit.facing} facing)`, plc] : null,
    parking ? ['Car parking', parking] : null,
    club ? ['Clubhouse & amenities', club] : null,
  ].filter(Boolean)
  return {
    lines,
    agreementValue,
    gstPct,
    gst,
    maintenance,
    stamp,
    stampPct,
    registration,
    payable: agreementValue + gst,
    allIn: agreementValue + gst + maintenance + stamp + registration,
  }
}
const num0 = (n) => Math.round(n).toLocaleString('en-IN')

/** Milestones with paid / due status for a booking given its payments. */
export function schedule(booking, payments) {
  const steps = PLANS[booking.plan]?.steps || PLANS.clp.steps
  let pool = payments.filter((p) => p.bookingId === booking.id).reduce((s, p) => s + p.amount, 0)
  const today = todayISO()
  return steps.map(([name, pct, days], i) => {
    const amount = Math.round((booking.payable * pct) / 100)
    const paid = Math.min(pool, amount)
    pool -= paid
    const dueDate = booking.demands?.[i] || addDays(booking.date, days)
    const left = amount - paid
    let status = 'Paid'
    if (left > 1) {
      const d = daysBetween(today, dueDate)
      status = paid > 0 ? 'Part paid' : 'Upcoming'
      if (d < 0) status = 'Overdue'
      else if (d <= 15) status = 'Due soon'
    }
    return { index: i, name, pct, amount, paid, balance: Math.max(0, left), dueDate, status }
  })
}

export function bookingTotals(booking, payments) {
  const s = schedule(booking, payments)
  const paid = s.reduce((a, m) => a + m.paid, 0)
  const overdue = s.filter((m) => m.status === 'Overdue').reduce((a, m) => a + m.balance, 0)
  const nextDue = s.find((m) => m.balance > 1)
  return { schedule: s, paid, balance: booking.payable - paid, overdue, nextDue }
}
