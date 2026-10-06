"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { docWhere, findParty, requireBusiness } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { newShareToken } from "@/lib/session";
import { isInterState } from "@/lib/gst";
import { openByEntry } from "@/lib/ledger";
import { istNoon, parseDoc, priceLines, sellerFor, toRows, todayYmd, type LineRow } from "@/lib/doc-core";
import { applyStock, checkLowStock } from "@/lib/stock";
import type { Prisma } from "@prisma/client";

export type NoteState = { error?: string; ok?: boolean; warning?: string[] };

type Tx = Prisma.TransactionClient;
const field = (f: FormData, k: string) => String(f.get(k) ?? "");

/** Stores a note with its lines and the next number in the credit or debit series. */
async function noteRecord(tx: Tx, o: {
  businessId: string; branchId: string | null; kind: "CREDIT" | "DEBIT"; partyId: string; invoiceId: string | null; reason: string;
  placeOfSupply: string; interState: boolean; lines: (LineRow & { returnToStock?: boolean })[]; userId: string;
}) {
  const b = await tx.business.update({
    where: { id: o.businessId },
    data: o.kind === "CREDIT" ? { nextCreditNoteNo: { increment: 1 } } : { nextDebitNoteNo: { increment: 1 } },
  });
  const number = o.kind === "CREDIT" ? `${b.creditNotePrefix}${b.nextCreditNoteNo - 1}` : `${b.debitNotePrefix}${b.nextDebitNoteNo - 1}`;
  const priced = priceLines(o.lines, o.interState);
  const note = await tx.note.create({
    data: {
      businessId: o.businessId, branchId: o.branchId, kind: o.kind, number, partyId: o.partyId, invoiceId: o.invoiceId, date: istNoon(todayYmd()), reason: o.reason,
      placeOfSupply: o.placeOfSupply, ...priced.header, shareToken: newShareToken(), createdById: o.userId,
      lines: { create: priced.rows.map((r, i) => ({ ...r, returnToStock: o.lines[i].returnToStock ?? false })) },
    },
  });
  return { note, number, total: priced.header.totalPaise };
}

/**
 * Credit note against an invoice (BD-06): a return or a discount after the sale.
 * It credits the customer's ledger, settles the invoice it was raised on, and
 * puts returned goods back into stock.
 */
