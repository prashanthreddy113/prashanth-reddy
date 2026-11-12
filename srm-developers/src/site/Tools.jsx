import { useState } from 'react'
import { useStore } from '../lib/store'
import EmiCalculator from '../components/Emi'
import { Field, Tabs } from '../components/ui'
import { emi, inr, inrShort } from '../lib/format'

export default function Tools() {
  const [t, setT] = useState('emi')
  return (
    <>
      <section className="page-hero"><div className="wrap"><span className="eyebrow light">Plan smart</span><h1>Property calculators</h1><p className="lead">EMI, loan eligibility, stamp duty & registration, and rental yield — tuned for Telangana.</p></div></section>
      <section className="wrap section">
        <Tabs value={t} onChange={setT} tabs={[['emi', 'EMI'], ['elig', 'Loan eligibility'], ['stamp', 'Stamp duty & GST'], ['yield', 'Rental yield']]} />
        <div className="card pad mt">
          {t === 'emi' && <><h2>Home-loan EMI calculator</h2><EmiCalculator price={12000000} /></>}
          {t === 'elig' && <Eligibility />}
          {t === 'stamp' && <Stamp />}
          {t === 'yield' && <Yield />}
        </div>
      </section>
    </>
  )
}

function Eligibility() {
  const [f, setF] = useState({ income: 200000, obligations: 15000, rate: 8.5, years: 20 })
  const set = (k) => (e) => setF({ ...f, [k]: Number(e.target.value) })
  const maxEmi = Math.max(0, f.income * 0.5 - f.obligations)
  const unit = emi(100000, f.rate, f.years)
  const loan = unit ? (maxEmi / unit) * 100000 : 0
  return (
    <div className="calc">
      <div className="form-grid">
        <Field label="Net monthly income (₹)"><input type="number" value={f.income} onChange={set('income')} /></Field>
        <Field label="Existing EMIs (₹/month)"><input type="number" value={f.obligations} onChange={set('obligations')} /></Field>
        <Field label="Interest rate (%)"><input type="number" step="0.05" value={f.rate} onChange={set('rate')} /></Field>
        <Field label="Tenure (years)"><input type="number" value={f.years} onChange={set('years')} /></Field>
      </div>
      <div className="calc-out">
        <small>You may be eligible for</small><b className="grad-text">{inrShort(loan)}</b>
        <span>Max EMI {inr(maxEmi)}/month (50% FOIR)</span>
        <span>Property budget ≈ <b>{inrShort(loan / 0.8)}</b> with 20% down payment</span>
      </div>
    </div>
  )
}

function Stamp() {
  const { settings } = useStore()
  const tx = settings.taxes
  const [v, setV] = useState(10000000)
  const [type, setType] = useState('Residential – under construction')
  const gstPct = type.includes('Commercial') ? tx.gstCommercial : type.includes('under') ? tx.gstResidential : 0
  const stamp = (v * (tx.stampDuty + tx.transferDuty)) / 100
  const reg = (v * tx.registration) / 100
  const gst = (v * gstPct) / 100
  return (
    <div className="calc">
      <div className="form-grid">
        <Field label="Agreement value (₹)"><input type="number" value={v} onChange={(e) => setV(Number(e.target.value))} /></Field>
        <Field label="Property type">
          <select value={type} onChange={(e) => setType(e.target.value)}>
            {['Residential – under construction', 'Residential – ready to move', 'Commercial – under construction', 'Plot'].map((x) => <option key={x}>{x}</option>)}
          </select>
        </Field>
      </div>
      <table className="table cost">
        <tbody>
          <tr><td>Stamp duty @ {tx.stampDuty}%</td><td className="num">{inr((v * tx.stampDuty) / 100)}</td></tr>
          <tr><td>Transfer duty @ {tx.transferDuty}%</td><td className="num">{inr((v * tx.transferDuty) / 100)}</td></tr>
          <tr><td>Registration fee @ {tx.registration}%</td><td className="num">{inr(reg)}</td></tr>
          <tr><td>GST @ {gstPct}%</td><td className="num">{inr(gst)}</td></tr>
          <tr className="total"><td>Total over agreement value</td><td className="num">{inr(stamp + reg + gst)}</td></tr>
        </tbody>
      </table>
      <p className="small muted">Indicative Telangana rates; government charges are levied on the higher of agreement value and market (SRO) value. Confirm current rates with your SRM relationship manager.</p>
    </div>
  )
}

function Yield() {
  const [f, setF] = useState({ price: 25000000, rent: 170000, maint: 12000, vacancy: 1 })
  const set = (k) => (e) => setF({ ...f, [k]: Number(e.target.value) })
  const gross = f.price ? ((f.rent * 12) / f.price) * 100 : 0
  const net = f.price ? (((f.rent - f.maint) * (12 - f.vacancy)) / f.price) * 100 : 0
  return (
    <div className="calc">
      <div className="form-grid">
        <Field label="Purchase price (₹)"><input type="number" value={f.price} onChange={set('price')} /></Field>
        <Field label="Monthly rent (₹)"><input type="number" value={f.rent} onChange={set('rent')} /></Field>
        <Field label="Monthly costs (₹)"><input type="number" value={f.maint} onChange={set('maint')} /></Field>
        <Field label="Vacant months / year"><input type="number" value={f.vacancy} onChange={set('vacancy')} /></Field>
      </div>
      <div className="calc-out">
        <small>Gross rental yield</small><b className="grad-text">{gross.toFixed(2)}%</b>
        <span>Net yield after costs & vacancy: <b>{net.toFixed(2)}%</b></span>
        <span>Payback ≈ {net > 0 ? (100 / net).toFixed(1) : '—'} years</span>
      </div>
    </div>
  )
}
