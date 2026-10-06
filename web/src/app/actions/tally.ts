"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireBusiness } from "@/lib/auth";
import { revokeTallyKey, rotateTallyKey } from "@/lib/tally";

export type KeyState = { key?: string; error?: string };

/** Makes a connector key. It is shown once; making another stops the old one working. */
export async function makeTallyKey(): Promise<KeyState> {
  const ctx = await requireBusiness("settings:write");
  const key = await rotateTallyKey(ctx.business.id, ctx.user.id);
  revalidatePath("/settings/tally");
  return { key };
}

export async function removeTallyKey(): Promise<void> {
  const ctx = await requireBusiness("settings:write");
  await revokeTallyKey(ctx.business.id, ctx.user.id);
  revalidatePath("/settings/tally");
}

/** Gives vouchers that Tally rejected another five tries (after fixing the cause in Tally). */
export async function retryTallyFailures(): Promise<void> {
  const ctx = await requireBusiness("settings:write");
  await db.tallySync.updateMany({ where: { businessId: ctx.business.id, direction: "PUSH", status: "FAILED" }, data: { retries: 0 } });
  revalidatePath("/settings/tally");
}

/** Marks a difference as dealt with so it leaves the review list. */
export async function dismissTallyConflict(form: FormData): Promise<void> {
  const ctx = await requireBusiness("settings:write");
  await db.tallySync.updateMany({ where: { id: String(form.get("id") ?? ""), businessId: ctx.business.id, status: "CONFLICT" }, data: { status: "OK", message: "Reviewed — see earlier note" } });
  revalidatePath("/settings/tally");
}
