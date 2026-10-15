import "server-only";
import { db } from "./db";
import type { Ctx } from "./auth";
import { userLabel } from "@/lib/identity";

/**
 * Options for the "Assigned to" and "Branch" pickers on the party form, or null
 * where this member isn't allowed to change them.
 */
export async function partyFormOptions(ctx: Ctx) {
  const [members, branches, priceLists] = await Promise.all([
    ctx.assignedOnly ? null : db.membership.findMany({ where: { businessId: ctx.business.id }, include: { user: true }, orderBy: { createdAt: "asc" } }),
    ctx.membership.branchId ? null : db.branch.findMany({ where: { businessId: ctx.business.id, archivedAt: null }, orderBy: { name: "asc" } }),
    db.priceList.findMany({ where: { businessId: ctx.business.id, archivedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  return {
    owners: members?.map((m) => ({ id: m.userId, name: userLabel(m.user) })) ?? null,
    branches: branches?.map((b) => ({ id: b.id, name: b.name })) ?? null,
    priceLists,
  };
}

/** Everyone on the team, for "assign to" pickers. */
export async function teamOptions(businessId: string) {
  const members = await db.membership.findMany({ where: { businessId }, include: { user: true }, orderBy: { createdAt: "asc" } });
  return members.map((m) => ({ id: m.userId, name: userLabel(m.user) }));
}
