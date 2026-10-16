import "server-only";
import { zipSync, strToU8 } from "fflate";
import { db } from "./db";
import { balancesByParty } from "./queries";
import { getObject } from "./files";
import { istDay } from "./ledger";
import { toRupeeString } from "./money";

type Table = { sheet: string; header: string[]; rows: (string | number | null)[][] };
const rs = (p: bigint | number | null) => (p === null ? null : toRupeeString(Number(p)));
const day = (d: Date | null) => (d ? istDay(d) : null);

export const EXPORTS = ["parties", "entries", "items", "invoices", "quotes", "receipts", "purchases", "expenses", "stock", "cashsales", "pricelists", "notes", "orders", "cashbook", "banklines"] as const;
export type ExportName = (typeof EXPORTS)[number];

/** One list of the business's data as a table (IN-02). */
export async function exportTable(businessId: string, name: ExportName): Promise<Table> {
  switch (name) {
    case "parties": {
      const [parties, bal] = await Promise.all([db.party.findMany({ where: { businessId }, orderBy: { name: "asc" } }), balancesByParty(businessId)]);
      return {
        sheet: "Parties",
        header: ["Name", "Type", "Mobile", "Email", "GSTIN", "State", "Address", "Credit days", "Balance (₹)", "Dr/Cr", "Source", "Archived"],
        rows: parties.map((p) => {
          const b = bal.get(p.id) ?? 0;
          return [p.name, p.type, p.phone, p.email, p.gstin, p.stateCode, p.address, p.creditDays, rs(Math.abs(b)), b > 0 ? "Dr" : b < 0 ? "Cr" : "", p.source, p.archivedAt ? "yes" : ""];
        }),
      };
    }
    case "entries": {
      const entries = await db.ledgerEntry.findMany({ where: { businessId }, orderBy: [{ date: "asc" }, { createdAt: "asc" }], include: { party: { select: { name: true } } } });
      return {
        sheet: "Entries",
        header: ["Date", "Party", "You gave (₹)", "You got (₹)", "Note", "Due date", "Paid by", "Source", "Reverses entry", "Entry ID", "Created at"],
        rows: entries.map((e) => [
          day(e.date), e.party.name, e.direction === "GAVE" ? rs(e.amountPaise) : null, e.direction === "GOT" ? rs(e.amountPaise) : null,
          e.note, day(e.dueDate), e.paymentMode, e.source, e.reversalOfId, e.id, e.createdAt.toISOString(),
        ]),
      };
    }
    case "items": {
      const items = await db.item.findMany({ where: { businessId }, orderBy: { name: "asc" } });
      return {
        sheet: "Items",
        header: ["Name", "Variant", "SKU", "Unit", "Sale price (₹)", "Purchase price (₹)", "GST %", "HSN/SAC", "In catalogue", "Archived"],
        rows: items.map((i) => [i.name, i.variantName, i.sku, i.unit, rs(i.pricePaise), rs(i.purchasePricePaise), i.taxRateBp / 100, i.hsn, i.isPublic ? "yes" : "", i.archivedAt ? "yes" : ""]),
      };
    }
    case "invoices": {
      const inv = await db.invoice.findMany({ where: { businessId }, orderBy: { date: "asc" }, include: { party: { select: { name: true, gstin: true } } } });
      return {
        sheet: "Invoices",
        header: ["Number", "Date", "Due date", "Customer", "Customer GSTIN", "Place of supply", "Taxable (₹)", "CGST (₹)", "SGST (₹)", "IGST (₹)", "Round off (₹)", "Total (₹)", "Status"],
        rows: inv.map((i) => [i.number, day(i.date), day(i.dueDate), i.party.name, i.party.gstin, i.placeOfSupply, rs(i.taxablePaise), rs(i.cgstPaise), rs(i.sgstPaise), rs(i.igstPaise), rs(i.roundOffPaise), rs(i.totalPaise), i.status]),
      };
    }
    case "quotes": {
      const q = await db.quote.findMany({ where: { businessId }, orderBy: { date: "asc" }, include: { party: { select: { name: true } } } });
      return {
        sheet: "Quotations",
        header: ["Number", "Date", "Valid until", "Customer", "Taxable (₹)", "Total (₹)", "Status", "Views"],
        rows: q.map((x) => [x.number, day(x.date), day(x.validUntil), x.party.name, rs(x.taxablePaise), rs(x.totalPaise), x.status, x.viewCount]),
      };
    }
    case "purchases": {
      const b = await db.purchaseBill.findMany({ where: { businessId }, orderBy: { date: "asc" } });
      return {
        sheet: "Supplier bills",
        header: ["Supplier", "Supplier GSTIN", "Bill no", "Date", "State", "Taxable value", "CGST", "SGST", "IGST", "Total", "Type", "ITC eligible", "Note", "Cancelled"],
        rows: b.map((x) => [x.supplierName, x.supplierGstin, x.number, day(x.date), x.stateCode, rs(x.taxablePaise), rs(x.cgstPaise), rs(x.sgstPaise), rs(x.igstPaise), rs(x.totalPaise), x.kind.toLowerCase(), x.itcEligible ? "yes" : "no", x.note, x.voidedAt ? "yes" : ""]),
      };
    }
    case "expenses": {
      const [e, parties] = await Promise.all([db.expense.findMany({ where: { businessId }, orderBy: { date: "asc" } }), db.party.findMany({ where: { businessId }, select: { id: true, name: true } })]);
      const pn = new Map(parties.map((p) => [p.id, p.name]));
      return { sheet: "Expenses", header: ["Date", "Amount", "Category", "Paid by", "Supplier", "Note", "Cancelled"], rows: e.map((x) => [day(x.date), rs(x.amountPaise), x.category, x.paymentMode.toLowerCase(), x.vendorId ? pn.get(x.vendorId) ?? null : null, x.note, x.voidedAt ? "yes" : ""]) };
    }
    case "stock": {
      const [items, sums] = await Promise.all([db.item.findMany({ where: { businessId, trackStock: true, archivedAt: null }, orderBy: { name: "asc" } }), db.stockMovement.groupBy({ by: ["itemId"], where: { businessId }, _sum: { qtyMilli: true } })]);
      const level = new Map(sums.map((s) => [s.itemId, s._sum.qtyMilli ?? 0]));
      return {
        sheet: "Stock",
        header: ["Item", "Quantity", "Unit", "Purchase price (₹)", "Stock value (₹)", "Low-stock level"],
        rows: items.map((i) => { const q = (level.get(i.id) ?? 0) / 1000; return [i.name, q, i.unit, rs(i.purchasePricePaise), i.purchasePricePaise === null ? null : Math.round(q * Number(i.purchasePricePaise)) / 100, i.reorderLevelMilli === null ? null : i.reorderLevelMilli / 1000]; }),
      };
    }
    case "cashsales": {
      const c = await db.cashSale.findMany({ where: { businessId }, orderBy: { date: "asc" } });
      return { sheet: "Cash sales", header: ["Date", "Item", "Quantity", "Amount", "Paid by", "Source", "Cancelled"], rows: c.map((x) => [day(x.date), x.item, x.qtyMilli === null ? null : x.qtyMilli / 1000, rs(x.amountPaise), x.paymentMode.toLowerCase(), x.source, x.voidedAt ? "yes" : ""]) };
    }
    case "pricelists": {
      const l = await db.priceListItem.findMany({ where: { priceList: { businessId, archivedAt: null } }, include: { priceList: { select: { name: true } } }, orderBy: [{ priceList: { name: "asc" } }, { minQtyMilli: "asc" }] });
      const items = await db.item.findMany({ where: { businessId }, select: { id: true, name: true } });
      const nm = new Map(items.map((i) => [i.id, i.name]));
      return { sheet: "Special prices", header: ["Price list", "Item", "Rate", "From quantity"], rows: l.map((x) => [x.priceList.name, nm.get(x.itemId) ?? "", rs(x.ratePaise), x.minQtyMilli / 1000]) };
    }
    case "notes": {
      const n = await db.note.findMany({ where: { businessId }, orderBy: { date: "asc" } });
      const parties = await db.party.findMany({ where: { businessId }, select: { id: true, name: true } });
      const pn = new Map(parties.map((p) => [p.id, p.name]));
      return { sheet: "Return & extra charge notes", header: ["Number", "Type", "Date", "Customer", "Reason", "Taxable (₹)", "CGST (₹)", "SGST (₹)", "IGST (₹)", "Total (₹)", "Status"], rows: n.map((x) => [x.number, x.kind, day(x.date), pn.get(x.partyId) ?? "", x.reason, rs(x.taxablePaise), rs(x.cgstPaise), rs(x.sgstPaise), rs(x.igstPaise), rs(x.totalPaise), x.status]) };
    }
    case "orders": {
      const o = await db.order.findMany({ where: { businessId }, orderBy: { date: "asc" } });
      const parties = await db.party.findMany({ where: { businessId }, select: { id: true, name: true } });
      const pn = new Map(parties.map((p) => [p.id, p.name]));
      return { sheet: "Orders", header: ["Number", "Type", "Date", "Party", "Total (₹)", "Status"], rows: o.map((x) => [x.number, x.kind, day(x.date), pn.get(x.partyId) ?? "", rs(x.totalPaise), x.status]) };
    }
    case "cashbook": {
      const a = await db.cashAdjustment.findMany({ where: { businessId }, orderBy: { date: "asc" } });
      return { sheet: "Cash adjustments", header: ["Date", "Direction", "Amount (₹)", "Note", "Cancelled"], rows: a.map((x) => [day(x.date), x.direction, rs(x.amountPaise), x.note, x.voidedAt ? "yes" : ""]) };
    }
    case "banklines": {
      const t = await db.bankTxn.findMany({ where: { businessId }, orderBy: [{ date: "asc" }, { createdAt: "asc" }] });
      return { sheet: "Bank lines", header: ["Date", "Description", "Money in (₹)", "Money out (₹)", "Group", "Balance (₹)"], rows: t.map((x) => [day(x.date), x.description, x.direction === "IN" ? rs(x.amountPaise) : null, x.direction === "OUT" ? rs(x.amountPaise) : null, x.category, rs(x.balancePaise)]) };
    }
    case "receipts": {
      const r = await db.receipt.findMany({ where: { businessId }, orderBy: { date: "asc" }, include: { party: { select: { name: true } } } });
      return {
        sheet: "Receipts",
        header: ["Number", "Date", "Party", "Amount (₹)", "Paid by"],
        rows: r.map((x) => [x.number, day(x.date), x.party.name, rs(x.amountPaise), x.mode]),
      };
    }
  }
}

