import { NextResponse } from "next/server";
import { fulfillOrder, getOrder } from "@/lib/accounts.ts";
import { testPaymentsAllowed, verifyPaymentSignature } from "@/lib/razorpay.ts";

export const runtime = "nodejs";

type Body = {
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  razorpay_signature?: string;
  test_order_id?: string;
};

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Body;

  // Local development only: complete a test order without real money.
  if (body.test_order_id) {
    if (!testPaymentsAllowed()) return NextResponse.json({ error: "Test payments are disabled." }, { status: 403 });
    const order = await getOrder(body.test_order_id);
    if (!order || order.provider !== "test") return NextResponse.json({ error: "Order not found." }, { status: 404 });
    const res = await fulfillOrder(order.id, `test_pay_${Date.now()}`);
    return NextResponse.json({ ok: true, credits: res?.wallet?.credits ?? 0, added: order.credits });
  }

  const orderId = String(body.razorpay_order_id || "");
  const paymentId = String(body.razorpay_payment_id || "");
  const signature = String(body.razorpay_signature || "");
  const secret = process.env.RAZORPAY_KEY_SECRET || "";

  if (!verifyPaymentSignature(orderId, paymentId, signature, secret)) {
    return NextResponse.json({ error: "Payment could not be verified. If money was deducted, contact support." }, { status: 400 });
  }
  const res = await fulfillOrder(orderId, paymentId);
  if (!res) return NextResponse.json({ error: "Order not found. Please contact support." }, { status: 404 });
  console.log(JSON.stringify({ event: "payment_verified", orderId, newlyPaid: res.newlyPaid }));
  return NextResponse.json({ ok: true, credits: res.wallet?.credits ?? 0, added: res.order.credits });
}
