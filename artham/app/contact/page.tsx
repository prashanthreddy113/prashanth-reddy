import type { Metadata } from "next";
import { Biz } from "@/components/Biz.tsx";
import { SITE } from "@/lib/config.ts";

export const metadata: Metadata = { title: `Contact us – ${SITE.name}` };

export default function Contact() {
  return (
    <div className="wrap narrow legal">
      <h1>Contact us</h1>
      <p>We are happy to help with payments, refunds, or anything about {SITE.name}.</p>
      <div className="card">
        <p>
          <strong>Business name:</strong> <Biz field="businessName" fallback="Business name" />
        </p>
        <p>
          <strong>Address:</strong> <Biz field="businessAddress" fallback="Registered address" />
        </p>
        <p>
          <strong>Email:</strong> <Biz field="supportEmail" fallback="support email" />
        </p>
        <p style={{ marginBottom: 0 }}>
          <strong>Phone / WhatsApp:</strong> <Biz field="supportPhone" fallback="support phone" />
        </p>
      </div>
      <p className="muted small" style={{ marginTop: 16 }}>
        We reply within 1 working day. For payment issues, please include your Razorpay payment ID.
      </p>
    </div>
  );
}
