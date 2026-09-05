import { useEffect, useMemo, useState } from 'react'
import Modal from './Modal'
import { api } from '../lib/api'
import { money, todayIso, addMonths, fmtDate } from '../lib/format'
import { useBranch } from '../lib/branch'

const empty = {
  branchId: '', name: '', mobile: '', gender: '', address: '', aadhaar: '', study: '', notes: '',
  months: 1, amountPerMonth: '', totalPaid: '', joiningDate: todayIso(), seatNumber: '', isActive: true,
}

function toForm(s) {
  if (!s) return { ...empty }
  return {
    branchId: s.branchId || '', name: s.name || '', mobile: s.mobile || '', gender: s.gender || '', address: s.address || '', aadhaar: s.aadhaar || '',
    study: s.study || '', notes: s.notes || '', months: s.months || 1,
    amountPerMonth: s.amountPerMonth ?? '', totalPaid: s.totalPaid ?? '',
    joiningDate: s.joiningDate || todayIso(), seatNumber: s.seatNumber ?? '', isActive: s.isActive ?? true,
  }
}

function validate(f, minFee) {
  const e = {}
  if (!f.branchId) e.branchId = 'Select the branch.'
  if (minFee > 0 && Number(f.amountPerMonth || 0) < minFee) e.amountPerMonth = `Minimum fee is ${money(minFee)} per month (change it in Settings).`
  if (!f.name.trim() || f.name.trim().length < 2) e.name = 'Name is required (min 2 characters).'
  if (!/^\+?[0-9]{10,15}$/.test(f.mobile.trim())) e.mobile = 'Enter a valid mobile number (10–15 digits).'
  if (!f.gender) e.gender = 'Select the gender.'
  if (f.aadhaar && !/^[0-9]{12}$/.test(f.aadhaar.trim())) e.aadhaar = 'Aadhaar must be exactly 12 digits.'
  if (!f.months || Number(f.months) < 1) e.months = 'At least 1 month.'
  if (f.amountPerMonth === '' || Number(f.amountPerMonth) < 0) e.amountPerMonth = 'Enter the monthly amount.'
  if (f.totalPaid !== '' && Number(f.totalPaid) < 0) e.totalPaid = 'Cannot be negative.'
  if (!f.joiningDate) e.joiningDate = 'Joining date is required.'
  return e
}

function Field({ k, label, required, children, help, className, error }) {
  return (
    <div className={`field ${error ? 'invalid' : ''} ${className || ''}`}>
      <label htmlFor={`f-${k}`}>{label}{required ? <span className="req">*</span> : <span className="opt">(optional)</span>}</label>
      {children}
      {error ? <span className="err">{error}</span> : help ? <span className="help">{help}</span> : null}
    </div>
  )
}

