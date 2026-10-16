import "server-only";
import { db } from "./db";
import { partyWhere, type Ctx } from "./auth";
import { newShareToken } from "./session";
import { checkPurchaseRow } from "./purchase";
import { checkCashSaleRow, checkExpenseRow, checkInvoiceRow, checkPaymentRow, checkPriceRow, checkStockRow, type MoreKind } from "./import-more";
import { levelOf } from "./stock";

export type Skipped = { row: number; name: string; reason: string }[];
export type Opts = { postToLedger: boolean; stockMode: "add" | "set" };

const noon = (d: string) => new Date(`${d}T12:00:00+05:30`);
const lc = (s: string) => s.trim().toLowerCase();

/**
 * Saves the valid rows of an import of supplier bills, expenses, payments, old sales bills, stock counts, cash sales or special prices.
 * Rows that are wrong, or already in the app, are skipped and reported; nothing is overwritten.
 */
export async function commitMore(kind: MoreKind, ctx: Ctx, rows: string[][], cell: (r: string[], key: string) => string, opts: Opts): Promise<{ imported: number; skipped: Skipped }> {
  const { business, user } = ctx;
  const skipped: Skipped = [];
  let imported = 0;
  const skip = (i: number, name: string, reason: string) => skipped.push({ row: i + 2, name: name || `(row ${i + 2})`, reason });

  if (kind === "purchases") {
    const [existing, suppliers] = await Promise.all([
      db.purchaseBill.findMany({ where: { businessId: business.id, voidedAt: null }, select: { number: true, supplierName: true, supplierGstin: true } }),
      db.party.findMany({ where: { businessId: business.id, archivedAt: null, type: { in: ["SUPPLIER", "BOTH"] } }, select: { id: true, name: true, gstin: true } }),
    ]);
    const seen = new Set(existing.map((b) => `${b.supplierGstin ?? lc(b.supplierName)}|${lc(b.number)}`));
    for (const [i, r] of rows.entries()) {
      const c = checkPurchaseRow((k) => cell(r, k), business.stateCode);
      const label = cell(r, "supplier");
      if (!c.ok) { skip(i, label, c.error); continue; }
      const v = c.value;
      const key = `${v.supplierGstin ?? lc(v.supplierName)}|${lc(v.number)}`;
      if (seen.has(key)) { skip(i, label, "Already exists"); continue; }
      const party = suppliers.find((s) => (v.supplierGstin && s.gstin === v.supplierGstin) || lc(s.name) === lc(v.supplierName));
      await db.purchaseBill.create({
        data: {
          businessId: business.id, branchId: ctx.branchId, partyId: party?.id ?? null, supplierName: v.supplierName, supplierGstin: v.supplierGstin, number: v.number, date: noon(v.date),
          stateCode: v.stateCode, interState: v.tax.igst > 0, taxablePaise: BigInt(v.taxablePaise), cgstPaise: BigInt(v.tax.cgst), sgstPaise: BigInt(v.tax.sgst), igstPaise: BigInt(v.tax.igst),
          totalPaise: BigInt(v.totalPaise), kind: v.kind, itcEligible: v.itcEligible, note: v.note, createdById: user.id,
        },
      });
      seen.add(key);
      imported++;
    }
  } else if (kind === "expenses") {
    const [existing, suppliers] = await Promise.all([
      db.expense.findMany({ where: { businessId: business.id, voidedAt: null }, select: { date: true, amountPaise: true, category: true } }),
      db.party.findMany({ where: { businessId: business.id, archivedAt: null, type: { in: ["SUPPLIER", "BOTH"] } }, select: { id: true, name: true } }),
    ]);
    const day = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    const seen = new Set(existing.map((e) => `${day(e.date)}|${e.amountPaise}|${lc(e.category)}`));
    for (const [i, r] of rows.entries()) {
      const c = checkExpenseRow((k) => cell(r, k));
      if (!c.ok) { skip(i, cell(r, "category"), c.error); continue; }
      const v = c.value;
      const key = `${v.date}|${v.amountPaise}|${lc(v.category)}`;
      if (seen.has(key)) { skip(i, v.category, "Already exists"); continue; }
      await db.expense.create({
        data: { businessId: business.id, branchId: ctx.branchId, date: noon(v.date), amountPaise: BigInt(v.amountPaise), category: v.category, paymentMode: v.mode, note: v.note, vendorId: suppliers.find((s) => lc(s.name) === lc(v.supplier ?? ""))?.id ?? null, createdById: user.id },
      });
      seen.add(key);
      imported++;
    }
  } else if (kind === "payments") {
    const parties = await db.party.findMany({ where: { AND: [partyWhere(ctx), { archivedAt: null }] }, select: { id: true, name: true, branchId: true } });
    const byName = new Map(parties.map((p) => [lc(p.name), p]));
    const existing = await db.ledgerEntry.findMany({ where: { businessId: business.id, source: "MANUAL", reversedBy: null }, select: { partyId: true, direction: true, amountPaise: true, date: true } });
    const day = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    const seen = new Set(existing.map((e) => `${e.partyId}|${e.direction}|${e.amountPaise}|${day(e.date)}`));
    for (const [i, r] of rows.entries()) {
      const c = checkPaymentRow((k) => cell(r, k));
      const label = cell(r, "party");
      if (!c.ok) { skip(i, label, c.error); continue; }
      const v = c.value;
      const party = byName.get(lc(v.party));
      if (!party) { skip(i, label, "No customer or supplier with this name. Add them first"); continue; }
      const key = `${party.id}|${v.direction}|${v.amountPaise}|${v.date}`;
      if (seen.has(key)) { skip(i, label, "Already exists"); continue; }
      await db.ledgerEntry.create({
        data: { businessId: business.id, partyId: party.id, branchId: ctx.branchId ?? party.branchId, direction: v.direction, amountPaise: BigInt(v.amountPaise), date: noon(v.date), note: v.note ?? "Imported", paymentMode: v.mode, source: "MANUAL", createdById: user.id },
      });
      seen.add(key);
      imported++;
    }
  } else if (kind === "invoices") {
    const [existing, parties] = await Promise.all([
      db.invoice.findMany({ where: { businessId: business.id }, select: { number: true } }),
      db.party.findMany({ where: { AND: [partyWhere(ctx), { archivedAt: null }] }, select: { id: true, name: true, gstin: true } }),
    ]);
    const numbers = new Set(existing.map((x) => lc(x.number)));
    const byName = new Map(parties.map((p) => [lc(p.name), p]));
    const byGstin = new Map(parties.filter((p) => p.gstin).map((p) => [p.gstin!, p]));
    for (const [i, r] of rows.entries()) {
      const c = checkInvoiceRow((k) => cell(r, k), business.stateCode);
      const label = cell(r, "number");
      if (!c.ok) { skip(i, label, c.error); continue; }
      const v = c.value;
      if (numbers.has(lc(v.number))) { skip(i, label, "Already exists"); continue; }
      let party = (v.gstin ? byGstin.get(v.gstin) : undefined) ?? byName.get(lc(v.party));
      await db.$transaction(async (tx) => {
        if (!party) {
          party = await tx.party.create({ data: { businessId: business.id, name: v.party, type: "CUSTOMER", gstin: v.gstin, stateCode: v.stateCode, source: "Import", shareToken: newShareToken(), branchId: ctx.branchId } });
          byName.set(lc(v.party), party);
          if (v.gstin) byGstin.set(v.gstin, party);
        }
        const inv = await tx.invoice.create({
          data: {
            businessId: business.id, partyId: party.id, branchId: ctx.branchId, number: v.number, date: noon(v.date), placeOfSupply: v.stateCode, interState: v.tax.igst > 0,
            taxablePaise: BigInt(v.taxablePaise), cgstPaise: BigInt(v.tax.cgst), sgstPaise: BigInt(v.tax.sgst), igstPaise: BigInt(v.tax.igst), roundOffPaise: 0n, totalPaise: BigInt(v.totalPaise),
            notes: "Imported bill", shareToken: newShareToken(), createdById: user.id, sellerGstin: business.gstin, sellerStateCode: business.stateCode,
            lines: { create: [{ description: "As per bill", hsn: v.hsn, qtyMilli: 1000, unit: "nos", ratePaise: BigInt(v.taxablePaise), taxRateBp: v.rateBp, taxablePaise: BigInt(v.taxablePaise), cgstPaise: BigInt(v.tax.cgst), sgstPaise: BigInt(v.tax.sgst), igstPaise: BigInt(v.tax.igst), totalPaise: BigInt(v.totalPaise) }] },
          },
        });
        if (opts.postToLedger) {
          await tx.ledgerEntry.create({ data: { businessId: business.id, partyId: party.id, branchId: ctx.branchId, direction: "GAVE", amountPaise: BigInt(v.totalPaise), date: noon(v.date), note: `Invoice ${v.number} (imported)`, source: "INVOICE", invoiceId: inv.id, createdById: user.id } });
        }
      });
      numbers.add(lc(v.number));
      imported++;
    }
  } else if (kind === "stock") {
    const items = await db.item.findMany({ where: { businessId: business.id, archivedAt: null }, select: { id: true, name: true, trackStock: true } });
    const byName = new Map(items.map((x) => [lc(x.name), x]));
    for (const [i, r] of rows.entries()) {
      const c = checkStockRow((k) => cell(r, k));
      const label = cell(r, "item");
      if (!c.ok) { skip(i, label, c.error); continue; }
      const item = byName.get(lc(c.value.item));
      if (!item) { skip(i, label, "No item with this name. Add it first"); continue; }
      const level = item.trackStock ? await levelOf(business.id, item.id) : 0;
      const delta = opts.stockMode === "set" ? c.value.qtyMilli - level : c.value.qtyMilli;
      if (delta === 0) { skip(i, label, "Already at this count"); continue; }
      await db.$transaction(async (tx) => {
        if (!item.trackStock) await tx.item.update({ where: { id: item.id }, data: { trackStock: true } });
        await tx.stockMovement.create({ data: { businessId: business.id, branchId: ctx.branchId, itemId: item.id, qtyMilli: delta, reason: level === 0 ? "OPENING" : "ADJUSTMENT", refType: "Import", note: c.value.note ?? "Imported stock count", createdById: user.id } });
      });
      item.trackStock = true;
      imported++;
    }
  } else if (kind === "cashsales") {
    const existing = await db.cashSale.findMany({ where: { businessId: business.id, voidedAt: null }, select: { date: true, item: true, amountPaise: true } });
    const day = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    const seen = new Set(existing.map((e) => `${day(e.date)}|${lc(e.item)}|${e.amountPaise}`));
    for (const [i, r] of rows.entries()) {
      const c = checkCashSaleRow((k) => cell(r, k));
      if (!c.ok) { skip(i, cell(r, "item"), c.error); continue; }
      const v = c.value;
      const key = `${v.date}|${lc(v.item)}|${v.amountPaise}`;
      if (seen.has(key)) { skip(i, v.item, "Already exists"); continue; }
      await db.cashSale.create({ data: { businessId: business.id, branchId: ctx.branchId, date: noon(v.date), item: v.item, qtyMilli: v.qtyMilli, amountPaise: BigInt(v.amountPaise), paymentMode: v.mode, source: "IMPORT", createdById: user.id } });
      seen.add(key);
      imported++;
    }
  } else {
    const [items, lists] = await Promise.all([
      db.item.findMany({ where: { businessId: business.id, archivedAt: null }, select: { id: true, name: true } }),
      db.priceList.findMany({ where: { businessId: business.id, archivedAt: null }, select: { id: true, name: true } }),
    ]);
    const byItem = new Map(items.map((x) => [lc(x.name), x.id]));
    const byList = new Map(lists.map((x) => [lc(x.name), x.id]));
    for (const [i, r] of rows.entries()) {
      const c = checkPriceRow((k) => cell(r, k));
      if (!c.ok) { skip(i, cell(r, "item"), c.error); continue; }
      const v = c.value;
      const itemId = byItem.get(lc(v.item));
      if (!itemId) { skip(i, v.item, "No item with this name. Add it first"); continue; }
      let listId = byList.get(lc(v.list));
      if (!listId) {
        listId = (await db.priceList.create({ data: { businessId: business.id, name: v.list } })).id;
        byList.set(lc(v.list), listId);
      }
      const clash = await db.priceListItem.findUnique({ where: { priceListId_itemId_minQtyMilli: { priceListId: listId, itemId, minQtyMilli: v.minQtyMilli } } });
      if (clash) { skip(i, v.item, "Already in this list at this quantity"); continue; }
      await db.priceListItem.create({ data: { priceListId: listId, itemId, minQtyMilli: v.minQtyMilli, ratePaise: BigInt(v.ratePaise) } });
      imported++;
    }
  }
  return { imported, skipped };
}
