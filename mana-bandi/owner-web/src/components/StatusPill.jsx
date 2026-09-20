const MAP = {
  // trips
  searching: ['yellow', 'Searching'],
  assigned: ['blue', 'Assigned'],
  on_trip: ['green', 'On trip'],
  finished: ['grey', 'Finished'],
  cancelled: ['red', 'Cancelled'],
  unfulfilled: ['red', 'Unfulfilled'],
  // captains
  pending: ['yellow', 'Pending'],
  verified: ['green', 'Verified'],
  rejected: ['red', 'Rejected'],
  blocked: ['red', 'Blocked'],
  online: ['green', 'Online'],
  offline: ['grey', 'Offline'],
  // settlements
  due: ['yellow', 'Due'],
  paid: ['green', 'Paid'],
  on_hold: ['red', 'On hold'],
  // templates
  approved: ['green', 'Approved'],
  pending_review: ['yellow', 'Pending review'],
  // checks
  pass: ['green', 'Pass'],
  fail: ['red', 'Fail'],
  review: ['orange', 'Needs review'],
  // misc
  cash: ['yellow', 'Cash'],
  upi: ['green', 'UPI'],
  yes: ['green', 'Yes'],
  no: ['grey', 'No'],
}

export default function StatusPill({ status, label, tone }) {
  const [t, l] = MAP[status] || ['grey', status]
  return <span className={`pill pill-${tone || t}`}>{label || l}</span>
}
