"use server";

import { revalidatePath } from "next/cache";
import { requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { acceptShared, rejectShared } from "@/lib/shared-ledger";

const field = (f: FormData, k: string) => String(f.get(k) ?? "");

export async function acceptSharedEntry(form: FormData): Promise<void> {
  const ctx = await requireBusiness("ledger:write");
  const id = field(form, "id");
  // Only the receiving business can accept.
  if (await db.sharedEntry.count({ where: { id, businessId: ctx.business.id } })) await acceptShared(id, ctx.user.id);
  revalidatePath("/shared");
}

export async function rejectSharedEntry(form: FormData): Promise<void> {
  const ctx = await requireBusiness("ledger:write");
  await rejectShared(field(form, "id"), ctx.user.id, ctx.business.id);
  revalidatePath("/shared");
}
