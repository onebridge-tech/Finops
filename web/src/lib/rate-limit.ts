import "server-only";
import { headers } from "next/headers";
import { db } from "./db";

// Limits on how often something can be tried, counted in the database so they hold across restarts and
// server instances. A limit is a key ("login:ip:1.2.3.4"), a number of tries and a time window.

export type Limit = { key: string; max: number; windowMs: number };

export const MIN = 60_000;
export const HOUR = 60 * MIN;

/** The visitor's address: Cloudflare's header first (the site sits behind Cloudflare), then the proxy chain. */
export async function clientIp(): Promise<string> {
  const h = await headers();
  return (h.get("cf-connecting-ip") ?? h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "unknown").trim().slice(0, 64);
}

/** True when any of the limits is already used up. Does not count this try; call `hit` for that. */
export async function limited(...limits: Limit[]): Promise<boolean> {
  for (const l of limits) {
    const n = await db.rateHit.count({ where: { key: l.key, createdAt: { gt: new Date(Date.now() - l.windowMs) } } });
    if (n >= l.max) return true;
  }
  return false;
}

/** Counts one try against each key. Now and then clears rows older than a day. */
export async function hit(...keys: string[]): Promise<void> {
  await db.rateHit.createMany({ data: keys.map((key) => ({ key })) });
  if (Math.random() < 0.02) await db.rateHit.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 24 * HOUR) } } }).catch(() => undefined);
}

/** Forgets the tries for these keys (after a successful sign-in, the failures no longer count). */
export async function clearHits(...keys: string[]): Promise<void> {
  await db.rateHit.deleteMany({ where: { key: { in: keys } } });
}
