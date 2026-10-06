import "server-only";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "./db";
import { audit } from "./audit";
import { newShareToken } from "./session";
import { parseRupees } from "./money";
import { computeInvoice, GST_RATES_BP, isInterState } from "./gst";
import { STATES } from "./gstin";
import { applyStock } from "./stock";

// Shared by invoices, quotations, orders and notes: parsing the line editor,
// pricing lines with GST, and issuing an invoice into the ledger.

type Tx = Prisma.TransactionClient;

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const optionalYmd = z.string().refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v));

export const DocInput = z.object({
  partyId: z.string().min(1, "Choose a party"),
  date: ymd,
  dueDate: optionalYmd, // invoice: due date · quotation: valid until · order: expected delivery
  placeOfSupply: z.string().refine((v) => v in STATES, "Choose the place of supply"),
  notes: z.string().trim().max(500),
  lines: z
    .array(
      z.object({
        itemId: z.string().optional(),
        description: z.string().trim().min(1, "Every line needs a description").max(200),
        hsn: z.string().trim().max(8).optional(),
        unit: z.string().trim().max(12).default("pcs"),
        qty: z.string(),
        rate: z.string(),
        discount: z.string().optional(), // percent, e.g. "10" or "2.5"
        taxRateBp: z.number().refine((v) => GST_RATES_BP.includes(v), "Invalid GST rate"),
      }),
    )
    .min(1, "Add at least one line"),
});

export type DocInputT = z.infer<typeof DocInput>;
export type ParsedLine = DocInputT["lines"][number] & { qtyMilli: number; ratePaise: number; discountBp: number };

export function parseDoc(form: FormData, maxDiscountBp: number | null): { error: string } | { doc: DocInputT; lines: ParsedLine[] } {
  let raw: unknown;
  try {
    raw = JSON.parse(String(form.get("payload") ?? ""));
  } catch {
    return { error: "Invalid form data" };
  }
  const r = DocInput.safeParse(raw);
  if (!r.success) return { error: r.error.issues[0].message };
  const lines: ParsedLine[] = [];
  for (const [i, l] of r.data.lines.entries()) {
    const qtyMilli = Math.round(Number(l.qty) * 1000);
    const rate = parseRupees(l.rate);
    if (!Number.isFinite(qtyMilli) || qtyMilli <= 0) return { error: `Line ${i + 1}: quantity must be more than zero` };
    if (rate === null) return { error: `Line ${i + 1}: rate must be an amount` };
    const d = (l.discount ?? "").trim();
    if (d && !/^\d{1,2}(\.\d{1,2})?$|^100$/.test(d)) return { error: `Line ${i + 1}: discount must be a percentage like 5 or 2.5` };
    const discountBp = d ? Math.round(Number(d) * 100) : 0;
    if (maxDiscountBp !== null && discountBp > maxDiscountBp) return { error: `Line ${i + 1}: your discount limit is ${maxDiscountBp / 100}%` };
    lines.push({ ...l, qtyMilli, ratePaise: rate, discountBp });
  }
  return { doc: r.data, lines };
}

export type LineRow = { itemId: string | null; description: string; hsn: string | null; qtyMilli: number; unit: string; ratePaise: number; taxRateBp: number; discountBp: number };

/** Totals and per-line rows ready to store on an invoice, quotation, order or note. */
export function priceLines(lines: LineRow[], interState: boolean) {
  const totals = computeInvoice(lines, interState);
  return {
    header: {
      interState,
      taxablePaise: BigInt(totals.taxable), cgstPaise: BigInt(totals.cgst), sgstPaise: BigInt(totals.sgst),
      igstPaise: BigInt(totals.igst), roundOffPaise: BigInt(totals.roundOff), totalPaise: BigInt(totals.total),
    },
    rows: lines.map((l, i) => ({
      itemId: l.itemId, description: l.description, hsn: l.hsn, qtyMilli: l.qtyMilli, unit: l.unit,
      ratePaise: BigInt(l.ratePaise), taxRateBp: l.taxRateBp, discountBp: l.discountBp,
      taxablePaise: BigInt(totals.lines[i].taxable), cgstPaise: BigInt(totals.lines[i].cgst),
      sgstPaise: BigInt(totals.lines[i].sgst), igstPaise: BigInt(totals.lines[i].igst), totalPaise: BigInt(totals.lines[i].total),
    })),
    total: totals.total,
  };
}

