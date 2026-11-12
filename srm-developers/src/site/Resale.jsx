import { useState } from 'react'
import { useStore } from '../lib/store'
import { Badge, Empty, Field, Modal, Tabs } from '../components/ui'
import PropertyArt from '../components/PropertyArt'
import { inr, inrShort, num, todayISO } from '../lib/format'

const ART = { Apartment: ['tower', ['#8b5cf6', '#06b6d4']], Villa: ['villa', ['#10b981', '#f59e0b']], Office: ['office', ['#3b82f6', '#a855f7']], Shop: ['retail', ['#f97316', '#ec4899']], Plot: ['plot', ['#e11d48', '#f59e0b']] }

export default function Resale() {
  const { ownerListings, add, submitEnquiry, toast } = useStore()
  const [kind, setKind] = useState('All')
  const [contact, setContact] = useState(null)
  const list = ownerListings.filter((l) => l.status === 'Approved' && (kind === 'All' || l.kind === kind))
  const [f, setF] = useState({ kind: 'Sell', category: 'Residential', ptype: 'Apartment', title: '', locality: 'Narsingi', area: '', price: '', ownerName: '', phone: '', description: '' })
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const post = (e) => {
    e.preventDefault()
    if (!f.title || !f.ownerName || !/\d{10}/.test(f.phone.replace(/\D/g, '')) || !Number(f.area) || !Number(f.price)) return toast('Please fill all required fields', 'err')
    add('ownerListings', { ...f, area: Number(f.area), price: Number(f.price), areaUnit: f.ptype === 'Plot' ? 'sq yd' : 'sq ft', status: 'Pending', createdAt: todayISO() })
    toast('Listing submitted! It will go live after verification (usually within 24 hours).')
    setF({ ...f, title: '', area: '', price: '', description: '' })
  }
  return (
    <>
      <section className="page-hero alt"><div className="wrap"><span className="eyebrow light">Marketplace</span><h1>Resale, rentals & leasing</h1><p className="lead">Verified owner listings in and around SRM communities — buy resale, rent a home or lease a commercial space. Owners can list for free.</p></div></section>
      <section className="wrap section">
        <div className="row-between wrap-row gap mb">
          <Tabs value={kind} onChange={setKind} tabs={[['All', 'All'], ['Sell', 'Buy resale'], ['Rent', 'Rent'], ['Lease', 'Commercial lease']]} />
          <a className="btn btn-primary" href="#post">+ Post your property free</a>
        </div>
        {list.length === 0 ? <Empty>No listings in this category right now.</Empty> : (
          <div className="grid-3">
            {list.map((l) => {
              const [art, pal] = ART[l.ptype] || ART.Apartment
              return (
                <div className="ccard" key={l.id}>
                  <div className="ccard-art"><PropertyArt kind={art} palette={pal} seed={l.area % 7} /><span className="ccard-cfg">{l.kind === 'Sell' ? 'For sale' : l.kind === 'Rent' ? 'For rent' : 'For lease'}</span></div>
                  <div className="ccard-body">
                    <div className="row-between"><Badge>{l.category}</Badge><Badge tone="green">✔ Verified</Badge></div>
                    <h4>{l.title}</h4>
                    <p className="muted small">📍 {l.locality} · {num(l.area)} {l.areaUnit} · {l.ptype}</p>
                    <div className="ccard-price"><b className="grad-text">{l.kind === 'Sell' ? inrShort(l.price) : `${inr(l.price)}/mo`}</b></div>
                    <button className="btn btn-ghost btn-sm" onClick={() => setContact(l)}>Contact owner</button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      <section className="wrap section" id="post">
        <div className="card pad post-card">
          <div>
            <span className="eyebrow">Owners & landlords</span>
            <h2>List your property with SRM</h2>
            <p className="muted">Sell your flat, rent out your villa or lease your shop/office. Our team verifies every listing, shares it with thousands of buyers and tenants, and helps with paperwork.</p>
            <ul className="ticks"><li>Free listing for SRM owners</li><li>Verified buyers & tenants only</li><li>Rental agreement & registration support</li><li>Property management on request</li></ul>
          </div>
          <form className="form-grid" onSubmit={post}>
            <Field label="I want to"><select value={f.kind} onChange={set('kind')}><option value="Sell">Sell</option><option value="Rent">Rent out</option><option value="Lease">Lease (commercial)</option></select></Field>
            <Field label="Property type"><select value={f.ptype} onChange={(e) => { const t = e.target.value; setF({ ...f, ptype: t, category: ['Office', 'Shop'].includes(t) ? 'Commercial' : t === 'Plot' ? 'Plots' : 'Residential' }) }}>{Object.keys(ART).map((t) => <option key={t}>{t}</option>)}</select></Field>
            <Field label="Title" span={2}><input value={f.title} onChange={set('title')} placeholder="e.g. 3 BHK East facing, 10th floor, Skyline Tower C" /></Field>
            <Field label="Locality"><input value={f.locality} onChange={set('locality')} /></Field>
            <Field label={`Area (${f.ptype === 'Plot' ? 'sq yd' : 'sq ft'})`}><input type="number" value={f.area} onChange={set('area')} /></Field>
            <Field label={f.kind === 'Sell' ? 'Expected price (₹)' : 'Monthly rent (₹)'}><input type="number" value={f.price} onChange={set('price')} /></Field>
            <Field label="Your name"><input value={f.ownerName} onChange={set('ownerName')} /></Field>
            <Field label="Mobile"><input value={f.phone} onChange={set('phone')} inputMode="tel" /></Field>
            <Field label="Description" span={2}><textarea rows={2} value={f.description} onChange={set('description')} /></Field>
            <button className="btn btn-primary span-2">Submit for verification</button>
          </form>
        </div>
      </section>
      {contact && (
        <Modal title="Contact owner" onClose={() => setContact(null)}>
          <ContactOwner l={contact} onDone={(form) => { submitEnquiry({ ...form, subject: `Interested in listing: ${contact.title}`, purpose: contact.kind }); toast('Request sent! Our team will connect you with the owner.'); setContact(null) }} />
        </Modal>
      )}
    </>
  )
}

function ContactOwner({ l, onDone }) {
  const [f, setF] = useState({ name: '', phone: '' })
  return (
    <form className="form-grid" onSubmit={(e) => { e.preventDefault(); if (f.name && /\d{10}/.test(f.phone)) onDone(f) }}>
      <p className="span-2 muted">{l.title}. For your privacy and the owner's, SRM's resale desk connects you directly and arranges the visit.</p>
      <Field label="Your name"><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required /></Field>
      <Field label="Mobile"><input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} required inputMode="tel" /></Field>
      <button className="btn btn-primary span-2">Request contact</button>
    </form>
  )
}
