"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireBusiness, requireUser, ROLES, type Role } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { normalizeIndianMobile } from "@/lib/share";
import { UI_LANGUAGES } from "@/lib/i18n";
import { TILES } from "@/lib/tiles";

export type TeamState = { error?: string; ok?: boolean; info?: string };

const field = (f: FormData, k: string) => String(f.get(k) ?? "");

const MemberInput = z.object({
  role: z.enum(ROLES as [Role, ...Role[]]),
  branchId: z.string(),
  partyScope: z.enum(["ALL", "ASSIGNED"]),
  maxDiscount: z.string().trim().refine((v) => v === "" || /^\d{1,2}(\.\d{1,2})?$|^100$/.test(v), "Discount limit must be a percentage"),
});

async function parseMember(form: FormData, businessId: string) {
  const r = MemberInput.safeParse({ role: field(form, "role"), branchId: field(form, "branchId"), partyScope: field(form, "partyScope"), maxDiscount: field(form, "maxDiscount") });
  if (!r.success) return { error: r.error.issues[0].message } as const;
  const d = r.data;
  if (d.branchId && !(await db.branch.count({ where: { id: d.branchId, businessId, archivedAt: null } }))) return { error: "Branch not found" } as const;
  return {
    data: {
      role: d.role, branchId: d.branchId || null,
      // Field reps always work from their own party list.
      partyScope: d.role === "REP" ? "ASSIGNED" : d.partyScope,
      maxDiscountBp: d.maxDiscount === "" ? null : Math.round(Number(d.maxDiscount) * 100),
    },
  } as const;
}

/**
 * Adds someone to the team by mobile number (SE-01). They sign in with an OTP
 * on that number and land in this business; nothing to accept.
 */
export async function inviteMember(_prev: TeamState, form: FormData): Promise<TeamState> {
  const ctx = await requireBusiness("team:manage");
  const phone = normalizeIndianMobile(field(form, "phone"));
  if (!phone) return { error: "Enter a valid 10-digit mobile number" };
  const p = await parseMember(form, ctx.business.id);
  if ("error" in p) return { error: p.error };
  if (p.data.role === "OWNER" && ctx.role !== "OWNER") return { error: "Only the owner can add another owner" };

  const name = field(form, "name").trim().slice(0, 80) || null;
  const user = await db.user.upsert({ where: { phone }, update: {}, create: { phone, name } });
  if (!user.name && name) await db.user.update({ where: { id: user.id }, data: { name } });
  const existing = await db.membership.findUnique({ where: { userId_businessId: { userId: user.id, businessId: ctx.business.id } } });
  if (existing) return { error: "This number is already on your team" };
  await db.$transaction(async (tx) => {
    const m = await tx.membership.create({ data: { userId: user.id, businessId: ctx.business.id, invitedById: ctx.user.id, ...p.data } });
    await audit(tx, { businessId: ctx.business.id, actorId: ctx.user.id, action: "invite", entity: "Membership", entityId: m.id, data: { phone, ...p.data } });
  });
  revalidatePath("/settings/team");
  return { ok: true, info: `Added +${phone}. They can sign in with that number now.` };
}

async function guardTarget(ctx: Awaited<ReturnType<typeof requireBusiness>>, membershipId: string) {
  const target = await db.membership.findFirst({ where: { id: membershipId, businessId: ctx.business.id } });
  if (!target) return { error: "Member not found" } as const;
  if (target.role === "OWNER" && ctx.role !== "OWNER") return { error: "Only the owner can change an owner" } as const;
  return { target } as const;
}

async function ownerCount(businessId: string) {
  return db.membership.count({ where: { businessId, role: "OWNER" } });
}

export async function updateMember(_prev: TeamState, form: FormData): Promise<TeamState> {
  const ctx = await requireBusiness("team:manage");
  const g = await guardTarget(ctx, field(form, "membershipId"));
  if ("error" in g) return { error: g.error };
  const p = await parseMember(form, ctx.business.id);
  if ("error" in p) return { error: p.error };
  if (p.data.role === "OWNER" && ctx.role !== "OWNER") return { error: "Only the owner can make someone an owner" };
  if (g.target.role === "OWNER" && p.data.role !== "OWNER" && (await ownerCount(ctx.business.id)) <= 1) return { error: "A business needs at least one owner" };
  await db.$transaction(async (tx) => {
    await tx.membership.update({ where: { id: g.target.id }, data: p.data });
    await audit(tx, { businessId: ctx.business.id, actorId: ctx.user.id, action: "update", entity: "Membership", entityId: g.target.id, data: { before: g.target, after: p.data } });
  });
  revalidatePath("/settings/team");
  return { ok: true, info: "Saved" };
}

