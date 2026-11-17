import type { Metadata } from "next";
import { Biz, LAST_UPDATED } from "@/components/Biz.tsx";
import { SITE } from "@/lib/config.ts";

export const metadata: Metadata = { title: `Privacy policy – ${SITE.name}` };

export default function Privacy() {
  return (
    <div className="wrap narrow legal">
      <h1>Privacy policy</h1>
      <p className="muted small">Last updated: {LAST_UPDATED}</p>
      <p>
        This policy explains how <Biz field="businessName" fallback="Business name" /> (&quot;we&quot;) handles information
        when you use {SITE.name}. We follow the Digital Personal Data Protection Act, 2023 and collect as little as possible.
      </p>

      <h2>1. Your documents</h2>
      <ul>
        <li>
          The photos or PDF you upload are sent over an encrypted connection to our AI provider (Anthropic) only to create
          your explanation.
        </li>
        <li>
          <strong>We do not save your documents or the explanations</strong> on our servers. Once your explanation is shown,
          the uploaded file is discarded from our side.
        </li>
        <li>
          Our AI provider processes the data under its commercial terms, does not use it to train its models, and may keep
          it for a limited period for safety and abuse monitoring before deleting it.
        </li>
      </ul>

      <h2>2. Information we keep</h2>
      <ul>
        <li>
          <strong>A random wallet ID</strong> stored in a cookie in your browser, with your credit balance. It is not linked
          to your name or phone number.
        </li>
        <li>
          <strong>Payment records</strong>: order ID, payment ID, pack and amount. Your card, bank and UPI details are
          handled by Razorpay and never reach us.
        </li>
        <li>
          <strong>Basic usage statistics</strong>: counts of documents explained, language chosen and technical logs (e.g.
          errors). These do not contain document content.
        </li>
        <li>
          <strong>A one-way hash of your IP address</strong> for one day, only to limit misuse of free credits.
        </li>
      </ul>

      <h2>3. How we use it</h2>
      <p>To provide the Service, keep your credit balance, process payments, prevent fraud and improve reliability. We do not sell your data or show advertising.</p>

      <h2>4. Service providers</h2>
      <ul>
        <li>Anthropic – AI processing of uploaded documents.</li>
        <li>Razorpay – payment processing.</li>
        <li>Netlify – website hosting and storage of wallet balances and payment records.</li>
      </ul>

      <h2>5. Your rights</h2>
      <p>
        You can ask us to access, correct or delete the information linked to your wallet or payments, or raise a
        grievance, by writing to our grievance officer at <Biz field="supportEmail" fallback="support email" />. We respond
        within 30 days. You can also clear your browser cookies at any time; note this removes access to unused credits
        unless you contact us with your payment ID.
      </p>

      <h2>6. Children</h2>
      <p>The Service is meant for adults. If you are under 18, please use it with a parent or guardian.</p>

      <h2>7. Changes</h2>
      <p>We will post any changes to this policy on this page with a new date.</p>
    </div>
  );
}
