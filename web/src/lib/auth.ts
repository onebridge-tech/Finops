import "server-only";
import { cache } from "react";
import { forbidden, redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { readSession } from "./session";
import { can, type Permission, type Role } from "./roles";
import { isPlatformAdmin } from "./platform-admins";

export { can, ROLES, ROLE_LABEL, type Permission, type Role } from "./roles";

const session = cache(readSession);

/** Signed-in, unlocked user, or redirect to login / the lock screen. */
export async function requireUser(o: { closedAccountOk?: boolean } = {}) {
  const s = await session();
  if (!s) redirect("/login");
  if (s.locked) redirect("/lock");
  const user = await db.user.findUnique({ where: { id: s.uid } });
  if (!user) redirect("/login");
  // An account waiting to be erased opens nothing but the page where it can be kept (lib/erase.ts).
  if (user.deletionRequestedAt && !o.closedAccountOk) redirect("/account/delete");
  return { user, session: s };
}

const membershipFor = cache(async (userId: string, businessId: string) =>
  db.membership.findUnique({ where: { userId_businessId: { userId, businessId } }, include: { business: true } }),
);

/**
 * Signed-in user with an active business membership, or redirect. Returns the
 * access context every page and action works within: role, the branch in view
 * (a member tied to a branch is always in it), and whether they only see their
 * assigned parties (SE-01).
 */
export async function requireBusiness(permission?: Permission) {
  const { user, session } = await requireUser();
  const membership = session.bid ? await membershipFor(user.id, session.bid) : null;
  if (!membership) {
    // Fall back to any business the user belongs to before sending them to onboarding.
    const other = await db.membership.findFirst({ where: { userId: user.id }, orderBy: { createdAt: "asc" } });
    if (other) {
      await db.session.update({ where: { id: session.sid }, data: { businessId: other.businessId, branchId: null } });
      redirect("/dashboard");
    }
    redirect(isPlatformAdmin(user) ? "/platform" : "/onboarding");
  }
  if (membership.business.suspendedAt || membership.business.closingAt) redirect("/suspended");
  const role = membership.role as Role;
  if (permission && !can(role, permission)) forbidden();
  const branchId = membership.branchId ?? session.brid ?? null;
  return {
    user, session, membership, role, business: membership.business,
    branchId,
    assignedOnly: membership.partyScope === "ASSIGNED",
  };
}

export type Ctx = Awaited<ReturnType<typeof requireBusiness>>;

/** Parties this member may see: their branch (plus shared parties) and, for reps, only their own. */
export function partyWhere(ctx: Ctx): Prisma.PartyWhereInput {
  return {
    businessId: ctx.business.id,
    ...(ctx.branchId ? { OR: [{ branchId: ctx.branchId }, { branchId: null }] } : {}),
    ...(ctx.assignedOnly ? { ownerId: ctx.user.id } : {}),
  };
}

/** A party by id, only if this member may see it. */
export function findParty(ctx: Ctx, id: string) {
  return db.party.findFirst({ where: { ...partyWhere(ctx), id } });
}

/** Records tagged with a branch show in that branch's view; untagged (shared) ones show in every view. */
export function branchOrShared(ctx: Ctx) {
  return ctx.branchId ? { OR: [{ branchId: ctx.branchId }, { branchId: null }] } : {};
}

/** Invoices / quotations in view: the active branch, and for reps their own parties only. */
export function docWhere(ctx: Ctx) {
  return {
    businessId: ctx.business.id,
    ...(ctx.branchId ? { branchId: ctx.branchId } : {}),
    ...(ctx.assignedOnly ? { party: { ownerId: ctx.user.id } } : {}),
  };
}
