import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { getStats } from "@/lib/accounts.ts";
import { aiConfigured } from "@/lib/ai.ts";
import { razorpayConfigured } from "@/lib/razorpay.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function keyMatches(given: string, expected: string) {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(req: Request) {
  const expected = process.env.ADMIN_KEY || "";
  const given = req.headers.get("x-admin-key") || "";
  if (!expected || expected.length < 12 || !keyMatches(given, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const days = await getStats(30);
  return NextResponse.json(
    {
      days,
      config: {
        ai: aiConfigured(),
        model: process.env.ARTHAM_MODEL || "claude-opus-5-5",
        effort: process.env.ARTHAM_EFFORT || "medium",
        payments: razorpayConfigured(),
        liveKeys: (process.env.RAZORPAY_KEY_ID || "").startsWith("rzp_live_"),
        webhook: !!process.env.RAZORPAY_WEBHOOK_SECRET,
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
