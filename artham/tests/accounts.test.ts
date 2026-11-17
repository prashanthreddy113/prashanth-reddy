import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createHmac } from "node:crypto";
import { createFileKV, setKVForTests } from "../lib/kv.ts";
import {
  createOrder,
  createWallet,
  fulfillOrder,
  getStats,
  getWallet,
  refundCredit,
  reserveCredit,
} from "../lib/accounts.ts";
import { verifyPaymentSignature, verifyWebhookSignature } from "../lib/razorpay.ts";
import { estimateCostUsd } from "../lib/ai.ts";
import { ExplanationSchema } from "../lib/schema.ts";
import { DEMO_EXPLANATION } from "../lib/demo.ts";

beforeEach(() => {
  const dir = mkdtempSync(path.join(tmpdir(), "artham-test-"));
  setKVForTests(createFileKV(path.join(dir, "store.json")));
  process.env.FREE_CREDITS = "2";
  process.env.FREE_WALLETS_PER_IP_PER_DAY = "2";
});

test("new wallet gets free credits, limited per IP per day", async () => {
  const a = await createWallet("1.2.3.4");
  const b = await createWallet("1.2.3.4");
  const c = await createWallet("1.2.3.4");
  const d = await createWallet("5.6.7.8");
  assert.equal(a.credits, 2);
  assert.equal(b.credits, 2);
  assert.equal(c.credits, 0, "third wallet from same IP gets no free credits");
  assert.equal(d.credits, 2);
});

test("reserve never goes below zero, refund restores", async () => {
  const w = await createWallet("9.9.9.9");
  assert.equal((await reserveCredit(w.id))?.credits, 1);
  assert.equal((await reserveCredit(w.id))?.credits, 0);
  assert.equal(await reserveCredit(w.id), null);
  assert.equal((await refundCredit(w.id))?.credits, 1);
  const stored = await getWallet(w.id);
  assert.equal(stored?.credits, 1);
  assert.equal(stored?.totalUsed, 1);
});

test("concurrent reservations cannot overspend", async () => {
  const w = await createWallet("8.8.8.8");
  const results = await Promise.all(Array.from({ length: 6 }, () => reserveCredit(w.id)));
  assert.equal(results.filter(Boolean).length, 2);
  assert.equal((await getWallet(w.id))?.credits, 0);
});

test("an order is credited exactly once (checkout callback + webhook)", async () => {
  const w = await createWallet(null);
  await createOrder({ id: "order_X", walletId: w.id, planId: "pack5", credits: 5, amountPaise: 9900, provider: "razorpay" });
  const results = await Promise.all([fulfillOrder("order_X", "pay_1"), fulfillOrder("order_X", "pay_1"), fulfillOrder("order_X", "pay_1")]);
  assert.equal(results.filter((r) => r?.newlyPaid).length, 1);
  assert.equal((await getWallet(w.id))?.credits, 2 + 5);
  assert.equal(await fulfillOrder("missing", "pay_2"), null);
  const [today] = await getStats(1);
  assert.equal(today.orders, 1);
  assert.equal(today.revenuePaise, 9900);
});

test("duplicate order ids are rejected", async () => {
  const w = await createWallet(null);
  const o = { id: "order_dup", walletId: w.id, planId: "single", credits: 1, amountPaise: 2900, provider: "razorpay" as const };
  await createOrder(o);
  await assert.rejects(() => createOrder(o));
});

test("Razorpay signatures", () => {
  const secret = "s3cret";
  const sig = createHmac("sha256", secret).update("order_1|pay_1").digest("hex");
  assert.equal(verifyPaymentSignature("order_1", "pay_1", sig, secret), true);
  assert.equal(verifyPaymentSignature("order_1", "pay_2", sig, secret), false);
  assert.equal(verifyPaymentSignature("order_1", "pay_1", sig, ""), false);
  assert.equal(verifyPaymentSignature("order_1", "pay_1", "short", secret), false);

  const body = JSON.stringify({ event: "payment.captured" });
  const wsig = createHmac("sha256", "whsec").update(body).digest("hex");
  assert.equal(verifyWebhookSignature(body, wsig, "whsec"), true);
  assert.equal(verifyWebhookSignature(body + " ", wsig, "whsec"), false);
});

test("cost estimate", () => {
  // 5,000 input + 1,500 output tokens on Claude Opus 5.5 = $0.02 + $0.03
  assert.equal(estimateCostUsd("claude-opus-5-5", 5000, 1500).toFixed(4), "0.0500");
  assert.equal(estimateCostUsd("claude-haiku-5-5", 5000, 1500).toFixed(5), "0.00125");
});

test("demo explanation matches the AI output schema", () => {
  assert.equal(ExplanationSchema.safeParse(DEMO_EXPLANATION).success, true);
});