export async function createCreditNote(_prev: NoteState, form: FormData): Promise<NoteState> {
  const ctx = await requireBusiness("invoice:write");
  const invoice = await db.invoice.findFirst({ where: { ...docWhere(ctx), id: field(form, "invoiceId"), status: "ISSUED" }, include: { lines: true } });
  if (!invoice) return { error: "Invoice not found" };
  const reason = field(form, "reason").trim();
  if (reason.length < 3) return { error: "Give a reason" };

  // What has already been credited on this invoice, per item.
  const prior = await db.noteLine.findMany({ where: { note: { invoiceId: invoice.id, kind: "CREDIT", status: "ISSUED" } } });
  const key = (l: { itemId: string | null; description: string }) => l.itemId ?? `d:${l.description}`;
  const credited = new Map<string, number>();
  for (const p of prior) credited.set(key(p), (credited.get(key(p)) ?? 0) + p.qtyMilli);

  const lines: (LineRow & { returnToStock: boolean })[] = [];
  for (const l of invoice.lines) {
    const raw = field(form, `qty_${l.id}`).trim();
    if (!raw) continue;
    if (!/^\d+(\.\d{1,3})?$/.test(raw)) return { error: "Quantities must be numbers" };
    const qty = Math.round(Number(raw) * 1000);
    if (qty === 0) continue;
    const room = l.qtyMilli - (credited.get(key(l)) ?? 0);
    if (qty > room) return { error: `Only ${room / 1000} of “${l.description}” can still be credited` };
    lines.push({ itemId: l.itemId, description: l.description, hsn: l.hsn, qtyMilli: qty, unit: l.unit, ratePaise: Number(l.ratePaise), taxRateBp: l.taxRateBp, discountBp: l.discountBp, returnToStock: form.get(`ret_${l.id}`) === "on" });
  }
  if (lines.length === 0) return { error: "Enter a quantity for at least one line" };

  const result = await db.$transaction(async (tx) => {
    const { note, number, total } = await noteRecord(tx, {
      businessId: ctx.business.id, branchId: invoice.branchId, kind: "CREDIT", partyId: invoice.partyId, invoiceId: invoice.id, reason,
      placeOfSupply: invoice.placeOfSupply, interState: invoice.interState, lines, userId: ctx.user.id,
    });
    const entry = await tx.ledgerEntry.create({
      data: {
        businessId: ctx.business.id, partyId: invoice.partyId, branchId: invoice.branchId, direction: "GOT", amountPaise: total, date: note.date,
        note: `Credit note ${number} against ${invoice.number}`, source: "NOTE", createdById: ctx.user.id,
      },
    });
    // Settle the invoice it was raised on, up to what is still open on it.
    const invEntry = await tx.ledgerEntry.findFirst({ where: { invoiceId: invoice.id, source: "INVOICE" } });
    if (invEntry) {
      const [all, allocs] = await Promise.all([tx.ledgerEntry.findMany({ where: { partyId: invoice.partyId } }), tx.allocation.findMany({ where: { partyId: invoice.partyId } })]);
      const open = openByEntry(all, allocs).get(invEntry.id) ?? 0;
      const apply = Math.min(open, Number(total));
      if (apply > 0) await tx.allocation.create({ data: { businessId: ctx.business.id, partyId: invoice.partyId, receiptEntryId: entry.id, invoiceEntryId: invEntry.id, amountPaise: BigInt(apply), createdById: ctx.user.id } });
    }
    for (const l of lines) {
      if (l.returnToStock) await applyStock(tx, { businessId: ctx.business.id, branchId: invoice.branchId, itemId: l.itemId, qtyMilli: l.qtyMilli, reason: "RETURN", refType: "Note", refId: note.id, userId: ctx.user.id });
    }
    await audit(tx, { businessId: ctx.business.id, actorId: ctx.user.id, action: "create", entity: "Note", entityId: note.id, data: { number, kind: "CREDIT", total: total.toString(), invoice: invoice.number, reason } });
    return note;
  });
  await checkLowStock(ctx.business.id, lines.map((l) => l.itemId)).catch(() => undefined);
  redirect(`/notes/${result.id}`);
}

/** Debit note (BD-06): an extra charge or a correction that increases what the party owes. */
export async function createDebitNote(_prev: NoteState, form: FormData): Promise<NoteState> {
  const ctx = await requireBusiness("invoice:write");
  const p = parseDoc(form, ctx.membership.maxDiscountBp);
  if ("error" in p) return { error: p.error };
  const reason = p.doc.notes.trim();
  if (reason.length < 3) return { error: "Give a reason" };
  const party = await findParty(ctx, p.doc.partyId);
  if (!party) return { error: "Party not found" };
  const branchId = ctx.branchId ?? party.branchId;
  const seller = await sellerFor(db, ctx.business.id, branchId);
  const rows = toRows(p.lines);
  const note = await db.$transaction(async (tx) => {
    const { note, number, total } = await noteRecord(tx, {
      businessId: ctx.business.id, branchId, kind: "DEBIT", partyId: party.id, invoiceId: null, reason,
      placeOfSupply: p.doc.placeOfSupply, interState: isInterState(seller.stateCode, p.doc.placeOfSupply), lines: rows, userId: ctx.user.id,
    });
    await tx.ledgerEntry.create({
      data: { businessId: ctx.business.id, partyId: party.id, branchId, direction: "GAVE", amountPaise: total, date: note.date, dueDate: note.date, note: `Debit note ${number}: ${reason}`, source: "NOTE", createdById: ctx.user.id },
    });
    await audit(tx, { businessId: ctx.business.id, actorId: ctx.user.id, action: "create", entity: "Note", entityId: note.id, data: { number, kind: "DEBIT", total: total.toString(), reason } });
    return note;
  });
  redirect(`/notes/${note.id}`);
}