/** Removes someone and signs them out of this business on every device. Their entries stay. */
export async function removeMember(form: FormData): Promise<void> {
  const ctx = await requireBusiness("team:manage");
  const g = await guardTarget(ctx, field(form, "membershipId"));
  if ("error" in g) throw new Error(g.error);
  if (g.target.userId === ctx.user.id) throw new Error("You can't remove yourself");
  if (g.target.role === "OWNER" && (await ownerCount(ctx.business.id)) <= 1) throw new Error("A business needs at least one owner");
  await db.$transaction(async (tx) => {
    await tx.membership.delete({ where: { id: g.target.id } });
    await tx.session.updateMany({ where: { userId: g.target.userId, businessId: ctx.business.id, revokedAt: null }, data: { revokedAt: new Date() } });
    await tx.party.updateMany({ where: { businessId: ctx.business.id, ownerId: g.target.userId }, data: { ownerId: null } });
    await audit(tx, { businessId: ctx.business.id, actorId: ctx.user.id, action: "remove", entity: "Membership", entityId: g.target.id, data: g.target });
  });
  revalidatePath("/settings/team");
}

// ── Branches (LG-12) ─────────────────────────────────────────────────────────

const BranchInput = z.object({
  name: z.string().trim().min(2, "Branch name is required").max(60),
  address: z.string().trim().max(300),
  phone: z.string().trim().max(20),
});

export async function saveBranch(_prev: TeamState, form: FormData): Promise<TeamState> {
  const ctx = await requireBusiness("settings:write");
  const r = BranchInput.safeParse({ name: field(form, "name"), address: field(form, "address"), phone: field(form, "phone") });
  if (!r.success) return { error: r.error.issues[0].message };
  const data = { name: r.data.name, address: r.data.address || null, phone: r.data.phone || null };
  const id = field(form, "branchId");
  await db.$transaction(async (tx) => {
    if (id) {
      const b = await tx.branch.findFirst({ where: { id, businessId: ctx.business.id } });
      if (!b) throw new Error("Branch not found");
      await tx.branch.update({ where: { id }, data });
      await audit(tx, { businessId: ctx.business.id, actorId: ctx.user.id, action: "update", entity: "Branch", entityId: id, data });
    } else {
      const b = await tx.branch.create({ data: { businessId: ctx.business.id, ...data } });
      await audit(tx, { businessId: ctx.business.id, actorId: ctx.user.id, action: "create", entity: "Branch", entityId: b.id, data });
    }
  });
  revalidatePath("/settings/branches");
  return { ok: true, info: "Saved" };
}

export async function archiveBranch(form: FormData): Promise<void> {
  const ctx = await requireBusiness("settings:write");
  const id = field(form, "branchId");
  const b = await db.branch.findFirst({ where: { id, businessId: ctx.business.id } });
  if (!b) return;
  if (await db.membership.count({ where: { businessId: ctx.business.id, branchId: id } })) {
    throw new Error("Move team members out of this branch first");
  }
  await db.$transaction(async (tx) => {
    await tx.branch.update({ where: { id }, data: { archivedAt: b.archivedAt ? null : new Date() } });
    await tx.session.updateMany({ where: { branchId: id }, data: { branchId: null } });
    await audit(tx, { businessId: ctx.business.id, actorId: ctx.user.id, action: b.archivedAt ? "restore" : "archive", entity: "Branch", entityId: id });
  });
  revalidatePath("/settings/branches");
}

export async function updateMyName(_prev: TeamState, form: FormData): Promise<TeamState> {
  const { user } = await requireUser();
  const name = field(form, "name").trim().slice(0, 80);
  if (name.length < 2) return { error: "Enter your name" };
  await db.user.update({ where: { id: user.id }, data: { name } });
  revalidatePath("/", "layout");
  return { ok: true, info: "Saved" };
}

/** App language (LO-01) and simple vs accountant view (LO-02), per user. */
export async function updatePreferences(_prev: TeamState, form: FormData): Promise<TeamState> {
  const { user } = await requireUser();
  const lang = field(form, "uiLanguage");
  const mode = field(form, "uiMode");
  if (!(lang in UI_LANGUAGES)) return { error: "Choose a language" };
  if (!["SIMPLE", "ACCOUNTANT"].includes(mode)) return { error: "Choose a view" };
  await db.user.update({ where: { id: user.id }, data: { uiLanguage: lang, uiMode: mode } });
  revalidatePath("/", "layout");
  return { ok: true, info: "Saved" };
}

/** Saves which dashboard tiles this member sees, in order (IR-01). */
export async function saveDashboardTiles(_prev: TeamState, form: FormData): Promise<TeamState> {
  const ctx = await requireBusiness();
  const ids = form.getAll("tile").map(String).filter((id) => id in TILES);
  const value = form.get("reset") === "1" ? null : JSON.stringify([...new Set(ids)]);
  await db.membership.update({ where: { id: ctx.membership.id }, data: { dashboardTiles: value } });
  revalidatePath("/dashboard");
  return { ok: true, info: "Saved" };
}
