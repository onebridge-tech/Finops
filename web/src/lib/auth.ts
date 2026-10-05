import "server-only";
import { redirect } from "next/navigation";
import { db } from "./db";
import { readSession } from "./session";

export type Role = "OWNER" | "ADMIN" | "ACCOUNTANT" | "BILLING" | "REP" | "VIEWER";

export type Permission =
  | "party:write"
  | "ledger:write"
  | "ledger:reverse"
  | "item:write"
  | "invoice:write"
  | "invoice:cancel"
  | "reminder:send"
  | "settings:write";

// Default role templates (PRD section 8). Branch / party-group scoping comes in Phase 2.
const GRANTS: Record<Role, Permission[]> = {
  OWNER: ["party:write", "ledger:write", "ledger:reverse", "item:write", "invoice:write", "invoice:cancel", "reminder:send", "settings:write"],
  ADMIN: ["party:write", "ledger:write", "ledger:reverse", "item:write", "invoice:write", "invoice:cancel", "reminder:send", "settings:write"],
  ACCOUNTANT: ["party:write", "ledger:write", "ledger:reverse", "item:write", "invoice:write", "invoice:cancel", "reminder:send"],
  BILLING: ["party:write", "ledger:write", "invoice:write", "reminder:send"],
  REP: ["party:write", "ledger:write", "reminder:send"],
  VIEWER: [],
};

export function can(role: string, p: Permission): boolean {
  return GRANTS[role as Role]?.includes(p) ?? false;
}

/** Signed-in user, or redirect to login. */
export async function requireUser() {
  const s = await readSession();
  if (!s) redirect("/login");
  const user = await db.user.findUnique({ where: { id: s.uid } });
  if (!user) redirect("/login");
  return { user, session: s };
}

/** Signed-in user with an active business membership, or redirect. */
export async function requireBusiness(permission?: Permission) {
  const { user, session } = await requireUser();
  const membership = session.bid
    ? await db.membership.findUnique({
        where: { userId_businessId: { userId: user.id, businessId: session.bid } },
        include: { business: true },
      })
    : null;
  if (!membership) redirect("/onboarding");
  if (permission && !can(membership.role, permission)) {
    throw new Error("You do not have permission to do this.");
  }
  return { user, business: membership.business, role: membership.role as Role };
}
