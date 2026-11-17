import type { Metadata } from "next";
import Link from "next/link";
import { Biz, LAST_UPDATED } from "@/components/Biz.tsx";
import { SITE } from "@/lib/config.ts";

export const metadata: Metadata = { title: `Terms of use – ${SITE.name}` };

export default function Terms() {
  return (
    <div className="wrap narrow legal">
      <h1>Terms of use</h1>
      <p className="muted small">Last updated: {LAST_UPDATED}</p>
      <p>
        These terms apply to your use of {SITE.name} (the &quot;Service&quot;), operated by{" "}
        <Biz field="businessName" fallback="Business name" />, <Biz field="businessAddress" fallback="Registered address" />{" "}
        (&quot;we&quot;, &quot;us&quot;). By using the Service you agree to these terms.
      </p>

      <h2>1. What the Service does</h2>
      <p>
        You upload photos or a PDF of a document and choose a language. The Service uses artificial intelligence to
        produce a plain-language explanation, a list of amounts and dates, possible risks, and suggested next steps.
      </p>

      <h2>2. Not professional advice</h2>
      <p>
        Explanations are generated automatically and may contain mistakes or miss important details. They are for
        general understanding only and are <strong>not legal, medical, financial or tax advice</strong>, and do not create
        any lawyer-client, doctor-patient or other professional relationship. Always check important information with the
        issuing organisation or a qualified professional before making decisions. In a medical emergency, contact a doctor
        or emergency services immediately.
      </p>

      <h2>3. Your responsibilities</h2>
      <ul>
        <li>Upload only documents you have the right to share, such as your own or your family&apos;s papers.</li>
        <li>Do not upload content that is illegal, or use the Service to harm, defraud or harass anyone.</li>
        <li>Do not try to disrupt, overload, copy or reverse-engineer the Service.</li>
      </ul>

      <h2>4. Credits and payments</h2>
      <ul>
        <li>New users receive free credits as shown on the website. One credit explains one document.</li>
        <li>Paid credit packs are priced in Indian Rupees and include applicable taxes. Payments are processed by Razorpay.</li>
        <li>Credits are stored in the browser you used and do not expire. Clearing your browser data may remove access to unused credits; contact us with your payment ID and we will help.</li>
        <li>
          Refunds are handled under our <Link href="/refunds">Refund &amp; cancellation policy</Link>.
        </li>
      </ul>

      <h2>5. Availability</h2>
      <p>
        We aim to keep the Service available but do not guarantee it will be uninterrupted or error-free. We may change,
        suspend or discontinue features at any time. If we discontinue the Service, we will refund unused paid credits.
      </p>

      <h2>6. Limitation of liability</h2>
      <p>
        To the maximum extent permitted by law, we are not liable for any loss arising from reliance on an explanation.
        Our total liability for any claim relating to the Service is limited to the amount you paid us in the 3 months
        before the claim.
      </p>

      <h2>7. Privacy</h2>
      <p>
        Please read our <Link href="/privacy">Privacy policy</Link> to understand how your information is handled.
      </p>

      <h2>8. Governing law</h2>
      <p>
        These terms are governed by the laws of India. Courts at <Biz field="businessAddress" fallback="City, State" /> will
        have jurisdiction, subject to applicable consumer protection laws.
      </p>

      <h2>9. Contact</h2>
      <p>
        Questions about these terms: <Biz field="supportEmail" fallback="support email" />.
      </p>
    </div>
  );
}
