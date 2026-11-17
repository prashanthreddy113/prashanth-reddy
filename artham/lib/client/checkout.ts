// Browser-only: loads Razorpay Checkout and resolves with the payment details.

type RazorpaySuccess = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};

type RazorpayOptions = {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  handler: (res: RazorpaySuccess) => void;
  modal?: { ondismiss?: () => void; confirm_close?: boolean };
  theme?: { color?: string };
  notes?: Record<string, string>;
};

type RazorpayInstance = {
  open: () => void;
  on: (event: "payment.failed", cb: (res: { error?: { description?: string } }) => void) => void;
};

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

let loading: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  if (loading) return loading;
  loading = new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      loading = null;
      reject(new Error("Could not load the payment window. Check your internet connection."));
    };
    document.body.appendChild(s);
  });
  return loading;
}

export async function openCheckout(opts: {
  keyId: string;
  orderId: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
}): Promise<RazorpaySuccess> {
  await loadScript();
  return new Promise((resolve, reject) => {
    // A failed attempt keeps the Razorpay window open so the customer can retry,
    // so remember the error and only give up when they close the window.
    let lastError = "";
    const rzp = new window.Razorpay!({
      key: opts.keyId,
      amount: opts.amount,
      currency: opts.currency,
      name: opts.name,
      description: opts.description,
      order_id: opts.orderId,
      handler: resolve,
      modal: { ondismiss: () => reject(new Error(lastError || "dismissed")), confirm_close: true },
      theme: { color: "#1d4e89" },
    });
    rzp.on("payment.failed", (res) => {
      lastError = res.error?.description || "Payment failed. No money was taken.";
    });
    rzp.open();
  });
}
