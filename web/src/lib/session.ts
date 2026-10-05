import "server-only";
import { createHash, createHmac, randomBytes, randomInt, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import { db } from "./db";

const COOKIE = "sid";
const MAX_AGE_S = 60 * 60 * 24 * 30;
const TOUCH_EVERY_MS = 60_000;

// The cookie carries only a signed session id; the Session row holds the rest,
// so devices can be listed, locked and signed out remotely (SE-03).
type Cookie = { sid: string; exp: number };

export type ActiveSession = { sid: string; uid: string; bid?: string; brid?: string; locked: boolean };

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) throw new Error("SESSION_SECRET must be set (16+ chars)");
  return s;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function encodeSession(s: Cookie): string {
  const payload = Buffer.from(JSON.stringify(s)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function decodeSession(token: string | undefined): Cookie | null {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const s = JSON.parse(Buffer.from(payload, "base64url").toString()) as Cookie;
    return s.sid && s.exp > Date.now() ? s : null;
  } catch {
    return null;
  }
}

/**
 * The current device session, or null. Also applies the app lock: a user with a
 * PIN who has been idle longer than their lock time finds the session locked.
 */
export async function readSession(): Promise<ActiveSession | null> {
  const c = decodeSession((await cookies()).get(COOKIE)?.value);
  if (!c) return null;
  const s = await db.session.findUnique({ where: { id: c.sid }, include: { user: { select: { pinHash: true, lockAfterMin: true } } } });
  const now = Date.now();
  if (!s || s.revokedAt || s.expiresAt.getTime() < now) return null;

  let locked = !!s.lockedAt;
  const idleMs = now - s.lastActiveAt.getTime();
  if (!locked && s.user.pinHash && idleMs > s.user.lockAfterMin * 60_000) {
    await db.session.update({ where: { id: s.id }, data: { lockedAt: new Date() } });
    locked = true;
  } else if (!locked && idleMs > TOUCH_EVERY_MS) {
    await db.session.update({ where: { id: s.id }, data: { lastActiveAt: new Date() } });
  }
  return { sid: s.id, uid: s.userId, bid: s.businessId ?? undefined, brid: s.branchId ?? undefined, locked };
}

/** Signs a user in on this device. */
export async function startSession(userId: string, businessId?: string): Promise<void> {
  const h = await headers();
  const s = await db.session.create({
    data: {
      userId, businessId: businessId ?? null,
      userAgent: h.get("user-agent")?.slice(0, 300) ?? null,
      ip: (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip"))?.trim().slice(0, 64) ?? null,
      expiresAt: new Date(Date.now() + MAX_AGE_S * 1000),
    },
  });
  (await cookies()).set(COOKIE, encodeSession({ sid: s.id, exp: s.expiresAt.getTime() }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_S,
  });
}

export async function updateSession(sid: string, data: { businessId?: string | null; branchId?: string | null }) {
  await db.session.update({ where: { id: sid }, data });
}

export async function endSession(): Promise<void> {
  const c = decodeSession((await cookies()).get(COOKIE)?.value);
  if (c) await db.session.updateMany({ where: { id: c.sid, revokedAt: null }, data: { revokedAt: new Date() } });
  (await cookies()).delete(COOKIE);
}

export function hashOtp(phone: string, code: string): string {
  return createHash("sha256").update(`${secret()}:${phone}:${code}`).digest("hex");
}

export function newOtp(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/** Unguessable token for public statement / invoice links. */
export function newShareToken(): string {
  return randomBytes(18).toString("base64url");
}

export function hashPin(pin: string): string {
  const salt = randomBytes(16);
  return `${salt.toString("base64url")}:${scryptSync(pin, salt, 32).toString("base64url")}`;
}

export function verifyPin(pin: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const a = scryptSync(pin, Buffer.from(salt, "base64url"), 32);
  const b = Buffer.from(hash, "base64url");
  return a.length === b.length && timingSafeEqual(a, b);
}
