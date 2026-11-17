// Razorpay webhook: credits the order even if the customer closed the browser
// before the checkout callback ran. Configure in Razorpay Dashboard -> Webhooks
// with events "payment.captured" and "order.paid".
import { NextResponse } from "next/server";
import { fulfillOrder, getOrder } from "@/lib/accounts.ts";
import { verifyWebhookSignature } from "@/lib/razorpay.ts";

export const runtime = "nodejs";

type PaymentEntity = { id?: string; order_id?: string; amount?: number; status?: string };
type Webhook = { event?: string; payload?: { payment?: { entity?: PaymentEntity } } };

export async function POST(req: Request) {
  const raw = await req.text();
  const signature = req.headers.get("x-razorpay-signature") || "";
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET || "";
  if (!verifyWebhookSignature(raw, signature, secret)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  let event: Webhook;
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  if (event.event !== "payment.captured" && event.event !== "order.paid") {
    return NextResponse.json({ ok: true, ignored: event.event });
  }

  const payment = event.payload?.payment?.entity;
  if (!payment?.order_id || !payment.id) return NextResponse.json({ ok: true, ignored: "no order" });

  const order = await getOrder(payment.order_id);
  if (!order) {
    console.warn(JSON.stringify({ event: "webhook_unknown_order", orderId: payment.order_id }));
    return NextResponse.json({ ok: true, ignored: "unknown order" });
  }
  if (typeof payment.amount === "number" && payment.amount < order.amountPaise) {
    console.error(JSON.stringify({ event: "webhook_amount_mismatch", orderId: order.id }));
    return NextResponse.json({ ok: true, ignored: "amount mismatch" });
  }

  const res = await fulfillOrder(order.id, payment.id);
  console.log(JSON.stringify({ event: "webhook_paid", orderId: order.id, newlyPaid: res?.newlyPaid }));
  return NextResponse.json({ ok: true });
}
