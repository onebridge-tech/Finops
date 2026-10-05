import "server-only";
import { randomBytes } from "node:crypto";
import { db } from "./db";
import { appUrl } from "./share";

// Invite loop (EC-03): every statement, invoice, receipt and quotation a
// business shares carries its invite link; sign-ups through it are credited
// to that business.

const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

function newCode(): string {
  return [...randomBytes(8)].map((b) => ALPHABET[b % ALPHABET.length]).join("");
}

/** The business's invite code, created the first time it is needed. */
export async function referralCode(businessId: string): Promise<string> {
  const b = await db.business.findUniqueOrThrow({ where: { id: businessId }, select: { referralCode: true } });
  if (b.referralCode) return b.referralCode;
  for (;;) {
    const code = newCode();
    const r = await db.business.updateMany({ where: { id: businessId, referralCode: null }, data: { referralCode: code } }).catch(() => null);
    if (r?.count) return code;
    const again = await db.business.findUniqueOrThrow({ where: { id: businessId }, select: { referralCode: true } });
    if (again.referralCode) return again.referralCode; // set concurrently
  }
}

export async function inviteUrl(businessId: string): Promise<string> {
  return appUrl(`/join/${await referralCode(businessId)}`);
}

export const REF_COOKIE = "ref";
