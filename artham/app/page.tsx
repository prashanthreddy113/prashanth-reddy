import Link from "next/link";
import Explainer from "@/components/Explainer.tsx";
import { PLANS, rupees, SITE } from "@/lib/config.ts";

const USES = [
  { icon: "🏥", title: "Hospital bills & reports", text: "Check charges, insurance share and what lab values mean before you pay or panic." },
  { icon: "🏠", title: "Rental & sale agreements", text: "Spot one-sided clauses, lock-in periods, deposit terms and missing registration." },
  { icon: "🏦", title: "Loan & insurance letters", text: "See the real interest, hidden fees, EMI dates and what the policy does not cover." },
  { icon: "🏛️", title: "Government & court notices", text: "Know what is being asked, the deadline, and which office to go to." },
  { icon: "💡", title: "Electricity, tax & other bills", text: "Understand every line, late fees, and whether the amount looks right." },
  { icon: "💼", title: "Job offers & salary slips", text: "Notice period, bond, deductions and in-hand salary explained simply." },
];

const FAQ = [
  {
    q: "Which languages are supported?",
    a: "Telugu, Hindi, English, Tamil, Kannada, Malayalam, Marathi, Bengali and Gujarati. Your document can be in any of these or in English.",
  },
  {
    q: "Do you keep my document?",
    a: "No. Your photos or PDF are sent securely to our AI provider to write the explanation and are not saved by us. We only keep your remaining credit balance.",
  },
  {
    q: "Is this legal or medical advice?",
    a: "No. We explain what your document says in simple words and point out things to check. For important decisions, talk to a lawyer, doctor or chartered accountant - we tell you when that is a good idea.",
  },
  {
    q: "How do I pay?",
    a: "With UPI (Google Pay, PhonePe, Paytm and others), debit/credit cards or net banking through Razorpay. You only pay for packs you choose - there is no subscription.",
  },
  {
    q: "What if the explanation fails?",
    a: "If something goes wrong or your photo cannot be read, your credit is returned automatically.",
  },
  {
    q: "Do I need to create an account?",
    a: "No sign-up needed. Your credits are saved in this browser. Use the same phone/browser to use the credits you bought.",
  },
];

export default function Home() {
  return (
    <>
      <section className="hero">
        <div className="wrap hero-grid">
          <div>
            <span className="eyebrow">Telugu · हिन्दी · தமிழ் · English + 5 more</span>
            <h1>Confusing paper? Understand it in your own language.</h1>
            <p className="lead">
              Take a photo of any hospital bill, rental agreement, loan letter or government notice. {SITE.name}{" "}
              explains it in simple words, shows hidden charges and deadlines, and tells you what to do next.
            </p>
            <ul className="ticks">
              <li>First 2 documents free – no sign-up</li>
              <li>Red flags, amounts and dates pulled out for you</li>
              <li>Listen to it, or share it on WhatsApp with family</li>
              <li>Your document is never stored</li>
            </ul>
          </div>
          <Explainer />
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="section-head">
            <h2>What people use it for</h2>
            <p className="muted">If it&apos;s on paper and it&apos;s confusing, {SITE.name} can explain it.</p>
          </div>
          <div className="grid-3">
            {USES.map((u) => (
              <div className="use-card" key={u.title}>
                <div className="icon" aria-hidden="true">
                  {u.icon}
                </div>
                <h3>{u.title}</h3>
                <p>{u.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section" id="how">
        <div className="wrap">
          <div className="section-head">
            <h2>How it works</h2>
          </div>
          <div className="grid-3">
            <div className="use-card">
              <div className="step-num">1</div>
              <h3>Take a photo</h3>
              <p>Snap each page with your phone camera, or upload a PDF.</p>
            </div>
            <div className="use-card">
              <div className="step-num">2</div>
              <h3>Choose your language</h3>
              <p>Pick Telugu, Hindi, Tamil, English or another language you are comfortable with.</p>
            </div>
            <div className="use-card">
              <div className="step-num">3</div>
              <h3>Understand & act</h3>
              <p>Read or listen to the explanation, see the risks, and follow the clear next steps.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="pricing">
        <div className="wrap">
          <div className="section-head">
            <h2>Simple pricing</h2>
            <p className="muted">No subscription. Pay only for what you use. Credits never expire.</p>
          </div>
          <div className="plans">
            <div className="plan">
              <h3>Free</h3>
              <div className="price">₹0</div>
              <div className="per">2 documents for every new user</div>
            </div>
            {PLANS.map((p) => (
              <div className={"plan" + (p.badge === "Most popular" ? " featured" : "")} key={p.id}>
                {p.badge && <span className="badge">{p.badge}</span>}
                <h3>{p.label}</h3>
                <div className="price">{rupees(p.pricePaise)}</div>
                <div className="per">
                  {p.credits > 1 ? `${rupees(Math.round(p.pricePaise / p.credits))} per document` : "Pay as you go"}
                </div>
              </div>
            ))}
          </div>
          <p className="small muted" style={{ marginTop: 12 }}>
            Prices include all taxes. Pay with UPI, cards or net banking. <Link href="/refunds">Refund policy</Link>.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="section-head">
            <h2>Safe and private</h2>
          </div>
          <div className="trust">
            <div className="use-card">
              <h3>🔒 Not stored</h3>
              <p>Your document is processed once and discarded. We don&apos;t build a file of your papers.</p>
            </div>
            <div className="use-card">
              <h3>🧾 Secure payments</h3>
              <p>Payments are handled by Razorpay, a trusted Indian payment gateway. We never see your card details or UPI PIN.</p>
            </div>
            <div className="use-card">
              <h3>🤝 Honest help</h3>
              <p>We tell you when something needs a real lawyer, doctor or CA, instead of guessing.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="section faq">
        <div className="wrap narrow">
          <div className="section-head">
            <h2>Questions</h2>
          </div>
          {FAQ.map((f) => (
            <details key={f.q}>
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </section>
    </>
  );
}
