import "server-only";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "./auth";
import { db } from "./db";
import { normalizeEmail } from "./identity";
import { normalizeIndianMobile } from "./share";

// Platform admins are the people who run FinOps itself, not a shop. They are named in the
// environment (PLATFORM_ADMIN_PHONES, PLATFORM_ADMIN_EMAILS; comma separated), never in the app,
// so nobody can promote themselves and removing a name there removes the access at once.

const phones = () => (process.env.PLATFORM_ADMIN_PHONES ?? "").split(",").map((p) => normalizeIndianMobile(p.trim())).filter((p): p is string => !!p);
const emails = () => [process.env.PLATFORM_ADMIN_EMAIL ?? "", ...(process.env.PLATFORM_ADMIN_EMAILS ?? "").split(",")].map((e) => normalizeEmail(e)).filter((e): e is string => !!e);

/** The admin account whose password is set on the server (PLATFORM_ADMIN_EMAIL + PLATFORM_ADMIN_PASSWORD), if any. */
export const serverAdminEmail = () => (process.env.PLATFORM_ADMIN_PASSWORD ? normalizeEmail(process.env.PLATFORM_ADMIN_EMAIL ?? "") : null);

export function isPlatformAdmin(u: { phone?: string | null; email?: string | null; emailVerifiedAt?: Date | null }): boolean {
  if (u.phone && phones().includes(u.phone)) return true; // a phone number is only stored after its code was entered
  return !!u.email && !!u.emailVerifiedAt && emails().includes(u.email.toLowerCase());
}

/**
 * The signed-in platform admin, or a plain "not found" for anyone else so the area's existence is not
 * revealed. An admin must also have an app-lock PIN, because this area shows every shop.
 */
export async function requirePlatformAdmin() {
  const { user } = await requireUser();
  if (!isPlatformAdmin(user)) notFound();
  if (!user.pinHash) redirect("/account/security?admin=1");
  return user;
}

/** Notes that an admin opened a shop, at most once every ten minutes so the log stays readable. */
export async function platformView(actorId: string, target: string) {
  const recent = await db.platformAudit.findFirst({ where: { actorId, action: "view_shop", target, createdAt: { gt: new Date(Date.now() - 600_000) } }, select: { id: true } });
  if (!recent) await platformAudit(actorId, "view_shop", target);
}

/** Records what an admin looked at or changed. */
export async function platformAudit(actorId: string, action: string, target?: string, data?: unknown) {
  await db.platformAudit.create({ data: { actorId, action, target: target ?? null, data: data === undefined ? null : JSON.stringify(data).slice(0, 2000) } });
}
