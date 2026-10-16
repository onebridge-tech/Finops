"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { SITE_FIELDS } from "@/lib/site-fields";
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

/** Marks a kind of error as dealt with. It reopens by itself if it happens again. */
export async function resolveError(form: FormData): Promise<void> {
  const admin = await requirePlatformAdmin();
  const id = text(form, "id");
  await db.errorLog.updateMany({ where: { id, resolvedAt: null }, data: { resolvedAt: new Date() } });
  await platformAudit(admin.id, "resolve_error", id);
  revalidatePath("/platform/errors");
}

export async function reopenError(form: FormData): Promise<void> {
  const admin = await requirePlatformAdmin();
  const id = text(form, "id");
  await db.errorLog.updateMany({ where: { id }, data: { resolvedAt: null } });
  await platformAudit(admin.id, "reopen_error", id);
  revalidatePath("/platform/errors");
}

/** Saves the company details shown on the legal pages and the landing page. Empty boxes clear that detail, so the pages leave it out. */
export async function saveSiteInfo(_prev: AdminState, form: FormData): Promise<AdminState> {
  const admin = await requirePlatformAdmin();
  const changes: Record<string, string> = {};
  for (const f of SITE_FIELDS) {
    const v = text(form, f.key).slice(0, f.kind === "textarea" ? 400 : 160);
    if (f.kind === "email" && v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return { error: `${f.label}: that does not look like an email address.` };
    if (f.kind === "number" && v && !(Number.isInteger(Number(v)) && Number(v) >= 1 && Number(v) <= 365)) return { error: `${f.label}: enter a whole number of days from 1 to 365.` };
    changes[f.key] = v;
  }
  await db.$transaction(
    Object.entries(changes).map(([key, value]) =>
      value
        ? db.siteSetting.upsert({ where: { key }, update: { value, updatedById: admin.id }, create: { key, value, updatedById: admin.id } })
        : db.siteSetting.deleteMany({ where: { key } }),
    ),
  );
  await platformAudit(admin.id, "save_site_info", undefined, { filled: Object.entries(changes).filter(([, v]) => v).map(([k]) => k) });
  for (const path of ["/platform/settings", "/", "/terms", "/privacy", "/refund-policy", "/acceptable-use", "/cookies", "/grievance"]) revalidatePath(path);
  return { ok: "Saved. The legal pages now show these details." };
}

/** Saves the settings of one outside service (keys are stored encrypted). Values are never written to the admin log, only which settings changed. */
export async function saveConnectionSettings(_prev: AdminState, form: FormData): Promise<AdminState> {
  const admin = await requirePlatformAdmin();
  const { saveConnection } = await import("@/lib/integrations");
  const id = text(form, "id");
  const r = await saveConnection(id, form, admin.id);
  if (!r.ok) return { error: r.error };
  await platformAudit(admin.id, "save_connection", id, { changed: r.changed });
  for (const p of ["/platform/integrations", "/paper-notes", "/login"]) revalidatePath(p);
  return { ok: r.changed.length ? "Saved. It is in use now." : "Nothing changed." };
}

/** Tries the chosen service with a one-line question (no photo and no customer data). */
export async function testConnection(_prev: AdminState, form: FormData): Promise<AdminState> {
  await requirePlatformAdmin();
  if (text(form, "id") !== "ai") return { error: "This connection cannot be tested here." };
  const { testNoteAi } = await import("@/lib/note-ai");
  const r = await testNoteAi();
  return r.ok ? { ok: r.message } : { error: r.message };
}
