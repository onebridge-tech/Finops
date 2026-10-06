"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireBusiness } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { parseRupees } from "@/lib/money";
import { applyStock, checkLowStock } from "@/lib/stock";
import { newShareToken } from "@/lib/session";

export type CatState = { error?: string; ok?: boolean; info?: string };

const field = (f: FormData, k: string) => String(f.get(k) ?? "");

// ── Stock adjustments (CI-04) ────────────────────────────────────────────────

/** Stock counted, damaged, found or written off: a signed movement with a reason. Movements are never edited. */
export async function adjustStock(_prev: CatState, form: FormData): Promise<CatState> {
  const ctx = await requireBusiness("stock:write");
  const item = await db.item.findFirst({ where: { id: field(form, "itemId"), businessId: ctx.business.id } });
  if (!item) return { error: "Choose an item" };
  if (!item.trackStock) return { error: "Turn on “Track stock” for this item first (Items → Edit)" };
  const raw = field(form, "qty").trim();
  if (!/^-?\d+(\.\d{1,3})?$/.test(raw) || Number(raw) === 0) return { error: "Enter a quantity like 10 or -2.5" };
  const note = field(form, "note").trim();
  if (note.length < 3) return { error: "Say why (count, damage, found…)" };
  const qtyMilli = Math.round(Number(raw) * 1000);
  await db.$transaction(async (tx) => {
    await applyStock(tx, { businessId: ctx.business.id, branchId: ctx.branchId, itemId: item.id, qtyMilli, reason: "ADJUSTMENT", note, userId: ctx.user.id });
    await audit(tx, { businessId: ctx.business.id, actorId: ctx.user.id, action: "stock_adjust", entity: "Item", entityId: item.id, data: { qtyMilli, note } });
  });
  await checkLowStock(ctx.business.id, [item.id]).catch(() => undefined);
  revalidatePath("/stock");
  return { ok: true, info: "Stock updated" };
}

// ── Price lists (CI-03) ──────────────────────────────────────────────────────

export async function createPriceList(_prev: CatState, form: FormData): Promise<CatState> {
  const ctx = await requireBusiness("item:write");
  const name = field(form, "name").trim();
  if (name.length < 2) return { error: "Give the list a name, e.g. Dealer" };
  if (await db.priceList.count({ where: { businessId: ctx.business.id, name, archivedAt: null } })) return { error: "You already have a list with that name" };
  const list = await db.$transaction(async (tx) => {
    const l = await tx.priceList.create({ data: { businessId: ctx.business.id, name } });
    await audit(tx, { businessId: ctx.business.id, actorId: ctx.user.id, action: "create", entity: "PriceList", entityId: l.id, data: { name } });
    return l;
  });
  redirect(`/price-lists/${list.id}`);
}

async function ownList(businessId: string, id: string) {
  return db.priceList.findFirst({ where: { id, businessId, archivedAt: null } });
}

/** A rate for an item; with a minimum quantity it is a slab that applies from that quantity up. */
export async function setPriceRow(_prev: CatState, form: FormData): Promise<CatState> {
  const ctx = await requireBusiness("item:write");
  const list = await ownList(ctx.business.id, field(form, "listId"));
  const item = await db.item.findFirst({ where: { id: field(form, "itemId"), businessId: ctx.business.id } });
  if (!list || !item) return { error: "Choose an item" };
  const rate = parseRupees(field(form, "rate"));
  if (rate === null) return { error: "Rate must be an amount like 850" };
  const minRaw = field(form, "minQty").trim() || "0";
  if (!/^\d+(\.\d{1,3})?$/.test(minRaw)) return { error: "Minimum quantity must be a number" };
  const minQtyMilli = Math.round(Number(minRaw) * 1000);
  await db.$transaction(async (tx) => {
    await tx.priceListItem.upsert({
      where: { priceListId_itemId_minQtyMilli: { priceListId: list.id, itemId: item.id, minQtyMilli } },
      create: { priceListId: list.id, itemId: item.id, minQtyMilli, ratePaise: BigInt(rate) },
      update: { ratePaise: BigInt(rate) },
    });
    await audit(tx, { businessId: ctx.business.id, actorId: ctx.user.id, action: "set_rate", entity: "PriceList", entityId: list.id, data: { itemId: item.id, minQtyMilli, rate } });
  });
  revalidatePath(`/price-lists/${list.id}`);
  return { ok: true };
}

export async function deletePriceRow(form: FormData): Promise<void> {
  const ctx = await requireBusiness("item:write");
  const row = await db.priceListItem.findFirst({ where: { id: field(form, "rowId"), priceList: { businessId: ctx.business.id } } });
  if (!row) return;
  await db.priceListItem.delete({ where: { id: row.id } });
  revalidatePath(`/price-lists/${row.priceListId}`);
}

/** Starts a list from the standard prices less a percentage (e.g. 10% off for dealers). */
export async function fillPriceList(_prev: CatState, form: FormData): Promise<CatState> {
  const ctx = await requireBusiness("item:write");
  const list = await ownList(ctx.business.id, field(form, "listId"));
  if (!list) return { error: "List not found" };
  const pctRaw = field(form, "pct").trim();
  if (!/^\d{1,2}(\.\d{1,2})?$/.test(pctRaw)) return { error: "Enter a percentage like 10" };
  const pct = Number(pctRaw);
  const items = await db.item.findMany({ where: { businessId: ctx.business.id, archivedAt: null } });
  let n = 0;
  await db.$transaction(async (tx) => {
    for (const it of items) {
      const rate = Math.round((Number(it.pricePaise) * (100 - pct)) / 100);
      await tx.priceListItem.upsert({
        where: { priceListId_itemId_minQtyMilli: { priceListId: list.id, itemId: it.id, minQtyMilli: 0 } },
        create: { priceListId: list.id, itemId: it.id, minQtyMilli: 0, ratePaise: BigInt(rate) }, update: { ratePaise: BigInt(rate) },
      });
      n++;
    }
    await audit(tx, { businessId: ctx.business.id, actorId: ctx.user.id, action: "fill", entity: "PriceList", entityId: list.id, data: { pct, items: n } });
  });
  revalidatePath(`/price-lists/${list.id}`);
  return { ok: true, info: `${n} items set to standard price less ${pct}%` };
}

export async function archivePriceList(form: FormData): Promise<void> {
  const ctx = await requireBusiness("item:write");
  const list = await ownList(ctx.business.id, field(form, "listId"));
  if (!list) return;
  await db.$transaction(async (tx) => {
    await tx.priceList.update({ where: { id: list.id }, data: { archivedAt: new Date() } });
    await tx.party.updateMany({ where: { businessId: ctx.business.id, priceListId: list.id }, data: { priceListId: null } });
    await audit(tx, { businessId: ctx.business.id, actorId: ctx.user.id, action: "archive", entity: "PriceList", entityId: list.id });
  });
  redirect("/price-lists");
}

// ── Public catalogue switch (CI-02) ──────────────────────────────────────────

export async function setCatalogue(_prev: CatState, form: FormData): Promise<CatState> {
  const ctx = await requireBusiness("settings:write");
  const enabled = form.get("enabled") === "on";
  await db.$transaction(async (tx) => {
    await tx.business.update({ where: { id: ctx.business.id }, data: { catalogEnabled: enabled, catalogToken: ctx.business.catalogToken ?? newShareToken() } });
    await audit(tx, { businessId: ctx.business.id, actorId: ctx.user.id, action: enabled ? "catalogue_on" : "catalogue_off", entity: "Business", entityId: ctx.business.id });
  });
  revalidatePath("/settings");
  return { ok: true, info: "Saved" };
}
