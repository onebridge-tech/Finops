"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { platformAudit, requirePlatformAdmin } from "@/lib/platform-auth";

export type AdminState = { error?: string; ok?: string };

const MAX_GRANT = 5000;
const text = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

/** Pauses a shop. Its people see a "paused" page and nothing is sent on its behalf until it is restored. */
export async function suspendShop(_prev: AdminState, form: FormData): Promise<AdminState> {
  const admin = await requirePlatformAdmin();
  const id = text(form, "businessId");
  const reason = text(form, "reason").slice(0, 300);
  if (reason.length < 5) return { error: "Write a reason the shop owner can read (at least a few words)." };
  if (form.get("confirm") !== "yes") return { error: "Tick the box to confirm." };
  const shop = await db.business.findUnique({ where: { id }, select: { id: true, name: true, suspendedAt: true } });
  if (!shop) return { error: "Shop not found." };
  if (shop.suspendedAt) return { error: "This shop is already paused." };

  await db.$transaction(async (tx) => {
    await tx.business.update({ where: { id }, data: { suspendedAt: new Date(), suspendedReason: reason, suspendedById: admin.id } });
    await audit(tx, { businessId: id, actorId: "platform", action: "suspend", entity: "Business", entityId: id, data: { reason } });
  });
  await platformAudit(admin.id, "suspend_shop", id, { reason });
  revalidatePath(`/platform/shops/${id}`);
  revalidatePath("/platform/shops");
  return { ok: `${shop.name} is now paused.` };
}

export async function restoreShop(_prev: AdminState, form: FormData): Promise<AdminState> {
  const admin = await requirePlatformAdmin();
  const id = text(form, "businessId");
  const shop = await db.business.findUnique({ where: { id }, select: { id: true, name: true, suspendedAt: true } });
  if (!shop) return { error: "Shop not found." };
  if (!shop.suspendedAt) return { error: "This shop is not paused." };
  await db.$transaction(async (tx) => {
    await tx.business.update({ where: { id }, data: { suspendedAt: null, suspendedReason: null, suspendedById: null } });
    await audit(tx, { businessId: id, actorId: "platform", action: "restore", entity: "Business", entityId: id });
  });
  await platformAudit(admin.id, "restore_shop", id);
  revalidatePath(`/platform/shops/${id}`);
  revalidatePath("/platform/shops");
  return { ok: `${shop.name} is open again.` };
}

/** Adds message credits to a shop, with a reason that is kept in both the shop's and the platform's history. */
export async function grantCredits(_prev: AdminState, form: FormData): Promise<AdminState> {
  const admin = await requirePlatformAdmin();
  const id = text(form, "businessId");
  const amount = Number(text(form, "amount"));
  const reason = text(form, "reason").slice(0, 200);
  if (!Number.isInteger(amount) || amount < 1 || amount > MAX_GRANT) return { error: `Enter a whole number from 1 to ${MAX_GRANT}.` };
  if (reason.length < 3) return { error: "Write a short reason." };
  const shop = await db.business.findUnique({ where: { id }, select: { id: true, name: true } });
  if (!shop) return { error: "Shop not found." };

  const balance = await db.$transaction(async (tx) => {
    const b = await tx.business.update({ where: { id }, data: { creditBalance: { increment: amount } }, select: { creditBalance: true } });
    await tx.creditTxn.create({ data: { businessId: id, delta: amount, balanceAfter: b.creditBalance, reason: "GRANT", userId: admin.id, note: reason } });
    await audit(tx, { businessId: id, actorId: "platform", action: "grant_credits", entity: "Business", entityId: id, data: { amount, reason } });
    return b.creditBalance;
  });
  await platformAudit(admin.id, "grant_credits", id, { amount, reason });
  revalidatePath(`/platform/shops/${id}`);
  return { ok: `Added ${amount} credits to ${shop.name}. They now have ${balance}.` };
}
