"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireBusiness, findParty } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { istDay } from "@/lib/ledger";
import { checkUpload, saveUpload } from "@/lib/files";

type R = { error?: string; ok?: boolean };

/** Selfie for today's attendance, or a photo for the open visit (FS-01, FS-07). Needs a connection. */
export async function attachPhoto(form: FormData): Promise<R> {
  const ctx = await requireBusiness("ledger:write");
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a photo" };
  const err = await checkUpload(file, "ATTACHMENT");
  if (err) return { error: err };
  const target = String(form.get("target") ?? "");
  if (target === "attendance") {
    const a = await db.attendance.findUnique({ where: { businessId_userId_date: { businessId: ctx.business.id, userId: ctx.user.id, date: istDay(new Date()) } } });
    if (!a) return { error: "Start your day first" };
    const r = await saveUpload(file, { businessId: ctx.business.id, userId: ctx.user.id, kind: "ATTACHMENT" });
    if (!r.ok) return { error: r.error };
    await db.attendance.update({ where: { id: a.id }, data: { photoFileId: r.id } });
    return { ok: true };
  }
  const v = await db.visit.findFirst({ where: { id: String(form.get("visitId") ?? ""), businessId: ctx.business.id, userId: ctx.user.id } });
  if (!v) return { error: "Visit not found" };
  const r = await saveUpload(file, { businessId: ctx.business.id, userId: ctx.user.id, kind: "ATTACHMENT", visitId: v.id });
  if (!r.ok) return { error: r.error };
  await db.visit.update({ where: { id: v.id }, data: { photoFileId: r.id } });
  return { ok: true };
}

export async function saveBeat(_: R | undefined, form: FormData): Promise<R> {
  const ctx = await requireBusiness("field:manage");
  const name = String(form.get("name") ?? "").trim().slice(0, 60);
  const userId = String(form.get("userId") ?? "");
  const weekdays = form.getAll("weekdays").map(String).filter((d) => /^[0-6]$/.test(d)).join(",");
  const partyIds = String(form.get("partyIds") ?? "").split(",").filter(Boolean);
  if (!name) return { error: "Give the beat a name" };
  if (!weekdays) return { error: "Pick at least one weekday" };
  if (!(await db.membership.count({ where: { businessId: ctx.business.id, userId } }))) return { error: "Choose a team member" };
  const parties: string[] = [];
  for (const id of [...new Set(partyIds)]) {
    const p = await findParty(ctx, id);
    if (p) parties.push(p.id);
  }
  const id = String(form.get("id") ?? "");
  await db.$transaction(async (tx) => {
    let beatId = id;
    if (id) {
      const b = await tx.beat.findFirst({ where: { id, businessId: ctx.business.id } });
      if (!b) throw new Error("Beat not found");
      await tx.beat.update({ where: { id }, data: { name, userId, weekdays } });
      await tx.beatParty.deleteMany({ where: { beatId: id } });
    } else {
      beatId = (await tx.beat.create({ data: { businessId: ctx.business.id, name, userId, weekdays } })).id;
    }
    await tx.beatParty.createMany({ data: parties.map((partyId, position) => ({ beatId, partyId, position })) });
    await audit(tx, { businessId: ctx.business.id, actorId: ctx.user.id, action: id ? "update" : "create", entity: "Beat", entityId: beatId, data: { name, userId, weekdays, parties: parties.length } });
  });
  revalidatePath("/field/beats");
  return { ok: true };
}

export async function archiveBeat(form: FormData): Promise<void> {
  const ctx = await requireBusiness("field:manage");
  await db.beat.updateMany({ where: { id: String(form.get("id") ?? ""), businessId: ctx.business.id }, data: { archivedAt: new Date() } });
  revalidatePath("/field/beats");
}

const METRICS = ["VISITS", "NEW_CUSTOMERS", "ORDERS", "COLLECTIONS", "SALES"] as const;

export async function setTarget(_: R | undefined, form: FormData): Promise<R> {
  const ctx = await requireBusiness("field:manage");
  const userId = String(form.get("userId") ?? "");
  const month = String(form.get("month") ?? "");
  const metric = String(form.get("metric") ?? "");
  const raw = Number(String(form.get("value") ?? "").replace(/,/g, ""));
  if (!/^\d{4}-\d{2}$/.test(month)) return { error: "Choose a month" };
  if (!(METRICS as readonly string[]).includes(metric)) return { error: "Choose a measure" };
  if (!Number.isFinite(raw) || raw < 0) return { error: "Enter a target" };
  if (!(await db.membership.count({ where: { businessId: ctx.business.id, userId } }))) return { error: "Choose a team member" };
  const value = BigInt(Math.round(metric === "SALES" || metric === "COLLECTIONS" ? raw * 100 : raw));
  await db.target.upsert({
    where: { businessId_userId_month_metric: { businessId: ctx.business.id, userId, month, metric } },
    update: { value }, create: { businessId: ctx.business.id, userId, month, metric, value },
  });
  revalidatePath("/field/team");
  return { ok: true };
}
