"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { branchOrShared, docWhere, findParty, requireBusiness } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { isInterState } from "@/lib/gst";
import { formatINR } from "@/lib/money";
import { creditGate } from "@/lib/credit-gate";
import { endOfDay, issueInvoice, istNoon, parseDoc, priceLines, sellerFor, toRows, todayYmd, type LineRow } from "@/lib/doc-core";
import { createOrderRecord } from "@/lib/orders";
import { orderStatus, pendingMilli } from "@/lib/rules";
import { applyStock, checkLowStock } from "@/lib/stock";
import { proposeShared } from "@/lib/shared-ledger";

export type OrderState = { error?: string; ok?: boolean; warning?: string[] };

const field = (f: FormData, k: string) => String(f.get(k) ?? "");

/** Sales or purchase order from the line editor (BD-02). */
export async function createOrder(_prev: OrderState, form: FormData): Promise<OrderState> {
  const ctx = await requireBusiness("invoice:write");
  const { user, business } = ctx;
  const kind = field(form, "orderKind") === "PURCHASE" ? "PURCHASE" : "SALES";
  const p = parseDoc(form, ctx.membership.maxDiscountBp);
  if ("error" in p) return { error: p.error };
  const party = await findParty(ctx, p.doc.partyId);
  if (!party) return { error: "Party not found" };
  if (kind === "PURCHASE" && party.type === "CUSTOMER") return { error: "Choose a supplier" };
  const branchId = ctx.branchId ?? party.branchId;
  const sellerState = kind === "SALES" ? (await sellerFor(db, business.id, branchId)).stateCode : business.stateCode;
  if (kind === "SALES") {
    const total = priceLines(toRows(p.lines), isInterState(sellerState, p.doc.placeOfSupply)).total;
    const gate = await creditGate(ctx, party, total, form.get("override") === "1");
    if (gate.error) return { error: gate.error };
    if (gate.warning) return { warning: gate.warning };
  }
  const order = await db.$transaction((tx) =>
    createOrderRecord(tx, {
      businessId: business.id, branchId, kind, partyId: party.id, date: istNoon(p.doc.date), expectedDate: p.doc.dueDate ? endOfDay(p.doc.dueDate) : null,
      placeOfSupply: p.doc.placeOfSupply, sellerStateCode: sellerState, notes: p.doc.notes || null, lines: toRows(p.lines), userId: user.id,
    }),
  );
  redirect(`/orders/${order.id}`);
}

/** A quotation the customer accepted becomes a sales order. */
export async function quoteToOrder(form: FormData): Promise<void> {
  const ctx = await requireBusiness("invoice:write");
  const quote = await db.quote.findFirst({ where: { ...docWhere(ctx), id: field(form, "quoteId") }, include: { lines: true } });
  if (!quote || quote.status === "CONVERTED" || quote.status === "DECLINED") throw new Error("This quotation can't become an order.");
  const seller = await sellerFor(db, ctx.business.id, quote.branchId);
  const order = await db.$transaction(async (tx) => {
    const o = await createOrderRecord(tx, {
      businessId: ctx.business.id, branchId: quote.branchId, kind: "SALES", partyId: quote.partyId, date: new Date(), expectedDate: null, placeOfSupply: quote.placeOfSupply,
      sellerStateCode: seller.stateCode, notes: quote.notes, source: "QUOTE", quoteId: quote.id, userId: ctx.user.id,
      lines: quote.lines.map((l) => ({ itemId: l.itemId, description: l.description, hsn: l.hsn, qtyMilli: l.qtyMilli, unit: l.unit, ratePaise: Number(l.ratePaise), taxRateBp: l.taxRateBp, discountBp: l.discountBp })),
    });
    await tx.quote.update({ where: { id: quote.id }, data: { status: "CONVERTED" } });
    return o;
  });
  redirect(`/orders/${order.id}`);
}

/** Accept or decline a catalogue request, or cancel an open order. */
export async function setOrderStatus(form: FormData): Promise<void> {
  const ctx = await requireBusiness("invoice:write");
  const status = field(form, "status");
  if (!["OPEN", "CANCELLED"].includes(status)) return;
  const o = await db.order.findFirst({ where: { id: field(form, "orderId"), businessId: ctx.business.id, ...branchOrShared(ctx) } });
  if (!o || o.status === "FULFILLED" || o.status === "CANCELLED") return;
  if (status === "OPEN" && o.status !== "REQUEST") return;
  await db.$transaction(async (tx) => {
    await tx.order.update({ where: { id: o.id }, data: { status } });
    await audit(tx, { businessId: ctx.business.id, actorId: ctx.user.id, action: status === "OPEN" ? "accept" : "cancel", entity: "Order", entityId: o.id });
  });
  revalidatePath(`/orders/${o.id}`);
  revalidatePath("/orders");
}

/** Quantities typed for each order line, validated against what is still pending. */
function readQuantities(form: FormData, lines: { id: string; qtyMilli: number; fulfilledMilli: number }[]): { error: string } | { picks: { id: string; qty: number }[] } {
  const picks: { id: string; qty: number }[] = [];
  for (const l of lines) {
    const raw = field(form, `qty_${l.id}`).trim();
    if (!raw) continue;
    if (!/^\d+(\.\d{1,3})?$/.test(raw)) return { error: "Quantities must be numbers" };
    const qty = Math.round(Number(raw) * 1000);
    if (qty === 0) continue;
    if (qty > pendingMilli(l)) return { error: `Only ${pendingMilli(l) / 1000} is still pending on a line` };
    picks.push({ id: l.id, qty });
  }
  return picks.length ? { picks } : { error: "Enter a quantity for at least one line" };
}

