import { NextResponse } from "next/server";
import { currentWallet } from "@/lib/session.ts";
import { razorpayConfigured, testPaymentsAllowed } from "@/lib/razorpay.ts";
import { aiConfigured, demoMode } from "@/lib/ai.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const wallet = await currentWallet(true);
  return NextResponse.json(
    {
      credits: wallet.credits,
      freeCredits: wallet.freeCredits,
      payments: razorpayConfigured() ? "razorpay" : testPaymentsAllowed() ? "test" : "unavailable",
      demo: !aiConfigured() && demoMode(),
      ready: aiConfigured() || demoMode(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
