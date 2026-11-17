import { useMemo, useState } from 'react'
import { emi, inr, inrShort } from '../lib/format'

export default function EmiCalculator({ price = 10000000 }) {
  const [amount, setAmount] = useState(Math.round(price * 0.8))
  const [rate, setRate] = useState(8.5)
  const [years, setYears] = useState(20)
  const m = useMemo(() => emi(amount, rate, years), [amount, rate, years])
  const total = m * years * 12
  const interest = total - amount
  const pPct = total ? (amount / total) * 100 : 0
  return (
    <div className="emi">
      <div className="emi-inputs">
        <Slider label="Loan amount" value={amount} min={500000} max={50000000} step={100000} onChange={setAmount} fmt={inrShort} />
        <Slider label="Interest rate (p.a.)" value={rate} min={6} max={14} step={0.05} onChange={setRate} fmt={(v) => `${v.toFixed(2)}%`} />
        <Slider label="Tenure" value={years} min={1} max={30} step={1} onChange={setYears} fmt={(v) => `${v} years`} />
      </div>
      <div className="emi-result">
        <div className="emi-ring" style={{ background: `conic-gradient(#7c3aed 0 ${pPct}%, #f59e0b ${pPct}% 100%)` }}>
          <div><small>Monthly EMI</small><b>{inr(m)}</b></div>
        </div>
        <ul className="emi-break">
          <li><i style={{ background: '#7c3aed' }} />Principal <b>{inrShort(amount)}</b></li>
          <li><i style={{ background: '#f59e0b' }} />Total interest <b>{inrShort(interest)}</b></li>
          <li>Total payable <b>{inrShort(total)}</b></li>
        </ul>
      </div>
    </div>
  )
}

function Slider({ label, value, min, max, step, onChange, fmt }) {
  return (
    <label className="slider">
      <span className="slider-top"><span>{label}</span><b>{fmt(value)}</b></span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))}
        style={{ '--p': `${((value - min) / (max - min)) * 100}%` }} />
    </label>
  )
}
