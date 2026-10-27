import "server-only";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "./auth";
import { db } from "./db";

// Who is a platform admin lives in ./platform-admins (no imports of the sign-in code, so lib/auth can use it too).
import { isPlatformAdmin } from "./platform-admins";
export { isPlatformAdmin, serverAdminEmail } from "./platform-admins";

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
