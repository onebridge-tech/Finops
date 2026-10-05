"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { findParty, requireBusiness } from "@/lib/auth";
import { audit } from "@/lib/audit";

export type FollowUpState = { error?: string; ok?: boolean };

const field = (f: FormData, k: string) => String(f.get(k) ?? "");

const Input = z.object({
  partyId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date"),
  time: z.string().regex(/^(\d{2}:\d{2})?$/),
  note: z.string().trim().min(2, "What is the follow-up about?").max(300),
  assignedToId: z.string(),
});

/** Schedules a follow-up call or visit on a party or lead (FS-06). */
export async function addFollowUp(_prev: FollowUpState, form: FormData): Promise<FollowUpState> {
  const ctx = await requireBusiness("party:write");
  const r = Input.safeParse(Object.fromEntries(Object.keys(Input.shape).map((k) => [k, field(form, k)])));
  if (!r.success) return { error: r.error.issues[0].message };
  const d = r.data;
  const party = await findParty(ctx, d.partyId);
  if (!party) return { error: "Party not found" };
  // Reps can only give follow-ups to themselves; others may assign anyone on the team.
  let assignee = ctx.user.id;
  if (!ctx.assignedOnly && d.assignedToId && (await db.membership.count({ where: { businessId: ctx.business.id, userId: d.assignedToId } }))) {
    assignee = d.assignedToId;
  }
  const dueAt = new Date(`${d.date}T${d.time || "10:00"}:00+05:30`);
  await db.$transaction(async (tx) => {
    const f = await tx.followUp.create({
      data: { businessId: ctx.business.id, partyId: party.id, assignedToId: assignee, dueAt, note: d.note, createdById: ctx.user.id },
    });
    await audit(tx, { businessId: ctx.business.id, actorId: ctx.user.id, action: "create", entity: "FollowUp", entityId: f.id, data: f });
  });
  revalidatePath(`/parties/${party.id}`);
  revalidatePath("/follow-ups");
  return { ok: true };
}

/** Marks a follow-up done with what happened, optionally booking the next one. */
export async function completeFollowUp(_prev: FollowUpState, form: FormData): Promise<FollowUpState> {
  const ctx = await requireBusiness("party:write");
  const f = await db.followUp.findFirst({ where: { id: field(form, "followUpId"), businessId: ctx.business.id }, include: { party: true } });
  if (!f || !(await findParty(ctx, f.partyId))) return { error: "Follow-up not found" };
  if (ctx.assignedOnly && f.assignedToId !== ctx.user.id) return { error: "This follow-up is assigned to someone else" };
  const outcome = field(form, "outcome").trim().slice(0, 300);
  const next = field(form, "nextDate");
  if (next && !/^\d{4}-\d{2}-\d{2}$/.test(next)) return { error: "Pick a date for the next follow-up" };
  await db.$transaction(async (tx) => {
    await tx.followUp.update({ where: { id: f.id }, data: { doneAt: new Date(), doneById: ctx.user.id, outcome: outcome || null } });
    await audit(tx, { businessId: ctx.business.id, actorId: ctx.user.id, action: "complete", entity: "FollowUp", entityId: f.id, data: { outcome } });
    if (next) {
      await tx.followUp.create({
        data: { businessId: ctx.business.id, partyId: f.partyId, assignedToId: f.assignedToId, dueAt: new Date(`${next}T10:00:00+05:30`), note: f.note, createdById: ctx.user.id },
      });
    }
  });
  revalidatePath(`/parties/${f.partyId}`);
  revalidatePath("/follow-ups");
  return { ok: true };
}
