import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { findPlan, SITE } from "@/lib/config.ts";
import { createOrder } from "@/lib/accounts.ts";
import { currentWallet } from "@/lib/session.ts";
import { createRazorpayOrder, razorpayConfigured, testPaymentsAllowed } from "@/lib/razorpay.ts";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { planId?: string };
  const plan = findPlan(String(body.planId || ""));
  if (!plan) return NextResponse.json({ error: "Please choose a pack." }, { status: 400 });

  const wallet = await currentWallet(true);

  if (razorpayConfigured()) {
    try {
      const rp = await createRazorpayOrder({
        amountPaise: plan.pricePaise,
        receipt: `w_${wallet.id.slice(0, 8)}_${Date.now()}`,
        notes: { wallet_id: wallet.id, plan_id: plan.id, credits: String(plan.credits) },
      });
      await createOrder({
        id: rp.id,
        walletId: wallet.id,
        planId: plan.id,
        credits: plan.credits,
        amountPaise: plan.pricePaise,
        provider: "razorpay",
      });
      return NextResponse.json({
        mode: "razorpay",
        keyId: process.env.RAZORPAY_KEY_ID,
        orderId: rp.id,
        amount: rp.amount,
        currency: rp.currency,
        name: SITE.name,
        description: `${plan.label} - ${SITE.name}`,
      });
    } catch (err) {
      console.error(JSON.stringify({ event: "order_failed", reason: String(err) }));
      return NextResponse.json({ error: "Could not start the payment. Please try again." }, { status: 502 });
    }
  }

  if (testPaymentsAllowed()) {
    const id = `test_${randomUUID()}`;
    await createOrder({
      id,
      walletId: wallet.id,
      planId: plan.id,
      credits: plan.credits,
      amountPaise: plan.pricePaise,
      provider: "test",
    });
    return NextResponse.json({ mode: "test", orderId: id, amount: plan.pricePaise });
  }

  return NextResponse.json({ error: "Payments are not available yet. Please check back soon." }, { status: 503 });
}
