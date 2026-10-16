"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { findParty, requireBusiness } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { checkCashSaleRow } from "@/lib/import-more";

export type CashSaleState = { error?: string; ok?: boolean };

const field = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

/** A sale with no customer name: what was sold, how much, and how it was paid. */
export async function addCashSale(_prev: CashSaleState, form: FormData): Promise<CashSaleState> {
  const ctx = await requireBusiness("ledger:write");
  const c = checkCashSaleRow((k) => field(form, k));
  if (!c.ok) return { error: c.error };
  const v = c.value;
  await db.$transaction(async (tx) => {
    const s = await tx.cashSale.create({ data: { businessId: ctx.business.id, branchId: ctx.branchId, date: new Date(`${v.date}T12:00:00+05:30`), item: v.item, qtyMilli: v.qtyMilli, amountPaise: BigInt(v.amountPaise), paymentMode: v.mode, createdById: ctx.user.id } });
    await audit(tx, { businessId: ctx.business.id, actorId: ctx.user.id, action: "create", entity: "CashSale", entityId: s.id, data: s });
  });
  for (const p of ["/cash-sales", "/cashbook", "/money/profit"]) revalidatePath(p);
  return { ok: true };
}

export async function voidCashSale(_prev: CashSaleState, form: FormData): Promise<CashSaleState> {
  const ctx = await requireBusiness("ledger:reverse");
  const s = await db.cashSale.findFirst({ where: { id: field(form, "saleId"), businessId: ctx.business.id, voidedAt: null } });
  if (!s) return { error: "Sale not found" };
  const reason = field(form, "reason");
  if (reason.length < 3) return { error: "Give a reason" };
  await db.$transaction(async (tx) => {
    await tx.cashSale.update({ where: { id: s.id }, data: { voidedAt: new Date(), voidReason: reason } });
    await audit(tx, { businessId: ctx.business.id, actorId: ctx.user.id, action: "void", entity: "CashSale", entityId: s.id, data: { reason } });
  });
  for (const p of ["/cash-sales", "/cashbook", "/money/profit"]) revalidatePath(p);
  return { ok: true };
}

/** Gives a no-name sale to a customer, so it shows who bought it. Money was already received, so no balance changes. */
export async function assignCashSale(form: FormData): Promise<void> {
  const ctx = await requireBusiness("ledger:write");
  const s = await db.cashSale.findFirst({ where: { id: field(form, "saleId"), businessId: ctx.business.id, voidedAt: null } });
  const party = field(form, "partyId") ? await findParty(ctx, field(form, "partyId")) : null;
  if (!s) return;
  await db.$transaction(async (tx) => {
    await tx.cashSale.update({ where: { id: s.id }, data: { partyId: party?.id ?? null } });
    await audit(tx, { businessId: ctx.business.id, actorId: ctx.user.id, action: "assign", entity: "CashSale", entityId: s.id, data: { partyId: party?.id ?? null } });
  });
  revalidatePath("/cash-sales");
}
