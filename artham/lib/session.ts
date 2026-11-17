// Anonymous visitor wallet, identified by an httpOnly cookie. No login needed.

import { cookies, headers } from "next/headers";
import { createWallet, getWallet, isWalletId, type Wallet } from "./accounts.ts";

export const WALLET_COOKIE = "artham_wallet";

export async function clientIp(): Promise<string | null> {
  const h = await headers();
  return (
    h.get("x-nf-client-connection-ip") ||
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    null
  );
}

/** Returns the visitor's wallet. Creates one (with free credits) when `create` is true. */
export async function currentWallet(create: true): Promise<Wallet>;
export async function currentWallet(create?: false): Promise<Wallet | null>;
export async function currentWallet(create = false): Promise<Wallet | null> {
  const jar = await cookies();
  const id = jar.get(WALLET_COOKIE)?.value;
  if (isWalletId(id)) {
    const wallet = await getWallet(id);
    if (wallet) return wallet;
  }
  if (!create) return null;
  const wallet = await createWallet(await clientIp());
  jar.set(WALLET_COOKIE, wallet.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365 * 2,
  });
  return wallet;
}