export const istNoon = (d: string) => new Date(`${d}T12:00:00+05:30`);
export const endOfDay = (d: string) => new Date(`${d}T23:59:59+05:30`);
export const todayYmd = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

export const toRows = (lines: ParsedLine[]): LineRow[] =>
  lines.map((l) => ({ itemId: l.itemId || null, description: l.description, hsn: l.hsn || null, qtyMilli: l.qtyMilli, unit: l.unit, ratePaise: l.ratePaise, taxRateBp: l.taxRateBp, discountBp: l.discountBp }));

/**
 * The GSTIN, state and invoice series an invoice is issued under (BD-10): the
 * branch's own when it has them, otherwise the business's.
 */
export async function sellerFor(db_: Pick<typeof db, "branch" | "business">, businessId: string, branchId: string | null) {
  const [business, branch] = await Promise.all([
    db_.business.findUniqueOrThrow({ where: { id: businessId } }),
    branchId ? db_.branch.findFirst({ where: { id: branchId, businessId } }) : null,
  ]);
  return {
    gstin: branch?.gstin ?? business.gstin,
    stateCode: branch?.stateCode ?? business.stateCode,
    branch: branch?.invoicePrefix ? branch : null,
  };
}

/** Next number in a series, advancing the counter in the same transaction. */
async function nextInvoiceNumber(tx: Tx, businessId: string, branchId: string | null) {
  const branch = branchId ? await tx.branch.findFirst({ where: { id: branchId, businessId } }) : null;
  if (branch?.invoicePrefix) {
    const b = await tx.branch.update({ where: { id: branch.id }, data: { nextInvoiceNo: { increment: 1 } } });
    return `${b.invoicePrefix}${b.nextInvoiceNo - 1}`;
  }
  const b = await tx.business.update({ where: { id: businessId }, data: { nextInvoiceNo: { increment: 1 } } });
  return `${b.invoicePrefix}${b.nextInvoiceNo - 1}`;
}

export type IssueInput = {
  businessId: string; userId: string; partyId: string; branchId: string | null; date: Date; dueDate: Date | null;
  placeOfSupply: string; notes: string | null; lines: LineRow[]; quoteId?: string; orderId?: string;
};

/** Creates an invoice, posts it to the party ledger (PRD flow F1) and takes the stock out. */
export async function issueInvoice(tx: Tx, o: IssueInput) {
  const seller = await sellerFor(tx as unknown as typeof db, o.businessId, o.branchId);
  const number = await nextInvoiceNumber(tx, o.businessId, o.branchId);
  const priced = priceLines(o.lines, isInterState(seller.stateCode, o.placeOfSupply));
  const inv = await tx.invoice.create({
    data: {
      businessId: o.businessId, partyId: o.partyId, branchId: o.branchId, number, date: o.date, dueDate: o.dueDate, placeOfSupply: o.placeOfSupply,
      ...priced.header, notes: o.notes, shareToken: newShareToken(), createdById: o.userId, quoteId: o.quoteId ?? null, orderId: o.orderId ?? null,
      sellerGstin: seller.gstin, sellerStateCode: seller.stateCode,
      lines: { create: priced.rows },
    },
  });
  await tx.ledgerEntry.create({
    data: {
      businessId: o.businessId, partyId: o.partyId, branchId: o.branchId, direction: "GAVE", amountPaise: priced.header.totalPaise, date: o.date, dueDate: o.dueDate,
      note: `Invoice ${number}`, source: "INVOICE", invoiceId: inv.id, createdById: o.userId,
    },
  });
  for (const l of o.lines) {
    await applyStock(tx, { businessId: o.businessId, branchId: o.branchId, itemId: l.itemId, qtyMilli: -l.qtyMilli, reason: "INVOICE", refType: "Invoice", refId: inv.id, userId: o.userId });
  }
  await audit(tx, { businessId: o.businessId, actorId: o.userId, action: "create", entity: "Invoice", entityId: inv.id, data: { number, total: priced.total, quoteId: o.quoteId, orderId: o.orderId } });
  return inv;
}
