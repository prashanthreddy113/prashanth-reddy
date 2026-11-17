"use client";

import { useEffect, useState } from "react";
import { PLANS, rupees } from "@/lib/config.ts";
import { openCheckout } from "@/lib/client/checkout.ts";

type Props = {
  payments: "razorpay" | "test" | "unavailable";
  onClose: () => void;
  onPurchased: (creditsNow: number, added: number) => void;
};

export default function BuyModal({ payments, onClose, onPurchased }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  async function buy(planId: string) {
    setError("");
    setBusy(planId);
    try {
      const res = await fetch("/api/payments/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      });
      const order = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(order.error || "Could not start the payment.");

      let verifyBody: Record<string, string>;
      if (order.mode === "test") {
        if (!window.confirm("TEST MODE: no real money. Simulate a successful payment?")) throw new Error("dismissed");
        verifyBody = { test_order_id: order.orderId };
      } else {
        const paid = await openCheckout({
          keyId: order.keyId,
          orderId: order.orderId,
          amount: order.amount,
          currency: order.currency,
          name: order.name,
          description: order.description,
        });
        verifyBody = { ...paid };
      }

      const v = await fetch("/api/payments/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(verifyBody),
      });
      const result = await v.json().catch(() => ({}));
      if (!v.ok) throw new Error(result.error || "Payment received but not confirmed yet. Please refresh in a minute.");
      onPurchased(result.credits, result.added);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg !== "dismissed") setError(msg);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="modal-backdrop" onClick={() => !busy && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="buy-title" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2 id="buy-title">Get more documents explained</h2>
          <button className="close-btn" aria-label="Close" onClick={onClose} disabled={!!busy}>
            ×
          </button>
        </div>

        {payments === "unavailable" ? (
          <div className="alert alert-info">Online payments are being set up. Please check back soon.</div>
        ) : (
          <>
            <p className="muted small" style={{ marginTop: 8 }}>
              One credit = one document explained (up to {6} photos or a 20-page PDF). Credits never expire.
            </p>
            {PLANS.map((p) => (
              <button key={p.id} className="plan-option" onClick={() => buy(p.id)} disabled={!!busy}>
                <span>
                  <strong>{p.label}</strong>
                  <span className="p-sub">
                    {p.credits > 1 ? `${rupees(Math.round(p.pricePaise / p.credits))} per document` : "Pay as you go"}
                    {p.badge ? ` · ${p.badge}` : ""}
                  </span>
                </span>
                <span className="p-price">{busy === p.id ? "…" : rupees(p.pricePaise)}</span>
              </button>
            ))}
            {error && (
              <div className="alert alert-error" role="alert">
                {error}
              </div>
            )}
            <div className="pay-methods">
              {payments === "test"
                ? "Test mode – no real payment will be taken."
                : "Pay securely with UPI (GPay, PhonePe, Paytm), cards or net banking via Razorpay."}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
