import "server-only";
import { db } from "./db";
import { docWhere, type Ctx } from "./auth";
import { istDay } from "./ledger";
import { monthBounds } from "./finance";
import { buildGstr1, buildGstr3b, type Doc, type Purchase } from "./gst-returns";

const n = (v: bigint | number) => Number(v);
type LineLike = { description: string; hsn: string | null; unit: string; qtyMilli: number; taxRateBp: number; taxablePaise: bigint; cgstPaise: bigint; sgstPaise: bigint; igstPaise: bigint };
const lines = (ls: LineLike[]): Doc["lines"] => ls.map((l) => ({ description: l.description, hsn: l.hsn, unit: l.unit, qtyMilli: l.qtyMilli, taxRateBp: l.taxRateBp, taxablePaise: n(l.taxablePaise), cgstPaise: n(l.cgstPaise), sgstPaise: n(l.sgstPaise), igstPaise: n(l.igstPaise) }));

/** Everything a month's GST return needs: sales, credit notes and purchase bills for that month. */
export async function loadGst(ctx: Ctx, month: string) {
  const { gte, lte } = monthBounds(month);
  const [invoices, notes, purchases] = await Promise.all([
    db.invoice.findMany({ where: { ...docWhere(ctx), date: { gte, lte } }, include: { lines: true, party: { select: { name: true, gstin: true } } }, orderBy: [{ date: "asc" }, { createdAt: "asc" }] }),
    db.note.findMany({ where: { businessId: ctx.business.id, kind: "CREDIT", date: { gte, lte }, ...(ctx.branchId ? { branchId: ctx.branchId } : {}) }, include: { lines: true }, orderBy: { date: "asc" } }),
    db.purchaseBill.findMany({ where: { businessId: ctx.business.id, date: { gte, lte }, voidedAt: null, ...(ctx.branchId ? { OR: [{ branchId: ctx.branchId }, { branchId: null }] } : {}) }, orderBy: { date: "asc" } }),
  ]);
  const parties = await db.party.findMany({ where: { id: { in: [...new Set(notes.map((x) => x.partyId))] } }, select: { id: true, name: true, gstin: true } });
  const pm = new Map(parties.map((p) => [p.id, p]));
  const sales: Doc[] = invoices.map((i) => ({ number: i.number, date: istDay(i.date), partyName: i.party.name, partyGstin: i.party.gstin, placeOfSupply: i.placeOfSupply, interState: i.interState, totalPaise: n(i.totalPaise), status: i.status, lines: lines(i.lines) }));
  const credit: Doc[] = notes.map((x) => ({ number: x.number, date: istDay(x.date), partyName: pm.get(x.partyId)?.name ?? "", partyGstin: pm.get(x.partyId)?.gstin ?? null, placeOfSupply: x.placeOfSupply, interState: x.interState, totalPaise: n(x.totalPaise), status: x.status, lines: lines(x.lines) }));
  const bills: Purchase[] = purchases.map((b) => ({ taxablePaise: n(b.taxablePaise), cgstPaise: n(b.cgstPaise), sgstPaise: n(b.sgstPaise), igstPaise: n(b.igstPaise), itcEligible: b.itcEligible, kind: b.kind, voided: !!b.voidedAt }));
  return { sales, credit, purchases, bills, gstr1: buildGstr1(sales, credit), gstr3b: buildGstr3b(sales, credit, bills) };
}