export default function StudentFormModal({ student, onClose, onSaved, presetSeat, presetBranchId }) {
  const editing = !!student
  const { activeBranches, branches, branchId: selectedBranchId } = useBranch()
  const [form, setForm] = useState(() => ({
    ...toForm(student),
    ...(presetSeat ? { seatNumber: presetSeat } : {}),
    branchId: student?.branchId || presetBranchId || selectedBranchId || activeBranches[0]?.id || '',
  }))
  const [errors, setErrors] = useState({})
  const [seats, setSeats] = useState([])
  const [summary, setSummary] = useState(null)
  const [minFee, setMinFee] = useState(0)
  const [busy, setBusy] = useState(false)
  const [serverError, setServerError] = useState('')

  useEffect(() => {
    api.settings().then((s) => {
      setMinFee(Number(s.minimumMonthlyFee || 0))
      if (!editing) setForm((f) => (f.amountPerMonth === '' && Number(s.minimumMonthlyFee) > 0 ? { ...f, amountPerMonth: String(s.minimumMonthlyFee) } : f))
    }).catch(() => {})
  }, [editing])

  useEffect(() => {
    if (!form.branchId) { setSeats([]); setSummary(null); return }
    api.seats(form.branchId).then(setSeats).catch(() => setSeats([]))
    api.seatSummary(form.branchId).then(setSummary).catch(() => setSummary(null))
  }, [form.branchId])

  const changeBranch = (e) => {
    const v = e.target.value
    setForm((f) => ({ ...f, branchId: v, seatNumber: student && String(student.branchId) === v ? (student.seatNumber ?? '') : '' }))
  }

  const set = (k) => (e) => {
    const v = e?.target?.type === 'checkbox' ? e.target.checked : e?.target ? e.target.value : e
    setForm((f) => ({ ...f, [k]: v }))
  }

  const availableSeats = useMemo(() => seats.filter((s) => s.isActive && (!s.isOccupied || s.studentId === student?.id)), [seats, student])

  // Women may take any free seat; men/others only the seats outside the reserved share.
  const holdsSeatAlready = !!student?.seatNumber && student?.gender !== 'Female' && String(student?.branchId) === String(form.branchId)
  const generalFree = summary ? summary.generalFree + (holdsSeatAlready ? 1 : 0) : null
  const quotaBlocked = !!summary && summary.reservedForWomen > 0 && form.gender && form.gender !== 'Female' && generalFree <= 0
  const seatHelp = !seats.length
    ? 'No seats yet — create seats from the Seats page'
    : summary && summary.reservedForWomen > 0
      ? `${availableSeats.length} free · ${summary.reservedForWomen} of ${summary.active} seats reserved for women (${summary.femaleReservationPercent}%) · ${Math.max(0, generalFree)} open to men/others`
      : `${availableSeats.length} seat(s) available`

  const totalFee = Number(form.months || 0) * Number(form.amountPerMonth || 0)
  const balance = totalFee - Number(form.totalPaid || 0)
  const dueDate = addMonths(form.joiningDate, form.months)

  const submit = async (e) => {
    e.preventDefault()
    const errs = validate(form, minFee)
    setErrors(errs)
    if (Object.keys(errs).length) return

    const payload = {
      branchId: Number(form.branchId),
      name: form.name.trim(),
      mobile: form.mobile.trim(),
      gender: form.gender,
      address: form.address.trim() || null,
      aadhaar: form.aadhaar.trim() || null,
      study: form.study.trim() || null,
      notes: form.notes.trim() || null,
      months: Number(form.months),
      amountPerMonth: Number(form.amountPerMonth || 0),
      totalPaid: Number(form.totalPaid || 0),
      joiningDate: form.joiningDate,
      seatNumber: form.seatNumber === '' ? null : Number(form.seatNumber),
      isActive: !!form.isActive,
    }

    setBusy(true); setServerError('')
    try {
      const saved = editing ? await api.updateStudent(student.id, payload) : await api.createStudent(payload)
      onSaved(saved, editing)
    } catch (err) {
      setServerError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title={editing ? `Edit ${student.name}` : 'Register new student'} onClose={onClose} size="wide">
      <form onSubmit={submit} noValidate>
        <div className="form-grid">
          {(branches.length > 1 || !form.branchId) && (
            <Field k="branchId" error={errors.branchId} label="Branch" required className="full">
              <select id="f-branchId" value={form.branchId} onChange={changeBranch}>
                <option value="">Select branch…</option>
                {branches.filter((b) => b.isActive || String(b.id) === String(form.branchId)).map((b) => <option key={b.id} value={b.id}>{b.name}{b.isActive ? '' : ' (inactive)'}</option>)}
              </select>
            </Field>
          )}
          <Field k="name" error={errors.name} label="Full name" required>
            <input id="f-name" value={form.name} onChange={set('name')} placeholder="e.g. Ravi Kumar" autoFocus />
          </Field>
          <Field k="mobile" error={errors.mobile} label="Mobile number" required>
            <input id="f-mobile" value={form.mobile} onChange={set('mobile')} placeholder="10-digit mobile" inputMode="tel" />
          </Field>

          <Field k="gender" error={errors.gender} label="Gender" required>
            <select id="f-gender" value={form.gender} onChange={set('gender')}>
              <option value="">Select…</option>
              <option value="Female">Female</option>
              <option value="Male">Male</option>
              <option value="Other">Other</option>
            </select>
          </Field>
          <Field k="seatNumber" error={errors.seatNumber} label="Seat number" help={quotaBlocked ? undefined : seatHelp}>
            {quotaBlocked && <span className="err">All seats open to men/others are taken; the remaining free seats are reserved for women. Free a seat or change the reservation in Settings.</span>}
            <select id="f-seatNumber" value={form.seatNumber} onChange={set('seatNumber')} disabled={!form.isActive}>
              <option value="">No seat assigned</option>
              {availableSeats.map((s) => (
                <option key={s.id} value={s.number}>Seat {s.number}{s.section ? ` · ${s.section}` : ''}{s.isAc ? ' · AC' : ' · Non-AC'}{s.label ? ` · ${s.label}` : ''}</option>
              ))}
            </select>
          </Field>
          <Field k="study" error={errors.study} label="Studying for / course">
            <input id="f-study" value={form.study} onChange={set('study')} placeholder="e.g. UPSC, CA, B.Tech" />
          </Field>

          <Field k="joiningDate" error={errors.joiningDate} label="Joining date" required>
            <input id="f-joiningDate" type="date" value={form.joiningDate} onChange={set('joiningDate')} />
          </Field>
          <Field k="months" error={errors.months} label="Months to join" required help={dueDate ? `Due date will be ${fmtDate(dueDate)}` : ''}>
            <input id="f-months" type="number" min="1" max="120" value={form.months} onChange={set('months')} />
          </Field>

          <Field k="amountPerMonth" error={errors.amountPerMonth} label="Amount per month" required help={minFee > 0 ? `Minimum ${money(minFee)} per month` : undefined}>
            <input id="f-amountPerMonth" type="number" min="0" step="1" value={form.amountPerMonth} onChange={set('amountPerMonth')} placeholder="e.g. 1500" inputMode="decimal" />
          </Field>
          <Field k="totalPaid" error={errors.totalPaid} label="Total paid amount" help={editing ? 'Adjusts the running total (use “Record payment” for a receipt entry).' : 'Amount collected now. A payment entry is created automatically.'}>
            <input id="f-totalPaid" type="number" min="0" step="1" value={form.totalPaid} onChange={set('totalPaid')} placeholder="0" inputMode="decimal" />
          </Field>

          <Field k="aadhaar" error={errors.aadhaar} label="Aadhaar number">
            <input id="f-aadhaar" value={form.aadhaar} onChange={set('aadhaar')} placeholder="12-digit Aadhaar" inputMode="numeric" maxLength={12} />
          </Field>
          <Field k="address" error={errors.address} label="Address">
            <input id="f-address" value={form.address} onChange={set('address')} placeholder="Street, area, city" />
          </Field>

          <Field k="notes" error={errors.notes} label="Notes" className="full">
            <textarea id="f-notes" rows={2} value={form.notes} onChange={set('notes')} placeholder="Anything to remember about this student" />
          </Field>

          {editing && (
            <div className="field full">
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" checked={form.isActive} onChange={set('isActive')} style={{ width: 'auto' }} />
                Active member (untick if the student has left — their seat is released)
              </label>
            </div>
          )}
        </div>

        <div className="summary-box" style={{ marginTop: 16 }}>
          <div><div className="k">Total fee</div><div className="v">{money(totalFee)}</div></div>
          <div><div className="k">Paid</div><div className="v">{money(form.totalPaid || 0)}</div></div>
          <div><div className="k">Balance</div><div className="v" style={{ color: balance > 0 ? 'var(--red)' : 'var(--green)' }}>{money(Math.max(0, balance))}</div></div>
          <div><div className="k">Due date</div><div className="v">{dueDate ? fmtDate(dueDate) : '—'}</div></div>
        </div>

        {serverError && <div className="alert error" style={{ marginTop: 12 }}>{serverError}</div>}

        <div className="form-actions" style={{ marginTop: 16 }}>
          <button type="button" className="btn" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" className="btn primary" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Register student'}</button>
        </div>
      </form>
    </Modal>
  )
}
