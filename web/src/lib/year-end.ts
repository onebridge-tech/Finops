import "server-only";
import { db } from "./db";
import { docWhere, type Ctx } from "./auth";
import { istDay } from "./ledger";
import { collections, partiesWithBalance } from "./queries";
import { profitAndLoss, shiftMonth } from "./finance";
import { loadGst } from "./gst-data";
import { estimateTax } from "./tax-estimate";
import { rangeDates } from "./period";
import { toRupeeString } from "./money";
import type { Sheet } from "./spreadsheet";

const rs = (p: bigint | number | null | undefined) => (p === null || p === undefined ? null : Number(toRupeeString(Number(p))));
const DIGITAL = new Set(["UPI", "BANK", "CARD", "CHEQUE"]);

export const fyLabel = (startYear: number) => `${startYear}-${String(startYear + 1).slice(2)}`;
export const fyRange = (startYear: number) => ({ from: `${startYear}-04-01`, to: `${startYear + 1}-03-31` });

/** Everything an accountant asks for at the end of a financial year, as sheets of one Excel file, plus the totals shown on the page. */
export async function loadYearEnd(ctx: Ctx, startYear: number) {
  const { from, to } = fyRange(startYear);
  const { gte, lte } = rangeDates(from, to);
  const bid = ctx.business.id;
  const months = Array.from({ length: 12 }, (_, i) => shiftMonth(`${startYear}-04`, i));

  const [invoices, notes, purchases, expenses, receipts, cashSales, bankTxns, items, parties, owing, pls, gsts] = await Promise.all([
    db.invoice.findMany({ where: { ...docWhere(ctx), date: { gte, lte } }, include: { party: { select: { name: true, gstin: true } } }, orderBy: [{ date: "asc" }, { createdAt: "asc" }] }),
    db.note.findMany({ where: { businessId: bid, date: { gte, lte }, ...(ctx.branchId ? { branchId: ctx.branchId } : {}) }, orderBy: { date: "asc" } }),
    db.purchaseBill.findMany({ where: { businessId: bid, date: { gte, lte }, ...(ctx.branchId ? { OR: [{ branchId: ctx.branchId }, { branchId: null }] } : {}) }, orderBy: { date: "asc" } }),
    db.expense.findMany({ where: { businessId: bid, date: { gte, lte }, voidedAt: null, ...(ctx.branchId ? { branchId: ctx.branchId } : {}) }, orderBy: { date: "asc" } }),
    db.ledgerEntry.findMany({ where: { businessId: bid, direction: "GOT", date: { gte, lte }, source: { notIn: ["REVERSAL", "OPENING", "NOTE"] }, reversedBy: null, ...(ctx.branchId ? { branchId: ctx.branchId } : {}) }, include: { party: { select: { name: true } } }, orderBy: { date: "asc" } }),
    db.cashSale.findMany({ where: { businessId: bid, date: { gte, lte }, voidedAt: null }, orderBy: { date: "asc" } }),
    db.bankTxn.findMany({ where: { businessId: bid, date: { gte, lte } }, orderBy: [{ date: "asc" }, { createdAt: "asc" }] }),
    db.item.findMany({ where: { businessId: bid, archivedAt: null }, orderBy: { name: "asc" } }),
    partiesWithBalance(ctx),
    collections(ctx),
    Promise.all(months.map((m) => profitAndLoss(ctx, m))),
    Promise.all(months.map((m) => loadGst(ctx, m))),
  ]);

  const live = invoices.filter((i) => i.status !== "CANCELLED");
  const sumP = (xs: { taxablePaise: bigint }[]) => xs.reduce((s, x) => s + Number(x.taxablePaise), 0);
  const sales = sumP(live);
  const returns = sumP(notes.filter((n) => n.kind === "CREDIT" && n.status !== "CANCELLED"));
  const cash = cashSales.reduce((s, x) => s + Number(x.amountPaise), 0);
  const turnover = sales - returns + cash;
  const gstSales = live.reduce((s, i) => s + Number(i.cgstPaise + i.sgstPaise + i.igstPaise), 0);
  const purchTotal = purchases.filter((b) => !b.voidedAt).reduce((s, b) => s + Number(b.taxablePaise), 0);
  const itc = purchases.filter((b) => !b.voidedAt && b.itcEligible).reduce((s, b) => s + Number(b.cgstPaise + b.sgstPaise + b.igstPaise), 0);
  const expTotal = expenses.reduce((s, e) => s + Number(e.amountPaise), 0);
  const profit = pls.reduce((s, p) => s + p.netProfit, 0); // already includes cash sales
  const allReceipts = receipts.reduce((s, e) => s + Number(e.amountPaise), 0) + cash;
  const digitalReceipts = receipts.filter((e) => DIGITAL.has(e.paymentMode ?? "")).reduce((s, e) => s + Number(e.amountPaise), 0) + cashSales.filter((c) => DIGITAL.has(c.paymentMode)).reduce((s, c) => s + Number(c.amountPaise), 0);
  const tax = estimateTax({ turnoverPaise: turnover, digitalReceiptsPaise: digitalReceipts, allReceiptsPaise: allReceipts, bookProfitPaise: profit });

  const byCat = new Map<string, number>();
  for (const e of expenses) byCat.set(e.category, (byCat.get(e.category) ?? 0) + Number(e.amountPaise));
  const today = istDay(new Date());
  const note = `${ctx.business.name} · financial year ${fyLabel(startYear)} (${from} to ${to}) · prepared from entries in FinOps; please verify`;

  const sheets: Sheet[] = [
    {
      name: "Summary", note, header: ["", "Amount (₹)"],
      rows: [
        ["Sales before GST", rs(sales)], ["Less: returns (credit notes)", rs(returns)], ["Cash sales without a bill", rs(cash)], ["Turnover", rs(turnover)],
        ["GST charged on sales", rs(gstSales)], ["Purchases before GST (supplier bills)", rs(purchTotal)], ["GST you can claim back (input credit)", rs(itc)],
        ["Shop expenses", rs(expTotal)], ["Profit (estimate, from your entries)", rs(profit)], ["Money received from customers", rs(allReceipts)], ["…of which by UPI, bank, card or cheque", rs(digitalReceipts)],
      ],
    },
    {
      name: "Income tax estimate", note: `Estimate only. ${tax.notes[0]}`, header: ["", "Amount (₹)"],
      rows: [
        ["Turnover", tax.turnover], ["Share of receipts that were digital (%)", tax.digitalShare],
        [`Presumptive profit (section 44AD, limit ₹${tax.presumptive.limit.toLocaleString("en-IN")})`, tax.presumptive.deemedProfit], ["…tax with cess", tax.presumptive.tax.total],
        ["Profit from your books", tax.books.profit], ["…tax with cess", tax.books.tax.total],
      ],
    },
    { name: "Sales register", note, header: ["Invoice", "Date", "Customer", "Customer GSTIN", "Place of supply", "Taxable", "CGST", "SGST", "IGST", "Round off", "Total", "Status"], rows: invoices.map((i) => [i.number, istDay(i.date), i.party.name, i.party.gstin, i.placeOfSupply, rs(i.taxablePaise), rs(i.cgstPaise), rs(i.sgstPaise), rs(i.igstPaise), rs(i.roundOffPaise), rs(i.totalPaise), i.status]) },
    { name: "Credit & debit notes", note, header: ["Note", "Type", "Date", "Reason", "Taxable", "CGST", "SGST", "IGST", "Total", "Status"], rows: notes.map((n) => [n.number, n.kind, istDay(n.date), n.reason, rs(n.taxablePaise), rs(n.cgstPaise), rs(n.sgstPaise), rs(n.igstPaise), rs(n.totalPaise), n.status]) },
    { name: "Purchase bills", note, header: ["Supplier", "GSTIN", "Bill number", "Date", "Type", "Taxable", "CGST", "SGST", "IGST", "Total", "Credit claimable", "Cancelled"], rows: purchases.map((b) => [b.supplierName, b.supplierGstin, b.number, istDay(b.date), b.kind, rs(b.taxablePaise), rs(b.cgstPaise), rs(b.sgstPaise), rs(b.igstPaise), rs(b.totalPaise), b.itcEligible ? "yes" : "no", b.voidedAt ? "yes" : ""]) },
    { name: "Expenses by category", note, header: ["Category", "Amount (₹)"], rows: [...byCat].sort((a, b) => b[1] - a[1]).map(([c, v]) => [c, rs(v)]) },
    { name: "Expenses", note, header: ["Date", "Category", "Paid by", "Amount (₹)", "Note"], rows: expenses.map((e) => [istDay(e.date), e.category, e.paymentMode, rs(e.amountPaise), e.note]) },
    { name: "Payments received", note, header: ["Date", "Customer", "Paid by", "Amount (₹)", "Note"], rows: receipts.map((e) => [istDay(e.date), e.party.name, e.paymentMode, rs(e.amountPaise), e.note]) },
    { name: "Cash sales (no bill)", note, header: ["Date", "Item", "Quantity", "Paid by", "Amount (₹)"], rows: cashSales.map((c) => [istDay(c.date), c.item, c.qtyMilli === null ? null : c.qtyMilli / 1000, c.paymentMode, rs(c.amountPaise)]) },
    { name: "Customer & supplier balances", note: `${note} · balances as on ${today}`, header: ["Name", "Type", "GSTIN", "Balance (₹)", "Dr/Cr"], rows: parties.map((p) => [p.name, p.type, p.gstin, rs(Math.abs(p.balance)), p.balance > 0 ? "Dr (owes you)" : p.balance < 0 ? "Cr (you owe)" : ""]) },
    { name: "Outstanding ageing", note: `${note} · as on ${today}`, header: ["Customer", "Owes you (₹)", "0-30 days", "31-60 days", "61-90 days", "Over 90 days"], rows: owing.map((p) => [p.name, rs(p.balance), rs(p.ageing["0-30"]), rs(p.ageing["31-60"]), rs(p.ageing["61-90"]), rs(p.ageing["90+"])]) },
    { name: "Bank statement lines", note, header: ["Date", "Description", "Money in (₹)", "Money out (₹)", "Group", "Balance (₹)"], rows: bankTxns.map((t) => [istDay(t.date), t.description, t.direction === "IN" ? rs(t.amountPaise) : null, t.direction === "OUT" ? rs(t.amountPaise) : null, t.category, rs(t.balancePaise)]) },
    { name: "Monthly profit & loss", note, header: ["Month", "Sales (before GST)", "Returns", "Cost of goods", "Shop expenses", "Profit"], rows: pls.map((p) => [p.month, rs(p.sales), rs(p.returns), rs(p.cogs), rs(p.expenses), rs(p.netProfit)]) },
    {
      name: "Monthly GST", note, header: ["Month", "Taxable sales", "GST on sales", "Credit notes (tax)", "Input credit", "Tax payable"],
      rows: gsts.map((g, i) => [months[i], rs(g.gstr3b.outward.taxable), rs(g.gstr3b.outward.cgst + g.gstr3b.outward.sgst + g.gstr3b.outward.igst), rs(g.gstr3b.creditNotes.cgst + g.gstr3b.creditNotes.sgst + g.gstr3b.creditNotes.igst), rs(g.gstr3b.itc.cgst + g.gstr3b.itc.sgst + g.gstr3b.itc.igst), rs(g.gstr3b.payable.total)]),
    },
    { name: "Items", note: `${note} · prices as on ${today}`, header: ["Item", "HSN/SAC", "Unit", "Sale price (₹)", "Purchase price (₹)", "GST %"], rows: items.map((i) => [i.name, i.hsn, i.unit, rs(i.pricePaise), rs(i.purchasePricePaise), i.taxRateBp / 100]) },
  ];
  return { sheets, tax, totals: { sales, returns, cash, turnover, gstSales, purchTotal, itc, expTotal, profit, allReceipts, digitalReceipts }, from, to, counts: { invoices: live.length, purchases: purchases.length, expenses: expenses.length } };
}
