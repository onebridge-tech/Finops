import "server-only";
import { db } from "./db";
import { docWhere, partyWhere, type Ctx } from "./auth";
import { parseRupees } from "./money";

export const SEARCH_TYPES = ["parties", "entries", "invoices", "quotes", "items", "receipts"] as const;
export type SearchType = (typeof SEARCH_TYPES)[number];

/**
 * One search across parties, ledger entries, documents, items and receipts
 * (IR-10), within what this member is allowed to see. A number also matches
 * entry and document amounts exactly.
 */
export async function search(ctx: Ctx, q: string, only?: SearchType, take = 10) {
  const text = q.trim();
  if (text.length < 2) return null;
  const amount = parseRupees(text);
  const want = (t: SearchType) => !only || only === t;
  const party = partyWhere(ctx);
  const docs = docWhere(ctx);
  const upper = text.toUpperCase();

  const [parties, entries, invoices, quotes, items, receipts] = await Promise.all([
    want("parties") ? db.party.findMany({
      where: { AND: [party, { OR: [{ name: { contains: text } }, { phone: { contains: text.replace(/\D/g, "") || text } }, { gstin: { contains: upper } }, { email: { contains: text } }] }] },
      take, orderBy: { name: "asc" },
    }) : [],
    want("entries") ? db.ledgerEntry.findMany({
      where: {
        businessId: ctx.business.id, party,
        OR: [{ note: { contains: text } }, ...(amount ? [{ amountPaise: BigInt(amount) }] : [])],
      },
      take, orderBy: { date: "desc" }, include: { party: { select: { name: true } } },
    }) : [],
    want("invoices") ? db.invoice.findMany({
      where: { ...docs, OR: [{ number: { contains: upper } }, { party: { name: { contains: text } } }, ...(amount ? [{ totalPaise: BigInt(amount) }] : [])] },
      take, orderBy: { date: "desc" }, include: { party: { select: { name: true } } },
    }) : [],
    want("quotes") ? db.quote.findMany({
      where: { ...docs, OR: [{ number: { contains: upper } }, { party: { name: { contains: text } } }, ...(amount ? [{ totalPaise: BigInt(amount) }] : [])] },
      take, orderBy: { date: "desc" }, include: { party: { select: { name: true } } },
    }) : [],
    want("items") ? db.item.findMany({
      where: { businessId: ctx.business.id, OR: [{ name: { contains: text } }, { sku: { contains: text } }, { hsn: { contains: text } }, { variantName: { contains: text } }] },
      take, orderBy: { name: "asc" },
    }) : [],
    want("receipts") ? db.receipt.findMany({
      where: { businessId: ctx.business.id, party, OR: [{ number: { contains: upper } }, ...(amount ? [{ amountPaise: BigInt(amount) }] : [])] },
      take, orderBy: { date: "desc" }, include: { party: { select: { name: true } } },
    }) : [],
  ]);
  return { parties, entries, invoices, quotes, items, receipts };
}
