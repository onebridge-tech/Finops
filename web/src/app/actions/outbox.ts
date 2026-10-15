"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { can, partyWhere, requireBusiness } from "@/lib/auth";

// The WhatsApp outbox: messages written from templates that wait for a person to send them from their own WhatsApp.

async function mine(id: string) {
  const ctx = await requireBusiness("reminder:send");
  const m = await db.message.findFirst({
    where: {
      id, businessId: ctx.business.id, channel: "WHATSAPP_LINK", status: "QUEUED",
      OR: [{ party: partyWhere(ctx) }, ...(can(ctx.role, "settings:write") ? [{ partyId: null }] : [])],
    },
  });
  return { ctx, m };
}

/** The person tapped Send and WhatsApp opened with the message. We can't see inside WhatsApp, so this is the best record there is. */
export async function markSent(id: string): Promise<void> {
  const { ctx, m } = await mine(id);
  if (!m) return;
  await db.message.update({ where: { id: m.id }, data: { status: "SENT", sentAt: new Date(), createdById: m.createdById ?? ctx.user.id } });
  revalidatePath("/outbox");
}

/** Takes a message out of the outbox without sending it. */
export async function removeFromOutbox(id: string): Promise<void> {
  const { m } = await mine(id);
  if (!m) return;
  await db.message.update({ where: { id: m.id }, data: { status: "SKIPPED", error: "Removed from the outbox" } });
  revalidatePath("/outbox");
}

export async function removeAllFromOutbox(): Promise<void> {
  const ctx = await requireBusiness("reminder:send");
  await db.message.updateMany({
    where: { businessId: ctx.business.id, channel: "WHATSAPP_LINK", status: "QUEUED", OR: [{ party: partyWhere(ctx) }, ...(can(ctx.role, "settings:write") ? [{ partyId: null }] : [])] },
    data: { status: "SKIPPED", error: "Removed from the outbox" },
  });
  revalidatePath("/outbox");
}
