import type { Metadata } from "next";
import { Biz, LAST_UPDATED } from "@/components/Biz.tsx";
import { SITE } from "@/lib/config.ts";

export const metadata: Metadata = { title: `Refund & cancellation policy – ${SITE.name}` };

export default function Refunds() {
  return (
    <div className="wrap narrow legal">
      <h1>Refund &amp; cancellation policy</h1>
      <p className="muted small">Last updated: {LAST_UPDATED}</p>

      <h2>Delivery</h2>
      <p>
        {SITE.name} is a digital service. Credits are added to your browser immediately after a successful payment, and
        each explanation is shown on screen within about a minute. Nothing is shipped physically.
      </p>

      <h2>Automatic credit return</h2>
      <p>
        If an explanation fails because of a technical error, or your photo could not be read, the credit is returned to
        your balance automatically.
      </p>

      <h2>Refunds</h2>
      <ul>
        <li>
          <strong>Unused credits:</strong> you can request a full refund for a pack with no credits used within 7 days of
          purchase.
        </li>
        <li>
          <strong>Payment taken but no credits added:</strong> we will add the credits or refund the full amount.
        </li>
        <li>
          <strong>Duplicate payment:</strong> the extra payment is refunded in full.
        </li>
        <li>Credits that have already been used to explain a document are not refundable.</li>
      </ul>
      <p>
        To request a refund, email <Biz field="supportEmail" fallback="support email" /> with your Razorpay payment ID
        (from your payment SMS or email). Approved refunds are sent to the original payment method within 5–7 working days.
      </p>

      <h2>Cancellation</h2>
      <p>There is no subscription, so there is nothing to cancel. You only pay when you choose to buy a pack.</p>
    </div>
  );
}
