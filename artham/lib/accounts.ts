// Wallets (anonymous visitor balances), orders (Razorpay payments) and daily stats.
// Documents themselves are never stored.

import { createHash, randomUUID } from "node:crypto";
import { getKV, update } from "./kv.ts";

export type Wallet = {
  id: string;
  credits: number;
  freeCredits: number;
  totalPurchased: number;
  totalUsed: number;
  createdAt: string;
  updatedAt: string;
};

export type Order = {
  id: string;
  walletId: string;
  planId: string;
  credits: number;
  amountPaise: number;
  status: "created" | "paid";
  paymentId?: string;
  provider: "razorpay" | "test";
  createdAt: string;
  paidAt?: string;
};

export type DailyStats = {
  date: string;
  newWallets: number;
  documents: number;
  failedDocuments: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  orders: number;
  revenuePaise: number;
  byModel: Record<string, number>;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function isWalletId(id: string | undefined | null): id is string {
  return !!id && UUID_RE.test(id);
}

const now = () => new Date().toISOString();
export const today = () => new Date().toISOString().slice(0, 10);

export async function getWallet(id: string): Promise<Wallet | null> {
  const res = await getKV().get<Wallet>(`wallet/${id}`);
  return res ? res.value : null;
}

function hashIp(ip: string): string {
  return createHash("sha256")
    .update((process.env.HASH_SALT || "artham") + ":" + ip)
    .digest("hex")
    .slice(0, 32);
}

/** Counts free wallets handed out to one IP today; returns how many free credits to grant. */
async function freeCreditsFor(ip: string | null): Promise<number> {
  const free = Math.max(0, Number(process.env.FREE_CREDITS ?? 2) || 0);
  if (!free || !ip) return free;
  const limit = Math.max(0, Number(process.env.FREE_WALLETS_PER_IP_PER_DAY ?? 10) || 0);
  let allowed = false;
  await update<{ count: number }>(getKV(), `ipfree/${today()}/${hashIp(ip)}`, (cur) => {
    const count = cur?.count ?? 0;
    allowed = count < limit;
    return allowed ? { count: count + 1 } : undefined;
  });
  return allowed ? free : 0;
}

export async function createWallet(ip: string | null): Promise<Wallet> {
  const free = await freeCreditsFor(ip);
  const wallet: Wallet = {
    id: randomUUID(),
    credits: free,
    freeCredits: free,
    totalPurchased: 0,
    totalUsed: 0,
    createdAt: now(),
    updatedAt: now(),
  };
  await getKV().create(`wallet/${wallet.id}`, wallet);
  await bumpStats({ newWallets: 1 });
  return wallet;
}

/** Takes one credit. Returns the updated wallet, or null when the balance is zero. */
export async function reserveCredit(walletId: string): Promise<Wallet | null> {
  const res = await update<Wallet>(getKV(), `wallet/${walletId}`, (w) => {
    if (!w || w.credits < 1) return undefined;
    return { ...w, credits: w.credits - 1, totalUsed: w.totalUsed + 1, updatedAt: now() };
  });
  return res.changed ? res.value : null;
}

/** Gives a credit back after a failed explanation. */
export async function refundCredit(walletId: string): Promise<Wallet | null> {
  const res = await update<Wallet>(getKV(), `wallet/${walletId}`, (w) => {
    if (!w) return undefined;
    return { ...w, credits: w.credits + 1, totalUsed: Math.max(0, w.totalUsed - 1), updatedAt: now() };
  });
  return res.value;
}

export async function createOrder(order: Omit<Order, "status" | "createdAt">): Promise<Order> {
  const full: Order = { ...order, status: "created", createdAt: now() };
  const ok = await getKV().create(`order/${order.id}`, full);
  if (!ok) throw new Error("Order already exists");
  return full;
}

export async function getOrder(id: string): Promise<Order | null> {
  const res = await getKV().get<Order>(`order/${id}`);
  return res ? res.value : null;
}

/**
 * Marks an order paid and adds its credits to the wallet exactly once,
 * even if the browser callback and the webhook both arrive.
 */
export async function fulfillOrder(
  orderId: string,
  paymentId: string,
): Promise<{ order: Order; wallet: Wallet | null; newlyPaid: boolean } | null> {
  const kv = getKV();
  const res = await update<Order>(kv, `order/${orderId}`, (o) => {
    if (!o || o.status === "paid") return undefined;
    return { ...o, status: "paid", paymentId, paidAt: now() };
  });
  const order = res.value;
  if (!order) return null;
  if (!res.changed) return { order, wallet: await getWallet(order.walletId), newlyPaid: false };

  const w = await update<Wallet>(kv, `wallet/${order.walletId}`, (wallet) => {
    if (!wallet) return undefined;
    return {
      ...wallet,
      credits: wallet.credits + order.credits,
      totalPurchased: wallet.totalPurchased + order.credits,
      updatedAt: now(),
    };
  });
  await bumpStats({ orders: 1, revenuePaise: order.amountPaise });
  return { order, wallet: w.value, newlyPaid: true };
}

// ---------------------------------------------------------------------------
// Daily statistics for the /admin page.

type StatsDelta = Partial<Omit<DailyStats, "date" | "byModel">> & { model?: string };

export async function bumpStats(delta: StatsDelta, date = today()): Promise<void> {
  try {
    await update<DailyStats>(getKV(), `stats/${date}`, (cur) => {
      const s: DailyStats = cur ?? {
        date,
        newWallets: 0,
        documents: 0,
        failedDocuments: 0,
        inputTokens: 0,
        outputTokens: 0,
        costUsd: 0,
        orders: 0,
        revenuePaise: 0,
        byModel: {},
      };
      const next: DailyStats = { ...s, byModel: { ...s.byModel } };
      for (const k of [
        "newWallets",
        "documents",
        "failedDocuments",
        "inputTokens",
        "outputTokens",
        "costUsd",
        "orders",
        "revenuePaise",
      ] as const) {
        if (delta[k]) next[k] = Math.round((next[k] + (delta[k] as number)) * 1e6) / 1e6;
      }
      if (delta.model && delta.documents) next.byModel[delta.model] = (next.byModel[delta.model] ?? 0) + delta.documents;
      return next;
    });
  } catch (e) {
    // Stats must never break a user request.
    console.error("stats update failed", e);
  }
}

export async function getStats(days: number): Promise<DailyStats[]> {
  const kv = getKV();
  const out: DailyStats[] = [];
  for (let i = 0; i < days; i++) {
    const date = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    const res = await kv.get<DailyStats>(`stats/${date}`);
    if (res) out.push(res.value);
  }
  return out;
}