const json = (v: unknown) => JSON.stringify(v, (_k, x) => (typeof x === "bigint" ? x.toString() : x), 2);

/**
 * Everything the business owns, as a ZIP: one JSON file per table plus every
 * uploaded file (SE-04: no lock-in). Money values are integer paise.
 */
export async function fullExport(businessId: string): Promise<Uint8Array> {
  const where = { businessId };
  const [business, members, parties, entries, items, invoices, quotes, receipts, messages, creditTxns, consentEvents, auditEvents, files, purchaseBills, expenses, cashSales, notes, orders, stockMovements, cashAdjustments, bankTxns] = await Promise.all([
    db.business.findUnique({ where: { id: businessId } }),
    db.membership.findMany({ where, include: { user: { select: { phone: true, name: true } } } }),
    db.party.findMany({ where }),
    db.ledgerEntry.findMany({ where }),
    db.item.findMany({ where }),
    db.invoice.findMany({ where, include: { lines: true } }),
    db.quote.findMany({ where, include: { lines: true } }),
    db.receipt.findMany({ where }),
    db.message.findMany({ where }),
    db.creditTxn.findMany({ where }),
    db.consentEvent.findMany({ where }),
    db.auditEvent.findMany({ where }),
    db.storedFile.findMany({ where }),
    db.purchaseBill.findMany({ where }),
    db.expense.findMany({ where }),
    db.cashSale.findMany({ where }),
    db.note.findMany({ where, include: { lines: true } }),
    db.order.findMany({ where, include: { lines: true } }),
    db.stockMovement.findMany({ where }),
    db.cashAdjustment.findMany({ where }),
    db.bankTxn.findMany({ where }),
  ]);
  const tables = { business, members, parties, entries, items, invoices, quotes, receipts, messages, creditTxns, consentEvents, auditEvents, files, purchaseBills, expenses, cashSales, notes, orders, stockMovements, cashAdjustments, bankTxns };
  const zip: Record<string, Uint8Array> = {
    "README.txt": strToU8(
      `Full data export of ${business?.name} taken ${new Date().toISOString()}.\n` +
      "Each data/*.json file is one table. Money fields ending in Paise are whole paise (₹1 = 100).\n" +
      "Uploaded files are in files/, named <file id>-<original name>; data/files.json maps them to entries.\n",
    ),
  };
  for (const [name, rows] of Object.entries(tables)) zip[`data/${name}.json`] = strToU8(json(rows));
  for (const f of files) {
    try {
      zip[`files/${f.id}-${f.name.replace(/[\\/:*?"<>|]+/g, "_")}`] = new Uint8Array(await getObject(f.storageKey));
    } catch {
      // A missing file on disk shouldn't block the rest of the export.
    }
  }
  return zipSync(zip, { level: 6 });
}