/** Delivers part or all of a sales order: issues an invoice for those quantities (BD-02). */
export async function deliverOrder(_prev: OrderState, form: FormData): Promise<OrderState> {
  const ctx = await requireBusiness("invoice:write");
  const order = await db.order.findFirst({ where: { id: field(form, "orderId"), businessId: ctx.business.id, kind: "SALES", ...branchOrShared(ctx) }, include: { lines: true } });
  if (!order || !["OPEN", "PARTIAL"].includes(order.status)) return { error: "This order can't be delivered" };
  const party = await findParty(ctx, order.partyId);
  if (!party) return { error: "Party not found" };
  const q = readQuantities(form, order.lines);
  if ("error" in q) return { error: q.error };
  const byId = new Map(order.lines.map((l) => [l.id, l]));
  const rows: LineRow[] = q.picks.map(({ id, qty }) => {
    const l = byId.get(id)!;
    return { itemId: l.itemId, description: l.description, hsn: l.hsn, qtyMilli: qty, unit: l.unit, ratePaise: Number(l.ratePaise), taxRateBp: l.taxRateBp, discountBp: l.discountBp };
  });
  const seller = await sellerFor(db, ctx.business.id, order.branchId);
  const gate = await creditGate(ctx, party, priceLines(rows, isInterState(seller.stateCode, order.placeOfSupply)).total, form.get("override") === "1");
  if (gate.error) return { error: gate.error };
  if (gate.warning) return { warning: gate.warning };
  const date = istNoon(todayYmd());
  const dueDate = party.creditDays ? new Date(date.getTime() + party.creditDays * 86400_000) : null;
  const inv = await db.$transaction(async (tx) => {
    const i = await issueInvoice(tx, { businessId: ctx.business.id, userId: ctx.user.id, partyId: party.id, branchId: order.branchId, date, dueDate, placeOfSupply: order.placeOfSupply, notes: order.notes, lines: rows, orderId: order.id });
    for (const p of q.picks) await tx.orderLine.update({ where: { id: p.id }, data: { fulfilledMilli: { increment: p.qty } } });
    const fresh = await tx.orderLine.findMany({ where: { orderId: order.id } });
    await tx.order.update({ where: { id: order.id }, data: { status: orderStatus(fresh) } });
    return i;
  });
  const e = await db.ledgerEntry.findFirst({ where: { invoiceId: inv.id, source: "INVOICE" }, select: { id: true } });
  if (e) await proposeShared(e.id).catch(() => false);
  await checkLowStock(ctx.business.id, rows.map((r) => r.itemId)).catch(() => undefined);
  redirect(`/invoices/${inv.id}`);
}

/** Receives goods against a purchase order: stock goes in and the supplier's ledger is credited (BD-02). */
export async function receiveOrder(_prev: OrderState, form: FormData): Promise<OrderState> {
  const ctx = await requireBusiness("stock:write");
  const order = await db.order.findFirst({ where: { id: field(form, "orderId"), businessId: ctx.business.id, kind: "PURCHASE" }, include: { lines: true } });
  if (!order || !["OPEN", "PARTIAL"].includes(order.status)) return { error: "This order can't be received" };
  const party = await findParty(ctx, order.partyId);
  if (!party) return { error: "Supplier not found" };
  const q = readQuantities(form, order.lines);
  if ("error" in q) return { error: q.error };
  const byId = new Map(order.lines.map((l) => [l.id, l]));
  const billNo = field(form, "billNo").trim().slice(0, 40);
  // Value of what arrived: each line's total (tax included) in proportion to the quantity received.
  const value = q.picks.reduce((s, p) => { const l = byId.get(p.id)!; return s + Math.round((Number(l.totalPaise) * p.qty) / l.qtyMilli); }, 0);
  const date = istNoon(todayYmd());
  await db.$transaction(async (tx) => {
    const e = await tx.ledgerEntry.create({
      data: {
        businessId: ctx.business.id, partyId: party.id, branchId: order.branchId, direction: "GOT", amountPaise: BigInt(value), date,
        note: `Goods received against ${order.number}${billNo ? ` (bill ${billNo})` : ""} · ${formatINR(value)}`, createdById: ctx.user.id,
      },
    });
    for (const p of q.picks) {
      const l = byId.get(p.id)!;
      await tx.orderLine.update({ where: { id: p.id }, data: { fulfilledMilli: { increment: p.qty } } });
      await applyStock(tx, { businessId: ctx.business.id, branchId: order.branchId, itemId: l.itemId, qtyMilli: p.qty, reason: "PURCHASE", refType: "Order", refId: order.id, userId: ctx.user.id });
    }
    const fresh = await tx.orderLine.findMany({ where: { orderId: order.id } });
    await tx.order.update({ where: { id: order.id }, data: { status: orderStatus(fresh) } });
    await audit(tx, { businessId: ctx.business.id, actorId: ctx.user.id, action: "receive", entity: "Order", entityId: order.id, data: { value, entryId: e.id, picks: q.picks } });
  });
  await checkLowStock(ctx.business.id, q.picks.map((p) => byId.get(p.id)!.itemId)).catch(() => undefined);
  revalidatePath(`/orders/${order.id}`);
  return { ok: true };
}
